# api/app/services/schedule_engine.py
# Motor do cronograma inteligente e adaptativo — v4
#
# Correções em relação à v3:
#   Bug 1 (PRINCIPAL): _get_pending_lessons agora exclui aulas já agendadas
#     como "pending" — evita duplicar aulas de hoje nos dias futuros
#   Bug 2: Aula mais longa que minutes_per_day não trava mais o for loop;
#     é agendada sozinha no próximo slot disponível (force-fit)
#   Bug 3: source_type adicionado ao _serialize_schedule (feito em routes/schedule.py)

from datetime import datetime, timezone, timedelta, date
from collections import defaultdict
from typing import Optional, List, Tuple

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
    MAX_LESSONS_PER_BLOCK = 2  # máx aulas da mesma disciplina por dia
    QUESTIONS_BLOCK_MINUTES = 30  # duração sessão de questões pós-aulas
    MIN_FREE_FOR_QUESTIONS = 25  # mínimo livre para adicionar questões
    REVIEW_MINUTES = 25  # duração sessão de revisão espaçada
    SIMULADO_INTERVAL_LESSONS = 12  # simulado a cada N aulas

    WEAK_DISCIPLINE_MULTIPLIER = 2.5
    STRONG_DISCIPLINE_FACTOR = 0.6
    WEAK_ACCURACY_THRESHOLD = 0.60
    STRONG_ACCURACY_THRESHOLD = 0.80
    NEVER_STUDIED_MULTIPLIER = 1.8

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
        """Gera cronograma do zero. Se já existe, reorganiza."""
        existing = StudySchedule.query.filter_by(
            user_id=self.user_id,
            course_id=self.course_id,
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
        """
        Reorganiza preservando itens concluídos/pulados de hoje e anteriores.
        Remove apenas itens FUTUROS pendentes (a partir de amanhã).
        Começa a reagendar de amanhã para não empilhar no dia atual.
        """
        if not schedule:
            schedule = StudySchedule.query.filter_by(
                user_id=self.user_id,
                course_id=self.course_id,
                is_deleted=False,
            ).first()
            if not schedule:
                return self.generate()

        tomorrow = date.today() + timedelta(days=1)
        tomorrow_str = tomorrow.isoformat()

        # synchronize_session="fetch" garante que a sessão SQLAlchemy
        # reflete imediatamente o delete (evita cache inconsistente)
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
            days_inactive = (datetime.now(timezone.utc) - last_attempt.created_at).days
            risk += (
                0.4
                if days_inactive >= 14
                else 0.25 if days_inactive >= 7 else 0.1 if days_inactive >= 3 else 0
            )

        schedule = StudySchedule.query.filter_by(
            user_id=self.user_id,
            course_id=self.course_id,
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
    # Construção do cronograma — v4
    # ─────────────────────────────────────────────────────────────────────────

    def _build_items(self, schedule: StudySchedule, start_date: date):
        """
        Distribui aulas nos slots disponíveis.

        Etapa 1 — Agrupa pendentes por disciplina (excluindo já agendadas)
        Etapa 2 — Monta blocos intercalados via round-robin entre disciplinas
        Etapa 3 — Distribui 1 bloco por slot, força aulas longas em slot próprio
        Etapa 4 — Adiciona questões se sobrar tempo no dia
        Etapa 5 — Simulados a cada 12 aulas
        Etapa 6 — Revisões espaçadas preenchem dias com tempo livre
        """
        priority_map = self._calculate_subject_priorities()
        pending_lessons = self._get_pending_lessons()

        if not pending_lessons:
            schedule.ai_notes = (
                "Todas as aulas já foram assistidas. Foco em revisão e simulados."
            )
            self._add_review_only_plan(schedule, priority_map, start_date)
            return

        # ── Etapa 1: agrupa por disciplina ────────────────────────────────────
        lessons_by_subject: dict[str, List] = defaultdict(list)
        subject_map: dict[str, Subject] = {}

        for lesson in pending_lessons:
            module = Module.query.get(lesson.module_id)
            subject = Subject.query.get(module.subject_id) if module else None
            sid = subject.id if subject else "__no_subject__"
            lessons_by_subject[sid].append(lesson)
            if subject:
                subject_map[sid] = subject

        # Ordena disciplinas por prioridade decrescente
        subject_ids_ordered = sorted(
            lessons_by_subject.keys(),
            key=lambda sid: priority_map.get(sid, 1.0),
            reverse=True,
        )

        # ── Etapa 2: round-robin de blocos ────────────────────────────────────
        # Cada bloco = (subject_id, [lesson1, lesson2])
        # Uma rodada percorre todas as disciplinas pegando 1 bloco de cada
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

        # ── Etapa 3: distribui blocos nos slots ───────────────────────────────
        compression = self._calculate_compression_factor(
            schedule.target_date, len(pending_lessons)
        )
        available_slots = self._generate_day_slots(start_date, compression)

        if not available_slots:
            return

        items_to_add: List[ScheduleItem] = []
        used_minutes: dict[date, int] = defaultdict(int)
        slot_idx = 0
        lessons_added = 0
        simulado_days: set[str] = set()

        for sid, block_lessons in all_blocks:
            if slot_idx >= len(available_slots):
                break

            subject = subject_map.get(sid)
            priority = priority_map.get(sid, 1.0)
            reason = self._build_priority_reason(subject, priority)

            # Duração total do bloco com pausas
            block_duration = sum(
                max(l.duration_minutes or 30, 15) for l in block_lessons
            )
            block_with_breaks = block_duration + self.BREAK_MINUTES * len(block_lessons)

            # ── FIX Bug 2: force-fit para blocos maiores que o dia ────────────
            # Se o bloco inteiro não cabe em nenhum dia, reduz para 1 aula por vez
            effective_blocks: List[List] = []
            if block_with_breaks > self.minutes_per_day:
                # Agenda cada aula individualmente (force-fit)
                for lesson in block_lessons:
                    effective_blocks.append([lesson])
            else:
                effective_blocks.append(block_lessons)

            for sub_block in effective_blocks:
                if slot_idx >= len(available_slots):
                    break

                sub_duration = sum(max(l.duration_minutes or 30, 15) for l in sub_block)
                sub_with_breaks = sub_duration + self.BREAK_MINUTES * len(sub_block)

                # Encontra próximo slot com espaço suficiente
                # Proteção: nunca itera mais do que o total de slots disponíveis
                start_search = slot_idx
                while slot_idx < len(available_slots):
                    slot_date = available_slots[slot_idx]
                    fits = (
                        used_minutes[slot_date] + sub_with_breaks
                        <= self.minutes_per_day
                    )
                    if fits:
                        break
                    # Dia cheio — avança
                    slot_idx += 1
                    # Se percorreu todos os slots sem achar espaço,
                    # usa o próximo slot mesmo assim (força agendamento)
                    if slot_idx - start_search > len(available_slots):
                        break

                if slot_idx >= len(available_slots):
                    break

                slot_date = available_slots[slot_idx]

                # Adiciona as aulas do sub-bloco
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

                # Sessão de questões após o sub-bloco (se sobrar tempo)
                remaining = self.minutes_per_day - used_minutes[slot_date]
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

                # Simulado a cada N aulas
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

                # Avança para o próximo slot — SEMPRE 1 por sub-bloco
                slot_idx += 1

        # ── Etapa 6: revisões espaçadas ───────────────────────────────────────
        self._add_spaced_reviews(
            schedule, available_slots, used_minutes, priority_map, items_to_add
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
        """Plano de revisão + questões para quem já assistiu tudo."""
        slots = self._generate_day_slots(start_date)
        items = []
        weak_subjects = sorted(priority_map.items(), key=lambda x: x[1], reverse=True)[
            :5
        ]
        for i, (sid, _) in enumerate(weak_subjects):
            if i >= len(slots):
                break
            subject = Subject.query.get(sid)
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

    # ─────────────────────────────────────────────────────────────────────────
    # Revisão espaçada
    # ─────────────────────────────────────────────────────────────────────────

    def _add_spaced_reviews(
        self, schedule, slots, used_minutes, priority_map, items_to_add
    ):
        """
        Agenda revisões espaçadas para disciplinas com questões respondidas.
        Revisão = sessão de questões das anteriormente erradas.
        Preenche apenas slots com tempo livre — nunca comprime o dia.
        """
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
                if used_minutes[review_date] + needed > self.minutes_per_day:
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

    # ─────────────────────────────────────────────────────────────────────────
    # Priorização
    # ─────────────────────────────────────────────────────────────────────────

    def _calculate_subject_priorities(self) -> dict:
        subjects = Subject.query.filter_by(
            course_id=self.course_id,
            tenant_id=self.tenant_id,
            is_deleted=False,
        ).all()

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

    # ─────────────────────────────────────────────────────────────────────────
    # Helpers
    # ─────────────────────────────────────────────────────────────────────────

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
        Aulas publicadas do curso que o aluno ainda não assistiu
        E que ainda não estão agendadas como pendentes no cronograma atual.

        FIX Bug 1: exclui lesson_ids que já existem em ScheduleItems pendentes
        (incluindo os de HOJE preservados pelo reorganize).
        Isso evita que a mesma aula apareça em dois dias diferentes.
        """
        # IDs das aulas já assistidas
        watched_ids = set(
            p.lesson_id
            for p in LessonProgress.query.filter_by(
                user_id=self.user_id,
                tenant_id=self.tenant_id,
                status="watched",
                is_deleted=False,
            ).all()
        )

        # ── FIX Bug 1 ─────────────────────────────────────────────────────────
        # IDs das aulas já agendadas como pendentes em qualquer data futura
        # (inclui os itens de hoje que foram preservados pelo reorganize)
        already_scheduled_ids = set(
            item.lesson_id
            for item in (
                ScheduleItem.query.join(
                    StudySchedule, ScheduleItem.schedule_id == StudySchedule.id
                )
                .filter(
                    StudySchedule.user_id == self.user_id,
                    StudySchedule.course_id == self.course_id,
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
        # ─────────────────────────────────────────────────────────────────────

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
