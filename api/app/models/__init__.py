# api/app/models/__init__.py
# Importa todos os models para o Alembic detectar nas migrations.

from .tenant import Tenant
from .user import User, UserRole
from .course import Course, Subject, Module, Lesson, LessonProgress
from .question import Question, Alternative, QuestionAttempt, QuestionTag
from .producer_schedule import ProducerScheduleTemplate, ProducerScheduleTemplateItem
from .schedule import StudySchedule, ScheduleItem, ScheduleCheckIn
from .simulado import Simulado, SimuladoQuestion, SimuladoAttempt, SimuladoAnswer
from .gamification import LessonRating, StudentBadge
from .notification import Notification

__all__ = [
    "Tenant",
    "User",
    "UserRole",
    "Course",
    "Subject",
    "Module",
    "Lesson",
    "LessonProgress",
    "Question",
    "Alternative",
    "QuestionAttempt",
    "QuestionTag",
    "StudySchedule",
    "ScheduleItem",
    "ScheduleCheckIn",
    "Simulado",
    "SimuladoQuestion",
    "SimuladoAttempt",
    "SimuladoAnswer",
    "ProducerScheduleTemplate",
    "ProducerScheduleTemplateItem",
    "Notification",
]
