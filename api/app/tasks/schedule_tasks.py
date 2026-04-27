# api/app/tasks/schedule_tasks.py
# Tasks Celery para adaptação automática do cronograma.
#
# generate_schedule_task           — gera/reorganiza cronograma em background (async)
# adapt_after_checkin              — reorganiza após check-in com muitos atrasos
# adapt_after_question_attempt     — injeta/remove revisões por desempenho em questões
# nightly_schedule_check           — job noturno (03h BRT)
# recalculate_schedule_after_lesson — reorganiza após check-in de aula

import json
import logging

from app.extensions import celery_app, redis_client

logger = logging.getLogger(__name__)


# ── Helpers de status para geração assíncrona ─────────────────────────────────

_SCHEDULE_GEN_TTL = 3600  # 1h


def _gen_key(task_id: str) -> str:
    return f"schedule_gen:{task_id}"


def get_task_status(task_id: str) -> dict | None:
    """Lê status da task de geração do Redis. Retorna None se não encontrado."""
    try:
        raw = redis_client.get(_gen_key(task_id))
        return json.loads(raw) if raw else None
    except Exception as e:
        logger.warning(f"[schedule_gen] Redis get falhou task={task_id}: {e}")
    return None


def _set_task_status(task_id: str, payload: dict) -> None:
    try:
        redis_client.setex(_gen_key(task_id), _SCHEDULE_GEN_TTL, json.dumps(payload))
    except Exception as e:
        logger.warning(f"[schedule_gen] Redis set falhou task={task_id}: {e}")


# ── App Flask cacheado por processo worker ────────────────────────────────────
# CRÍTICO: cachear em nível de módulo garante que cada processo worker cria
# apenas 1 Flask app (1 connection pool), não 1 por invocação de task.

_cached_flask_app = None


def _get_flask_app():
    """
    Retorna o Flask app para uso no Celery worker.

    Tenta usar current_app (contexto já ativo — reutiliza pool existente).
    Caso não disponível, cria 1 app por processo worker e reutiliza sempre
    (evita criar centenas de pools que esgotam o RDS).
    """
    global _cached_flask_app

    # Tenta usar o app já ativo no worker
    try:
        from flask import current_app
        return current_app._get_current_object()
    except RuntimeError:
        pass

    # Cria ou reutiliza o app cacheado para este processo
    if _cached_flask_app is None:
        logger.info("[schedule_gen] Criando Flask app para este worker process")
        from app import create_app
        _cached_flask_app = create_app()

    return _cached_flask_app


# ── Task de geração assíncrona ────────────────────────────────────────────────


@celery_app.task(bind=True, max_retries=2, default_retry_delay=30)
def generate_schedule_task(
    self,
    user_id: str,
    tenant_id: str,
    course_id: str,
    target_date: str | None = None,
):
    """
    Gera ou reorganiza o cronograma em background (Celery).

    Usa _get_flask_app() que cacheia o app por processo worker,
    garantindo um único SQLAlchemy pool por worker (não por task).
    """
    task_id = self.request.id
    logger.info(f"[schedule_gen] task={task_id} user={user_id} course={course_id} START")
    _set_task_status(task_id, {"status": "pending"})

    app = _get_flask_app()
    with app.app_context():
        try:
            from app.extensions import db
            from app.services.schedule_engine import ScheduleEngine

            engine = ScheduleEngine(
                user_id=user_id,
                tenant_id=tenant_id,
                course_id=course_id,
            )
            schedule = engine.generate(target_date=target_date)
            risk = engine.calculate_abandonment_risk()
            schedule.abandonment_risk_score = risk
            db.session.commit()

            result: dict = {
                "status": "ready",
                "schedule_id": str(schedule.id),
                "abandonment_risk": round(risk, 4),
            }
            if engine.last_coverage_gap:
                result["coverage_gap"] = engine.last_coverage_gap

            _set_task_status(task_id, result)
            logger.info(f"[schedule_gen] task={task_id} DONE schedule={schedule.id}")
            return result

        except Exception as exc:
            _set_task_status(task_id, {"status": "error", "message": str(exc)})
            logger.error(f"[schedule_gen] task={task_id} ERRO: {exc}")
            raise self.retry(exc=exc)


