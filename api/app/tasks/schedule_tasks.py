# api/app/tasks/schedule_tasks.py
# Tasks Celery para adaptação automática do cronograma.
#
# adapt_after_checkin         — dispara imediatamente após cada check-in do aluno
# nightly_schedule_check      — job noturno que verifica todos os cronogramas ativos
# recalculate_schedule_after_lesson — dispara quando aluno faz check-in em aula

from app.extensions import celery_app
import logging

logger = logging.getLogger(__name__)


@celery_app.task(bind=True, max_retries=3, default_retry_delay=30)
def adapt_after_checkin(
    self, user_id: str, tenant_id: str, course_id: str, item_id: str
):
    """
    Dispara imediatamente após o aluno fazer check-in num item do cronograma.
    Verifica se deve reorganizar e atualiza o risk score.
    """
    try:
        from app.services.schedule_engine import ScheduleEngine

        engine = ScheduleEngine(
            user_id=user_id, tenant_id=tenant_id, course_id=course_id
        )
        reorganized = engine.adapt_after_checkin(item_id)
        logger.info(
            f"adapt_after_checkin: user={user_id} course={course_id} "
            f"reorganized={reorganized}"
        )
        return {"reorganized": reorganized}
    except Exception as exc:
        logger.error(f"adapt_after_checkin falhou: {exc}")
        raise self.retry(exc=exc)


@celery_app.task(bind=True, max_retries=2)
def nightly_schedule_check(self):
    """
    Job noturno — deve ser agendado via Celery Beat para rodar às 03:00 BRT.
    Verifica todos os cronogramas ativos e:
    1. Detecta itens muito atrasados → reorganiza
    2. Atualiza risk scores
    3. Marca cronogramas completos (todas as aulas ASSISTIDAS — não apenas agendadas)

    FIX Bug #1: Antes usava _get_pending_lessons() para checar conclusão.
    Esse método retorna [] quando todas as aulas estão agendadas como pendentes,
    causando marcação incorreta de "completed" após reorganize.
    Agora usa engine._all_lessons_completed() que verifica LessonProgress real.
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

                # FIX Bug #1: usa _all_lessons_completed() em vez de
                # _get_pending_lessons() — esse retorna [] mesmo quando
                # as aulas estão apenas AGENDADAS (não assistidas)
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
    Atualiza todos os cronogramas ativos do aluno com os novos dados de progresso.
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
                    f"recalculate_schedule_after_lesson: falha no schedule "
                    f"{schedule.id}: {e}"
                )

        db.session.commit()
        logger.info(
            f"recalculate_schedule_after_lesson: user={user_id} "
            f"reorganized={reorganized}"
        )
        return {"reorganized": reorganized}

    except Exception as exc:
        logger.error(f"recalculate_schedule_after_lesson falhou: {exc}")
        raise self.retry(exc=exc)
