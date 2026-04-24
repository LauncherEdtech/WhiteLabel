# api/app/services/schedule_engine.py
# Motor do cronograma inteligente e adaptativo — v12
#
# v12 — FIX DE JANELA DE AULAS (aulas não agendadas):
#   PROBLEMA: com break_minutes=0, a fórmula anterior estimava lessons/dia
#     usando apenas `budget / avg_lesson`, ignorando que a primeira aula do
#     dia também consome questões (~19 min). Resultado: estimava 4 aulas/dia
#     mas o engine real fazia 2–3 → janela de 155 dias para 617 aulas, mas
#     só 472 eram agendadas (os demais ficavam fora da lesson_window).
#   FIX: fórmula realista:
#     primeira_aula = avg + break + avg_questions + break
#     extras = floor(restante / (avg + break))
#     lessons_per_day = 1 + extras
#   Também adiciona padding para aulas oversized (force-fit ocupa dia inteiro).
#   O mesmo fix foi aplicado ao cálculo de coverage_gap para consistência.
#
# v11 — Pausa configurável pelo aluno (0–15 min) (preservado)
# v10 — Distribuição híbrida + _schedule_single_day extraído (preservado)
# v9  — Distribuição híbrida 60/40 (preservado)
# v8.3 — Solução UniqueViolation delete+generate (preservado)
# v8.1 — Badge "Aula longa" via FORCE_FIT_PREFIX (preservado)

from datetime import datetime, timezone, timedelta, date
from collections import defaultdict
from typing import Optional, List, Dict, Tuple
import math

from app.extensions import db
from app.models.user import User
from app.models.course import Course, Subject, Module, Lesson, LessonProgress
from app.models.question import QuestionAttempt
from app.models.schedule import StudySchedule, ScheduleItem, ScheduleCheckIn


FORCE_FIT_PREFIX = "[LONGA]"

_MIN_FILLER_MINUTES = 15


