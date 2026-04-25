# api/app/tasks/__init__.py
import importlib.util
import sys
import os

# ── Carrega tasks.py (monolítico) como app.tasks ──────────────────────────────
# O arquivo tasks.py fica em api/app/tasks.py (um nível acima deste __init__).
# Registramos ANTES de executar para evitar double-import circular.

_tasks_py = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "tasks.py"))
_spec = importlib.util.spec_from_file_location("app.tasks", _tasks_py)
_module = importlib.util.module_from_spec(_spec)

sys.modules["app.tasks"] = _module
_spec.loader.exec_module(_module)

# Re-exporta tasks principais do arquivo monolítico
send_broadcast_email = _module.send_broadcast_email
send_password_reset_email = _module.send_password_reset_email
send_welcome_email = _module.send_welcome_email
update_gamification_after_answer = _module.update_gamification_after_answer
analyze_question_task = _module.analyze_question_task
generate_lesson_questions_task = _module.generate_lesson_questions_task

try:
    process_xlsx_import_job = _module.process_xlsx_import_job
except AttributeError:
    process_xlsx_import_job = None

try:
    run_reprocess_gemini_job = _module.run_reprocess_gemini_job
except AttributeError:
    run_reprocess_gemini_job = None

# ── Pré-registra submodules do pacote tasks/ ──────────────────────────────────
# Problema: após sys.modules["app.tasks"] = _module (um arquivo, não um pacote),
# imports do tipo `from app.tasks.schedule_tasks import X` falham com
# "app.tasks is not a package" porque Python não sabe mais que tasks/ é um dir.
#
# Solução: carregar cada submodule via importlib e registrar diretamente em
# sys.modules["app.tasks.<nome>"] ANTES que qualquer código tente importá-los.
# Python verifica sys.modules primeiro — se encontrar, usa sem precisar
# navegar pela hierarquia de pacotes.


def _load_submodule(submod_name: str):
    """Carrega <submod_name>.py deste diretório e registra em sys.modules."""
    full_name = f"app.tasks.{submod_name}"
    if full_name in sys.modules:
        return sys.modules[full_name]

    path = os.path.join(os.path.dirname(__file__), f"{submod_name}.py")
    if not os.path.exists(path):
        return None

    spec = importlib.util.spec_from_file_location(full_name, path)
    mod = importlib.util.module_from_spec(spec)
    sys.modules[full_name] = mod  # registra antes de executar (evita circular)
    spec.loader.exec_module(mod)
    return mod


_schedule_tasks = _load_submodule("schedule_tasks")
_cloudwatch_metrics = _load_submodule("cloudwatch_metrics")

# Re-exporta para que `from app.tasks import generate_schedule_task` funcione
# mesmo quando app.tasks é o módulo monolítico (sem __path__)
if _schedule_tasks:
    generate_schedule_task = _schedule_tasks.generate_schedule_task
    get_task_status = _schedule_tasks.get_task_status

__all__ = [
    "send_broadcast_email",
    "send_password_reset_email",
    "send_welcome_email",
    "update_gamification_after_answer",
    "analyze_question_task",
    "generate_lesson_questions_task",
    "process_xlsx_import_job",
    "run_reprocess_gemini_job",
    "generate_schedule_task",
    "get_task_status",
]