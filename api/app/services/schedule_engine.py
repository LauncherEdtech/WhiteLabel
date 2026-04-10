# api/app/services/schedule_engine.py
# Motor do cronograma inteligente e adaptativo — v5
#
# v5 — Adaptação reativa por desempenho em questões:
#   inject_subject_reviews()   — injeta revisões cirúrgicas quando acurácia < 50%
#   remove_excess_reviews()    — remove revisões adaptativas quando acurácia >= 70%
#   _get_subject_accuracy()    — helper: calcula acurácia atual de uma disciplina
#   _all_lessons_completed()   — verifica conclusão real via LessonProgress
#
# Correções acumuladas de v4:
#   - tenant_id em generate() e reorganize()
#   - compression aplicada como effective_minutes (não ignorada)
#   - slots limitados à data-alvo da prova
#   - pre-load bulk de módulos/subjects (elimina N+1)
#   - Subject.order como critério de desempate na ordenação

from datetime import datetime, timezone, timedelta, date
from collections import defaultdict
from typing import Optional, List, Tuple, Dict

from app.extensions import db
from app.models.user import User
from app.models.course import (
    Course,
    Subject,
    Module,
    Lesson,
    LessonProgress,
    CourseEnrollment,
)
from app.models.question import QuestionAttempt
from app.models.schedule import StudySchedule, ScheduleItem, ScheduleCheckIn
from app.models.simulado import Simulado