# ── Tasks existentes (sem alteração) ─────────────────────────────────────────


@celery_app.task(bind=True, max_retries=3, default_retry_delay=30)
def adapt_after_checkin(
    self, user_id: str, tenant_id: str, course_id: str, item_id: str
):
    """Dispara imediatamente após check-in. Verifica atrasos e reorganiza se necessário."""
    try:
        from app.services.schedule_engine import ScheduleEngine

        engine = ScheduleEngine(
            user_id=user_id, tenant_id=tenant_id, course_id=course_id
        )
        reorganized = engine.adapt_after_checkin(item_id)
        logger.info(
            f"adapt_after_checkin: user={user_id} course={course_id} reorganized={reorganized}"
        )
        return {"reorganized": reorganized}
    except Exception as exc:
        logger.error(f"adapt_after_checkin falhou: {exc}")
        raise self.retry(exc=exc)


@celery_app.task(bind=True, max_retries=3, default_retry_delay=60)
def adapt_after_question_attempt(self, user_id: str, tenant_id: str, subject_id: str):
    """
    Dispara após o aluno responder questões de uma disciplina.

    Lógica:
    - Menos de ADAPTIVE_MIN_ATTEMPTS (10) tentativas → ignora (amostra insuficiente)
    - Acurácia < ADAPTIVE_INJECT_THRESHOLD (50%) → inject_subject_reviews()
    - Acurácia >= ADAPTIVE_REMOVE_THRESHOLD (70%) → remove_excess_reviews()
    - Entre 50% e 70% → nenhuma ação (zona neutra)
    """
    try:
        from app.extensions import db
        from app.models.question import QuestionAttempt
        from app.models.course import Subject
        from app.models.schedule import StudySchedule
        from app.services.schedule_engine import ScheduleEngine

        subject = Subject.query.filter_by(
            id=subject_id,
            tenant_id=tenant_id,
            is_deleted=False,
        ).first()
        if not subject:
            return {"action": "skipped", "reason": "subject_not_found"}

        from sqlalchemy import func, case as sql_case
        from app.models.question import Question

        row = (
            db.session.query(
                func.count(QuestionAttempt.id).label("total"),
                func.sum(sql_case((QuestionAttempt.is_correct == True, 1), else_=0)).label("correct"),
            )
            .filter_by(user_id=user_id, tenant_id=tenant_id, is_deleted=False)
            .join(Question)
            .filter_by(subject_id=subject_id)
            .one()
        )

        total = row.total or 0
        if total < 10:
            return {"action": "skipped", "reason": "insufficient_attempts", "total": total}

        correct = row.correct or 0
        accuracy = correct / total

        active_schedules = StudySchedule.query.filter_by(
            user_id=user_id,
            course_id=subject.course_id,
            tenant_id=tenant_id,
            status="active",
            is_deleted=False,
        ).all()

        if not active_schedules:
            return {"action": "skipped", "reason": "no_active_schedule"}

        results = []
        for schedule in active_schedules:
            try:
                engine = ScheduleEngine(user_id=user_id, tenant_id=tenant_id, course_id=schedule.course_id)

                if accuracy < engine.ADAPTIVE_INJECT_THRESHOLD:
                    injected = engine.inject_subject_reviews(subject_id=subject_id)
                    results.append({"schedule": schedule.id, "action": "injected", "count": injected, "accuracy": round(accuracy, 3)})
                    logger.info(f"adapt_after_question_attempt: injetou {injected} revisões para user={user_id} subject={subject_id} acerto={round(accuracy*100)}%")

                elif accuracy >= engine.ADAPTIVE_REMOVE_THRESHOLD:
                    removed = engine.remove_excess_reviews(subject_id=subject_id)
                    results.append({"schedule": schedule.id, "action": "removed", "count": removed, "accuracy": round(accuracy, 3)})
                    if removed > 0:
                        logger.info(f"adapt_after_question_attempt: removeu {removed} revisões adaptativas para user={user_id} subject={subject_id} acerto={round(accuracy*100)}%")

                else:
                    results.append({"schedule": schedule.id, "action": "no_change", "accuracy": round(accuracy, 3)})

            except Exception as e:
                logger.warning(f"adapt_after_question_attempt: erro no schedule {schedule.id}: {e}")

        return {"subject_id": subject_id, "accuracy": round(accuracy, 3), "results": results}

    except Exception as exc:
        logger.error(f"adapt_after_question_attempt falhou: {exc}")
        raise self.retry(exc=exc)


