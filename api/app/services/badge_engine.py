# api/app/services/badge_engine.py
# Motor de gamificação: define todas as badges, calcula conquistas e patentes.
#
# PATENTES (rank por pontos):
#   Recruta → Soldado → Cabo → Sargento → Tenente →
#   Capitão → Major → Coronel → General
#
# BADGES: agrupadas por categoria

from datetime import datetime, timezone, date, timedelta
from typing import Optional

from app.extensions import db
from app.models.user import User
from app.models.course import LessonProgress, CourseEnrollment
from app.models.question import QuestionAttempt
from app.models.schedule import StudySchedule, ScheduleItem
from app.models.gamification import StudentBadge


# ── Definição de todas as badges ─────────────────────────────────────────────

BADGES: dict[str, dict] = {
    # ── Questões ──────────────────────────────────────────────────────────────
    "questions_first": {
        "name": "Primeira Questão",
        "icon": "🎯",
        "category": "questões",
        "description": "Respondeu sua primeira questão",
        "points": 10,
    },
    "questions_10": {
        "name": "Iniciante",
        "icon": "📝",
        "category": "questões",
        "description": "Respondeu 10 questões",
        "points": 20,
    },
    "questions_50": {
        "name": "Estudante Dedicado",
        "icon": "📚",
        "category": "questões",
        "description": "Respondeu 50 questões",
        "points": 50,
    },
    "questions_100": {
        "name": "Centurião",
        "icon": "💯",
        "category": "questões",
        "description": "Respondeu 100 questões",
        "points": 100,
    },
    "questions_250": {
        "name": "Maratonista",
        "icon": "🏃",
        "category": "questões",
        "description": "Respondeu 250 questões",
        "points": 150,
    },
    "questions_500": {
        "name": "Veterano",
        "icon": "⚔️",
        "category": "questões",
        "description": "Respondeu 500 questões",
        "points": 250,
    },
    "questions_1000": {
        "name": "Mestre das Questões",
        "icon": "🏆",
        "category": "questões",
        "description": "Respondeu 1000 questões",
        "points": 500,
    },
    # ── Acerto ────────────────────────────────────────────────────────────────
    "accuracy_60": {
        "name": "Bom Aproveitamento",
        "icon": "✅",
        "category": "acerto",
        "description": "Taxa de acerto acima de 60%",
        "points": 50,
    },
    "accuracy_70": {
        "name": "Excelência",
        "icon": "🌟",
        "category": "acerto",
        "description": "Taxa de acerto acima de 70%",
        "points": 100,
    },
    "accuracy_80": {
        "name": "Craque",
        "icon": "💎",
        "category": "acerto",
        "description": "Taxa de acerto acima de 80%",
        "points": 200,
    },
    "accuracy_90": {
        "name": "Atirador de Elite",
        "icon": "🎖️",
        "category": "acerto",
        "description": "Taxa de acerto acima de 90%",
        "points": 400,
    },
    "streak_correct_5": {
        "name": "Em Chamas",
        "icon": "🔥",
        "category": "acerto",
        "description": "5 acertos consecutivos",
        "points": 30,
    },
    "streak_correct_10": {
        "name": "Imparável",
        "icon": "⚡",
        "category": "acerto",
        "description": "10 acertos consecutivos",
        "points": 80,
    },
    # ── Aulas ─────────────────────────────────────────────────────────────────
    "lessons_first": {
        "name": "Primeira Aula",
        "icon": "🎬",
        "category": "aulas",
        "description": "Assistiu sua primeira aula",
        "points": 10,
    },
    "lessons_10": {
        "name": "Aluno Aplicado",
        "icon": "🎓",
        "category": "aulas",
        "description": "Assistiu 10 aulas",
        "points": 40,
    },
    "lessons_25": {
        "name": "Estudante Sério",
        "icon": "📖",
        "category": "aulas",
        "description": "Assistiu 25 aulas",
        "points": 80,
    },
    "lessons_50": {
        "name": "Meio Caminho Andado",
        "icon": "🚀",
        "category": "aulas",
        "description": "Assistiu 50 aulas",
        "points": 150,
    },
    "lessons_100": {
        "name": "Matrona do Saber",
        "icon": "🦅",
        "category": "aulas",
        "description": "Assistiu 100 aulas",
        "points": 300,
    },
    "course_complete": {
        "name": "Curso Concluído",
        "icon": "🏅",
        "category": "aulas",
        "description": "Concluiu 100% de um curso",
        "points": 500,
    },
    # ── Consistência / Streak ─────────────────────────────────────────────────
    "streak_3": {
        "name": "Consistente",
        "icon": "📅",
        "category": "streak",
        "description": "3 dias seguidos de estudo",
        "points": 30,
    },
    "streak_7": {
        "name": "Semana Completa",
        "icon": "🗓️",
        "category": "streak",
        "description": "7 dias seguidos de estudo",
        "points": 70,
    },
    "streak_14": {
        "name": "Quinzena de Ferro",
        "icon": "💪",
        "category": "streak",
        "description": "14 dias seguidos de estudo",
        "points": 150,
    },
    "streak_30": {
        "name": "Mês Inabalável",
        "icon": "🌙",
        "category": "streak",
        "description": "30 dias seguidos de estudo",
        "points": 400,
    },
    "streak_60": {
        "name": "Bimestre Lendário",
        "icon": "👑",
        "category": "streak",
        "description": "60 dias seguidos de estudo",
        "points": 800,
    },
    # ── Cronograma ────────────────────────────────────────────────────────────
    "schedule_first": {
        "name": "Planejado",
        "icon": "🗺️",
        "category": "cronograma",
        "description": "Criou seu primeiro cronograma",
        "points": 20,
    },
    "schedule_week": {
        "name": "Semana Perfeita",
        "icon": "🎯",
        "category": "cronograma",
        "description": "Completou todos os itens de uma semana",
        "points": 100,
    },
    "schedule_30_items": {
        "name": "Foco Total",
        "icon": "🔭",
        "category": "cronograma",
        "description": "Completou 30 itens do cronograma",
        "points": 80,
    },
    "schedule_100_items": {
        "name": "Máquina de Estudar",
        "icon": "🤖",
        "category": "cronograma",
        "description": "Completou 100 itens do cronograma",
        "points": 200,
    },
    # ── Simulados ─────────────────────────────────────────────────────────────
    "simulado_first": {
        "name": "Primeiro Simulado",
        "icon": "📋",
        "category": "simulados",
        "description": "Fez seu primeiro simulado",
        "points": 50,
    },
    "simulado_passed": {
        "name": "Aprovado!",
        "icon": "🎊",
        "category": "simulados",
        "description": "Passou em um simulado com mais de 60%",
        "points": 150,
    },
    "simulado_5": {
        "name": "Simuladista",
        "icon": "📊",
        "category": "simulados",
        "description": "Fez 5 simulados",
        "points": 100,
    },
    # ── Especiais ─────────────────────────────────────────────────────────────
    "night_owl": {
        "name": "Coruja da Madrugada",
        "icon": "🦉",
        "category": "especiais",
        "description": "Estudou após meia-noite",
        "points": 20,
    },
    "early_bird": {
        "name": "Madrugador",
        "icon": "🌅",
        "category": "especiais",
        "description": "Estudou antes das 6h",
        "points": 20,
    },
    "weekend_warrior": {
        "name": "Guerreiro do Fim de Semana",
        "icon": "⚔️",
        "category": "especiais",
        "description": "Estudou no sábado e domingo",
        "points": 40,
    },
    "comeback": {
        "name": "De Volta ao Jogo",
        "icon": "🔄",
        "category": "especiais",
        "description": "Voltou a estudar após 7 dias de inatividade",
        "points": 30,
    },
    "perfectionist": {
        "name": "Perfeccionista",
        "icon": "💯",
        "category": "especiais",
        "description": "Zerou uma sessão de questões (100% acerto)",
        "points": 60,
    },
}