class ScheduleEngine:
    BREAK_MINUTES = 10
    MAX_SCHEDULE_DAYS = 120
    MAX_LESSONS_PER_BLOCK = 2
    QUESTIONS_BLOCK_MINUTES = 30
    MIN_FREE_FOR_QUESTIONS = 25
    REVIEW_MINUTES = 25
    SIMULADO_INTERVAL_LESSONS = 12
    MAX_EFFECTIVE_MINUTES = 480

    WEAK_DISCIPLINE_MULTIPLIER = 2.5
    STRONG_DISCIPLINE_FACTOR = 0.6
    WEAK_ACCURACY_THRESHOLD = 0.60
    STRONG_ACCURACY_THRESHOLD = 0.80
    NEVER_STUDIED_MULTIPLIER = 1.8

    # Thresholds da adaptação reativa
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

    # ─────────────────────────────────────────────────────────────────────────
    # API pública
    # ─────────────────────────────────────────────────────────────────────────

    def generate(self, target_date: Optional[str] = None) -> StudySchedule:
        existing = StudySchedule.query.filter_by(
            user_id=self.user_id,
            course_id=self.course_id,
            tenant_id=self.tenant_id,
        ).first()

        if existing:
            if existing.is_deleted:
                existing.is_deleted = False
                existing.deleted_at = None
            if target_date:
                existing.target_date = target_date
            return self.reorganize(existing)

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
        ).delete(synchronize_session="fetch")

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
    # Adaptação reativa por desempenho em questões
    # ─────────────────────────────────────────────────────────────────────────

    def inject_subject_reviews(
        self,
        subject_id: str,
        count: int = None,
        days_window: int = None,
    ) -> int:
        """
        Injeta revisões extras para uma disciplina com baixa acurácia.

        Regras:
        - Insere `count` revisões nos próximos `days_window` dias com tempo livre.
        - Tags com question_filters={"_adaptive": True} para identificação futura.
        - Não duplica se já há revisões adaptativas suficientes para esta disciplina.
        - Não sobrepõe revisões normais já agendadas no mesmo dia.
        - Operação cirúrgica: NÃO reorganiza o cronograma inteiro.

        Returns: número de revisões efetivamente inseridas.
        """
        count = count if count is not None else self.ADAPTIVE_REVIEWS_COUNT
        days_window = (
            days_window if days_window is not None else self.ADAPTIVE_DAYS_WINDOW
        )

        schedule = StudySchedule.query.filter_by(
            user_id=self.user_id,
            course_id=self.course_id,
            tenant_id=self.tenant_id,
            status="active",
            is_deleted=False,
        ).first()
        if not schedule:
            return 0

        subject = Subject.query.filter_by(
            id=subject_id,
            tenant_id=self.tenant_id,
            is_deleted=False,
        ).first()
        if not subject:
            return 0

        today = date.today()
        window_end = today + timedelta(days=days_window)
        today_str = today.isoformat()
        window_str = window_end.isoformat()

        # Carrega todos os itens pendentes na janela
        existing_items = ScheduleItem.query.filter(
            ScheduleItem.schedule_id == schedule.id,
            ScheduleItem.scheduled_date >= today_str,
            ScheduleItem.scheduled_date <= window_str,
            ScheduleItem.is_deleted == False,
        ).all()

        # Conta revisões adaptativas já existentes para esta disciplina na janela
        already_adaptive = [
            i
            for i in existing_items
            if (
                i.subject_id == subject_id
                and i.item_type == "review"
                and i.status == "pending"
                and i.question_filters
                and i.question_filters.get("_adaptive") is True
            )
        ]
        needed = count - len(already_adaptive)
        if needed <= 0:
            return 0

        # Minutos já usados por data
        used_minutes: Dict[date, int] = defaultdict(int)
        for item in existing_items:
            if item.status != "pending":
                continue
            try:
                item_date = date.fromisoformat(item.scheduled_date)
                used_minutes[item_date] += item.estimated_minutes + self.BREAK_MINUTES
            except ValueError:
                pass

        # Datas que já têm revisão desta disciplina (evita duplicar no mesmo dia)
        review_dates_with_subject = {
            i.scheduled_date
            for i in existing_items
            if (
                i.subject_id == subject_id
                and i.item_type == "review"
                and i.status == "pending"
            )
        }

        # Slots disponíveis na janela (começa amanhã)
        slots = self._generate_day_slots(
            today + timedelta(days=1),
            max_days=days_window,
        )

        accuracy = self._get_subject_accuracy(subject_id)
        inserted = 0
        new_items = []

        for slot_date in slots:
            if inserted >= needed:
                break

            slot_str = slot_date.isoformat()
            if slot_str in review_dates_with_subject:
                continue

            free = self.minutes_per_day - used_minutes[slot_date]
            if free < self.REVIEW_MINUTES + self.BREAK_MINUTES:
                continue

            new_items.append(
                ScheduleItem(
                    tenant_id=self.tenant_id,
                    schedule_id=schedule.id,
                    item_type="review",
                    subject_id=subject_id,
                    scheduled_date=slot_str,
                    order=98,
                    estimated_minutes=self.REVIEW_MINUTES,
                    priority_reason=(
                        f"Revisão adaptativa: {subject.name} "
                        f"— acerto {round(accuracy * 100)}% (abaixo de 50%)"
                    ),
                    status="pending",
                    # Tag especial: identifica revisões por baixo desempenho
                    question_filters={"_adaptive": True},
                )
            )
            used_minutes[slot_date] += self.REVIEW_MINUTES + self.BREAK_MINUTES
            review_dates_with_subject.add(slot_str)
            inserted += 1

        if new_items:
            db.session.bulk_save_objects(new_items)
            db.session.commit()

        return inserted

    def remove_excess_reviews(self, subject_id: str) -> int:
        """
        Remove revisões adaptativas pendentes de uma disciplina que melhorou.

        Só remove itens com question_filters._adaptive=True ainda pendentes e futuros.
        Itens já concluídos, pulados ou passados são preservados.

        Returns: número de itens removidos.
        """
        schedule = StudySchedule.query.filter_by(
            user_id=self.user_id,
            course_id=self.course_id,
            tenant_id=self.tenant_id,
            status="active",
            is_deleted=False,
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

        # Filtra somente os adaptativos (em Python — evita SQL JSON complexo)
        adaptive_items = [
            item
            for item in pending_reviews
            if item.question_filters and item.question_filters.get("_adaptive") is True
        ]

        removed = 0
        for item in adaptive_items:
            item.soft_delete()
            removed += 1

        if removed > 0:
            db.session.commit()

        return removed

    def _get_subject_accuracy(self, subject_id: str) -> float:
        """Acurácia atual do aluno nesta disciplina (0.0 se sem tentativas)."""
        attempts = (
            QuestionAttempt.query.filter_by(
                user_id=self.user_id,
                tenant_id=self.tenant_id,
                is_deleted=False,
            )
            .join(QuestionAttempt.question)
            .filter_by(subject_id=subject_id)
            .all()
        )
        if not attempts:
            return 0.0
        correct = sum(1 for a in attempts if a.is_correct)
        return correct / len(attempts)

    def _all_lessons_completed(self) -> bool:
        """
        True se todas as aulas publicadas do curso foram assistidas.
        Usa LessonProgress — NÃO usa _get_pending_lessons() que retorna []
        mesmo quando tudo está apenas agendado como pending.
        """
        total_lessons = (
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
        if total_lessons == 0:
            return False

        watched_count = (
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
        return watched_count >= total_lessons

    def calculate_abandonment_risk(self) -> float:
        risk = 0.0

        last_attempt = (
            QuestionAttempt.query.filter_by(
                user_id=self.user_id,
                tenant_id=self.tenant_id,
                is_deleted=False,
            )
            .order_by(QuestionAttempt.created_at.desc())
            .first()
        )

        if not last_attempt:
            risk += 0.4
        else:
            days_inactive = (datetime.utcnow() - last_attempt.created_at).days
            risk += (
                0.4
                if days_inactive >= 14
                else 0.25 if days_inactive >= 7 else 0.1 if days_inactive >= 3 else 0
            )

        schedule = StudySchedule.query.filter_by(
            user_id=self.user_id,
            course_id=self.course_id,
            tenant_id=self.tenant_id,
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
            risk += (
                0.3
                if overdue >= 10
                else 0.2 if overdue >= 5 else 0.1 if overdue >= 2 else 0
            )

        total = QuestionAttempt.query.filter_by(
            user_id=self.user_id,
            tenant_id=self.tenant_id,
            is_deleted=False,
        ).count()
        if total >= 10:
            correct = QuestionAttempt.query.filter_by(
                user_id=self.user_id,
                tenant_id=self.tenant_id,
                is_correct=True,
                is_deleted=False,
            ).count()
            accuracy = correct / total
            risk += 0.3 if accuracy < 0.3 else 0.15 if accuracy < 0.4 else 0

        return round(min(risk, 1.0), 2)

    # ─────────────────────────────────────────────────────────────────────────
    # Construção do cronograma
    # ─────────────────────────────────────────────────────────────────────────

    def _build_items(self, schedule: StudySchedule, start_date: date):
        priority_map = self._calculate_subject_priorities()
        pending_lessons = self._get_pending_lessons()

        if not pending_lessons:
            schedule.ai_notes = (
                "Todas as aulas já foram assistidas. Foco em revisão e simulados."
            )
            self._add_review_only_plan(schedule, priority_map, start_date)
            return

        compression = self._calculate_compression_factor(
            schedule.target_date, len(pending_lessons)
        )
        effective_minutes = min(
            int(self.minutes_per_day * compression),
            self.MAX_EFFECTIVE_MINUTES,
        )

        if schedule.target_date:
            try:
                target = date.fromisoformat(schedule.target_date)
                days_left = max(1, (target - start_date).days)
                available_slots = self._generate_day_slots(
                    start_date, max_days=days_left
                )
                if not available_slots:
                    available_slots = self._generate_day_slots(start_date)
            except ValueError:
                available_slots = self._generate_day_slots(start_date)
        else:
            available_slots = self._generate_day_slots(start_date)

        if not available_slots:
            return

        # Pre-load bulk (elimina N+1)
        module_ids = {l.module_id for l in pending_lessons if l.module_id}
        modules_by_id: Dict[str, Module] = (
            {m.id: m for m in Module.query.filter(Module.id.in_(module_ids)).all()}
            if module_ids
            else {}
        )

        subject_ids_from_modules = {
            m.subject_id for m in modules_by_id.values() if m.subject_id
        }
        subjects_by_id: Dict[str, Subject] = (
            {
                s.id: s
                for s in Subject.query.filter(
                    Subject.id.in_(subject_ids_from_modules)
                ).all()
            }
            if subject_ids_from_modules
            else {}
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

        def _subject_sort_key(sid: str):
            s = subject_map.get(sid)
            return (-priority_map.get(sid, 1.0), (s.order or 0) if s else 999)

        subject_ids_ordered = sorted(lessons_by_subject.keys(), key=_subject_sort_key)

        all_blocks: List[Tuple[str, List]] = []
        queues = {sid: list(lessons_by_subject[sid]) for sid in subject_ids_ordered}

        while any(queues[sid] for sid in subject_ids_ordered):
            for sid in subject_ids_ordered:
                if not queues[sid]:
                    continue
                block = []
                for _ in range(self.MAX_LESSONS_PER_BLOCK):
                    if queues[sid]:
                        block.append(queues[sid].pop(0))
                if block:
                    all_blocks.append((sid, block))

        items_to_add: List[ScheduleItem] = []
        used_minutes: Dict[date, int] = defaultdict(int)
        slot_idx = 0
        lessons_added = 0
        simulado_days: set = set()

        for sid, block_lessons in all_blocks:
            if slot_idx >= len(available_slots):
                break

            subject = subject_map.get(sid)
            priority = priority_map.get(sid, 1.0)
            reason = self._build_priority_reason(subject, priority)

            block_duration = sum(
                max(l.duration_minutes or 30, 15) for l in block_lessons
            )
            block_with_breaks = block_duration + self.BREAK_MINUTES * len(block_lessons)

            effective_blocks: List[List] = []
            if block_with_breaks > effective_minutes:
                for lesson in block_lessons:
                    effective_blocks.append([lesson])
            else:
                effective_blocks.append(block_lessons)

            for sub_block in effective_blocks:
                if slot_idx >= len(available_slots):
                    break

                sub_duration = sum(max(l.duration_minutes or 30, 15) for l in sub_block)
                sub_with_breaks = sub_duration + self.BREAK_MINUTES * len(sub_block)

                start_search = slot_idx
                while slot_idx < len(available_slots):
                    slot_date = available_slots[slot_idx]
                    if used_minutes[slot_date] + sub_with_breaks <= effective_minutes:
                        break
                    slot_idx += 1
                    if slot_idx - start_search > len(available_slots):
                        break

                if slot_idx >= len(available_slots):
                    break

                slot_date = available_slots[slot_idx]

                for order_idx, lesson in enumerate(sub_block):
                    duration = max(lesson.duration_minutes or 30, 15)
                    items_to_add.append(
                        ScheduleItem(
                            tenant_id=self.tenant_id,
                            schedule_id=schedule.id,
                            item_type="lesson",
                            lesson_id=lesson.id,
                            subject_id=sid if sid != "__no_subject__" else None,
                            scheduled_date=slot_date.isoformat(),
                            order=order_idx,
                            estimated_minutes=duration,
                            priority_reason=reason,
                            status="pending",
                        )
                    )
                    used_minutes[slot_date] += duration + self.BREAK_MINUTES
                    lessons_added += 1

                remaining = effective_minutes - used_minutes[slot_date]
                if remaining >= self.MIN_FREE_FOR_QUESTIONS and subject:
                    q_min = min(
                        self.QUESTIONS_BLOCK_MINUTES, remaining - self.BREAK_MINUTES
                    )
                    items_to_add.append(
                        ScheduleItem(
                            tenant_id=self.tenant_id,
                            schedule_id=schedule.id,
                            item_type="questions",
                            subject_id=sid,
                            scheduled_date=slot_date.isoformat(),
                            order=len(sub_block) + 1,
                            estimated_minutes=q_min,
                            priority_reason=f"Fixação: {subject.name}",
                            status="pending",
                        )
                    )
                    used_minutes[slot_date] += q_min + self.BREAK_MINUTES

                if (
                    lessons_added > 0
                    and lessons_added % self.SIMULADO_INTERVAL_LESSONS == 0
                ):
                    sim_slot_idx = slot_idx + 1
                    if sim_slot_idx < len(available_slots):
                        sim_date_str = available_slots[sim_slot_idx].isoformat()
                        if sim_date_str not in simulado_days:
                            items_to_add.append(
                                ScheduleItem(
                                    tenant_id=self.tenant_id,
                                    schedule_id=schedule.id,
                                    item_type="simulado",
                                    scheduled_date=sim_date_str,
                                    order=0,
                                    estimated_minutes=90,
                                    priority_reason=f"Simulado após {lessons_added} aulas",
                                    status="pending",
                                )
                            )
                            simulado_days.add(sim_date_str)

                slot_idx += 1

        self._add_spaced_reviews(
            schedule,
            available_slots,
            used_minutes,
            priority_map,
            items_to_add,
            effective_minutes,
        )

        if items_to_add:
            db.session.bulk_save_objects(items_to_add)

        weak_names = [
            subject_map[sid].name
            for sid in subject_ids_ordered[:3]
            if sid in subject_map and priority_map.get(sid, 1.0) >= 1.5
        ]
        compression_info = (
            f" Compressão {compression:.1f}x por data de prova."
            if compression > 1.0
            else ""
        )
        schedule.ai_notes = (
            f"Cronograma gerado com {lessons_added} aulas.{compression_info} "
            f"Disciplinas priorizadas: {', '.join(weak_names) or 'distribuição equilibrada'}. "
            f"Carga diária: {self.hours_per_day}h."
        )

    def _add_review_only_plan(self, schedule, priority_map, start_date):
        slots = self._generate_day_slots(start_date)
        top_ids = [
            sid
            for sid, _ in sorted(
                priority_map.items(), key=lambda x: x[1], reverse=True
            )[:5]
        ]
        subjects_map = (
            {s.id: s for s in Subject.query.filter(Subject.id.in_(top_ids)).all()}
            if top_ids
            else {}
        )

        items = []
        for i, (sid, _) in enumerate(
            sorted(priority_map.items(), key=lambda x: x[1], reverse=True)[:5]
        ):
            if i >= len(slots):
                break
            subject = subjects_map.get(sid)
            if not subject:
                continue
            items += [
                ScheduleItem(
                    tenant_id=self.tenant_id,
                    schedule_id=schedule.id,
                    item_type="review",
                    subject_id=sid,
                    scheduled_date=slots[i].isoformat(),
                    order=0,
                    estimated_minutes=45,
                    priority_reason=f"Revisão: {subject.name}",
                    status="pending",
                ),
                ScheduleItem(
                    tenant_id=self.tenant_id,
                    schedule_id=schedule.id,
                    item_type="questions",
                    subject_id=sid,
                    scheduled_date=slots[i].isoformat(),
                    order=1,
                    estimated_minutes=30,
                    priority_reason=f"Fixação: {subject.name}",
                    status="pending",
                ),
            ]
        if items:
            db.session.bulk_save_objects(items)

    def _add_spaced_reviews(
        self,
        schedule,
        slots,
        used_minutes,
        priority_map,
        items_to_add,
        effective_minutes: int = None,
    ):
        if effective_minutes is None:
            effective_minutes = self.minutes_per_day

        subjects = Subject.query.filter_by(
            course_id=self.course_id,
            tenant_id=self.tenant_id,
            is_deleted=False,
        ).all()

        today = date.today()
        slot_date_set = {s.isoformat(): s for s in slots}
        review_tracker = set()

        for subject in subjects:
            attempts = (
                QuestionAttempt.query.filter_by(
                    user_id=self.user_id,
                    tenant_id=self.tenant_id,
                    is_deleted=False,
                )
                .join(QuestionAttempt.question)
                .filter_by(subject_id=subject.id)
                .all()
            )
            if not attempts:
                continue

            total = len(attempts)
            correct = sum(1 for a in attempts if a.is_correct)
            accuracy = correct / total

            if accuracy < self.WEAK_ACCURACY_THRESHOLD:
                level, intervals = "fraco", self.SPACED_REVIEW_INTERVALS["fraco"]
            elif accuracy < self.STRONG_ACCURACY_THRESHOLD:
                level, intervals = "regular", self.SPACED_REVIEW_INTERVALS["regular"]
            else:
                level, intervals = "forte", self.SPACED_REVIEW_INTERVALS["forte"]

            last_review = (
                ScheduleItem.query.filter(
                    ScheduleItem.schedule_id == schedule.id,
                    ScheduleItem.subject_id == subject.id,
                    ScheduleItem.item_type == "review",
                    ScheduleItem.is_deleted == False,
                )
                .order_by(ScheduleItem.scheduled_date.desc())
                .first()
            )

            base_date = today
            if last_review:
                try:
                    base_date = date.fromisoformat(last_review.scheduled_date)
                except ValueError:
                    pass

            for interval in intervals:
                review_date = base_date + timedelta(days=interval)
                review_str = review_date.isoformat()
                tracker_key = (subject.id, review_str)

                if review_str not in slot_date_set:
                    continue
                if tracker_key in review_tracker:
                    continue
                already = any(
                    i.item_type == "review"
                    and i.subject_id == subject.id
                    and i.scheduled_date == review_str
                    for i in items_to_add
                )
                if already:
                    continue

                needed = self.REVIEW_MINUTES + self.BREAK_MINUTES
                if used_minutes[review_date] + needed > effective_minutes:
                    continue

                items_to_add.append(
                    ScheduleItem(
                        tenant_id=self.tenant_id,
                        schedule_id=schedule.id,
                        item_type="review",
                        subject_id=subject.id,
                        scheduled_date=review_str,
                        order=50,
                        estimated_minutes=self.REVIEW_MINUTES,
                        priority_reason=(
                            f"Revisão espaçada ({level}): {subject.name} "
                            f"— acerto {round(accuracy * 100)}%"
                        ),
                        status="pending",
                    )
                )
                used_minutes[review_date] += needed
                review_tracker.add(tracker_key)
                break

    def _calculate_subject_priorities(self) -> dict:
        subjects = (
            Subject.query.filter_by(
                course_id=self.course_id,
                tenant_id=self.tenant_id,
                is_deleted=False,
            )
            .order_by(Subject.order)
            .all()
        )

        priorities = {}
        for subject in subjects:
            base = float(subject.edital_weight or 1.0)
            attempts = (
                QuestionAttempt.query.filter_by(
                    user_id=self.user_id,
                    tenant_id=self.tenant_id,
                    is_deleted=False,
                )
                .join(QuestionAttempt.question)
                .filter_by(subject_id=subject.id)
                .all()
            )
            if not attempts:
                priority = base * self.NEVER_STUDIED_MULTIPLIER
            else:
                total = len(attempts)
                correct = sum(1 for a in attempts if a.is_correct)
                accuracy = correct / total
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
        lessons_per_slot = max(
            1, self.minutes_per_day // (avg_lesson_minutes + self.BREAK_MINUTES)
        )
        capacity = len(slots) * lessons_per_slot
        if capacity >= lessons_remaining:
            return 1.0
        return round(min(lessons_remaining / max(capacity, 1), 3.0), 2)

    def _get_pending_lessons(self) -> list:
        watched_ids = set(
            p.lesson_id
            for p in LessonProgress.query.filter_by(
                user_id=self.user_id,
                tenant_id=self.tenant_id,
                status="watched",
                is_deleted=False,
            ).all()
        )

        already_scheduled_ids = set(
            item.lesson_id
            for item in (
                ScheduleItem.query.join(
                    StudySchedule, ScheduleItem.schedule_id == StudySchedule.id
                )
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
                .all()
            )
            if item.lesson_id is not None
        )

        exclude_ids = watched_ids | already_scheduled_ids

        all_lessons = (
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
            .order_by(Subject.order, Module.order, Lesson.order)
            .all()
        )

        return [l for l in all_lessons if l.id not in exclude_ids]

    def _generate_day_slots(
        self,
        start_date: date,
        compression: float = 1.0,
        max_days: Optional[int] = None,
    ) -> list:
        slots = []
        current = start_date
        limit = max_days or self.MAX_SCHEDULE_DAYS
        end = start_date + timedelta(days=limit)

        while current <= end and len(slots) < limit:
            if current.weekday() in self.available_days:
                slots.append(current)
            current += timedelta(days=1)

        return slots

    def _build_priority_reason(
        self, subject: Optional[Subject], priority: float
    ) -> str:
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
