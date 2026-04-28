# api/app/tasks/event_cleanup.py
# Hard delete de eventos > 365 dias para atender LGPD e controle de storage.
#
# Por que separado do aggregation:
#   - Risco isolado: se delete falhar, agregação continua funcionando
#   - Pode ser pausado independentemente em incidentes
#
# Por que DELETE em batches:
#   - DELETE 1M+ rows em transação única bloqueia tabela
#   - Batch de 10k preserva responsividade do banco

import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import text

from app.extensions import celery_app, db

logger = logging.getLogger(__name__)

# Retenção: eventos mais antigos que 365 dias são removidos
RETENTION_DAYS = 365
DELETE_BATCH_SIZE = 10000


@celery_app.task(bind=True, max_retries=2, default_retry_delay=300, name="app.tasks.cleanup_old_user_events")
def cleanup_old_user_events(self):
    """
    Remove eventos com created_at mais antigo que RETENTION_DAYS.

    Roda noturnamente via Celery Beat às 03:30 BRT (depois da agregação).
    Deleta em batches de 10k para não bloquear a tabela.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=RETENTION_DAYS)
    logger.info(f"[event_cleanup] Cutoff = {cutoff.isoformat()} (>{RETENTION_DAYS} dias)")

    total_deleted = 0
    while True:
        # CTE para deletar em batch — Postgres-specific mas mais rápido que LIMIT em DELETE
        result = db.session.execute(
            text("""
                WITH batch AS (
                    SELECT id FROM user_events
                    WHERE created_at < :cutoff
                    LIMIT :batch_size
                )
                DELETE FROM user_events
                WHERE id IN (SELECT id FROM batch)
            """),
            {"cutoff": cutoff, "batch_size": DELETE_BATCH_SIZE},
        )
        db.session.commit()

        deleted = result.rowcount or 0
        total_deleted += deleted

        if deleted == 0:
            break

        logger.info(f"[event_cleanup] Deletados {deleted} eventos (total: {total_deleted})")

        # Hard limit de segurança: nunca deleta mais de 1M numa execução
        if total_deleted >= 1_000_000:
            logger.warning(f"[event_cleanup] Hit hard limit de 1M, abortando até próxima execução")
            break

    logger.info(f"[event_cleanup] Concluído: {total_deleted} eventos removidos")
    return {"deleted": total_deleted, "cutoff": cutoff.isoformat()}