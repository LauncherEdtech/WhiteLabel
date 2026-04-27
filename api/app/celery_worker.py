# api/app/celery_worker.py
import os

from app import create_app
from app.extensions import celery_app

flask_app = create_app("production")

# Guarda referência do flask_app no celery_app para tasks que precisam de contexto explícito
celery_app.flask_app = flask_app


# ── ContextTask ───────────────────────────────────────────────────────────────
# CRÍTICO: flask_app.app_context().push() não funciona em ForkPoolWorkers
# porque o fork() não herda o stack de contexto do processo pai.
#
# A ContextTask garante que CADA invocação de task roda dentro de um
# app_context próprio, independente do processo worker que executar.
# Isso substitui o push() global e cobre TODAS as tasks automaticamente.
# ─────────────────────────────────────────────────────────────────────────────
class ContextTask(celery_app.Task):
    """Base task que injeta Flask app_context em todos os workers."""

    abstract = True  # Celery não registra esta classe como task

    def __call__(self, *args, **kwargs):
        with flask_app.app_context():
            return super().__call__(*args, **kwargs)


celery_app.Task = ContextTask


# ── Roteamento de filas ───────────────────────────────────────────────────────
# Separa tasks rápidas (ms) de tasks lentas (I/O pesado, Gemini, retries longos).
# Evita que retries de schedule tasks bloqueiem a gamification.
#
# Worker deve ser iniciado com: --queues=fast,slow,celery
# ─────────────────────────────────────────────────────────────────────────────
celery_app.conf.task_routes = {
    # Fila fast: tasks de milissegundos — nunca devem esperar tasks lentas
    "app.tasks.update_gamification_after_answer":                 {"queue": "fast"},
    "app.tasks.send_broadcast_email":                             {"queue": "fast"},
    "app.tasks.send_password_reset_email":                        {"queue": "fast"},
    "app.tasks.send_welcome_email":                               {"queue": "fast"},

    # Fila slow: tasks com I/O pesado, Gemini ou possíveis retries longos
    "app.tasks.schedule_tasks.adapt_after_checkin":               {"queue": "slow"},
    "app.tasks.schedule_tasks.adapt_after_question_attempt":      {"queue": "slow"},
    "app.tasks.schedule_tasks.generate_schedule_task":            {"queue": "slow"},
    "app.tasks.schedule_tasks.nightly_schedule_check":            {"queue": "slow"},
    "app.tasks.schedule_tasks.recalculate_schedule_after_lesson": {"queue": "slow"},
    "tasks.analyze_question_task":                                {"queue": "slow"},
    "tasks.generate_lesson_questions_task":                       {"queue": "slow"},
    "app.tasks.regenerate_tenant_insights":                       {"queue": "slow"},
    "app.tasks.scheduled_insights_refresh":                       {"queue": "slow"},
    "app.tasks.run_reprocess_gemini_job":                         {"queue": "slow"},
    "app.tasks.process_xlsx_import_job":                          {"queue": "slow"},
}


# ── Configurações de confiabilidade ──────────────────────────────────────────
celery_app.conf.update(
    # Não perder tasks se o worker morrer no meio da execução.
    # Task só é removida da fila após ser concluída com sucesso.
    task_acks_late=True,

    # Se o worker morrer durante a execução, rejeita a task de volta à fila
    # em vez de perdê-la silenciosamente.
    task_reject_on_worker_lost=True,

    # Avisa a task que o tempo está acabando (soft) — ela pode fazer cleanup.
    # Hard limit: mata o processo após esse tempo.
    task_soft_time_limit=3600,   # 1h
    task_time_limit=3900,        # 1h5min
)


# ── Importa tasks DEPOIS de definir ContextTask e task_routes ─────────────────
# Ordem importa: tasks decoradas com @celery_app.task herdam a base ContextTask
# apenas se ela for definida antes do import.
# ─────────────────────────────────────────────────────────────────────────────
with flask_app.app_context():
    import app.tasks                        # tasks.py principal (generate, analyze, email)
    import app.tasks.cloudwatch_metrics     # publish_active_users_metric
    import app.tasks.schedule_tasks         # nightly_schedule_check, adapt_after_checkin, etc.