@celery_app.task(bind=True, max_retries=2)
def nightly_schedule_check(self):
    """
    Job noturno — 03:00 BRT.
    1. Reorganiza cronogramas com muitos itens atrasados (>= 5)
    2. Atualiza risk scores
    3. Marca concluídos apenas se o aluno REALMENTE assistiu todas as aulas
    """
    try:
        from app.extensions import db
        from app.models.schedule import StudySchedule, ScheduleItem
        from app.services.schedule_engine import ScheduleEngine
        from datetime import date

        today_str = date.today().isoformat()
        checked = reorganized = completed_count = 0

        schedules = StudySchedule.query.filter_by(status="active", is_deleted=False).all()

        for schedule in schedules:
            checked += 1
            try:
                overdue = ScheduleItem.query.filter(
                    ScheduleItem.schedule_id == schedule.id,
                    ScheduleItem.scheduled_date < today_str,
                    ScheduleItem.status == "pending",
                    ScheduleItem.is_deleted == False,
                ).count()

                engine = ScheduleEngine(user_id=schedule.user_id, tenant_id=schedule.tenant_id, course_id=schedule.course_id)

                if overdue >= 5:
                    engine.reorganize(schedule)
                    reorganized += 1
                else:
                    risk = engine.calculate_abandonment_risk()
                    schedule.abandonment_risk_score = risk

                if engine._all_lessons_completed():
                    schedule.status = "completed"
                    completed_count += 1

            except Exception as e:
                logger.warning(f"Erro ao processar schedule {schedule.id}: {e}")

        db.session.commit()
        logger.info(f"nightly_schedule_check: {checked} verificados, {reorganized} reorganizados, {completed_count} concluídos")
        return {"checked": checked, "reorganized": reorganized, "completed": completed_count}

    except Exception as exc:
        logger.error(f"nightly_schedule_check falhou: {exc}")
        raise self.retry(exc=exc)


@celery_app.task(bind=True, max_retries=3)
def recalculate_schedule_after_lesson(self, user_id: str, tenant_id: str):
    """
    Disparado quando aluno faz check-in em uma aula (route /lessons/checkin).
    Reorganiza todos os cronogramas ativos do aluno.
    """
    try:
        from app.extensions import db
        from app.models.schedule import StudySchedule
        from app.services.schedule_engine import ScheduleEngine

        schedules = StudySchedule.query.filter_by(
            user_id=user_id, tenant_id=tenant_id, status="active", is_deleted=False
        ).all()

        reorganized = 0
        for schedule in schedules:
            try:
                engine = ScheduleEngine(user_id=user_id, tenant_id=tenant_id, course_id=schedule.course_id)
                engine.reorganize(schedule)
                reorganized += 1
            except Exception as e:
                logger.warning(f"recalculate_schedule_after_lesson: falha schedule {schedule.id}: {e}")

        db.session.commit()
        logger.info(f"recalculate_schedule_after_lesson: user={user_id} reorganized={reorganized}")
        return {"reorganized": reorganized}

    except Exception as exc:
        logger.error(f"recalculate_schedule_after_lesson falhou: {exc}")
        raise self.retry(exc=exc)