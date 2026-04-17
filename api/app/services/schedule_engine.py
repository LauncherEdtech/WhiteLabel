# api/app/services/schedule_engine.py
# Motor do cronograma inteligente e adaptativo — v9
#
# v9 — DISTRIBUIÇÃO HÍBRIDA (fix de concentração no início):
#   BUG: algoritmo enchia cada dia até o orçamento máximo (2 aulas+questões = 2h)
#        e saía quando as filas esvaziavam. Com 617 aulas + 2h/dia, todas as aulas
#        ficavam concentradas em ~40 dias úteis, mesmo com 519 dias até a prova.
#
#   FIX: Se tem target_date, reserva 40% do tempo final para revisão/simulados
#        e distribui as aulas nos primeiros 60% em ritmo natural. Isso simula
#        o fluxo real de concurseiro: edital primeiro, reta final de revisão depois.
#
#   Estratégias disponíveis (constante DISTRIBUTION_STRATEGY):
#     "hybrid"      → 60% aulas + 40% revisão (RECOMENDADO, padrão)
#     "stretched"   → distribui aulas por 100% do tempo (ritmo confortável)
#     "concentrated" → enche 2h/dia até acabar as aulas (comportamento v8)
#
# v8.3 — Solução para UniqueViolation no delete+generate (preservado)
# v8.1 — Badge "Aula longa" para force-fit (preservado)

from datetime import datetime, timezone, timedelta, date
from collections import defaultdict
from typing import Optional, List, Dict
import math

from app.extensions import db
from app.models.user import User
from app.models.course import Course, Subject, Module, Lesson, LessonProgress
from app.models.question import QuestionAttempt
from app.models.schedule import StudySchedule, ScheduleItem, ScheduleCheckIn


FORCE_FIT_PREFIX = "[LONGA]"


