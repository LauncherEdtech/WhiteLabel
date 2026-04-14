# api/app/tasks/schedule_tasks.py
# Tasks Celery para adaptação automática do cronograma.
#
# adapt_after_checkin              — reorganiza após check-in com muitos atrasos
# adapt_after_question_attempt     — injeta/remove revisões por desempenho em questões
# nightly_schedule_check           — job noturno (03h BRT)
# recalculate_schedule_after_lesson — reorganiza após check-in de aula

from app.extensions import celery_app
import logging

logger = logging.getLogger(__name__)


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
      Insere 2 revisões nos próximos 7 dias com tempo livre
    - Acurácia >= ADAPTIVE_REMOVE_THRESHOLD (70%) → remove_excess_reviews()
      Remove revisões adaptativas pendentes (aluno melhorou)
    - Entre 50% e 70% → nenhuma ação (zona neutra)

    Funciona em TODOS os cronogramas ativos do aluno que contenham a disciplina.
    """
    try:
        from app.extensions import db
        from app.models.question import QuestionAttempt
        from app.models.course import Subject
        from app.models.schedule import StudySchedule
        from app.services.schedule_engine import ScheduleEngine

        # Verifica se a disciplina existe neste tenant
        subject = Subject.query.filter_by(
            id=subject_id,
            tenant_id=tenant_id,
            is_deleted=False,
        ).first()
        if not subject:
            return {"action": "skipped", "reason": "subject_not_found"}

        # OTIMIZAÇÃO: Calcula acurácia via SQL em vez de carregar tudo em memória
        from sqlalchemy import func, case as sql_case
        from app.models.question import Question

        row = (
            db.session.query(
                func.count(QuestionAttempt.id).label("total"),
                func.sum(sql_case((QuestionAttempt.is_correct == True, 1), else_=0)).label("correct"),
            )
            .filter_by(
                user_id=user_id,
                tenant_id=tenant_id,
                is_deleted=False,
            )
            .join(Question)
            .filter_by(subject_id=subject_id)
            .one()
        )

        total = row.total or 0
        if total < 10:
            return {
                "action": "skipped",
                "reason": "insufficient_attempts",
                "total": total,
            }

        correct = row.correct or 0
        accuracy = correct / total

        # Encontra cronogramas ativos para o curso desta disciplina
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
                engine = ScheduleEngine(
                    user_id=user_id,
                    tenant_id=tenant_id,
                    course_id=schedule.course_id,
                )

                if accuracy < engine.ADAPTIVE_INJECT_THRESHOLD:
                    # Acurácia baixa: injeta revisões extras
                    injected = engine.inject_subject_reviews(subject_id=subject_id)
                    results.append(
                        {
                            "schedule": schedule.id,
                            "action": "injected",
                            "count": injected,
                            "accuracy": round(accuracy, 3),
                        }
                    )
                    logger.info(
                        f"adapt_after_question_attempt: injetou {injected} revisões "
                        f"para user={user_id} subject={subject_id} acerto={round(accuracy*100)}%"
                    )

                elif accuracy >= engine.ADAPTIVE_REMOVE_THRESHOLD:
                    # Acurácia boa: remove revisões adaptativas pendentes
                    removed = engine.remove_excess_reviews(subject_id=subject_id)
                    results.append(
                        {
                            "schedule": schedule.id,
                            "action": "removed",
                            "count": removed,
                            "accuracy": round(accuracy, 3),
                        }
                    )
                    if removed > 0:
                        logger.info(
                            f"adapt_after_question_attempt: removeu {removed} revisões "
                            f"adaptativas para user={user_id} subject={subject_id} "
                            f"acerto={round(accuracy*100)}%"
                        )

                else:
                    # Zona neutra (50%–70%): sem ação
                    results.append(
                        {
                            "schedule": schedule.id,
                            "action": "no_change",
                            "accuracy": round(accuracy, 3),
                        }
                    )

            except Exception as e:
                logger.warning(
                    f"adapt_after_question_attempt: erro no schedule {schedule.id}: {e}"
                )

        return {
            "subject_id": subject_id,
            "accuracy": round(accuracy, 3),
            "results": results,
        }

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
       (usa _all_lessons_completed(), não _get_pending_lessons())
    """
    try:
        from app.extensions import db
        from app.models.schedule import StudySchedule, ScheduleItem
        from app.services.schedule_engine import ScheduleEngine
        from datetime import date

        today_str = date.today().isoformat()
        checked = reorganized = completed_count = 0

        schedules = StudySchedule.query.filter_by(
            status="active",
            is_deleted=False,
        ).all()

        for schedule in schedules:
            checked += 1
            try:
                overdue = ScheduleItem.query.filter(
                    ScheduleItem.schedule_id == schedule.id,
                    ScheduleItem.scheduled_date < today_str,
                    ScheduleItem.status == "pending",
                    ScheduleItem.is_deleted == False,
                ).count()

                engine = ScheduleEngine(
                    user_id=schedule.user_id,
                    tenant_id=schedule.tenant_id,
                    course_id=schedule.course_id,
                )

                if overdue >= 5:
                    engine.reorganize(schedule)
                    reorganized += 1
                else:
                    risk = engine.calculate_abandonment_risk()
                    schedule.abandonment_risk_score = risk

                # FIX: usa _all_lessons_completed() — não _get_pending_lessons()
                # _get_pending_lessons() retorna [] quando tudo está agendado como pending,
                # causando marcação falsa de "completed" após reorganize
                if engine._all_lessons_completed():
                    schedule.status = "completed"
                    completed_count += 1

            except Exception as e:
                logger.warning(f"Erro ao processar schedule {schedule.id}: {e}")

        db.session.commit()
        logger.info(
            f"nightly_schedule_check: {checked} verificados, "
            f"{reorganized} reorganizados, {completed_count} concluídos"
        )
        return {
            "checked": checked,
            "reorganized": reorganized,
            "completed": completed_count,
        }

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
            user_id=user_id,
            tenant_id=tenant_id,
            status="active",
            is_deleted=False,
        ).all()

        reorganized = 0
        for schedule in schedules:
            try:
                engine = ScheduleEngine(
                    user_id=user_id,
                    tenant_id=tenant_id,
                    course_id=schedule.course_id,
                )
                engine.reorganize(schedule)
                reorganized += 1
            except Exception as e:
                logger.warning(
                    f"recalculate_schedule_after_lesson: falha schedule {schedule.id}: {e}"
                )

        db.session.commit()
        logger.info(
            f"recalculate_schedule_after_lesson: user={user_id} reorganized={reorganized}"
        )
        return {"reorganized": reorganized}

    except Exception as exc:
        logger.error(f"recalculate_schedule_after_lesson falhou: {exc}")
        raise self.retry(exc=exc)
