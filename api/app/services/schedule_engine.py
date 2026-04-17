# api/app/services/schedule_engine.py
# Motor do cronograma inteligente e adaptativo — v10
#
# v10 — REESCRITA DA DISTRIBUIÇÃO DIÁRIA (fixes de consistência):
#
#   BUG 1 (principal): critério de encaixe de aula usava `lesson_cost`
#     (lesson_dur + BREAK_MINUTES), bloqueando aulas de 35 min quando
#     sobravam 38 min no dia. Fix: usa `lesson_dur` para o check — a pausa
#     ao fim do último item é "overflow" aceitável.
#
#   BUG 2: tempo livre não era preenchido. Com 82 min usados em dia de 120,
#     os 38 min restantes ficavam vazios. Fix: `_fill_day_remainder()` adiciona
#     revisão de fixação ou bloco de questões extras no tempo que sobra.
#
#   BUG 3: `_calculate_lessons_window` subestimava aulas/dia. Usava
#     `avg + BREAK + 15 + BREAK` (75 min) → 1 aula/dia. Real: 2 aulas/dia
#     para aulas médias de 40 min. Fix: usa `avg + BREAK` apenas.
#
#   BUG 4: `_add_spaced_reviews` tinha janela de 1–2 dias, impossível
#     de preencher se slots estivessem cheios. Fix: janela de 7 dias úteis.
#
#   BUG 5: lógica de `consecutive_skips` saía do dia cedo após Strategy A/B;
#     substituída por loop mais simples e previsível em `_schedule_single_day`.
#
#   ARQUITETURA: `_build_items` agora delega o agendamento de cada dia para
#   `_schedule_single_day()` (extraído), separando responsabilidades e
#   tornando o algoritmo testável unitariamente.
#
# v9 — Distribuição híbrida (preservado): 60% aulas + 40% revisão/simulados
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

# Tempo mínimo livre para valer a pena adicionar um bloco de revisão/questões
_MIN_FILLER_MINUTES = 15


