# api/app/celery_worker.py
import sys
import os

from app import create_app
from app.extensions import celery_app

flask_app = create_app("production")

# Guarda referência do flask_app no celery_app para tasks que precisam de contexto explícito
celery_app.flask_app = flask_app
flask_app.app_context().push()


with flask_app.app_context():
    import app.tasks                        # tasks.py principal (generate, analyze, email)
    import app.tasks.cloudwatch_metrics     # publish_active_users_metric
    import app.tasks.schedule_tasks         # nightly_schedule_check