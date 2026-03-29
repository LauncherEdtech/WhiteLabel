# api/app/tasks/cloudwatch_metrics.py
# Task Celery que publica métricas customizadas no CloudWatch a cada 1 minuto.
#
# MÉTRICA PUBLICADA: "ActiveUsers"
#   - Namespace: "ConcursoPlataforma"
#   - Unidade: "Count"
#   - Valor: usuários únicos com request nos últimos 5 minutos
#
# O Auto Scaling usa essa métrica para decisões de escala:
#   0–5   usuários → 1 task (mínimo)
#   6–30  usuários → 2 tasks
#   31–80 usuários → 3 tasks
#   81+   usuários → 4 tasks
#
# ─────────────────────────────────────────────────────────────────────────────

import logging
from datetime import datetime, timezone

from app.extensions import celery_app

logger = logging.getLogger(__name__)

# Configuração da métrica — deve bater com o Terraform (autoscaling.tf)
CLOUDWATCH_NAMESPACE = "ConcursoPlataforma"
METRIC_NAME = "ActiveUsers"
AWS_REGION = "sa-east-1"


@celery_app.task(bind=True, max_retries=2, default_retry_delay=10)
def publish_active_users_metric(self):
    """
    Lê a contagem de usuários ativos do Redis e publica no CloudWatch.

    Roda a cada 60 segundos via Celery Beat.
    Em caso de falha, tenta novamente em 10s (max 2 vezes).
    Falha silenciosa após tentativas — não impacta a aplicação.
    """
    try:
        from app.middleware.activity_tracker import get_active_user_count

        active_count = get_active_user_count()

        # Publica no CloudWatch
        _publish_to_cloudwatch(METRIC_NAME, active_count)

        logger.info(f"cloudwatch_metrics: ActiveUsers={active_count} publicado")
        return {"metric": METRIC_NAME, "value": active_count}

    except Exception as exc:
        logger.warning(f"publish_active_users_metric falhou: {exc}")
        raise self.retry(exc=exc)


def _publish_to_cloudwatch(metric_name: str, value: float):
    """
    Publica uma métrica no CloudWatch.
    Requer que a ECS Task Role tenha permissão cloudwatch:PutMetricData
    (configurado em infra/autoscaling.tf).
    """
    try:
        import boto3

        client = boto3.client("cloudwatch", region_name=AWS_REGION)

        client.put_metric_data(
            Namespace=CLOUDWATCH_NAMESPACE,
            MetricData=[
                {
                    "MetricName": metric_name,
                    "Value": value,
                    "Unit": "Count",
                    "Timestamp": datetime.now(timezone.utc),
                    # Dimensão permite filtrar por ambiente no CloudWatch
                    "Dimensions": [
                        {
                            "Name": "Environment",
                            "Value": "production",
                        }
                    ],
                }
            ],
        )
    except Exception as e:
        logger.error(f"CloudWatch put_metric_data falhou: {e}")
        raise
