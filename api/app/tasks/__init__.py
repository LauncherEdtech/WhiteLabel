# api/app/tasks/__init__.py
import importlib.util
import sys
import os

_tasks_py = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "tasks.py"))
_spec = importlib.util.spec_from_file_location("app.tasks", _tasks_py)
_module = importlib.util.module_from_spec(_spec)

# Registra no sys.modules ANTES de executar — evita double-import
sys.modules["app.tasks"] = _module
_spec.loader.exec_module(_module)

send_broadcast_email = _module.send_broadcast_email
send_password_reset_email = _module.send_password_reset_email
send_welcome_email = _module.send_welcome_email
update_gamification_after_answer = _module.update_gamification_after_answer
analyze_question_task = _module.analyze_question_task
generate_lesson_questions_task = _module.generate_lesson_questions_task

__all__ = [
    "send_broadcast_email",
    "send_password_reset_email",
    "send_welcome_email",
    "update_gamification_after_answer",
    "analyze_question_task",
    "generate_lesson_questions_task",
]