class ScheduleEngine:
    BREAK_MINUTES = 10
    MAX_SCHEDULE_DAYS = 730          # 2 anos (era 120 — limitava concursos grandes)
    QUESTIONS_BLOCK_MINUTES = 20
    MIN_FREE_FOR_QUESTIONS = 0
    REVIEW_MINUTES = 25
    SIMULADO_INTERVAL_LESSONS = 12
    MAX_EFFECTIVE_MINUTES = 480

    # ─── Estratégia de distribuição ──────────────────────────────────────────
    # "hybrid"       → 60% aulas + 40% revisão final (concurso realista)
    # "stretched"    → 100% aulas espalhadas confortavelmente
    # "concentrated" → enche 2h/dia até acabar (comportamento antigo)
    DISTRIBUTION_STRATEGY = "hybrid"

    # Para "hybrid": fração do tempo reservada pra aulas (resto é revisão/simulado)
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

        # v9.2: armazena o coverage_gap calculado no último _build_items()
        # pra que o caller (route /generate) possa retornar pro frontend
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
    # Adaptação reativa (idêntica v8.3)
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
    # Construção do cronograma — v9 (DISTRIBUIÇÃO HÍBRIDA)
    # ─────────────────────────────────────────────────────────────────────────

    def _calculate_lessons_window(
        self,
        total_lessons: int,
        available_days: int,
        effective_minutes: int,
        avg_lesson_minutes: float = 40.0,
    ) -> int:
        """
        Calcula quantos dias serão usados APENAS para aulas (resto é revisão).

        v9.1 — comportamento atualizado pra "fill_budget":
          - concentrated: usa só os dias necessários (ritmo 2h/dia cheio)
          - stretched:    distribui por TODOS os dias disponíveis
          - hybrid:       usa os dias necessários, e o RESTO (até a prova
                          ou MAX_SCHEDULE_DAYS) vira reta final de revisão.
                          Antes era "60% aulas / 40% revisão"; agora é
                          "concentra aulas e o resto é revisão".

        v9.1: aceita avg_lesson_minutes como parâmetro (calculado das aulas reais)
        em vez de estimar com 40 min fixos. Isso melhora a precisão pra concursos
        com aulas curtas (10-15 min) ou longas (60+ min).
        """
        # Custo médio por aula (aula + pausa + questões + pausa)
        cost_per_lesson = avg_lesson_minutes + self.BREAK_MINUTES + 15 + self.BREAK_MINUTES
        lessons_per_day_max = max(1, effective_minutes // cost_per_lesson)

        # Dias necessários se enchermos 100%
        days_needed_concentrated = math.ceil(total_lessons / lessons_per_day_max)

        if self.DISTRIBUTION_STRATEGY == "concentrated":
            return min(days_needed_concentrated, available_days)

        if self.DISTRIBUTION_STRATEGY == "stretched":
            # Usa TODOS os dias disponíveis (ritmo mais leve)
            return available_days

        # hybrid (padrão): aulas concentradas, resto vira reta final de revisão
        # Se cabem em 60% do tempo ou menos → usa só o necessário
        # Se precisam de mais → estende, mas sempre reserva alguma reta final
        target_window = min(days_needed_concentrated, available_days)

        # Garante mínimo de 5% de reta final (ou pelo menos 7 dias)
        max_lessons_window = available_days - max(7, int(available_days * 0.05))
        return min(target_window, max(max_lessons_window, days_needed_concentrated))

    def _build_items(self, schedule: StudySchedule, start_date: date):
        priority_map = self._calculate_subject_priorities()
        pending_lessons = self._get_pending_lessons()

        if not pending_lessons:
            schedule.ai_notes = "Todas as aulas já foram assistidas. Foco em revisão e simulados."
            self._add_review_only_plan(schedule, priority_map, start_date)
            return

        # ── Calcula janela de aulas (depende da estratégia) ──────────────────
        if schedule.target_date:
            try:
                target = date.fromisoformat(schedule.target_date)
                days_until_exam = max(1, (target - start_date).days)
                all_slots = self._generate_day_slots(start_date, max_days=days_until_exam)
            except ValueError:
                all_slots = self._generate_day_slots(start_date)
        else:
            # Sem data de prova → usa MAX_SCHEDULE_DAYS como teto
            all_slots = self._generate_day_slots(start_date)

        if not all_slots:
            return

        # v9.2 — RESPEITAR LIMITE DO USUÁRIO:
        # Antes: comprimia silenciosamente até 3.0x, estourando 2h→6h sem avisar.
        # Agora: usa effective_minutes = minutes_per_day (sem compressão automática).
        # Se as aulas não cabem na janela, calcula um "coverage_gap" e expõe pro
        # frontend mostrar aviso com opções (aumentar carga / adiar prova / etc.).
        effective_minutes = min(self.minutes_per_day, self.MAX_EFFECTIVE_MINUTES)

        # Janela de aulas: onde aulas vão entrar (resto é pra revisão)
        # v9.1: calcula a média real das aulas (em vez de chutar 40 min)
        # — melhora precisão pra cursos com aulas curtas (15min) ou longas (60+min)
        lesson_durations = [max(l.duration_minutes or 30, 15) for l in pending_lessons]
        avg_lesson_real = sum(lesson_durations) / max(1, len(lesson_durations))

        # v9.2 — Calcula CAPACIDADE vs DEMANDA pra detectar gap
        cost_per_lesson_real = avg_lesson_real + self.BREAK_MINUTES + 15 + self.BREAK_MINUTES
        lessons_per_day_capacity = max(1, effective_minutes // cost_per_lesson_real)
        max_lessons_in_window = int(len(all_slots) * lessons_per_day_capacity)

        # Se não cabe tudo, calcula sugestões
        coverage_gap = None
        if max_lessons_in_window < len(pending_lessons) and schedule.target_date:
            # Quantas horas/dia precisariam pra fazer TUDO?
            total_minutes_needed = len(pending_lessons) * cost_per_lesson_real
            hours_needed_per_day = total_minutes_needed / (len(all_slots) * 60)
            # Arredonda pra cima (.5 mais próximo)
            suggested_hours = round(hours_needed_per_day * 2) / 2  # múltiplos de 0.5
            if suggested_hours <= self.hours_per_day:
                suggested_hours = self.hours_per_day + 0.5
            # Cap em 8h/dia (limite saudável)
            suggested_hours = min(suggested_hours, 8.0)

            coverage_gap = {
                "will_cover_lessons": max_lessons_in_window,
                "total_lessons": len(pending_lessons),
                "coverage_percent": round((max_lessons_in_window / len(pending_lessons)) * 100, 1),
                "suggested_hours_per_day": suggested_hours,
                "current_hours_per_day": self.hours_per_day,
                "days_until_exam": len(all_slots),
            }

        # Armazena pro route ler depois e expor pro frontend
        self.last_coverage_gap = coverage_gap

        # Persiste no availability_snapshot pra que GET /schedule retorne
        # o aviso mesmo quando o aluno recarrega a página
        snapshot = dict(schedule.availability_snapshot or {})
        snapshot["days"] = self.available_days
        snapshot["hours_per_day"] = self.hours_per_day
        if coverage_gap:
            snapshot["coverage_gap"] = coverage_gap
        else:
            snapshot.pop("coverage_gap", None)  # remove se não tem mais gap
        schedule.availability_snapshot = snapshot

        lessons_window_days = self._calculate_lessons_window(
            total_lessons=len(pending_lessons),
            available_days=len(all_slots),
            effective_minutes=effective_minutes,
            avg_lesson_minutes=avg_lesson_real,
        )
        lesson_slots = all_slots[:lessons_window_days]
        review_only_slots = all_slots[lessons_window_days:]  # pode ficar vazio

        # v9.1: Sem target_date, limita reta final a 90 dias úteis (~4 meses).
        # Reta final infinita não faz sentido — o aluno revisa por uns meses
        # e depois deveria gerar um novo cronograma se quisesse continuar.
        if not schedule.target_date and len(review_only_slots) > 90:
            review_only_slots = review_only_slots[:90]

        # ── Pre-load em bulk ─────────────────────────────────────────────────
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

        # v9.1 — ESTRATÉGIA "fill_budget":
        # Em vez de limitar aulas por dia (deixava dias vazios quando aulas
        # eram curtas), agora enchemos cada dia até atingir o orçamento de
        # tempo (ex: 2h = 120 min). Cronograma fica mais denso mas termina
        # antes — comportamento esperado pra concurseiros intensivos.

        # ── ALGORITMO: enche cada dia até o orçamento ──────────────────────
        for slot_idx, slot_date in enumerate(lesson_slots):
            if not any(queues[sid] for sid in subject_ids_ordered):
                break

            slot_str = slot_date.isoformat()
            day_used = 0
            day_order = 0
            day_subjects: List[str] = []

            active_subjects = [sid for sid in subject_ids_ordered if queues[sid]]
            rotation_pos = 0
            consecutive_skips = 0

            while active_subjects:
                # v9.1: enche até o orçamento (sem limite max_today)

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

                is_force_fit_needed = (day_used == 0 and lesson_cost > effective_minutes)

                if is_force_fit_needed:
                    queues[sid].pop(0)
                    subject = subject_map.get(sid)
                    priority = priority_map.get(sid, 1.0)

                    day_used, day_order = self._add_lesson_with_questions(
                        items_to_add, slot_str, lesson, lesson_dur, sid, subject,
                        priority, day_used, day_order, self.tenant_id, schedule.id,
                        effective_minutes, is_long_lesson=True
                    )
                    lessons_added += 1
                    consecutive_skips = 0
                    if sid not in day_subjects:
                        day_subjects.append(sid)
                    break  # force-fit ocupa dia todo

                elif day_used + lesson_cost <= effective_minutes:
                    queues[sid].pop(0)
                    subject = subject_map.get(sid)
                    priority = priority_map.get(sid, 1.0)

                    day_used, day_order = self._add_lesson_with_questions(
                        items_to_add, slot_str, lesson, lesson_dur, sid, subject,
                        priority, day_used, day_order, self.tenant_id, schedule.id,
                        effective_minutes, is_long_lesson=False
                    )
                    lessons_added += 1
                    consecutive_skips = 0
                    if sid not in day_subjects:
                        day_subjects.append(sid)

                    if day_used >= effective_minutes:
                        break
                    rotation_pos += 1

                else:
                    rotation_pos += 1
                    consecutive_skips += 1
                    if consecutive_skips >= len(active_subjects):
                        # v9.3 — Antes de desistir do dia, testa duas estratégias:
                        #
                        # (A) Se existe alguma disciplina cuja aula[0] caiba,
                        #     agenda ela (bug antigo: saía sem tentar de novo
                        #     após uma volta completa em que nenhuma coube).
                        #
                        # (B) Se nenhuma aula[0] cabe, mas tem 1 disciplina só
                        #     ativa, procura mais fundo na fila dela (aulas curtas
                        #     mais atrás na ordem). A aula[0] longa fica pra ser
                        #     agendada em outro dia via force-fit. Isso evita
                        #     desperdiçar dias com 29 min quando há aulas curtas
                        #     disponíveis logo atrás.
                        time_remaining = effective_minutes - day_used
                        best_sid = None
                        best_idx = 0

                        # Estratégia A: aula[0] de qualquer disciplina
                        for s in active_subjects:
                            if not queues[s]:
                                continue
                            top = queues[s][0]
                            top_dur = max(top.duration_minutes or 30, 15)
                            top_cost = top_dur + self.BREAK_MINUTES
                            if top_cost <= time_remaining:
                                best_sid = s
                                best_idx = 0
                                break

                        # Estratégia B: se não achou e tem só 1 disciplina ativa,
                        # procura aula menor adiante na fila
                        if best_sid is None and len(active_subjects) == 1:
                            s = active_subjects[0]
                            # Limita a busca a 10 aulas à frente (evita pular demais)
                            for idx, candidate in enumerate(queues[s][:10]):
                                cand_dur = max(candidate.duration_minutes or 30, 15)
                                cand_cost = cand_dur + self.BREAK_MINUTES
                                if cand_cost <= time_remaining:
                                    best_sid = s
                                    best_idx = idx
                                    break

                        if best_sid is not None:
                            lesson = queues[best_sid].pop(best_idx)
                            lesson_dur = max(lesson.duration_minutes or 30, 15)
                            subject = subject_map.get(best_sid)
                            priority = priority_map.get(best_sid, 1.0)

                            day_used, day_order = self._add_lesson_with_questions(
                                items_to_add, slot_str, lesson, lesson_dur, best_sid, subject,
                                priority, day_used, day_order, self.tenant_id, schedule.id,
                                effective_minutes, is_long_lesson=False
                            )
                            lessons_added += 1
                            consecutive_skips = 0
                            if best_sid not in day_subjects:
                                day_subjects.append(best_sid)
                            if day_used >= effective_minutes:
                                break
                            # Continua o while — pode caber mais aulas
                        else:
                            # Nada cabe mesmo, desiste do dia
                            break

            used_minutes_tracker[slot_date] = day_used

            # Simulado a cada N aulas
            if lessons_added > 0 and lessons_added % self.SIMULADO_INTERVAL_LESSONS == 0:
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

        # ── Na janela de revisão (só no hybrid/stretched com target): simulados semanais ─
        if review_only_slots and len(review_only_slots) >= 5:
            # Intercala simulados a cada ~7 dias úteis na janela final
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

        # Revisões espaçadas nos slots de aula + slots de revisão
        self._add_spaced_reviews(
            schedule,
            all_slots,  # permite revisões por toda a janela
            used_minutes_tracker,
            priority_map,
            items_to_add,
            effective_minutes,
        )

        if items_to_add:
            db.session.bulk_save_objects(items_to_add)

        # Nota da IA enriquecida
        weak_names = [
            subject_map[sid].name for sid in subject_ids_ordered[:3]
            if sid in subject_map and priority_map.get(sid, 1.0) >= 1.5
        ]

        # v9.2: aviso de cobertura insuficiente substitui a "Compressão Xx" antiga
        coverage_warning = ""
        if coverage_gap:
            coverage_warning = (
                f" ⚠️ Atenção: com {coverage_gap['current_hours_per_day']}h/dia, "
                f"você cobrirá apenas {coverage_gap['will_cover_lessons']} de "
                f"{coverage_gap['total_lessons']} aulas até a prova "
                f"({coverage_gap['coverage_percent']}%). "
                f"Para cobrir tudo, considere {coverage_gap['suggested_hours_per_day']}h/dia."
            )

        # ── Janela de distribuição: sempre mostra em dias úteis + período corrido ──
        # v9.1: calcula dias REAIS usados (não a janela teórica), pois agora
        # enchemos os dias até o orçamento e o cronograma pode terminar antes.
        if lesson_slots and lessons_added > 0:
            # Conta quantos dias da janela realmente receberam aulas
            actual_days_used = len(used_minutes_tracker)

            first_lesson_day = lesson_slots[0]
            # Último dia com aula = início + actual_days_used dias úteis
            # (aproximação: usa o último slot do tracker)
            last_used_date = max(used_minutes_tracker.keys()) if used_minutes_tracker else first_lesson_day
            calendar_days_window = (last_used_date - first_lesson_day).days + 1
            months_approx = calendar_days_window / 30.0

            # Formata o período de forma humana
            if months_approx < 1.5:
                period_str = f"{calendar_days_window} dias"
            elif months_approx < 24:
                period_str = f"~{round(months_approx)} meses"
            else:
                years_approx = months_approx / 12.0
                period_str = f"~{years_approx:.1f} anos"

            actual_avg = lessons_added / max(1, actual_days_used)

            window_info = (
                f" Aulas distribuídas em {actual_days_used} dias úteis "
                f"({period_str}, ~{actual_avg:.1f} aulas/dia em média)."
            )
        else:
            window_info = ""

        # Informação da reta final (só aparece em hybrid com review_only_slots)
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

    def _calculate_questions_minutes(self, lesson_minutes):
        proportional = self.QUESTIONS_MIN_MINUTES + (lesson_minutes * 0.3)
        return int(min(self.QUESTIONS_MAX_MINUTES, max(self.QUESTIONS_MIN_MINUTES, proportional)))

    def _calculate_review_minutes(self, accuracy):
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
        self, items_to_add, slot_str, lesson, lesson_dur, subject_id, subject,
        priority, day_used, day_order, tenant_id, schedule_id, effective_minutes,
        is_long_lesson=False,
    ):
        lesson_cost = lesson_dur + self.BREAK_MINUTES

        base_reason = self._build_priority_reason(subject, priority)
        priority_reason = f"{FORCE_FIT_PREFIX} {base_reason}" if is_long_lesson else base_reason

        items_to_add.append(ScheduleItem(
            tenant_id=tenant_id, schedule_id=schedule_id,
            item_type="lesson", lesson_id=lesson.id,
            subject_id=subject_id if subject_id != "__no_subject__" else None,
            scheduled_date=slot_str, order=day_order,
            estimated_minutes=lesson_dur, priority_reason=priority_reason,
            status="pending",
        ))
        day_used += lesson_cost
        day_order += 1

        questions_minutes = self._calculate_questions_minutes(lesson_dur)
        questions_cost = questions_minutes + self.BREAK_MINUTES

        if day_used + questions_cost <= effective_minutes and subject:
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

    def _add_spaced_reviews(self, schedule, slots, used_minutes, priority_map,
                             items_to_add, effective_minutes=None):
        if effective_minutes is None:
            effective_minutes = self.minutes_per_day

        subjects = Subject.query.filter_by(
            course_id=self.course_id, tenant_id=self.tenant_id, is_deleted=False,
        ).all()

        today = date.today()
        reviews_per_day = defaultdict(int)
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
                    latest = last_date + timedelta(days=2)
                except ValueError:
                    continue
            else:
                earliest = today
                latest = today + timedelta(days=2)

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
                    priority_reason=f"Revisão adaptativa: {subject.name} — acerto {round(accuracy * 100)}% (abaixo de 50%)",
                    status="pending",
                ))
                used_minutes[slot] = used_minutes.get(slot, 0) + needed
                reviews_per_day[slot_str] += 1
                items_to_add_set.add((subject.id, slot_str))
                break

    def _calculate_subject_priorities(self):
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
        lessons_per_slot = max(1, self.minutes_per_day // (avg_lesson_minutes + self.BREAK_MINUTES))
        capacity = len(slots) * lessons_per_slot
        if capacity >= lessons_remaining:
            return 1.0
        return round(min(lessons_remaining / max(capacity, 1), 3.0), 2)

    def _get_pending_lessons(self):
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

    def _generate_day_slots(self, start_date, compression=1.0, max_days=None):
        slots = []
        current = start_date
        limit = max_days or self.MAX_SCHEDULE_DAYS
        end = start_date + timedelta(days=limit)

        while current <= end and len(slots) < limit:
            if current.weekday() in self.available_days:
                slots.append(current)
            current += timedelta(days=1)

        return slots

    def _build_priority_reason(self, subject, priority):
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