# api/app/services/schedule_engine.py
# Motor do cronograma inteligente e adaptativo.
#
# Funcionalidades:
# 1. Priorização por peso do edital + performance em questões
# 2. Revisão espaçada (intervalos: 3→7→14→30 dias) por disciplina
# 3. Compressão por data-alvo (prova)
# 4. Agendamento automático de simulados
# 5. Adaptação contínua após check-ins

from datetime import datetime, timezone, timedelta, date
from collections import defaultdict
from typing import Optional
import math

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
    """
    Motor de geração e adaptação do cronograma de estudos.

    Uso:
        engine = ScheduleEngine(user_id, tenant_id, course_id)
        schedule = engine.generate(target_date="2025-12-01")
        schedule = engine.reorganize()
        risk    = engine.calculate_abandonment_risk()
    """

    BREAK_MINUTES = 10
    MAX_SCHEDULE_DAYS = 120
    WEAK_DISCIPLINE_MULTIPLIER = 2.5  # 2.5x para disciplinas fracas
    STRONG_DISCIPLINE_FACTOR = 0.6  # 0.6x para pontos fortes
    WEAK_ACCURACY_THRESHOLD = 0.60  # < 60% = fraco
    STRONG_ACCURACY_THRESHOLD = 0.80  # > 80% = forte
    NEVER_STUDIED_MULTIPLIER = 1.8  # Nunca respondeu questões

    # Intervalos de revisão espaçada em dias por nível de domínio
    SPACED_REVIEW_INTERVALS = {
        "fraco": [3, 5, 10, 21],  # muita revisão
        "regular": [5, 10, 21, 45],  # revisão moderada
        "forte": [14, 30],  # pouca revisão
    }

    # Simulado a cada N aulas assistidas
    SIMULADO_INTERVAL_LESSONS = 12

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
        # Busca qualquer registro, incluindo soft-deleted
        # (constraint UNIQUE não distingue is_deleted)
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
            target_date=target_date,
            availability_snapshot={
                "days": self.available_days,
                "hours_per_day": self.hours_per_day,
            },
            last_reorganized_at=datetime.now(timezone.utc).isoformat(),
        )
        db.session.add(schedule)
        db.session.flush()
        self._build_items(schedule)
        db.session.commit()
        return schedule

    def reorganize(self, schedule: Optional[StudySchedule] = None) -> StudySchedule:
        """
        Reorganiza o cronograma preservando o histórico.
        Remove apenas itens FUTUROS pendentes e redistribui com novos dados.
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

        ScheduleItem.query.filter(
            ScheduleItem.schedule_id == schedule.id,
            ScheduleItem.scheduled_date > today_str,
            ScheduleItem.status == "pending",
            ScheduleItem.is_deleted == False,
        ).delete(synchronize_session=False)

        schedule.status = "active"
        schedule.last_reorganized_at = datetime.now(timezone.utc).isoformat()
        schedule.availability_snapshot = {
            "days": self.available_days,
            "hours_per_day": self.hours_per_day,
        }
        db.session.flush()
        self._build_items(schedule, start_from_today=True)
        db.session.commit()
        return schedule

    def adapt_after_checkin(self, item_id: str) -> bool:
        """
        Disparado após cada check-in. Decide se deve reorganizar.
        Retorna True se reorganizou.
        """
        schedule = StudySchedule.query.filter_by(
            user_id=self.user_id,
            course_id=self.course_id,
            is_deleted=False,
        ).first()
        if not schedule:
            return False

        today_str = date.today().isoformat()

        # Itens atrasados
        overdue = ScheduleItem.query.filter(
            ScheduleItem.schedule_id == schedule.id,
            ScheduleItem.scheduled_date < today_str,
            ScheduleItem.status == "pending",
            ScheduleItem.is_deleted == False,
        ).count()

        # Itens pulados recentemente
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

        should_reorg = overdue >= 4 or len(recent_skipped) >= 3

        if should_reorg:
            self.reorganize(schedule)
            risk = self.calculate_abandonment_risk()
            schedule.abandonment_risk_score = risk
            db.session.commit()
            return True

        # Atualiza apenas o risk score sem reorganizar
        risk = self.calculate_abandonment_risk()
        schedule.abandonment_risk_score = risk
        db.session.commit()
        return False

    def calculate_abandonment_risk(self) -> float:
        """Score de risco de abandono 0.0–1.0."""
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
            if days_inactive >= 14:
                risk += 0.4
            elif days_inactive >= 7:
                risk += 0.25
            elif days_inactive >= 3:
                risk += 0.1

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
            if overdue >= 10:
                risk += 0.3
            elif overdue >= 5:
                risk += 0.2
            elif overdue >= 2:
                risk += 0.1

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
            if accuracy < 0.3:
                risk += 0.3
            elif accuracy < 0.4:
                risk += 0.15

        return round(min(risk, 1.0), 2)

    # ─────────────────────────────────────────────────────────────────────────
    # Construção do cronograma
    # ─────────────────────────────────────────────────────────────────────────

    def _build_items(self, schedule: StudySchedule, start_from_today: bool = False):
        """
        Distribui os itens de estudo nos dias disponíveis.

        Algoritmo:
        1. Calcula prioridade de cada disciplina
        2. Coleta aulas pendentes e ordena por prioridade
        3. Calcula fator de compressão por data-alvo
        4. Distribui nos slots respeitando minutes_per_day
        5. Intercala sessões de questões e revisões espaçadas
        6. Agenda simulados a cada N aulas
        """
        priority_map = self._calculate_subject_priorities()
        pending_lessons = self._get_pending_lessons()

        if not pending_lessons:
            schedule.ai_notes = (
                "Todas as aulas já foram assistidas. Foco em revisão e simulados."
            )
            self._add_review_only_plan(schedule, priority_map)
            return

        # Ordena por prioridade (maior prioridade → aparece antes)
        def lesson_priority(lesson: Lesson) -> float:
            module = Module.query.get(lesson.module_id)
            subject = Subject.query.get(module.subject_id) if module else None
            return priority_map.get(subject.id, 1.0) if subject else 1.0

        sorted_lessons = sorted(pending_lessons, key=lesson_priority, reverse=True)

        # Compressão por data-alvo
        compression = self._calculate_compression_factor(
            schedule.target_date, len(sorted_lessons)
        )

        start = date.today() if start_from_today else date.today()
        available_slots = self._generate_day_slots(start, compression)

        if not available_slots:
            return

        items_to_add = []
        lessons_per_day = defaultdict(list)
        used_minutes = defaultdict(int)
        slot_idx = 0
        lessons_added = 0

        for lesson in sorted_lessons:
            if slot_idx >= len(available_slots):
                break

            slot_date = available_slots[slot_idx]
            lesson_duration = max(lesson.duration_minutes or 30, 15)

            # Passa para o próximo slot se cheio
            while (
                used_minutes[slot_date] + lesson_duration + self.BREAK_MINUTES
                > self.minutes_per_day
            ):
                slot_idx += 1
                if slot_idx >= len(available_slots):
                    break
                slot_date = available_slots[slot_idx]

            if slot_idx >= len(available_slots):
                break

            module = Module.query.get(lesson.module_id)
            subject = Subject.query.get(module.subject_id) if module else None
            priority = priority_map.get(subject.id, 1.0) if subject else 1.0
            priority_reason = self._build_priority_reason(subject, priority)

            items_to_add.append(
                ScheduleItem(
                    tenant_id=self.tenant_id,
                    schedule_id=schedule.id,
                    item_type="lesson",
                    lesson_id=lesson.id,
                    subject_id=subject.id if subject else None,
                    scheduled_date=slot_date.isoformat(),
                    order=len(lessons_per_day[slot_date]),
                    estimated_minutes=lesson_duration,
                    priority_reason=priority_reason,
                    status="pending",
                )
            )

            lessons_per_day[slot_date].append(lesson)
            used_minutes[slot_date] += lesson_duration + self.BREAK_MINUTES
            lessons_added += 1

            # Intercala questões a cada 2 aulas no mesmo dia
            if len(lessons_per_day[slot_date]) % 2 == 0 and subject:
                remaining = self.minutes_per_day - used_minutes[slot_date]
                if remaining >= 15:
                    q_minutes = min(30, remaining)
                    items_to_add.append(
                        ScheduleItem(
                            tenant_id=self.tenant_id,
                            schedule_id=schedule.id,
                            item_type="questions",
                            subject_id=subject.id,
                            scheduled_date=slot_date.isoformat(),
                            order=len(lessons_per_day[slot_date]) + 10,
                            estimated_minutes=q_minutes,
                            priority_reason=f"Fixação: {subject.name}",
                            status="pending",
                        )
                    )
                    used_minutes[slot_date] += q_minutes + self.BREAK_MINUTES

            # Agenda simulado a cada N aulas
            if lessons_added % self.SIMULADO_INTERVAL_LESSONS == 0:
                sim_slot_idx = slot_idx + 1
                if sim_slot_idx < len(available_slots):
                    sim_date = available_slots[sim_slot_idx]
                    items_to_add.append(
                        ScheduleItem(
                            tenant_id=self.tenant_id,
                            schedule_id=schedule.id,
                            item_type="simulado",
                            scheduled_date=sim_date.isoformat(),
                            order=0,
                            estimated_minutes=90,
                            priority_reason=f"Simulado de verificação — após {lessons_added} aulas concluídas",
                            status="pending",
                        )
                    )

        # Revisões espaçadas nos dias com espaço
        self._add_spaced_reviews(
            schedule, available_slots, used_minutes, priority_map, items_to_add
        )

        # Revisões extras para disciplinas fracas
        weak_subjects = [sid for sid, p in priority_map.items() if p >= 1.5]
        self._add_review_sessions(
            schedule,
            available_slots,
            lessons_per_day,
            used_minutes,
            weak_subjects,
            items_to_add,
        )

        db.session.bulk_save_objects(items_to_add)

        # Nota da IA
        weak_names = []
        for sid in weak_subjects[:3]:
            subj = Subject.query.get(sid)
            if subj:
                weak_names.append(subj.name)

        compression_info = (
            f" Plano comprimido {compression:.1f}x por data-alvo."
            if compression > 1.0
            else ""
        )
        schedule.ai_notes = (
            f"Cronograma gerado com {lessons_added} aulas pendentes.{compression_info} "
            f"Disciplinas priorizadas: {', '.join(weak_names) or 'distribuição equilibrada'}. "
            f"Carga diária: {self.hours_per_day}h."
        )

    def _add_review_only_plan(self, schedule: StudySchedule, priority_map: dict):
        """Plano de revisão para quem já assistiu tudo."""
        slots = self._generate_day_slots(date.today())
        items = []
        weak_subjects = sorted(priority_map.items(), key=lambda x: x[1], reverse=True)[
            :5
        ]
        for i, (sid, priority) in enumerate(weak_subjects):
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
                    scheduled_date=slots[i * 2 % len(slots)].isoformat(),
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
                    scheduled_date=slots[i * 2 % len(slots)].isoformat(),
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
        Para cada disciplina com aulas já assistidas, agenda revisões
        em intervalos crescentes baseados no nível de domínio.

        Intervalos:
        - fraco:   3, 5, 10, 21 dias
        - regular: 5, 10, 21, 45 dias
        - forte:   14, 30 dias
        """
        subjects = Subject.query.filter_by(
            course_id=self.course_id,
            tenant_id=self.tenant_id,
            is_deleted=False,
        ).all()

        today = date.today()
        slot_set = {s.isoformat(): s for s in slots}

        for subject in subjects:
            # Performance do aluno
            attempts = (
                QuestionAttempt.query.filter_by(
                    user_id=self.user_id,
                    tenant_id=self.tenant_id,
                    is_deleted=False,
                )
                .join(QuestionAttempt.question)
                .filter_by(
                    subject_id=subject.id,
                )
                .all()
            )

            if not attempts:
                continue

            total = len(attempts)
            correct = sum(1 for a in attempts if a.is_correct)
            accuracy = correct / total

            if accuracy < self.WEAK_ACCURACY_THRESHOLD:
                level = "fraco"
                intervals = self.SPACED_REVIEW_INTERVALS["fraco"]
            elif accuracy < self.STRONG_ACCURACY_THRESHOLD:
                level = "regular"
                intervals = self.SPACED_REVIEW_INTERVALS["regular"]
            else:
                level = "forte"
                intervals = self.SPACED_REVIEW_INTERVALS["forte"]

            # Verifica a última revisão desta disciplina já agendada
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
                    base_date = today

            for interval in intervals:
                review_date = base_date + timedelta(days=interval)
                review_str = review_date.isoformat()

                if review_str not in slot_set:
                    continue
                if used_minutes[review_date] + 25 > self.minutes_per_day:
                    continue

                items_to_add.append(
                    ScheduleItem(
                        tenant_id=self.tenant_id,
                        schedule_id=schedule.id,
                        item_type="review",
                        subject_id=subject.id,
                        scheduled_date=review_str,
                        order=50,
                        estimated_minutes=25,
                        priority_reason=f"Revisão espaçada ({level}): {subject.name} — acerto {round(accuracy*100)}%",
                        status="pending",
                    )
                )
                used_minutes[review_date] += 25 + self.BREAK_MINUTES
                break  # Um intervalo por vez

    def _add_review_sessions(
        self,
        schedule,
        slots,
        lessons_per_day,
        used_minutes,
        weak_subject_ids,
        items_to_add,
    ):
        """Revisões extras para disciplinas fracas nos dias com espaço livre."""
        if not weak_subject_ids:
            return

        idx = 0
        for slot_date in slots:
            remaining = self.minutes_per_day - used_minutes[slot_date]
            if remaining >= 20 and idx < len(weak_subject_ids):
                subject_id = weak_subject_ids[idx % len(weak_subject_ids)]
                subject = Subject.query.get(subject_id)
                if subject:
                    items_to_add.append(
                        ScheduleItem(
                            tenant_id=self.tenant_id,
                            schedule_id=schedule.id,
                            item_type="review",
                            subject_id=subject_id,
                            scheduled_date=slot_date.isoformat(),
                            order=99,
                            estimated_minutes=min(20, remaining),
                            priority_reason=f"Revisão prioritária: {subject.name} (ponto fraco)",
                            status="pending",
                        )
                    )
                    used_minutes[slot_date] += min(20, remaining) + self.BREAK_MINUTES
                    idx += 1

    # ─────────────────────────────────────────────────────────────────────────
    # Priorização
    # ─────────────────────────────────────────────────────────────────────────

    def _calculate_subject_priorities(self) -> dict:
        """
        Prioridade = edital_weight × fator_performance

        Fatores:
        - Nunca estudou:    × 1.8
        - Acerto < 60%:     × 2.5  (ponto fraco)
        - Acerto 60-80%:    × 1.0  (regular)
        - Acerto > 80%:     × 0.6  (ponto forte)
        """
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
                .filter_by(
                    subject_id=subject.id,
                )
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

    def _calculate_compression_factor(
        self, target_date: Optional[str], lessons_remaining: int
    ) -> float:
        """
        Se o aluno tem data de prova definida, calcula o quanto o cronograma
        precisa ser comprimido para caber no tempo disponível.

        Ex: 60 aulas, disponível 30 dias de estudo, cada dia cabe 2 aulas → ok
            60 aulas, disponível 15 dias → comprime 2x (mais aulas por dia)
        """
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

        # Slots disponíveis até a data-alvo
        slots = self._generate_day_slots(today, max_days=days_left)
        if not slots:
            return 1.0

        # Capacidade por dia em aulas (estimando 40min/aula)
        avg_lesson_minutes = 40
        lessons_per_slot = max(
            1, self.minutes_per_day // (avg_lesson_minutes + self.BREAK_MINUTES)
        )
        capacity = len(slots) * lessons_per_slot

        if capacity >= lessons_remaining:
            return 1.0  # Cabe sem comprimir

        # Factor de compressão: mais aulas por dia
        compression = lessons_remaining / max(capacity, 1)
        return round(min(compression, 3.0), 2)  # Máximo 3x

    def _get_pending_lessons(self) -> list:
        """Aulas publicadas do curso que o aluno ainda não assistiu."""
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
        self, start_date: date, compression: float = 1.0, max_days: Optional[int] = None
    ) -> list:
        """Gera lista de datas disponíveis para estudo."""
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