# ── Patentes ──────────────────────────────────────────────────────────────────

RANKS = [
    {"key": "recruta", "name": "Recruta", "icon": "🪖", "min_points": 0},
    {"key": "soldado", "name": "Soldado", "icon": "🎖️", "min_points": 100},
    {"key": "cabo", "name": "Cabo", "icon": "⭐", "min_points": 300},
    {"key": "sargento", "name": "Sargento", "icon": "⭐⭐", "min_points": 600},
    {"key": "tenente", "name": "Tenente", "icon": "⭐⭐⭐", "min_points": 1000},
    {"key": "capitao", "name": "Capitão", "icon": "🔰", "min_points": 1600},
    {"key": "major", "name": "Major", "icon": "🏅", "min_points": 2500},
    {"key": "coronel", "name": "Coronel", "icon": "🦅", "min_points": 4000},
    {"key": "general", "name": "General", "icon": "👑", "min_points": 6000},
]


def get_rank(points: int) -> dict:
    """Retorna a patente atual baseada nos pontos totais."""
    current = RANKS[0]
    for rank in RANKS:
        if points >= rank["min_points"]:
            current = rank
    return current


def get_next_rank(points: int) -> Optional[dict]:
    """Retorna a próxima patente a alcançar."""
    for rank in RANKS:
        if rank["min_points"] > points:
            return rank
    return None


