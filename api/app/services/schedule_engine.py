# api/app/services/schedule_engine.py
# Motor do cronograma inteligente e adaptativo — v3
#
# Correções em relação à v2:
#   - Bug 1 corrigido: slot_idx nunca incrementa duas vezes para o mesmo bloco
#   - Bug 2 corrigido: reorganize começa AMANHÃ, não hoje (evita empilhar no dia atual)
#   - Bug 3 corrigido: removido already_scheduled_ids (causava cache inconsistente)
#
# Lógica de distribuição:
#   1. Agrupa aulas pendentes por disciplina (ordem do edital preservada)
#   2. Ordena disciplinas por prioridade (pontos fracos/nunca estudados primeiro)
#   3. Monta lista de BLOCOS: cada bloco = 1 disciplina × MAX_LESSONS_PER_BLOCK aulas
#   4. Distribui blocos sequencialmente nos slots disponíveis (1 bloco por slot)
#   5. Adiciona sessão de questões após aulas, se sobrar tempo no dia
#   6. Simulado a cada 12 aulas
#   7. Revisões espaçadas preenchem os dias com tempo livre

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
    BREAK_MINUTES = 10  # pausa entre atividades
    MAX_SCHEDULE_DAYS = 120  # janela máxima de planejamento
    MAX_LESSONS_PER_BLOCK = 2  # máx aulas da mesma disciplina por dia
    QUESTIONS_BLOCK_MINUTES = 30  # duração da sessão de questões pós-aulas
    MIN_FREE_FOR_QUESTIONS = 25  # mínimo de minutos livres para adicionar questões
    REVIEW_MINUTES = 25  # duração da sessão de revisão espaçada
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

        FIX Bug 2: começa a reagendar a partir de AMANHÃ para não empilhar
        no dia atual que já pode ter itens pendentes.
        """
        if not schedule:
            schedule = StudySchedule.query.filter_by(
                user_id=self.user_id,
                course_id=self.course_id,
                is_deleted=False,
            ).first()
            if not schedule:
                return self.generate()

        today_str = date.today().isoformat()
        tomorrow = date.today() + timedelta(days=1)
        tomorrow_str = tomorrow.isoformat()

        # ── FIX Bug 2: deleta a partir de AMANHÃ, não de hoje ────────────────
        # Assim os itens de hoje (já visíveis ao aluno) são preservados
        deleted_count = ScheduleItem.query.filter(
            ScheduleItem.schedule_id == schedule.id,
            ScheduleItem.scheduled_date >= tomorrow_str,
            ScheduleItem.status == "pending",
            ScheduleItem.is_deleted == False,
        ).delete(
            synchronize_session="fetch"
        )  # FIX Bug 3: "fetch" mantém sessão consistente

        schedule.status = "active"
        schedule.last_reorganized_at = datetime.now(timezone.utc).isoformat()
        schedule.availability_snapshot = {
            "days": self.available_days,
            "hours_per_day": self.hours_per_day,
        }
        db.session.flush()

        # Reagenda a partir de amanhã
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
    # Construção do cronograma — algoritmo v3
    # ─────────────────────────────────────────────────────────────────────────

    def _build_items(self, schedule: StudySchedule, start_date: date):
        """
        Distribui aulas nos slots disponíveis.

        Etapa 1 — Monta blocos:
            Para cada disciplina (ordem de prioridade), agrupa as aulas pendentes
            em blocos de até MAX_LESSONS_PER_BLOCK aulas.
            Ex: Disciplina A com 5 aulas → [bloco A1: aulas 1-2], [bloco A2: aulas 3-4], [bloco A3: aula 5]

        Etapa 2 — Intercala blocos (round-robin):
            [A1, B1, C1, A2, B2, C2, A3, ...]
            Isso garante rotação entre disciplinas.

        Etapa 3 — Distribui no calendário:
            Cada bloco recebe UM slot de dia.
            Se o bloco cabe no dia → adiciona. Se não → avança para o próximo dia.
            Após as aulas do bloco, adiciona sessão de questões se sobrar tempo.

        Etapa 4 — Simulados e revisões:
            Simulado a cada SIMULADO_INTERVAL_LESSONS aulas.
            Revisões espaçadas preenchem dias com espaço livre.
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

        # ── Etapa 2: monta lista intercalada de blocos ────────────────────────
        # Cada bloco = (subject_id, [lesson1, lesson2])
        # Round-robin: pega 1 bloco de cada disciplina por rodada
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

            # Calcula duração total do bloco
            block_duration = sum(
                max(l.duration_minutes or 30, 15) for l in block_lessons
            )
            block_with_breaks = block_duration + self.BREAK_MINUTES * len(block_lessons)

            # FIX Bug 1: avança slot UMA ÚNICA VEZ até encontrar dia com espaço
            # Nunca incrementa slot_idx duas vezes para o mesmo bloco
            attempts = 0
            while slot_idx < len(available_slots):
                slot_date = available_slots[slot_idx]
                if used_minutes[slot_date] + block_with_breaks <= self.minutes_per_day:
                    break  # dia tem espaço — usa este slot
                slot_idx += 1
                attempts += 1
                if attempts > len(available_slots):
                    break  # proteção contra loop infinito

            if slot_idx >= len(available_slots):
                break

            slot_date = available_slots[slot_idx]

            # Adiciona as aulas do bloco
            for order_idx, lesson in enumerate(block_lessons):
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

            # Sessão de questões após o bloco, se sobrar tempo
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
                        order=len(block_lessons) + 1,
                        estimated_minutes=q_min,
                        priority_reason=f"Fixação: {subject.name}",
                        status="pending",
                    )
                )
                used_minutes[slot_date] += q_min + self.BREAK_MINUTES

            # Simulado a cada N aulas (no próximo dia disponível, sem duplicar)
            if (
                lessons_added > 0
                and lessons_added % self.SIMULADO_INTERVAL_LESSONS == 0
            ):
                sim_slot_idx = slot_idx + 1
                if sim_slot_idx < len(available_slots):
                    sim_date = available_slots[sim_slot_idx]
                    sim_date_str = sim_date.isoformat()
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

            # Avança para o próximo slot — UMA SÓ VEZ por bloco
            slot_idx += 1

        # ── Etapa 4: revisões espaçadas ───────────────────────────────────────
        self._add_spaced_reviews(
            schedule, available_slots, used_minutes, priority_map, items_to_add
        )

        if items_to_add:
            db.session.bulk_save_objects(items_to_add)

        # Notas do AI
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
            items.append(
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
                )
            )
            items.append(
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
                )
            )
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
        Revisão = sessão de questões das erradas anteriormente.
        Preenche apenas slots com tempo livre — nunca comprime o dia.
        """
        subjects = Subject.query.filter_by(
            course_id=self.course_id,
            tenant_id=self.tenant_id,
            is_deleted=False,
        ).all()

        today = date.today()
        slot_date_set = {s.isoformat(): s for s in slots}
        review_tracker = set()  # (subject_id, date_str) — evita duplicatas

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

            # Data base: última revisão já agendada
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
                # Verifica se já há revisão desta disciplina neste dia nos novos itens
                already = any(
                    i.item_type == "review"
                    and i.subject_id == subject.id
                    and i.scheduled_date == review_str
                    for i in items_to_add
                )
                if already:
                    continue
                # Verifica se sobra tempo
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
                break  # um intervalo por vez por disciplina

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
        Aulas publicadas do curso que o aluno ainda não assistiu.

        FIX Bug 3: removido 'already_scheduled_ids' que causava inconsistência
        de cache com synchronize_session=False. Após reorganize deletar os itens
        futuros, esta query retorna corretamente todas as aulas não assistidas.
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

        return [l for l in all_lessons if l.id not in watched_ids]

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
