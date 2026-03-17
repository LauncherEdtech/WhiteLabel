# api/app/services/schedule_engine.py
# Motor do cronograma inteligente.
# Responsável por gerar, priorizar e reorganizar o plano de estudos do aluno.
#
# Lógica central:
# 1. Coleta disponibilidade do aluno (dias/horas)
# 2. Coleta performance por disciplina (analytics)
# 3. Calcula peso de prioridade de cada disciplina/aula
# 4. Distribui itens nos dias disponíveis respeitando carga horária
# 5. Reorganiza quando aluno atrasa ou muda rotina

from datetime import datetime, timezone, timedelta, date
from collections import defaultdict
from typing import Optional

from app.extensions import db
from app.models.user import User
from app.models.course import Course, Subject, Module, Lesson, LessonProgress, CourseEnrollment
from app.models.question import QuestionAttempt
from app.models.schedule import StudySchedule, ScheduleItem, ScheduleCheckIn


class ScheduleEngine:
    """
    Motor de geração e adaptação do cronograma de estudos.

    Uso:
        engine = ScheduleEngine(user_id, tenant_id, course_id)
        schedule = engine.generate()      # Gera do zero
        schedule = engine.reorganize()    # Adapta cronograma existente
    """

    # Minutos de buffer entre itens (pausa)
    BREAK_MINUTES = 10

    # Número máximo de dias que o cronograma cobre
    MAX_SCHEDULE_DAYS = 90

    # Peso extra para disciplinas fracas na priorização
    WEAK_DISCIPLINE_MULTIPLIER = 2.0

    # Limiar de taxa de acerto para considerar disciplina "fraca"
    WEAK_ACCURACY_THRESHOLD = 0.60

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

        # Disponibilidade do aluno
        avail = self.user.study_availability or {}
        self.available_days = avail.get("days", [0, 1, 2, 3, 4])  # 0=seg…6=dom
        self.hours_per_day = avail.get("hours_per_day", 2)
        self.minutes_per_day = self.hours_per_day * 60

    # ── API pública ───────────────────────────────────────────────────────────

    def generate(self, target_date: Optional[str] = None) -> StudySchedule:
        """
        Gera um novo cronograma do zero para o aluno neste curso.
        Se já existir um cronograma ativo, reorganiza-o.
        """
        existing = StudySchedule.query.filter_by(
            user_id=self.user_id,
            course_id=self.course_id,
            is_deleted=False,
        ).first()

        if existing:
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
        Reorganiza o cronograma existente.
        Remove itens pendentes futuros e redistribui levando em conta:
        - Itens já concluídos (mantém)
        - Novos dados de performance (priorização atualizada)
        - Aulas ainda não assistidas
        - Data atual (não agenda no passado)
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

        # Remove apenas itens FUTUROS pendentes (preserva histórico)
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

    def calculate_abandonment_risk(self) -> float:
        """
        Calcula score de risco de abandono (0.0 = ok, 1.0 = alto risco).

        Fatores:
        - Dias sem atividade
        - Items do cronograma ignorados consecutivamente
        - Taxa de acerto muito baixa (frustração)
        - Tendência de queda no engajamento
        """
        risk = 0.0

        # ── Fator 1: Inatividade ──────────────────────────────────────────────
        last_attempt = QuestionAttempt.query.filter_by(
            user_id=self.user_id,
            tenant_id=self.tenant_id,
            is_deleted=False,
        ).order_by(QuestionAttempt.created_at.desc()).first()

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

        # ── Fator 2: Itens do cronograma ignorados ────────────────────────────
        schedule = StudySchedule.query.filter_by(
            user_id=self.user_id,
            course_id=self.course_id,
            is_deleted=False,
        ).first()

        if schedule:
            today_str = date.today().isoformat()
            # Itens passados que ficaram como pending (não foram feitos nem marcados)
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

        # ── Fator 3: Taxa de acerto muito baixa ───────────────────────────────
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

    # ── Construção do cronograma ──────────────────────────────────────────────

    def _build_items(self, schedule: StudySchedule, start_from_today: bool = False):
        """
        Distribui os itens de estudo nos dias disponíveis.

        Algoritmo:
        1. Coleta todas as lições não concluídas
        2. Calcula prioridade de cada disciplina
        3. Ordena lições por prioridade
        4. Distribui nos slots de dias disponíveis
        5. Intercala sessões de questões para fixação
        """
        priority_map = self._calculate_subject_priorities()
        pending_lessons = self._get_pending_lessons()

        if not pending_lessons:
            schedule.ai_notes = "Todas as aulas foram concluídas! Foque em revisão e questões."
            return

        # Ordena lições por prioridade (maior prioridade primeiro)
        def lesson_priority(lesson: Lesson) -> float:
            module = Module.query.get(lesson.module_id)
            if not module:
                return 1.0
            subject = Subject.query.get(module.subject_id)
            if not subject:
                return 1.0
            return priority_map.get(subject.id, 1.0)

        sorted_lessons = sorted(pending_lessons, key=lesson_priority, reverse=True)

        # Gera slots de dias disponíveis a partir de hoje
        start_date = date.today() if start_from_today else date.today()
        available_slots = self._generate_day_slots(start_date)

        if not available_slots:
            return

        # Distribui lições + sessões de questões
        slot_idx = 0
        items_to_add = []
        lessons_per_day: dict = defaultdict(list)

        for lesson in sorted_lessons:
            if slot_idx >= len(available_slots):
                break

            slot_date = available_slots[slot_idx]
            used_minutes = sum(
                l.duration_minutes + self.BREAK_MINUTES
                for l in lessons_per_day[slot_date]
            )

            lesson_duration = lesson.duration_minutes or 30

            # Se não couber no dia, vai para o próximo
            if used_minutes + lesson_duration > self.minutes_per_day:
                slot_idx += 1
                if slot_idx >= len(available_slots):
                    break
                slot_date = available_slots[slot_idx]
                used_minutes = 0

            lessons_per_day[slot_date].append(lesson)

            module = Module.query.get(lesson.module_id)
            subject = Subject.query.get(module.subject_id) if module else None
            priority = priority_map.get(subject.id, 1.0) if subject else 1.0
            priority_reason = self._build_priority_reason(subject, priority)

            items_to_add.append(ScheduleItem(
                tenant_id=self.tenant_id,
                schedule_id=schedule.id,
                item_type="lesson",
                lesson_id=lesson.id,
                subject_id=subject.id if subject else None,
                scheduled_date=slot_date.isoformat(),
                order=len(lessons_per_day[slot_date]) - 1,
                estimated_minutes=lesson_duration,
                priority_reason=priority_reason,
                status="pending",
            ))

            used_minutes += lesson_duration + self.BREAK_MINUTES

            # Intercala sessão de questões após cada 2 aulas
            if len(lessons_per_day[slot_date]) % 2 == 0 and subject:
                remaining = self.minutes_per_day - used_minutes
                if remaining >= 15:
                    items_to_add.append(ScheduleItem(
                        tenant_id=self.tenant_id,
                        schedule_id=schedule.id,
                        item_type="questions",
                        subject_id=subject.id,
                        scheduled_date=slot_date.isoformat(),
                        order=len(lessons_per_day[slot_date]),
                        estimated_minutes=min(30, remaining),
                        priority_reason=f"Fixação: {subject.name}",
                        status="pending",
                    ))
                    used_minutes += 30 + self.BREAK_MINUTES

        # Adiciona sessões extras de revisão nos dias mais fracos
        weak_subjects = [
            sid for sid, priority in priority_map.items()
            if priority >= 1.5
        ]
        self._add_review_sessions(
            schedule, available_slots, lessons_per_day,
            weak_subjects, items_to_add
        )

        db.session.bulk_save_objects(items_to_add)

        # Nota da IA sobre o cronograma gerado
        weak_names = []
        for sid in weak_subjects[:3]:
            subj = Subject.query.get(sid)
            if subj:
                weak_names.append(subj.name)

        schedule.ai_notes = (
            f"Cronograma gerado com {len(sorted_lessons)} aulas pendentes. "
            f"Disciplinas priorizadas: {', '.join(weak_names) or 'distribuição equilibrada'}. "
            f"Carga diária: {self.hours_per_day}h nos dias selecionados."
        )

    def _calculate_subject_priorities(self) -> dict:
        """
        Calcula prioridade de cada disciplina.

        Fórmula:
        - Base: peso do edital (edital_weight)
        - Multiplicador: 2x se taxa de acerto < 60% (ponto fraco)
        - Multiplicador: 1.5x se nunca respondeu questões da disciplina
        - Divisor: 0.5x se taxa de acerto > 80% (ponto forte, menos urgente)

        Retorna dict: {subject_id: priority_score}
        """
        subjects = Subject.query.filter_by(
            course_id=self.course_id,
            tenant_id=self.tenant_id,
            is_deleted=False,
        ).all()

        priorities = {}

        for subject in subjects:
            base = subject.edital_weight or 1.0

            # Performance do aluno nesta disciplina
            attempts = QuestionAttempt.query.filter_by(
                user_id=self.user_id,
                tenant_id=self.tenant_id,
                is_deleted=False,
            ).join(
                QuestionAttempt.question
            ).filter_by(
                subject_id=subject.id,
            ).all()

            if not attempts:
                # Nunca estudou: prioridade alta
                priority = base * 1.5
            else:
                total = len(attempts)
                correct = sum(1 for a in attempts if a.is_correct)
                accuracy = correct / total

                if accuracy < self.WEAK_ACCURACY_THRESHOLD:
                    # Ponto fraco: prioridade alta
                    priority = base * self.WEAK_DISCIPLINE_MULTIPLIER
                elif accuracy > 0.80:
                    # Ponto forte: pode dar menos atenção
                    priority = base * 0.7
                else:
                    priority = base

            priorities[subject.id] = round(priority, 2)

        return priorities

    def _get_pending_lessons(self) -> list:
        """
        Retorna aulas do curso que o aluno ainda não assistiu.
        Exclui aulas já marcadas como 'watched'.
        """
        # IDs de aulas já assistidas
        watched_ids = set(
            p.lesson_id for p in LessonProgress.query.filter_by(
                user_id=self.user_id,
                tenant_id=self.tenant_id,
                status="watched",
                is_deleted=False,
            ).all()
        )

        # Todas as aulas publicadas do curso
        all_lessons = (
            Lesson.query
            .join(Module, Lesson.module_id == Module.id)
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

    def _generate_day_slots(self, start_date: date) -> list:
        """
        Gera lista de datas disponíveis para estudo
        com base na disponibilidade do aluno.
        Limita ao MAX_SCHEDULE_DAYS.
        """
        slots = []
        current = start_date
        end = start_date + timedelta(days=self.MAX_SCHEDULE_DAYS)

        while current <= end and len(slots) < self.MAX_SCHEDULE_DAYS:
            # weekday(): 0=segunda, 6=domingo — mesmo padrão do frontend
            if current.weekday() in self.available_days:
                slots.append(current)
            current += timedelta(days=1)

        return slots

    def _add_review_sessions(self, schedule: StudySchedule, slots: list,
                              lessons_per_day: dict, weak_subject_ids: list,
                              items_to_add: list):
        """
        Adiciona sessões de revisão nos dias com espaço sobrando
        para as disciplinas mais fracas.
        """
        if not weak_subject_ids:
            return

        weak_idx = 0
        for slot_date in slots:
            used = sum(
                l.duration_minutes + self.BREAK_MINUTES
                for l in lessons_per_day[slot_date]
            )
            remaining = self.minutes_per_day - used

            # Adiciona revisão se tiver pelo menos 20min sobrando
            if remaining >= 20 and weak_idx < len(weak_subject_ids):
                subject_id = weak_subject_ids[weak_idx % len(weak_subject_ids)]
                subject = Subject.query.get(subject_id)
                if subject:
                    items_to_add.append(ScheduleItem(
                        tenant_id=self.tenant_id,
                        schedule_id=schedule.id,
                        item_type="review",
                        subject_id=subject_id,
                        scheduled_date=slot_date.isoformat(),
                        order=99,
                        estimated_minutes=min(20, remaining),
                        priority_reason=f"Revisão prioritária: {subject.name} (ponto fraco)",
                        status="pending",
                    ))
                weak_idx += 1

    def _build_priority_reason(self, subject: Optional[Subject],
                                priority: float) -> str:
        """Gera texto explicando o motivo da priorização."""
        if not subject:
            return "Sequência do curso"

        if priority >= 2.0:
            return f"Prioridade alta: taxa de acerto baixa em {subject.name}"
        elif priority >= 1.5:
            return f"Conteúdo novo em {subject.name} — ainda não praticado"
        elif priority <= 0.8:
            return f"Manutenção: {subject.name} está em bom nível"
        else:
            return f"Sequência do edital: {subject.name}"