# ── Motor de conquistas ───────────────────────────────────────────────────────


class BadgeEngine:
    """
    Verifica e concede badges para um aluno.
    Chamado após qualquer ação relevante (responder questão, assistir aula, etc).
    """

    def __init__(self, user_id: str, tenant_id: str):
        self.user_id = user_id
        self.tenant_id = tenant_id

    def check_and_award(self) -> list[str]:
        """
        Verifica todas as badges ainda não conquistadas.
        Retorna lista das novas badges conquistadas nesta verificação.
        """
        already_earned = {
            b.badge_key
            for b in StudentBadge.query.filter_by(
                user_id=self.user_id,
                tenant_id=self.tenant_id,
                is_deleted=False,
            ).all()
        }

        new_badges = []
        now = datetime.now(timezone.utc).isoformat()

        checks = [
            self._check_questions,
            self._check_accuracy,
            self._check_lessons,
            self._check_streak,
            self._check_schedule,
        ]

        for check_fn in checks:
            earned = check_fn()
            for key in earned:
                if key not in already_earned:
                    badge = StudentBadge(
                        tenant_id=self.tenant_id,
                        user_id=self.user_id,
                        badge_key=key,
                        earned_at=now,
                    )
                    db.session.add(badge)
                    new_badges.append(key)
                    already_earned.add(key)

        if new_badges:
            db.session.commit()

        return new_badges

    def get_profile(self) -> dict:
        """Retorna perfil completo de gamificação do aluno."""
        earned_badges = StudentBadge.query.filter_by(
            user_id=self.user_id,
            tenant_id=self.tenant_id,
            is_deleted=False,
        ).all()

        earned_keys = {b.badge_key: b.earned_at for b in earned_badges}

        # Calcula pontos totais
        total_points = sum(
            BADGES[key]["points"] for key in earned_keys if key in BADGES
        )

        # Patente atual e próxima
        current_rank = get_rank(total_points)
        next_rank = get_next_rank(total_points)

        # Progresso para próxima patente
        if next_rank:
            points_needed = next_rank["min_points"] - current_rank["min_points"]
            points_progress = total_points - current_rank["min_points"]
            rank_progress_pct = round((points_progress / points_needed) * 100, 1)
        else:
            rank_progress_pct = 100

        # Monta lista completa de badges com status
        all_badges = []
        for key, badge_def in BADGES.items():
            all_badges.append(
                {
                    **badge_def,
                    "key": key,
                    "earned": key in earned_keys,
                    "earned_at": earned_keys.get(key),
                }
            )

        # Agrupa por categoria
        by_category: dict[str, list] = {}
        for badge in all_badges:
            cat = badge["category"]
            if cat not in by_category:
                by_category[cat] = []
            by_category[cat].append(badge)

        return {
            "total_points": total_points,
            "badges_earned": len(earned_keys),
            "badges_total": len(BADGES),
            "current_rank": current_rank,
            "next_rank": next_rank,
            "rank_progress_pct": rank_progress_pct,
            "badges_by_category": by_category,
            "recent_badges": sorted(
                [b for b in all_badges if b["earned"]],
                key=lambda x: x["earned_at"] or "",
                reverse=True,
            )[:5],
        }

    # ── Checagens individuais ─────────────────────────────────────────────────

    def _check_questions(self) -> list[str]:
        earned = []
        total = QuestionAttempt.query.filter_by(
            user_id=self.user_id,
            tenant_id=self.tenant_id,
            is_deleted=False,
        ).count()

        thresholds = [
            (1, "questions_first"),
            (10, "questions_10"),
            (50, "questions_50"),
            (100, "questions_100"),
            (250, "questions_250"),
            (500, "questions_500"),
            (1000, "questions_1000"),
        ]
        for threshold, key in thresholds:
            if total >= threshold:
                earned.append(key)

        # Acertos consecutivos
        recent = (
            QuestionAttempt.query.filter_by(
                user_id=self.user_id,
                tenant_id=self.tenant_id,
                is_deleted=False,
            )
            .order_by(QuestionAttempt.created_at.desc())
            .limit(10)
            .all()
        )

        streak = 0
        for attempt in recent:
            if attempt.is_correct:
                streak += 1
            else:
                break

        if streak >= 5:
            earned.append("streak_correct_5")
        if streak >= 10:
            earned.append("streak_correct_10")

        # Sessão perfeita
        if total >= 10:
            last_10 = (
                QuestionAttempt.query.filter_by(
                    user_id=self.user_id,
                    tenant_id=self.tenant_id,
                    is_deleted=False,
                )
                .order_by(QuestionAttempt.created_at.desc())
                .limit(10)
                .all()
            )
            if len(last_10) == 10 and all(a.is_correct for a in last_10):
                earned.append("perfectionist")

        return earned

    def _check_accuracy(self) -> list[str]:
        earned = []
        total = QuestionAttempt.query.filter_by(
            user_id=self.user_id,
            tenant_id=self.tenant_id,
            is_deleted=False,
        ).count()

        if total < 20:
            return earned  # amostra insuficiente

        correct = QuestionAttempt.query.filter_by(
            user_id=self.user_id,
            tenant_id=self.tenant_id,
            is_correct=True,
            is_deleted=False,
        ).count()

        accuracy = correct / total * 100

        if accuracy >= 60:
            earned.append("accuracy_60")
        if accuracy >= 70:
            earned.append("accuracy_70")
        if accuracy >= 80:
            earned.append("accuracy_80")
        if accuracy >= 90:
            earned.append("accuracy_90")

        return earned

    def _check_lessons(self) -> list[str]:
        earned = []
        watched = LessonProgress.query.filter_by(
            user_id=self.user_id,
            tenant_id=self.tenant_id,
            status="watched",
            is_deleted=False,
        ).count()

        thresholds = [
            (1, "lessons_first"),
            (10, "lessons_10"),
            (25, "lessons_25"),
            (50, "lessons_50"),
            (100, "lessons_100"),
        ]
        for threshold, key in thresholds:
            if watched >= threshold:
                earned.append(key)

        # Curso concluído
        enrollments = CourseEnrollment.query.filter_by(
            user_id=self.user_id,
            tenant_id=self.tenant_id,
            is_active=True,
            is_deleted=False,
        ).all()

        from app.models.course import Lesson, Module, Subject

        for enrollment in enrollments:
            total_lessons = (
                Lesson.query.join(Module, Lesson.module_id == Module.id)
                .join(Subject, Module.subject_id == Subject.id)
                .filter(
                    Subject.course_id == enrollment.course_id,
                    Lesson.is_published == True,
                    Lesson.is_deleted == False,
                    Module.is_deleted == False,
                    Subject.is_deleted == False,
                )
                .count()
            )
            if total_lessons > 0 and watched >= total_lessons:
                earned.append("course_complete")
                break

        return earned

    def _check_streak(self) -> list[str]:
        """Verifica streak de dias consecutivos de estudo."""
        earned = []

        # Coleta todos os dias em que houve atividade (questão ou aula)
        question_dates = (
            db.session.query(db.func.date(QuestionAttempt.created_at))
            .filter_by(
                user_id=self.user_id,
                tenant_id=self.tenant_id,
                is_deleted=False,
            )
            .distinct()
            .all()
        )

        lesson_dates = (
            db.session.query(db.func.date(LessonProgress.updated_at))
            .filter_by(
                user_id=self.user_id,
                tenant_id=self.tenant_id,
                status="watched",
                is_deleted=False,
            )
            .distinct()
            .all()
        )

        active_days = set()
        for (d,) in question_dates:
            if d:
                active_days.add(
                    d if isinstance(d, date) else date.fromisoformat(str(d))
                )
        for (d,) in lesson_dates:
            if d:
                active_days.add(
                    d if isinstance(d, date) else date.fromisoformat(str(d))
                )

        if not active_days:
            return earned

        # Calcula streak atual (contando de hoje para trás)
        today = date.today()
        streak = 0
        check = today

        while check in active_days:
            streak += 1
            check -= timedelta(days=1)

        # Verifica comeback (voltou depois de 7+ dias parado)
        sorted_days = sorted(active_days)
        if len(sorted_days) >= 2:
            gap = (sorted_days[-1] - sorted_days[-2]).days
            if gap >= 7:
                earned.append("comeback")

        thresholds = [
            (3, "streak_3"),
            (7, "streak_7"),
            (14, "streak_14"),
            (30, "streak_30"),
            (60, "streak_60"),
        ]
        for threshold, key in thresholds:
            if streak >= threshold:
                earned.append(key)

        return earned

    def _check_schedule(self) -> list[str]:
        earned = []

        schedule = StudySchedule.query.filter_by(
            user_id=self.user_id,
            tenant_id=self.tenant_id,
            is_deleted=False,
        ).first()

        if schedule:
            earned.append("schedule_first")

            done_count = ScheduleItem.query.filter_by(
                schedule_id=schedule.id,
                status="done",
                is_deleted=False,
            ).count()

            if done_count >= 30:
                earned.append("schedule_30_items")
            if done_count >= 100:
                earned.append("schedule_100_items")

        return earned