class ScheduleEngine:
    # break_minutes NÃO é mais constante de classe — é atributo de instância
    # lido de study_availability["break_minutes"]. Mantemos apenas como fallback
    # para código externo que ainda referencie ScheduleEngine.BREAK_MINUTES.
    BREAK_MINUTES = 0  # fallback legado — não usar em cálculos internos

    MAX_SCHEDULE_DAYS = 730
    QUESTIONS_BLOCK_MINUTES = 20
    MIN_FREE_FOR_QUESTIONS = 0
    REVIEW_MINUTES = 25
    SIMULADO_INTERVAL_LESSONS = 12
    MAX_EFFECTIVE_MINUTES = 480

    DISTRIBUTION_STRATEGY = "hybrid"
    HYBRID_LESSONS_FRACTION = 0.6

    WEAK_DISCIPLINE_MULTIPLIER = 2.5
    STRONG_DISCIPLINE_FACTOR = 0.6
    WEAK_ACCURACY_THRESHOLD = 0.60
    STRONG_ACCURACY_THRESHOLD = 0.80
    NEVER_STUDIED_MULTIPLIER = 1.8

    ADAPTIVE_MIN_ATTEMPTS = 10
    ADAPTIVE_INJECT_THRESHOLD = 0.50
    ADAPTIVE_REMOVE_THRESHOLD = 0.70
    ADAPTIVE_REVIEWS_COUNT = 2
    ADAPTIVE_DAYS_WINDOW = 7

    SPACED_REVIEW_INTERVALS = {
        "fraco": [3, 5, 10, 21],
        "regular": [5, 10, 21, 45],
        "forte": [14, 30],
    }

    QUESTIONS_MIN_MINUTES = 10
    QUESTIONS_MAX_MINUTES = 25
    REVIEW_MIN_MINUTES = 15
    REVIEW_MAX_MINUTES = 30

    def __init__(self, user_id: str, tenant_id: str, course_id: str):
        self.user_id = user_id
        self.tenant_id = tenant_id
        self.course_id = course_id

        self.user = User.query.filter_by(
            id=user_id, tenant_id=tenant_id, is_deleted=False
        ).first()
        self.course = Course.query.filter_by(
            id=course_id, tenant_id=tenant_id, is_deleted=False
        ).first()

        if not self.user or not self.course:
            raise ValueError("Usuário ou curso não encontrado.")

        avail = self.user.study_availability or {}
        self.available_days = avail.get("days", [0, 1, 2, 3, 4])
        self.hours_per_day = avail.get("hours_per_day", 2)
        self.minutes_per_day = int(self.hours_per_day * 60)

        # v11: pausa entre atividades definida pelo aluno (0–15 min, padrão 0)
        self.break_minutes = int(avail.get("break_minutes", 0))

        self.last_coverage_gap: Optional[Dict] = None

    # ─────────────────────────────────────────────────────────────────────────
    # API pública
    # ─────────────────────────────────────────────────────────────────────────

    def generate(self, target_date: Optional[str] = None) -> StudySchedule:
        active_schedule = StudySchedule.query.filter_by(
            user_id=self.user_id,
            course_id=self.course_id,
            tenant_id=self.tenant_id,
            is_deleted=False,
        ).first()

        if active_schedule:
            if target_date:
                active_schedule.target_date = target_date
            return self.reorganize(active_schedule)

        deleted_schedule = StudySchedule.query.filter_by(
            user_id=self.user_id,
            course_id=self.course_id,
            tenant_id=self.tenant_id,
            is_deleted=True,
        ).first()

        if deleted_schedule:
            now_iso = datetime.now(timezone.utc).isoformat()
            ScheduleItem.query.filter_by(schedule_id=deleted_schedule.id).update(
                {"is_deleted": True, "deleted_at": now_iso},
                synchronize_session=False,
            )
            deleted_schedule.is_deleted = False
            deleted_schedule.deleted_at = None
            deleted_schedule.status = "active"
            deleted_schedule.source_type = "ai"
            deleted_schedule.template_id = None
            deleted_schedule.target_date = target_date
            deleted_schedule.availability_snapshot = {
                "days": self.available_days,
                "hours_per_day": self.hours_per_day,
                "break_minutes": self.break_minutes,
            }
            deleted_schedule.last_reorganized_at = now_iso
            deleted_schedule.abandonment_risk_score = 0.0
            deleted_schedule.ai_notes = None
            db.session.flush()
            self._build_items(deleted_schedule, start_date=date.today())
            db.session.commit()
            return deleted_schedule

        from sqlalchemy.exc import IntegrityError

        schedule = StudySchedule(
            tenant_id=self.tenant_id,
            user_id=self.user_id,
            course_id=self.course_id,
            status="active",
            source_type="ai",
            target_date=target_date,
            availability_snapshot={
                "days": self.available_days,
                "hours_per_day": self.hours_per_day,
                "break_minutes": self.break_minutes,
            },
            last_reorganized_at=datetime.now(timezone.utc).isoformat(),
        )
        db.session.add(schedule)
        try:
            db.session.flush()
        except IntegrityError:
            # Race condition: outro worker criou o cronograma antes
            db.session.rollback()
            existing = StudySchedule.query.filter_by(
                user_id=self.user_id,
                course_id=self.course_id,
                tenant_id=self.tenant_id,
                is_deleted=False,
            ).first()
            if existing:
                return self.reorganize(existing)
            raise
        self._build_items(schedule, start_date=date.today())
        db.session.commit()
        return schedule

    def reorganize(self, schedule: Optional[StudySchedule] = None) -> StudySchedule:
        if not schedule:
            schedule = StudySchedule.query.filter_by(
                user_id=self.user_id,
                course_id=self.course_id,
                tenant_id=self.tenant_id,
                is_deleted=False,
            ).first()
            if not schedule:
                return self.generate()

        tomorrow = date.today() + timedelta(days=1)
        ScheduleItem.query.filter(
            ScheduleItem.schedule_id == schedule.id,
            ScheduleItem.scheduled_date >= tomorrow.isoformat(),
            ScheduleItem.status == "pending",
            ScheduleItem.is_deleted == False,
        ).update(
            {"is_deleted": True, "deleted_at": datetime.now(timezone.utc).isoformat()},
            synchronize_session="fetch",
        )

        schedule.status = "active"
        schedule.last_reorganized_at = datetime.now(timezone.utc).isoformat()
        schedule.availability_snapshot = {
            "days": self.available_days,
            "hours_per_day": self.hours_per_day,
            "break_minutes": self.break_minutes,
        }
        db.session.flush()
        self._build_items(schedule, start_date=tomorrow)
        db.session.commit()
        return schedule

    def adapt_after_checkin(self, item_id: str) -> bool:
        schedule = StudySchedule.query.filter_by(
            user_id=self.user_id,
            course_id=self.course_id,
            tenant_id=self.tenant_id,
            is_deleted=False,
        ).first()
        if not schedule:
            return False

        today_str = date.today().isoformat()
        overdue = ScheduleItem.query.filter(
            ScheduleItem.schedule_id == schedule.id,
            ScheduleItem.scheduled_date < today_str,
            ScheduleItem.status == "pending",
            ScheduleItem.is_deleted == False,
        ).count()

        recent_skipped = (
            ScheduleItem.query.filter(
                ScheduleItem.schedule_id == schedule.id,
                ScheduleItem.status == "skipped",
                ScheduleItem.is_deleted == False,
            )
            .order_by(ScheduleItem.scheduled_date.desc())
            .limit(5)
            .all()
        )

        if overdue >= 4 or len(recent_skipped) >= 3:
            self.reorganize(schedule)
            schedule.abandonment_risk_score = self.calculate_abandonment_risk()
            db.session.commit()
            return True

        schedule.abandonment_risk_score = self.calculate_abandonment_risk()
        db.session.commit()
        return False

    # ─────────────────────────────────────────────────────────────────────────
    # Adaptação reativa
    # ─────────────────────────────────────────────────────────────────────────

    def inject_subject_reviews(self, subject_id, count=None, days_window=None):
        count = count if count is not None else self.ADAPTIVE_REVIEWS_COUNT
        days_window = days_window if days_window is not None else self.ADAPTIVE_DAYS_WINDOW

        schedule = StudySchedule.query.filter_by(
            user_id=self.user_id, course_id=self.course_id, tenant_id=self.tenant_id,
            status="active", is_deleted=False,
        ).first()
        if not schedule:
            return 0

        subject = Subject.query.filter_by(
            id=subject_id, tenant_id=self.tenant_id, is_deleted=False
        ).first()
        if not subject:
            return 0

        today = date.today()
        window_end = today + timedelta(days=days_window)

        existing_items = ScheduleItem.query.filter(
            ScheduleItem.schedule_id == schedule.id,
            ScheduleItem.scheduled_date >= today.isoformat(),
            ScheduleItem.scheduled_date <= window_end.isoformat(),
            ScheduleItem.is_deleted == False,
        ).all()

        already_adaptive = [
            i for i in existing_items
            if (i.subject_id == subject_id and i.item_type == "review"
                and i.status == "pending" and i.question_filters
                and i.question_filters.get("_adaptive") is True)
        ]
        needed = count - len(already_adaptive)
        if needed <= 0:
            return 0

        used_minutes: Dict[date, int] = defaultdict(int)
        for item in existing_items:
            if item.status != "pending":
                continue
            try:
                item_date = date.fromisoformat(item.scheduled_date)
                used_minutes[item_date] += item.estimated_minutes + self.break_minutes
            except ValueError:
                pass

        review_dates_with_subject = {
            i.scheduled_date for i in existing_items
            if (i.subject_id == subject_id and i.item_type == "review" and i.status == "pending")
        }

        slots = self._generate_day_slots(today + timedelta(days=1), max_days=days_window)
        accuracy = self._get_subject_accuracy(subject_id)
        inserted = 0
        new_items = []
        budget = min(self.minutes_per_day, self.MAX_EFFECTIVE_MINUTES)

        for slot_date in slots:
            if inserted >= needed:
                break
            slot_str = slot_date.isoformat()
            if slot_str in review_dates_with_subject:
                continue
            free = budget - used_minutes[slot_date]
            if free < self.REVIEW_MINUTES + self.break_minutes:
                continue

            new_items.append(ScheduleItem(
                tenant_id=self.tenant_id, schedule_id=schedule.id,
                item_type="review", subject_id=subject_id,
                scheduled_date=slot_str, order=98,
                estimated_minutes=self.REVIEW_MINUTES,
                priority_reason=f"Revisão adaptativa: {subject.name} — acerto {round(accuracy * 100)}% (abaixo de 50%)",
                status="pending",
                question_filters={"_adaptive": True},
            ))
            used_minutes[slot_date] += self.REVIEW_MINUTES + self.break_minutes
            review_dates_with_subject.add(slot_str)
            inserted += 1

        if new_items:
            db.session.bulk_save_objects(new_items)
            db.session.commit()

        return inserted

    def remove_excess_reviews(self, subject_id):
        schedule = StudySchedule.query.filter_by(
            user_id=self.user_id, course_id=self.course_id, tenant_id=self.tenant_id,
            status="active", is_deleted=False,
        ).first()
        if not schedule:
            return 0

        today_str = date.today().isoformat()
        pending_reviews = ScheduleItem.query.filter(
            ScheduleItem.schedule_id == schedule.id,
            ScheduleItem.subject_id == subject_id,
            ScheduleItem.item_type == "review",
            ScheduleItem.status == "pending",
            ScheduleItem.scheduled_date >= today_str,
            ScheduleItem.is_deleted == False,
        ).all()

        adaptive_items = [
            item for item in pending_reviews
            if item.question_filters and item.question_filters.get("_adaptive") is True
        ]

        removed = 0
        for item in adaptive_items:
            item.soft_delete()
            removed += 1

        if removed > 0:
            db.session.commit()
        return removed

    def _get_subject_accuracy(self, subject_id):
        from sqlalchemy import func, case as sql_case
        from app.models.question import Question

        row = (
            db.session.query(
                func.count(QuestionAttempt.id).label("total"),
                func.sum(sql_case((QuestionAttempt.is_correct == True, 1), else_=0)).label("correct"),
            )
            .filter_by(user_id=self.user_id, tenant_id=self.tenant_id, is_deleted=False)
            .join(Question)
            .filter_by(subject_id=subject_id)
            .one()
        )
        total = row.total or 0
        if total == 0:
            return 0.0
        return (row.correct or 0) / total

    def _all_lessons_completed(self):
        total = (
            Lesson.query.join(Module, Lesson.module_id == Module.id)
            .join(Subject, Module.subject_id == Subject.id)
            .filter(
                Subject.course_id == self.course_id,
                Subject.tenant_id == self.tenant_id,
                Lesson.is_published == True,
                Lesson.is_deleted == False,
                Module.is_deleted == False,
                Subject.is_deleted == False,
            )
            .count()
        )
        if total == 0:
            return False

        watched = (
            LessonProgress.query.join(Lesson, LessonProgress.lesson_id == Lesson.id)
            .join(Module, Lesson.module_id == Module.id)
            .join(Subject, Module.subject_id == Subject.id)
            .filter(
                LessonProgress.user_id == self.user_id,
                LessonProgress.tenant_id == self.tenant_id,
                LessonProgress.status == "watched",
                Subject.course_id == self.course_id,
                Subject.tenant_id == self.tenant_id,
                Lesson.is_published == True,
                Lesson.is_deleted == False,
                Module.is_deleted == False,
                Subject.is_deleted == False,
            )
            .count()
        )
        return watched >= total

    def calculate_abandonment_risk(self):
        from sqlalchemy import func, case as sql_case

        risk = 0.0
        qa_row = (
            db.session.query(
                func.max(QuestionAttempt.created_at).label("last_attempt"),
                func.count(QuestionAttempt.id).label("total"),
                func.sum(sql_case((QuestionAttempt.is_correct == True, 1), else_=0)).label("correct"),
            )
            .filter_by(user_id=self.user_id, tenant_id=self.tenant_id, is_deleted=False)
            .one()
        )

        if not qa_row.last_attempt:
            risk += 0.4
        else:
            created_at = qa_row.last_attempt
            if created_at.tzinfo is None:
                created_at = created_at.replace(tzinfo=timezone.utc)
            days_inactive = (datetime.now(timezone.utc) - created_at).days
            risk += (
                0.4 if days_inactive >= 14
                else 0.25 if days_inactive >= 7
                else 0.1 if days_inactive >= 3 else 0
            )

        total = qa_row.total or 0
        if total >= 10:
            correct = qa_row.correct or 0
            accuracy = correct / total
            risk += 0.3 if accuracy < 0.3 else 0.15 if accuracy < 0.4 else 0

        schedule = StudySchedule.query.filter_by(
            user_id=self.user_id, course_id=self.course_id, tenant_id=self.tenant_id,
            is_deleted=False,
        ).first()

        if schedule:
            today_str = date.today().isoformat()
            overdue = ScheduleItem.query.filter(
                ScheduleItem.schedule_id == schedule.id,
                ScheduleItem.scheduled_date < today_str,
                ScheduleItem.status == "pending",
                ScheduleItem.is_deleted == False,
            ).count()
            risk += 0.3 if overdue >= 10 else 0.2 if overdue >= 5 else 0.1 if overdue >= 2 else 0

        return round(min(risk, 1.0), 2)

    # ─────────────────────────────────────────────────────────────────────────
    # Janela de aulas — v11
    # ─────────────────────────────────────────────────────────────────────────

    def _calculate_lessons_window(
        self,
        total_lessons: int,
        available_days: int,
        effective_minutes: int,
        avg_lesson_minutes: float = 40.0,
        lesson_durations: Optional[List[int]] = None,
    ) -> int:
        """
        Calcula quantos dias serão usados para aulas.

        v12 FIX — fórmula realista de aulas/dia:
          A versão anterior usava apenas `avg_lesson / budget`, ignorando que
          a primeira aula do dia também consome um bloco de questões. Isso
          causava janelas 2x menores que o necessário (ex: estimava 4 aulas/dia
          mas a realidade era 2–3 aulas/dia), deixando 100+ aulas sem slot.

          Fórmula correta:
            primeira aula = avg_lesson + break + avg_questions + break
            aulas extras   = floor(restante / (avg_lesson + break))
            lessons_per_day = 1 + aulas_extras

          Também adiciona padding para aulas oversized (force-fit): cada aula
          maior que o budget ocupa um dia inteiro mas rende apenas 1 aula,
          "desperdiçando" (lessons_per_day - 1) slots extras.
        """
        avg_questions = self._calculate_questions_minutes(int(avg_lesson_minutes))

        # Custo real por aula: duração + pausa + questões + pausa
        # Tanto a primeira quanto as extras têm questões — usar custo uniforme.
        # v12 FIX: versão anterior usava cost_extra = avg_lesson + break apenas,
        # ignorando questões nas aulas extras → superestimava lessons/dia (3 em
        # vez de 2), gerando janela muito curta e deixando 100+ aulas sem slot.
        cost_per_lesson_full = (avg_lesson_minutes + self.break_minutes
                                + avg_questions + self.break_minutes)
        cost_per_lesson_full = max(cost_per_lesson_full, 1)
        lessons_per_day_max = max(1, int(effective_minutes / cost_per_lesson_full))

        days_needed_concentrated = math.ceil(total_lessons / lessons_per_day_max)

        # Padding para aulas oversized: force-fit ocupa o dia inteiro (1 aula),
        # mas o estimador contaria lessons_per_day_max aulas naquele dia.
        if lesson_durations and lessons_per_day_max > 1:
            oversized = sum(1 for d in lesson_durations if d > effective_minutes)
            if oversized > 0:
                days_needed_concentrated += oversized * (lessons_per_day_max - 1)

        if self.DISTRIBUTION_STRATEGY == "concentrated":
            return min(days_needed_concentrated, available_days)
        if self.DISTRIBUTION_STRATEGY == "stretched":
            return available_days

        # hybrid
        target_window = min(days_needed_concentrated, available_days)
        max_lessons_window = available_days - max(7, int(available_days * 0.05))
        return min(target_window, max(max_lessons_window, days_needed_concentrated))

    # ─────────────────────────────────────────────────────────────────────────
    # Construção do cronograma — v11
    # ─────────────────────────────────────────────────────────────────────────

    def _build_items(self, schedule: StudySchedule, start_date: date):
        priority_map = self._calculate_subject_priorities()
        pending_lessons = self._get_pending_lessons()

        if not pending_lessons:
            schedule.ai_notes = "Todas as aulas já foram assistidas. Foco em revisão e simulados."
            self._add_review_only_plan(schedule, priority_map, start_date)
            return

        if schedule.target_date:
            try:
                target = date.fromisoformat(schedule.target_date)
                days_until_exam = max(1, (target - start_date).days)
                all_slots = self._generate_day_slots(start_date, max_days=days_until_exam)
            except ValueError:
                all_slots = self._generate_day_slots(start_date)
        else:
            all_slots = self._generate_day_slots(start_date)

        if not all_slots:
            return

        effective_minutes = min(self.minutes_per_day, self.MAX_EFFECTIVE_MINUTES)

        lesson_durations = [max(l.duration_minutes or 30, 15) for l in pending_lessons]
        avg_lesson_real = sum(lesson_durations) / max(1, len(lesson_durations))

        # coverage_gap: usa mesma fórmula de _calculate_lessons_window (custo uniforme)
        avg_questions_real = self._calculate_questions_minutes(int(avg_lesson_real))
        cost_per_lesson_full_real = (avg_lesson_real + self.break_minutes
                                     + avg_questions_real + self.break_minutes)
        cost_per_lesson_full_real = max(cost_per_lesson_full_real, 1)
        lessons_per_day_capacity = max(1, int(effective_minutes / cost_per_lesson_full_real))
        max_lessons_in_window = len(all_slots) * lessons_per_day_capacity

        coverage_gap = None
        if max_lessons_in_window < len(pending_lessons) and schedule.target_date:
            total_minutes_needed = len(pending_lessons) * cost_per_lesson_real
            hours_needed_per_day = total_minutes_needed / (len(all_slots) * 60)
            suggested_hours = round(hours_needed_per_day * 2) / 2
            if suggested_hours <= self.hours_per_day:
                suggested_hours = self.hours_per_day + 0.5
            suggested_hours = min(suggested_hours, 8.0)

            coverage_gap = {
                "will_cover_lessons": max_lessons_in_window,
                "total_lessons": len(pending_lessons),
                "coverage_percent": round((max_lessons_in_window / len(pending_lessons)) * 100, 1),
                "suggested_hours_per_day": suggested_hours,
                "current_hours_per_day": self.hours_per_day,
                "days_until_exam": len(all_slots),
            }

        self.last_coverage_gap = coverage_gap

        snapshot = dict(schedule.availability_snapshot or {})
        snapshot["days"] = self.available_days
        snapshot["hours_per_day"] = self.hours_per_day
        snapshot["break_minutes"] = self.break_minutes
        if coverage_gap:
            snapshot["coverage_gap"] = coverage_gap
        else:
            snapshot.pop("coverage_gap", None)
        schedule.availability_snapshot = snapshot

        lessons_window_days = self._calculate_lessons_window(
            total_lessons=len(pending_lessons),
            available_days=len(all_slots),
            effective_minutes=effective_minutes,
            avg_lesson_minutes=avg_lesson_real,
            lesson_durations=lesson_durations,  # v12: para padding de force-fits
        )
        lesson_slots = all_slots[:lessons_window_days]
        review_only_slots = all_slots[lessons_window_days:]

        if not schedule.target_date and len(review_only_slots) > 90:
            review_only_slots = review_only_slots[:90]

        # Pre-load
        module_ids = {l.module_id for l in pending_lessons if l.module_id}
        modules_by_id: Dict[str, Module] = (
            {m.id: m for m in Module.query.filter(Module.id.in_(module_ids)).all()}
            if module_ids else {}
        )
        subject_ids_bulk = {m.subject_id for m in modules_by_id.values() if m.subject_id}
        subjects_by_id: Dict[str, Subject] = (
            {s.id: s for s in Subject.query.filter(Subject.id.in_(subject_ids_bulk)).all()}
            if subject_ids_bulk else {}
        )

        lessons_by_subject: Dict[str, List] = defaultdict(list)
        subject_map: Dict[str, Subject] = {}

        for lesson in pending_lessons:
            module = modules_by_id.get(lesson.module_id)
            subject = subjects_by_id.get(module.subject_id) if module else None
            sid = subject.id if subject else "__no_subject__"
            lessons_by_subject[sid].append(lesson)
            if subject:
                subject_map[sid] = subject

        def _sort_key(sid):
            s = subject_map.get(sid)
            return (-priority_map.get(sid, 1.0), (s.order or 0) if s else 999)

        subject_ids_ordered = sorted(lessons_by_subject.keys(), key=_sort_key)
        queues: Dict[str, List] = {
            sid: list(lessons_by_subject[sid]) for sid in subject_ids_ordered
        }

        items_to_add: List[ScheduleItem] = []
        lessons_added = 0
        simulado_days: set = set()
        used_minutes_tracker: Dict[date, int] = defaultdict(int)

        rotation_offset = 0  # v12: persiste entre dias para distribuicao uniforme

        for slot_idx, slot_date in enumerate(lesson_slots):
            if not any(queues.get(sid) for sid in subject_ids_ordered):
                break

            day_items, day_minutes, day_lessons_count, rotation_offset = self._schedule_single_day(
                slot_str=slot_date.isoformat(),
                queues=queues,
                subject_ids_ordered=subject_ids_ordered,
                subject_map=subject_map,
                priority_map=priority_map,
                effective_minutes=effective_minutes,
                tenant_id=self.tenant_id,
                schedule_id=schedule.id,
                rotation_offset=rotation_offset,
            )

            items_to_add.extend(day_items)
            used_minutes_tracker[slot_date] = day_minutes
            lessons_added += day_lessons_count

            if day_lessons_count > 0 and lessons_added % self.SIMULADO_INTERVAL_LESSONS == 0:
                next_idx = slot_idx + 1
                if next_idx < len(lesson_slots):
                    sim_date_str = lesson_slots[next_idx].isoformat()
                    if sim_date_str not in simulado_days:
                        items_to_add.append(ScheduleItem(
                            tenant_id=self.tenant_id, schedule_id=schedule.id,
                            item_type="simulado", scheduled_date=sim_date_str,
                            order=0, estimated_minutes=90,
                            priority_reason=f"Simulado após {lessons_added} aulas",
                            status="pending",
                        ))
                        simulado_days.add(sim_date_str)

        if review_only_slots and len(review_only_slots) >= 5:
            for i, slot_date in enumerate(review_only_slots):
                if i % 7 == 0:
                    slot_str = slot_date.isoformat()
                    if slot_str not in simulado_days:
                        items_to_add.append(ScheduleItem(
                            tenant_id=self.tenant_id, schedule_id=schedule.id,
                            item_type="simulado", scheduled_date=slot_str,
                            order=0, estimated_minutes=90,
                            priority_reason="Simulado de revisão — reta final",
                            status="pending",
                        ))
                        simulado_days.add(slot_str)

        self._add_spaced_reviews(
            schedule, all_slots, used_minutes_tracker,
            priority_map, items_to_add, effective_minutes,
        )

        if items_to_add:
            db.session.bulk_save_objects(items_to_add)

        weak_names = [
            subject_map[sid].name for sid in subject_ids_ordered[:3]
            if sid in subject_map and priority_map.get(sid, 1.0) >= 1.5
        ]

        coverage_warning = ""
        if coverage_gap:
            coverage_warning = (
                f" ⚠️ Atenção: com {coverage_gap['current_hours_per_day']}h/dia, "
                f"você cobrirá apenas {coverage_gap['will_cover_lessons']} de "
                f"{coverage_gap['total_lessons']} aulas até a prova "
                f"({coverage_gap['coverage_percent']}%). "
                f"Para cobrir tudo, considere {coverage_gap['suggested_hours_per_day']}h/dia."
            )

        if lesson_slots and lessons_added > 0:
            actual_days_used = len(used_minutes_tracker)
            first_lesson_day = lesson_slots[0]
            last_used_date = max(used_minutes_tracker.keys()) if used_minutes_tracker else first_lesson_day
            calendar_days_window = (last_used_date - first_lesson_day).days + 1
            months_approx = calendar_days_window / 30.0

            if months_approx < 1.5:
                period_str = f"{calendar_days_window} dias"
            elif months_approx < 24:
                period_str = f"~{round(months_approx)} meses"
            else:
                period_str = f"~{months_approx / 12:.1f} anos"

            actual_avg = lessons_added / max(1, actual_days_used)
            window_info = (
                f" Aulas distribuídas em {actual_days_used} dias úteis "
                f"({period_str}, ~{actual_avg:.1f} aulas/dia em média)."
            )
        else:
            window_info = ""

        review_info = ""
        if self.DISTRIBUTION_STRATEGY == "hybrid" and review_only_slots:
            review_info = (
                f" Últimos {len(review_only_slots)} dias úteis reservados "
                f"para revisão e simulados (reta final)."
            )

        break_info = f" Pausa entre atividades: {self.break_minutes} min." if self.break_minutes > 0 else ""

        schedule.ai_notes = (
            f"Cronograma gerado com {lessons_added} aulas.{coverage_warning}{window_info}{review_info}{break_info} "
            f"Disciplinas priorizadas: {', '.join(weak_names) or 'distribuição equilibrada'}. "
            f"Carga diária: {self.hours_per_day}h."
        )

    # ─────────────────────────────────────────────────────────────────────────
    # Agendamento de um único dia — v12 (rotation_offset global)
    # ─────────────────────────────────────────────────────────────────────────

    def _schedule_single_day(
        self,
        slot_str: str,
        queues: Dict[str, List],
        subject_ids_ordered: List[str],
        subject_map: Dict[str, Subject],
        priority_map: Dict[str, float],
        effective_minutes: int,
        tenant_id: str,
        schedule_id: str,
        rotation_offset: int = 0,
    ) -> Tuple[List[ScheduleItem], int, int, int]:
        items: List[ScheduleItem] = []
        day_used = 0
        order = 0
        day_subjects_used: List[str] = []
        lessons_count = 0

        active_subjects = [sid for sid in subject_ids_ordered if queues.get(sid)]
        if not active_subjects:
            return items, day_used, lessons_count, rotation_offset

        # Force-fit: aula maior que o budget inteiro
        first_sid = active_subjects[rotation_offset % len(active_subjects)]
        if queues[first_sid]:
            first_lesson = queues[first_sid][0]
            first_dur = max(first_lesson.duration_minutes or 30, 15)
            if first_dur > effective_minutes:
                queues[first_sid].pop(0)
                subject = subject_map.get(first_sid)
                priority = priority_map.get(first_sid, 1.0)
                day_used, order = self._add_lesson_with_questions(
                    items, slot_str, first_lesson, first_dur, first_sid, subject,
                    priority, day_used, order, tenant_id, schedule_id,
                    effective_minutes, is_long_lesson=True,
                )
                lessons_count += 1
                next_offset = (rotation_offset + 1) % max(1, len(subject_ids_ordered))
                return items, day_used, lessons_count, next_offset

        # Round-robin comecando no offset do dia anterior
        rotation = rotation_offset % len(active_subjects)
        skips_in_round = 0

        while True:
            active_subjects = [sid for sid in active_subjects if queues.get(sid)]
            if not active_subjects:
                break

            remaining = effective_minutes - day_used
            if remaining < _MIN_FILLER_MINUTES:
                break

            if rotation >= len(active_subjects):
                rotation = 0

            if skips_in_round >= len(active_subjects):
                found = self._find_short_lesson(active_subjects, queues, remaining)
                if found is None:
                    break
                sid, lesson_idx = found
                lesson = queues[sid].pop(lesson_idx)
                dur = max(lesson.duration_minutes or 30, 15)
                subject = subject_map.get(sid)
                priority = priority_map.get(sid, 1.0)
                day_used, order = self._add_lesson_with_questions(
                    items, slot_str, lesson, dur, sid, subject,
                    priority, day_used, order, tenant_id, schedule_id,
                    effective_minutes, is_long_lesson=False,
                )
                if sid not in day_subjects_used:
                    day_subjects_used.append(sid)
                lessons_count += 1
                skips_in_round = 0
                rotation = 0
                continue

            sid = active_subjects[rotation]
            if not queues.get(sid):
                rotation += 1
                skips_in_round += 1
                continue

            lesson = queues[sid][0]
            dur = max(lesson.duration_minutes or 30, 15)

            if dur <= remaining:
                queues[sid].pop(0)
                subject = subject_map.get(sid)
                priority = priority_map.get(sid, 1.0)
                day_used, order = self._add_lesson_with_questions(
                    items, slot_str, lesson, dur, sid, subject,
                    priority, day_used, order, tenant_id, schedule_id,
                    effective_minutes, is_long_lesson=False,
                )
                if sid not in day_subjects_used:
                    day_subjects_used.append(sid)
                lessons_count += 1
                skips_in_round = 0
                rotation += 1
            else:
                skips_in_round += 1
                rotation += 1

        # Preenche tempo livre residual
        day_used, order = self._fill_day_remainder(
            items=items, slot_str=slot_str,
            day_subjects_used=day_subjects_used,
            subject_map=subject_map, priority_map=priority_map,
            day_used=day_used, order=order,
            effective_minutes=effective_minutes,
            tenant_id=tenant_id, schedule_id=schedule_id,
        )

        next_offset = (rotation_offset + lessons_count) % max(1, len(subject_ids_ordered))
        return items, day_used, lessons_count, next_offset

    def _find_short_lesson(
        self,
        active_subjects: List[str],
        queues: Dict[str, List],
        remaining: int,
        look_ahead: int = 10,
    ) -> Optional[Tuple[str, int]]:
        for sid in active_subjects:
            queue = queues.get(sid, [])
            for idx, candidate in enumerate(queue[:look_ahead]):
                cdur = max(candidate.duration_minutes or 30, 15)
                if cdur <= remaining:
                    return sid, idx
        return None

    def _fill_day_remainder(
        self,
        items: List[ScheduleItem],
        slot_str: str,
        day_subjects_used: List[str],
        subject_map: Dict[str, Subject],
        priority_map: Dict[str, float],
        day_used: int,
        order: int,
        effective_minutes: int,
        tenant_id: str,
        schedule_id: str,
    ) -> Tuple[int, int]:
        remaining = effective_minutes - day_used

        if remaining < _MIN_FILLER_MINUTES:
            return day_used, order

        if not day_subjects_used:
            return day_used, order

        weakest_sid = max(day_subjects_used, key=lambda sid: priority_map.get(sid, 1.0))
        subject = subject_map.get(weakest_sid)
        if not subject:
            return day_used, order

        filler_min = min(remaining, self.REVIEW_MAX_MINUTES)

        items.append(ScheduleItem(
            tenant_id=tenant_id, schedule_id=schedule_id,
            item_type="review", subject_id=weakest_sid,
            scheduled_date=slot_str, order=order,
            estimated_minutes=filler_min,
            priority_reason=f"Revisão de fixação: {subject.name}",
            status="pending",
        ))
        day_used += filler_min + self.break_minutes
        order += 1

        return day_used, order

    # ─────────────────────────────────────────────────────────────────────────
    # Helpers
    # ─────────────────────────────────────────────────────────────────────────

    def _calculate_questions_minutes(self, lesson_minutes: int) -> int:
        proportional = self.QUESTIONS_MIN_MINUTES + (lesson_minutes * 0.3)
        return int(min(self.QUESTIONS_MAX_MINUTES, max(self.QUESTIONS_MIN_MINUTES, proportional)))

    def _calculate_review_minutes(self, accuracy: float) -> int:
        proportional = self.REVIEW_MIN_MINUTES + ((1.0 - accuracy) * 15)
        return int(min(self.REVIEW_MAX_MINUTES, max(self.REVIEW_MIN_MINUTES, proportional)))

    def _add_review_only_plan(self, schedule, priority_map, start_date):
        slots = self._generate_day_slots(start_date)
        top_ids = [sid for sid, _ in sorted(priority_map.items(), key=lambda x: x[1], reverse=True)[:5]]
        subjects_map = (
            {s.id: s for s in Subject.query.filter(Subject.id.in_(top_ids)).all()}
            if top_ids else {}
        )
        items = []
        for i, (sid, _) in enumerate(sorted(priority_map.items(), key=lambda x: x[1], reverse=True)[:5]):
            if i >= len(slots):
                break
            subject = subjects_map.get(sid)
            if not subject:
                continue
            items += [
                ScheduleItem(
                    tenant_id=self.tenant_id, schedule_id=schedule.id,
                    item_type="review", subject_id=sid,
                    scheduled_date=slots[i].isoformat(), order=0,
                    estimated_minutes=45, priority_reason=f"Revisão: {subject.name}",
                    status="pending",
                ),
                ScheduleItem(
                    tenant_id=self.tenant_id, schedule_id=schedule.id,
                    item_type="questions", subject_id=sid,
                    scheduled_date=slots[i].isoformat(), order=1,
                    estimated_minutes=30, priority_reason=f"Fixação: {subject.name}",
                    status="pending",
                ),
            ]
        if items:
            db.session.bulk_save_objects(items)

    def _add_lesson_with_questions(
        self,
        items_to_add: List[ScheduleItem],
        slot_str: str,
        lesson,
        lesson_dur: int,
        subject_id: str,
        subject: Optional[Subject],
        priority: float,
        day_used: int,
        day_order: int,
        tenant_id: str,
        schedule_id: str,
        effective_minutes: int,
        is_long_lesson: bool = False,
    ) -> Tuple[int, int]:
        base_reason = self._build_priority_reason(subject, priority)
        priority_reason = f"{FORCE_FIT_PREFIX} {base_reason}" if is_long_lesson else base_reason

        items_to_add.append(ScheduleItem(
            tenant_id=tenant_id, schedule_id=schedule_id,
            item_type="lesson", lesson_id=lesson.id,
            subject_id=subject_id if subject_id != "__no_subject__" else None,
            scheduled_date=slot_str, order=day_order,
            estimated_minutes=lesson_dur,
            priority_reason=priority_reason,
            status="pending",
        ))
        day_used += lesson_dur + self.break_minutes
        day_order += 1

        if not subject or subject_id == "__no_subject__":
            return day_used, day_order

        questions_minutes = self._calculate_questions_minutes(lesson_dur)
        questions_cost = questions_minutes + self.break_minutes

        if is_long_lesson:
            # v13 FIX: force-fit sempre adiciona questões obrigatórias (mín. 10 min)
            # independente do budget — fixação após aula longa é inegociável.
            forced_minutes = self.QUESTIONS_MIN_MINUTES
            items_to_add.append(ScheduleItem(
                tenant_id=tenant_id, schedule_id=schedule_id,
                item_type="questions", subject_id=subject_id,
                scheduled_date=slot_str, order=day_order,
                estimated_minutes=forced_minutes,
                priority_reason=f"Fixação obrigatória: {subject.name} (após aula longa)",
                status="pending",
            ))
            day_used += forced_minutes + self.break_minutes
            day_order += 1
        elif day_used + questions_cost <= effective_minutes:
            # Aula normal: questões só se couber no budget
            items_to_add.append(ScheduleItem(
                tenant_id=tenant_id, schedule_id=schedule_id,
                item_type="questions", subject_id=subject_id,
                scheduled_date=slot_str, order=day_order,
                estimated_minutes=questions_minutes,
                priority_reason=f"Fixação: {subject.name}",
                status="pending",
            ))
            day_used += questions_cost
            day_order += 1

        return day_used, day_order

    def _add_spaced_reviews(
        self,
        schedule: StudySchedule,
        slots: List[date],
        used_minutes: Dict[date, int],
        priority_map: Dict[str, float],
        items_to_add: List[ScheduleItem],
        effective_minutes: int = None,
    ):
        if effective_minutes is None:
            effective_minutes = self.minutes_per_day

        subjects = Subject.query.filter_by(
            course_id=self.course_id, tenant_id=self.tenant_id, is_deleted=False,
        ).all()

        today = date.today()
        reviews_per_day: Dict[str, int] = defaultdict(int)
        items_to_add_set = {
            (i.subject_id, i.scheduled_date) for i in items_to_add
            if i.item_type == "review"
        }

        from sqlalchemy import func, case as sql_case
        from app.models.question import Question

        subject_ids = [s.id for s in subjects]

        accuracy_stats = (
            db.session.query(
                Question.subject_id,
                func.count(QuestionAttempt.id).label("total"),
                func.sum(sql_case((QuestionAttempt.is_correct == True, 1), else_=0)).label("correct"),
            )
            .join(Question)
            .filter(
                QuestionAttempt.user_id == self.user_id,
                QuestionAttempt.tenant_id == self.tenant_id,
                QuestionAttempt.is_deleted == False,
                Question.subject_id.in_(subject_ids),
            )
            .group_by(Question.subject_id)
            .all()
        )

        accuracy_map = {
            row[0]: (row[2] or 0) / row[1] if row[1] > 0 else 0.0
            for row in accuracy_stats
        }

        last_items_rows = (
            db.session.query(
                ScheduleItem.subject_id,
                func.max(ScheduleItem.scheduled_date).label("last_date"),
            )
            .filter(
                ScheduleItem.schedule_id == schedule.id,
                ScheduleItem.subject_id.in_(subject_ids),
                ScheduleItem.item_type.in_(["lesson", "questions"]),
                ScheduleItem.is_deleted == False,
            )
            .group_by(ScheduleItem.subject_id)
            .all()
        )

        last_dates = {row[0]: row[1] for row in last_items_rows}

        for subject in subjects:
            accuracy = accuracy_map.get(subject.id, 0.0)
            total_attempts = next((row[1] for row in accuracy_stats if row[0] == subject.id), 0)

            if total_attempts == 0:
                continue
            if total_attempts < self.ADAPTIVE_MIN_ATTEMPTS:
                continue
            if accuracy >= self.ADAPTIVE_INJECT_THRESHOLD:
                continue

            review_minutes = self._calculate_review_minutes(accuracy)
            needed = review_minutes + self.break_minutes

            last_date_str = last_dates.get(subject.id)
            if last_date_str:
                try:
                    last_date = date.fromisoformat(last_date_str)
                    earliest = last_date + timedelta(days=1)
                    latest = last_date + timedelta(days=7)
                except ValueError:
                    continue
            else:
                earliest = today
                latest = today + timedelta(days=7)

            for slot in slots:
                if slot < earliest or slot > latest:
                    continue
                slot_str = slot.isoformat()
                if (subject.id, slot_str) in items_to_add_set:
                    continue
                if reviews_per_day[slot_str] >= 2:
                    continue
                if used_minutes.get(slot, 0) + needed > effective_minutes:
                    continue

                items_to_add.append(ScheduleItem(
                    tenant_id=self.tenant_id, schedule_id=schedule.id,
                    item_type="review", subject_id=subject.id,
                    scheduled_date=slot_str, order=50,
                    estimated_minutes=review_minutes,
                    priority_reason=(
                        f"Revisão adaptativa: {subject.name} "
                        f"— acerto {round(accuracy * 100)}% (abaixo de 50%)"
                    ),
                    status="pending",
                ))
                used_minutes[slot] = used_minutes.get(slot, 0) + needed
                reviews_per_day[slot_str] += 1
                items_to_add_set.add((subject.id, slot_str))
                break

    def _calculate_subject_priorities(self) -> Dict[str, float]:
        from sqlalchemy import func, case as sql_case
        from app.models.question import Question

        subjects = (
            Subject.query.filter_by(
                course_id=self.course_id, tenant_id=self.tenant_id, is_deleted=False,
            )
            .order_by(Subject.order)
            .all()
        )

        subject_ids = [s.id for s in subjects]
        stats_rows = (
            db.session.query(
                Question.subject_id,
                func.count(QuestionAttempt.id).label("total"),
                func.sum(sql_case((QuestionAttempt.is_correct == True, 1), else_=0)).label("correct"),
            )
            .join(Question)
            .filter(
                QuestionAttempt.user_id == self.user_id,
                QuestionAttempt.tenant_id == self.tenant_id,
                QuestionAttempt.is_deleted == False,
                Question.subject_id.in_(subject_ids),
            )
            .group_by(Question.subject_id)
            .all()
        )

        stats_map = {row[0]: {"total": row[1], "correct": row[2] or 0} for row in stats_rows}

        priorities = {}
        for subject in subjects:
            base = float(subject.edital_weight or 1.0)
            stats = stats_map.get(subject.id)
            if not stats or stats["total"] == 0:
                priority = base * self.NEVER_STUDIED_MULTIPLIER
            else:
                accuracy = stats["correct"] / stats["total"]
                if accuracy < self.WEAK_ACCURACY_THRESHOLD:
                    priority = base * self.WEAK_DISCIPLINE_MULTIPLIER
                elif accuracy > self.STRONG_ACCURACY_THRESHOLD:
                    priority = base * self.STRONG_DISCIPLINE_FACTOR
                else:
                    priority = base
            priorities[subject.id] = round(priority, 3)

        return priorities

    def _calculate_compression_factor(self, target_date, lessons_remaining):
        if not target_date or lessons_remaining == 0:
            return 1.0
        try:
            target = date.fromisoformat(target_date)
        except ValueError:
            return 1.0
        today = date.today()
        days_left = (target - today).days
        if days_left <= 0:
            return 1.0
        slots = self._generate_day_slots(today, max_days=days_left)
        if not slots:
            return 1.0
        avg_lesson_minutes = 40
        lessons_per_slot = max(1, self.minutes_per_day // (avg_lesson_minutes + self.break_minutes))
        capacity = len(slots) * lessons_per_slot
        if capacity >= lessons_remaining:
            return 1.0
        return round(min(lessons_remaining / max(capacity, 1), 3.0), 2)

    def _get_pending_lessons(self) -> List[Lesson]:
        watched_subquery = (
            db.session.query(LessonProgress.lesson_id)
            .filter(
                LessonProgress.user_id == self.user_id,
                LessonProgress.tenant_id == self.tenant_id,
                LessonProgress.status == "watched",
                LessonProgress.is_deleted == False,
            )
        )
        scheduled_subquery = (
            db.session.query(ScheduleItem.lesson_id)
            .join(StudySchedule, ScheduleItem.schedule_id == StudySchedule.id)
            .filter(
                StudySchedule.user_id == self.user_id,
                StudySchedule.course_id == self.course_id,
                StudySchedule.tenant_id == self.tenant_id,
                StudySchedule.is_deleted == False,
                ScheduleItem.item_type == "lesson",
                ScheduleItem.status == "pending",
                ScheduleItem.is_deleted == False,
                ScheduleItem.lesson_id.isnot(None),
            )
        )
        exclude_subquery = watched_subquery.union(scheduled_subquery)
        return (
            Lesson.query.join(Module, Lesson.module_id == Module.id)
            .join(Subject, Module.subject_id == Subject.id)
            .filter(
                Subject.course_id == self.course_id,
                Subject.tenant_id == self.tenant_id,
                Lesson.is_published == True,
                Lesson.is_deleted == False,
                Module.is_deleted == False,
                Subject.is_deleted == False,
                ~Lesson.id.in_(exclude_subquery),
            )
            .order_by(Subject.order, Module.order, Lesson.order)
            .all()
        )

    def _generate_day_slots(self, start_date: date, compression: float = 1.0, max_days: int = None) -> List[date]:
        slots = []
        current = start_date
        limit = max_days or self.MAX_SCHEDULE_DAYS
        end = start_date + timedelta(days=limit)
        while current <= end and len(slots) < limit:
            if current.weekday() in self.available_days:
                slots.append(current)
            current += timedelta(days=1)
        return slots

    def _build_priority_reason(self, subject: Optional[Subject], priority: float) -> str:
        if not subject:
            return "Sequência do curso"
        if priority >= 2.0:
            return f"Alta prioridade: acerto baixo em {subject.name}"
        elif priority >= 1.5:
            return f"Conteúdo novo: {subject.name} — ainda não praticado"
        elif priority <= 0.7:
            return f"Manutenção: {subject.name} — bom desempenho"
        else:
            return f"Sequência do edital: {subject.name}"