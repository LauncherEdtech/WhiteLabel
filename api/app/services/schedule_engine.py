# api/app/services/schedule_engine.py
# Motor do cronograma inteligente e adaptativo — v6
#
# v6 — Reescrita do algoritmo de distribuição:
#   ANTES: round-robin por bloco fixo de 2 aulas → quebrava com aulas longas
#   DEPOIS: preenchimento dia-a-dia até o orçamento + force-fit real
#
#   Bug corrigido: aulas mais longas que minutes_per_day abandonavam
#   todas as aulas seguintes silenciosamente (slot_idx extrapolava a lista)
#
#   Bug corrigido: MAX_LESSONS_PER_BLOCK fixo subutilizava dias com aulas curtas
#
# v5 — Adaptação reativa:
#   inject_subject_reviews(), remove_excess_reviews(), _all_lessons_completed()

from datetime import datetime, timezone, timedelta, date
from collections import defaultdict
from typing import Optional, List, Dict

from app.extensions import db
from app.models.user import User
from app.models.course import Course, Subject, Module, Lesson, LessonProgress
from app.models.question import QuestionAttempt
from app.models.schedule import StudySchedule, ScheduleItem, ScheduleCheckIn


class ScheduleEngine:
    BREAK_MINUTES = 10
    MAX_SCHEDULE_DAYS = 120
    QUESTIONS_BLOCK_MINUTES = 20  # duração fixa da sessão de questões (obrigatória)
    MIN_FREE_FOR_QUESTIONS = 0  # questões agora são obrigatórias (não precisa espaço livre)
    REVIEW_MINUTES = 25  # duração de uma revisão espaçada
    SIMULADO_INTERVAL_LESSONS = 12  # simulado a cada N aulas
    MAX_EFFECTIVE_MINUTES = 480  # teto de 8h/dia

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
        ).update(
            {
                "is_deleted": True,
                "deleted_at": datetime.now(timezone.utc).isoformat(),
            },
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
    # Adaptação reativa por desempenho em questões
    # ─────────────────────────────────────────────────────────────────────────

    def inject_subject_reviews(
        self,
        subject_id: str,
        count: int = None,
        days_window: int = None,
    ) -> int:
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
            id=subject_id, tenant_id=self.tenant_id, is_deleted=False
        ).first()
        if not subject:
            return 0

        today = date.today()
        window_end = today + timedelta(days=days_window)
        today_str = today.isoformat()
        window_str = window_end.isoformat()

        existing_items = ScheduleItem.query.filter(
            ScheduleItem.schedule_id == schedule.id,
            ScheduleItem.scheduled_date >= today_str,
            ScheduleItem.scheduled_date <= window_str,
            ScheduleItem.is_deleted == False,
        ).all()

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
            i.scheduled_date
            for i in existing_items
            if (
                i.subject_id == subject_id
                and i.item_type == "review"
                and i.status == "pending"
            )
        }

        slots = self._generate_day_slots(
            today + timedelta(days=1), max_days=days_window
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
        return sum(1 for a in attempts if a.is_correct) / len(attempts)

    def _all_lessons_completed(self) -> bool:
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
            # FIX: compatível com naive (SQLite/testes) e aware (PostgreSQL/produção)
            created_at = last_attempt.created_at
            if created_at.tzinfo is None:
                created_at = created_at.replace(tzinfo=timezone.utc)
            days_inactive = (datetime.now(timezone.utc) - created_at).days
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
    # Construção do cronograma — v6 (algoritmo dia-a-dia)
    # ─────────────────────────────────────────────────────────────────────────

    def _build_items(self, schedule: StudySchedule, start_date: date):
        """
        Distribui aulas nos slots disponíveis.

        ALGORITMO v6 — preenchimento dia-a-dia:
        Para cada dia disponível:
          1. Round-robin entre disciplinas (prioridade + Subject.order)
          2. Adiciona aulas até o orçamento diário se esgotar
          3. Aula > orçamento: force-fit (ocupa o dia sozinha)
          4. Após aulas: sessão de questões para cada disciplina coberta
          5. A cada 12 aulas: simulado no dia seguinte

        Isso garante que TODAS as aulas sejam agendadas independente da duração.
        """
        priority_map = self._calculate_subject_priorities()
        pending_lessons = self._get_pending_lessons()

        if not pending_lessons:
            schedule.ai_notes = (
                "Todas as aulas já foram assistidas. Foco em revisão e simulados."
            )
            self._add_review_only_plan(schedule, priority_map, start_date)
            return

        # Compressão por data de prova
        compression = self._calculate_compression_factor(
            schedule.target_date, len(pending_lessons)
        )
        effective_minutes = min(
            int(self.minutes_per_day * compression),
            self.MAX_EFFECTIVE_MINUTES,
        )

        # Slots disponíveis
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

        # Pre-load em bulk (elimina N+1 queries)
        module_ids = {l.module_id for l in pending_lessons if l.module_id}
        modules_by_id: Dict[str, Module] = (
            {m.id: m for m in Module.query.filter(Module.id.in_(module_ids)).all()}
            if module_ids
            else {}
        )
        subject_ids_bulk = {
            m.subject_id for m in modules_by_id.values() if m.subject_id
        }
        subjects_by_id: Dict[str, Subject] = (
            {
                s.id: s
                for s in Subject.query.filter(Subject.id.in_(subject_ids_bulk)).all()
            }
            if subject_ids_bulk
            else {}
        )

        # Agrupa aulas por disciplina (ordem do curso preservada)
        lessons_by_subject: Dict[str, List] = defaultdict(list)
        subject_map: Dict[str, Subject] = {}

        for lesson in pending_lessons:
            module = modules_by_id.get(lesson.module_id)
            subject = subjects_by_id.get(module.subject_id) if module else None
            sid = subject.id if subject else "__no_subject__"
            lessons_by_subject[sid].append(lesson)
            if subject:
                subject_map[sid] = subject

        # Ordena disciplinas: prioridade decrescente + Subject.order como desempate
        def _sort_key(sid: str):
            s = subject_map.get(sid)
            return (-priority_map.get(sid, 1.0), (s.order or 0) if s else 999)

        subject_ids_ordered = sorted(lessons_by_subject.keys(), key=_sort_key)

        # Filas de aulas por disciplina (ordem do módulo preservada)
        queues: Dict[str, List] = {
            sid: list(lessons_by_subject[sid]) for sid in subject_ids_ordered
        }

        items_to_add: List[ScheduleItem] = []
        lessons_added = 0
        simulado_days: set = set()
        # Usado para rastrear minutos ocupados por slot (para spaced reviews)
        used_minutes_tracker: Dict[date, int] = defaultdict(int)

        # ── ALGORITMO PRINCIPAL: preenche dia-a-dia ───────────────────────────
        for slot_idx, slot_date in enumerate(available_slots):
            # Para se não há mais aulas para agendar
            if not any(queues[sid] for sid in subject_ids_ordered):
                break

            slot_str = slot_date.isoformat()
            day_used = 0  # minutos usados neste dia
            day_order = 0  # ordem dos itens no dia
            day_subjects: List[str] = []  # disciplinas cobertas hoje

            # Rotação de disciplinas ativas com aulas pendentes
            active_subjects = [sid for sid in subject_ids_ordered if queues[sid]]

            rotation_pos = 0
            consecutive_skips = 0

            while active_subjects:
                if rotation_pos >= len(active_subjects):
                    rotation_pos = 0

                sid = active_subjects[rotation_pos]

                if not queues[sid]:
                    active_subjects.pop(rotation_pos)
                    consecutive_skips = 0
                    if rotation_pos >= len(active_subjects):
                        rotation_pos = 0
                    continue

                lesson = queues[sid][0]
                lesson_dur = max(lesson.duration_minutes or 30, 15)
                lesson_cost = lesson_dur + self.BREAK_MINUTES

                if day_used == 0:
                    # FORCE-FIT: dia vazio → aula SEMPRE é agendada, independente da duração
                    # Isso garante que aulas longas (ex: 3h) não são puladas
                    queues[sid].pop(0)

                    subject = subject_map.get(sid)
                    priority = priority_map.get(sid, 1.0)

                    items_to_add.append(
                        ScheduleItem(
                            tenant_id=self.tenant_id,
                            schedule_id=schedule.id,
                            item_type="lesson",
                            lesson_id=lesson.id,
                            subject_id=sid if sid != "__no_subject__" else None,
                            scheduled_date=slot_str,
                            order=day_order,
                            estimated_minutes=lesson_dur,
                            priority_reason=self._build_priority_reason(
                                subject, priority
                            ),
                            status="pending",
                        )
                    )

                    day_used += lesson_cost
                    day_order += 1
                    lessons_added += 1
                    consecutive_skips = 0

                    if sid not in day_subjects:
                        day_subjects.append(sid)

                    # Aula preencheu ou excedeu o orçamento → dia encerrado
                    if day_used >= effective_minutes:
                        break

                    rotation_pos += 1

                elif day_used + lesson_cost <= effective_minutes:
                    # Espaço disponível: adiciona a aula normalmente
                    queues[sid].pop(0)

                    subject = subject_map.get(sid)
                    priority = priority_map.get(sid, 1.0)

                    items_to_add.append(
                        ScheduleItem(
                            tenant_id=self.tenant_id,
                            schedule_id=schedule.id,
                            item_type="lesson",
                            lesson_id=lesson.id,
                            subject_id=sid if sid != "__no_subject__" else None,
                            scheduled_date=slot_str,
                            order=day_order,
                            estimated_minutes=lesson_dur,
                            priority_reason=self._build_priority_reason(
                                subject, priority
                            ),
                            status="pending",
                        )
                    )

                    day_used += lesson_cost
                    day_order += 1
                    lessons_added += 1
                    consecutive_skips = 0

                    if sid not in day_subjects:
                        day_subjects.append(sid)

                    rotation_pos += 1

                else:
                    # Próxima aula desta disciplina não cabe → tenta outra disciplina
                    rotation_pos += 1
                    consecutive_skips += 1

                    # Se nenhuma disciplina ativa tem aula que caiba, fecha o dia
                    if consecutive_skips >= len(active_subjects):
                        break

            # ── Questões obrigatórias (20 min fixo) para cada disciplina coberta ──
            for sid in day_subjects:
                subject = subject_map.get(sid)
                if not subject:
                    continue

                # Sempre 20 minutos de questões para fixação da aula do dia
                questions_minutes = self.QUESTIONS_BLOCK_MINUTES  # 20 min fixo
                needed = questions_minutes + self.BREAK_MINUTES  # 20 + 10 = 30 min

                items_to_add.append(
                    ScheduleItem(
                        tenant_id=self.tenant_id,
                        schedule_id=schedule.id,
                        item_type="questions",
                        subject_id=sid,
                        scheduled_date=slot_str,
                        order=day_order,
                        estimated_minutes=questions_minutes,
                        priority_reason=f"Fixação: {subject.name}",
                        status="pending",
                    )
                )
                day_used += needed
                day_order += 1

            # Registra minutos usados para spaced reviews
            used_minutes_tracker[slot_date] = day_used

            # ── Simulado a cada N aulas ───────────────────────────────────────
            if (
                lessons_added > 0
                and lessons_added % self.SIMULADO_INTERVAL_LESSONS == 0
            ):
                next_idx = slot_idx + 1
                if next_idx < len(available_slots):
                    sim_date_str = available_slots[next_idx].isoformat()
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

        # ── Revisões espaçadas nos slots restantes ────────────────────────────
        self._add_spaced_reviews(
            schedule,
            available_slots,
            used_minutes_tracker,
            priority_map,
            items_to_add,
            effective_minutes,
        )

        if items_to_add:
            db.session.bulk_save_objects(items_to_add)

        # Nota da IA
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

    # ─────────────────────────────────────────────────────────────────────────
    # Helpers internos
    # ─────────────────────────────────────────────────────────────────────────

    def _add_review_only_plan(self, schedule, priority_map, start_date):
        """Plano de revisão + questões para quem já assistiu tudo."""
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
        """
        Revisões ADAPTATIVAS: apenas para disciplinas com BAIXO DESEMPENHO (< 50%).
        - Accuracy < 50%: injeta revisão em 3, 5, 10, 21 dias após última aula/questão
        - Accuracy >= 50%: sem revisão (aluno está aprendendo)
        - Zero tentativas: sem revisão (aluno começa do zero)
        """
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

            # Zero tentativas: pula revisão (aluno começando do zero)
            if not attempts:
                continue

            # Amostra < 10 tentativas: sem ação
            if len(attempts) < self.ADAPTIVE_MIN_ATTEMPTS:
                continue

            total = len(attempts)
            correct = sum(1 for a in attempts if a.is_correct)
            accuracy = correct / total

            # IMPORTANTE: Só injeta revisão se accuracy < 50% (BAIXO DESEMPENHO)
            if accuracy >= self.ADAPTIVE_INJECT_THRESHOLD:
                continue  # Aluno está aprendendo, sem revisão

            # Accuracy < 50%: precisa revisar
            level = "fraco"
            intervals = self.SPACED_REVIEW_INTERVALS["fraco"]  # [3, 5, 10, 21]

            # Encontra última aula OU questão desta disciplina
            last_item = (
                ScheduleItem.query.filter(
                    ScheduleItem.schedule_id == schedule.id,
                    ScheduleItem.subject_id == subject.id,
                    ScheduleItem.item_type.in_(["lesson", "questions"]),
                    ScheduleItem.is_deleted == False,
                )
                .order_by(ScheduleItem.scheduled_date.desc())
                .first()
            )

            # Base: 3 dias após última aula/questão (mínimo)
            base_date = today
            if last_item:
                try:
                    last_date = date.fromisoformat(last_item.scheduled_date)
                    base_date = last_date + timedelta(days=3)
                except ValueError:
                    pass

            # Agenda revisões nos intervalos
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
                if used_minutes.get(review_date, 0) + needed > effective_minutes:
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
                            f"Revisão adaptativa ({level}): {subject.name} "
                            f"— acerto {round(accuracy * 100)}% (abaixo de 50%)"
                        ),
                        status="pending",
                    )
                )
                used_minutes[review_date] = used_minutes.get(review_date, 0) + needed
                review_tracker.add(tracker_key)
                break  # Só uma revisão por intervalo

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
        """
        Aulas publicadas não assistidas e não agendadas como pendentes.
        Ordenadas por Subject.order → Module.order → Lesson.order.
        """
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