class ScheduleEngine:
    BREAK_MINUTES = 10
    MAX_SCHEDULE_DAYS = 730          # 2 anos
    QUESTIONS_BLOCK_MINUTES = 20
    MIN_FREE_FOR_QUESTIONS = 0
    REVIEW_MINUTES = 25
    SIMULADO_INTERVAL_LESSONS = 12
    MAX_EFFECTIVE_MINUTES = 480

    # ─── Estratégia de distribuição ──────────────────────────────────────────
    # "hybrid"       → aulas concentradas + reta final de revisão (padrão)
    # "stretched"    → 100% do tempo com aulas (ritmo mais leve)
    # "concentrated" → enche 2h/dia até acabar as aulas (comportamento antigo)
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

        # Armazena o coverage_gap calculado no último _build_items()
        self.last_coverage_gap: Optional[Dict] = None

    # ─────────────────────────────────────────────────────────────────────────
    # API pública
    # ─────────────────────────────────────────────────────────────────────────

    def generate(self, target_date: Optional[str] = None) -> StudySchedule:
        """
        Lógica em 3 camadas (v8.3):
          1. Schedule ATIVO → reorganiza
          2. Schedule DELETADO → ressuscita (evita UniqueViolation)
          3. Nada → cria novo
        """
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

            ScheduleItem.query.filter_by(
                schedule_id=deleted_schedule.id,
            ).update(
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
            }
            deleted_schedule.last_reorganized_at = now_iso
            deleted_schedule.abandonment_risk_score = 0.0
            deleted_schedule.ai_notes = None

            db.session.flush()
            self._build_items(deleted_schedule, start_date=date.today())
            db.session.commit()
            return deleted_schedule

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
            },
            last_reorganized_at=datetime.now(timezone.utc).isoformat(),
        )
        db.session.add(schedule)
        db.session.flush()
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
        tomorrow_str = tomorrow.isoformat()

        ScheduleItem.query.filter(
            ScheduleItem.schedule_id == schedule.id,
            ScheduleItem.scheduled_date >= tomorrow_str,
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
                used_minutes[item_date] += item.estimated_minutes + self.BREAK_MINUTES
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
            if free < self.REVIEW_MINUTES + self.BREAK_MINUTES:
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
            used_minutes[slot_date] += self.REVIEW_MINUTES + self.BREAK_MINUTES
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
    # Cálculo da janela de aulas — v10
    # ─────────────────────────────────────────────────────────────────────────

    def _calculate_lessons_window(
        self,
        total_lessons: int,
        available_days: int,
        effective_minutes: int,
        avg_lesson_minutes: float = 40.0,
    ) -> int:
        """
        Calcula quantos dias serão usados para aulas (resto = revisão).

        v10 FIX: fórmula anterior usava avg + BREAK + 15 + BREAK (≈75 min para
        40 min de aula), resultando em 1 aula/dia. Fórmula correta: avg + BREAK
        apenas — questões são adicionadas como subproduto das aulas, não como
        um slot independente no cálculo da capacidade.

        Resultado: para aulas de 40 min com 120 min/dia → 2 aulas/dia (correto).
        """
        # Custo de uma aula: duração + pausa obrigatória após
        # (questões não contam aqui — são preenchidas no espaço restante)
        cost_per_lesson = avg_lesson_minutes + self.BREAK_MINUTES
        lessons_per_day_max = max(1, int(effective_minutes / cost_per_lesson))

        days_needed_concentrated = math.ceil(total_lessons / lessons_per_day_max)

        if self.DISTRIBUTION_STRATEGY == "concentrated":
            return min(days_needed_concentrated, available_days)

        if self.DISTRIBUTION_STRATEGY == "stretched":
            return available_days

        # hybrid: concentra aulas, reserva final para revisão
        target_window = min(days_needed_concentrated, available_days)
        # Garante mínimo de 5% ou 7 dias de reta final
        max_lessons_window = available_days - max(7, int(available_days * 0.05))
        return min(target_window, max(max_lessons_window, days_needed_concentrated))

    # ─────────────────────────────────────────────────────────────────────────
    # Construção do cronograma — v10
    # ─────────────────────────────────────────────────────────────────────────

    def _build_items(self, schedule: StudySchedule, start_date: date):
        """
        Orquestra a construção do cronograma:
          1. Calcula janela de aulas vs revisão final
          2. Para cada dia da janela de aulas, chama _schedule_single_day()
          3. Adiciona simulados a cada N aulas
          4. Adiciona revisões espaçadas (spaced repetition)
          5. Persiste tudo em bulk
        """
        priority_map = self._calculate_subject_priorities()
        pending_lessons = self._get_pending_lessons()

        if not pending_lessons:
            schedule.ai_notes = "Todas as aulas já foram assistidas. Foco em revisão e simulados."
            self._add_review_only_plan(schedule, priority_map, start_date)
            return

        # ── Define slots disponíveis ─────────────────────────────────────────
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

        # ── Calcula duração média real das aulas ─────────────────────────────
        lesson_durations = [max(l.duration_minutes or 30, 15) for l in pending_lessons]
        avg_lesson_real = sum(lesson_durations) / max(1, len(lesson_durations))

        # ── Detecta gap de cobertura ─────────────────────────────────────────
        # v10: usa a mesma fórmula de _calculate_lessons_window (avg + BREAK)
        cost_per_lesson_real = avg_lesson_real + self.BREAK_MINUTES
        lessons_per_day_capacity = max(1, int(effective_minutes / cost_per_lesson_real))
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
        if coverage_gap:
            snapshot["coverage_gap"] = coverage_gap
        else:
            snapshot.pop("coverage_gap", None)
        schedule.availability_snapshot = snapshot

        # ── Define janela de aulas vs reta final ─────────────────────────────
        lessons_window_days = self._calculate_lessons_window(
            total_lessons=len(pending_lessons),
            available_days=len(all_slots),
            effective_minutes=effective_minutes,
            avg_lesson_minutes=avg_lesson_real,
        )
        lesson_slots = all_slots[:lessons_window_days]
        review_only_slots = all_slots[lessons_window_days:]

        if not schedule.target_date and len(review_only_slots) > 90:
            review_only_slots = review_only_slots[:90]

        # ── Pre-load de módulos e disciplinas ────────────────────────────────
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

        # ── Fase 1: Agendamento de aulas (usa _schedule_single_day) ──────────
        for slot_idx, slot_date in enumerate(lesson_slots):
            if not any(queues.get(sid) for sid in subject_ids_ordered):
                break

            day_items, day_minutes, day_lessons_count = self._schedule_single_day(
                slot_str=slot_date.isoformat(),
                queues=queues,
                subject_ids_ordered=subject_ids_ordered,
                subject_map=subject_map,
                priority_map=priority_map,
                effective_minutes=effective_minutes,
                tenant_id=self.tenant_id,
                schedule_id=schedule.id,
            )

            items_to_add.extend(day_items)
            used_minutes_tracker[slot_date] = day_minutes
            lessons_added += day_lessons_count

            # Simulado a cada N aulas, no dia seguinte
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

        # ── Fase 2: Simulados na reta final ──────────────────────────────────
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

        # ── Fase 3: Revisões espaçadas (spaced repetition) ───────────────────
        self._add_spaced_reviews(
            schedule, all_slots, used_minutes_tracker,
            priority_map, items_to_add, effective_minutes,
        )

        if items_to_add:
            db.session.bulk_save_objects(items_to_add)

        # ── Nota da IA ────────────────────────────────────────────────────────
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

        schedule.ai_notes = (
            f"Cronograma gerado com {lessons_added} aulas.{coverage_warning}{window_info}{review_info} "
            f"Disciplinas priorizadas: {', '.join(weak_names) or 'distribuição equilibrada'}. "
            f"Carga diária: {self.hours_per_day}h."
        )

    # ─────────────────────────────────────────────────────────────────────────
    # Agendamento de um único dia — v10 (novo método extraído)
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
    ) -> Tuple[List[ScheduleItem], int, int]:
        """
        Agenda aulas, questões e revisão de fixação para um único dia de estudo.

        Retorna:
            (items, minutes_used, lessons_count)

        Algoritmo v10:
          1. Verifica force-fit: se a primeira aula da fila prioritária excede
             o budget, agenda ela sozinha (marcada como aula longa) e encerra.
          2. Round-robin entre disciplinas ativas: agenda a próxima aula de cada
             disciplina enquanto `lesson_dur <= remaining`.
          3. Após cada aula, tenta adicionar questões se houver espaço.
          4. Encerra quando nenhuma aula de nenhuma disciplina cabe no tempo
             restante, ou quando o budget é atingido.
          5. Chama _fill_day_remainder() para aproveitar tempo livre residual.

        FIX v10 (Bug 1): usa `lesson_dur <= remaining` (não `lesson_cost`)
        para o check de encaixe. Isso evita descartar aulas de 35 min quando
        sobram 38 min no dia (caso comum que desperdiçava ~30% do tempo).
        """
        items: List[ScheduleItem] = []
        day_used = 0
        order = 0
        day_subjects_used: List[str] = []  # disciplinas que tiveram aula hoje
        lessons_count = 0

        active_subjects = [sid for sid in subject_ids_ordered if queues.get(sid)]
        if not active_subjects:
            return items, day_used, lessons_count

        # ── Force-fit: aula maior que o budget inteiro ────────────────────────
        first_sid = active_subjects[0]
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
                # Não preenchemos o resto — dia já estourou o budget
                return items, day_used, lessons_count

        # ── Agendamento normal: round-robin ───────────────────────────────────
        rotation = 0
        skips_in_round = 0  # quantas disciplinas consecutivas não couberam

        while True:
            # Limpa disciplinas sem mais aulas
            active_subjects = [sid for sid in active_subjects if queues.get(sid)]
            if not active_subjects:
                break

            remaining = effective_minutes - day_used

            # Se não há tempo nem para o menor bloco útil, encerra
            if remaining < _MIN_FILLER_MINUTES:
                break

            if rotation >= len(active_subjects):
                rotation = 0

            # Se percorremos TODAS as disciplinas ativas e nenhuma coube,
            # tenta encontrar alguma aula mais curta antes de desistir
            if skips_in_round >= len(active_subjects):
                found = self._find_short_lesson(
                    active_subjects, queues, remaining,
                )
                if found is None:
                    break  # nada mais cabe no tempo restante
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

            # FIX BUG 1: checa `dur <= remaining` (não `dur + BREAK <= remaining`)
            # Isso permite encaixar aulas que "tocam" o fim do orçamento, com a
            # pausa transbordando apenas alguns minutos — aceitável na prática.
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

        # ── Preenche tempo livre residual (FIX BUG 2) ─────────────────────────
        day_used, order = self._fill_day_remainder(
            items=items,
            slot_str=slot_str,
            day_subjects_used=day_subjects_used,
            subject_map=subject_map,
            priority_map=priority_map,
            day_used=day_used,
            order=order,
            effective_minutes=effective_minutes,
            tenant_id=tenant_id,
            schedule_id=schedule_id,
        )

        return items, day_used, lessons_count

    def _find_short_lesson(
        self,
        active_subjects: List[str],
        queues: Dict[str, List],
        remaining: int,
        look_ahead: int = 10,
    ) -> Optional[Tuple[str, int]]:
        """
        Busca, nas primeiras `look_ahead` posições de cada fila, uma aula que
        caiba no tempo restante do dia. Retorna (subject_id, queue_index) ou None.

        Isso evita desperdiçar tempo quando a fila[0] é longa mas há aulas
        mais curtas logo atrás (e.g., módulo de revisão de 15 min após aula de 60 min).
        """
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
        """
        Após o loop de aulas, se há tempo livre >= _MIN_FILLER_MINUTES,
        adiciona uma revisão de fixação para a disciplina mais fraca do dia.

        FIX BUG 2: evita dias com 30-40 min de tempo vazio após as aulas.

        Exemplos com budget de 120 min:
          - 1 aula de 40 min → used=82 → 38 min livres → revisão de 25 min
          - 1 aula de 60 min → used=105 → 15 min livres → revisão de 15 min
          - 2 aulas de 30 min → used=110 → 10 min livres → sem filler (< 15)
        """
        remaining = effective_minutes - day_used

        if remaining < _MIN_FILLER_MINUTES:
            return day_used, order

        if not day_subjects_used:
            return day_used, order

        # Escolhe a disciplina mais fraca estudada hoje (maior priority = mais fraca)
        weakest_sid = max(day_subjects_used, key=lambda sid: priority_map.get(sid, 1.0))
        subject = subject_map.get(weakest_sid)
        if not subject:
            return day_used, order

        # Ajusta duração ao tempo disponível, sem exceder REVIEW_MAX_MINUTES
        filler_min = min(remaining, self.REVIEW_MAX_MINUTES)

        items.append(ScheduleItem(
            tenant_id=tenant_id,
            schedule_id=schedule_id,
            item_type="review",
            subject_id=weakest_sid,
            scheduled_date=slot_str,
            order=order,
            estimated_minutes=filler_min,
            priority_reason=f"Revisão de fixação: {subject.name}",
            status="pending",
        ))
        day_used += filler_min + self.BREAK_MINUTES
        order += 1

        return day_used, order

    # ─────────────────────────────────────────────────────────────────────────
    # Helpers de cálculo de tempo
    # ─────────────────────────────────────────────────────────────────────────

    def _calculate_questions_minutes(self, lesson_minutes: int) -> int:
        proportional = self.QUESTIONS_MIN_MINUTES + (lesson_minutes * 0.3)
        return int(min(self.QUESTIONS_MAX_MINUTES, max(self.QUESTIONS_MIN_MINUTES, proportional)))

    def _calculate_review_minutes(self, accuracy: float) -> int:
        proportional = self.REVIEW_MIN_MINUTES + ((1.0 - accuracy) * 15)
        return int(min(self.REVIEW_MAX_MINUTES, max(self.REVIEW_MIN_MINUTES, proportional)))

    # ─────────────────────────────────────────────────────────────────────────
    # Plano de revisão (quando todas as aulas já foram assistidas)
    # ─────────────────────────────────────────────────────────────────────────

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

    # ─────────────────────────────────────────────────────────────────────────
    # Adiciona aula + questões de fixação imediata
    # ─────────────────────────────────────────────────────────────────────────

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
        """
        Adiciona um item de aula e, se couber no budget, o bloco de questões
        imediatamente após.

        O custo da aula = lesson_dur + BREAK_MINUTES (pausa pós-aula).
        O custo das questões = questions_min + BREAK_MINUTES (pausa pós-questões).

        As questões só são adicionadas se `day_used + questions_cost <= effective_minutes`,
        garantindo que não excedam o budget de forma descontrolada.
        """
        base_reason = self._build_priority_reason(subject, priority)
        priority_reason = f"{FORCE_FIT_PREFIX} {base_reason}" if is_long_lesson else base_reason

        items_to_add.append(ScheduleItem(
            tenant_id=tenant_id,
            schedule_id=schedule_id,
            item_type="lesson",
            lesson_id=lesson.id,
            subject_id=subject_id if subject_id != "__no_subject__" else None,
            scheduled_date=slot_str,
            order=day_order,
            estimated_minutes=lesson_dur,
            priority_reason=priority_reason,
            status="pending",
        ))
        day_used += lesson_dur + self.BREAK_MINUTES
        day_order += 1

        # Questões: apenas se o sujeito existir e houver espaço no budget
        if subject and subject_id != "__no_subject__":
            questions_minutes = self._calculate_questions_minutes(lesson_dur)
            questions_cost = questions_minutes + self.BREAK_MINUTES

            if day_used + questions_cost <= effective_minutes:
                items_to_add.append(ScheduleItem(
                    tenant_id=tenant_id,
                    schedule_id=schedule_id,
                    item_type="questions",
                    subject_id=subject_id,
                    scheduled_date=slot_str,
                    order=day_order,
                    estimated_minutes=questions_minutes,
                    priority_reason=f"Fixação: {subject.name}",
                    status="pending",
                ))
                day_used += questions_cost
                day_order += 1

        return day_used, day_order

    # ─────────────────────────────────────────────────────────────────────────
    # Revisões espaçadas (spaced repetition) — v10
    # ─────────────────────────────────────────────────────────────────────────

    def _add_spaced_reviews(
        self,
        schedule: StudySchedule,
        slots: List[date],
        used_minutes: Dict[date, int],
        priority_map: Dict[str, float],
        items_to_add: List[ScheduleItem],
        effective_minutes: int = None,
    ):
        """
        Insere revisões espaçadas para disciplinas com acurácia abaixo de 50%.

        v10 FIX (Bug 4): janela ampliada de 1–2 dias para 1–7 dias úteis.
        A janela anterior tornava impossível agendar revisões quando D+1 e D+2
        já estavam lotados — o que ocorre com frequência pois o scheduler
        enche os dias mais densamente a partir da v10.
        """
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
            needed = review_minutes + self.BREAK_MINUTES

            last_date_str = last_dates.get(subject.id)
            if last_date_str:
                try:
                    last_date = date.fromisoformat(last_date_str)
                    earliest = last_date + timedelta(days=1)
                    # FIX BUG 4: janela ampliada de 2 → 7 dias para acomodar
                    # dias já cheios no início da janela
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

    # ─────────────────────────────────────────────────────────────────────────
    # Prioridades de disciplinas
    # ─────────────────────────────────────────────────────────────────────────

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
        """Mantido por compatibilidade com referências externas."""
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
        lessons_per_slot = max(1, self.minutes_per_day // (avg_lesson_minutes + self.BREAK_MINUTES))
        capacity = len(slots) * lessons_per_slot
        if capacity >= lessons_remaining:
            return 1.0
        return round(min(lessons_remaining / max(capacity, 1), 3.0), 2)

    # ─────────────────────────────────────────────────────────────────────────
    # Aulas pendentes
    # ─────────────────────────────────────────────────────────────────────────

    def _get_pending_lessons(self) -> List[Lesson]:
        from sqlalchemy import and_

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

    # ─────────────────────────────────────────────────────────────────────────
    # Geração de slots de dias disponíveis
    # ─────────────────────────────────────────────────────────────────────────

    def _generate_day_slots(
        self,
        start_date: date,
        compression: float = 1.0,
        max_days: int = None,
    ) -> List[date]:
        slots = []
        current = start_date
        limit = max_days or self.MAX_SCHEDULE_DAYS
        end = start_date + timedelta(days=limit)

        while current <= end and len(slots) < limit:
            if current.weekday() in self.available_days:
                slots.append(current)
            current += timedelta(days=1)

        return slots

    # ─────────────────────────────────────────────────────────────────────────
    # Utilitários
    # ─────────────────────────────────────────────────────────────────────────

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