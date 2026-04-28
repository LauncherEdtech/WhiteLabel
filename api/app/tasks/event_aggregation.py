# api/app/tasks/event_aggregation.py
# Job noturno (03:00 BRT) que pré-agrega user_events em user_event_daily_rollup.
#
# Estratégia:
#   - Roda 1x por dia, processa sempre D-1 (ontem completo)
#   - Idempotente via ON CONFLICT — pode re-rodar sem efeito colateral
#   - Particiona por tenant para não monopolizar transação longa
#
# Performance esperada (1000 users, ~50k eventos/dia):
#   - 1 job processa todos os tenants em ~30-60s
#   - Output: ~100 linhas/tenant/dia na tabela rollup

import logging
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone

from sqlalchemy import text

from app.extensions import celery_app, db

logger = logging.getLogger(__name__)


# ── Whitelist de chaves de metadata que viram dimensão de drill-down ──────────
# Manter PEQUENO — cada chave aqui vira uma agregação extra.
# Ordem de prioridade: o que vai ser exibido no painel.
METADATA_DIMENSIONS_BY_EVENT = {
    "question_filter_used": ["source"],
    "schedule_choice_made": ["choice"],
    "page_view": ["path"],
    "page_leave": ["path"],
    "lesson_started": ["course_id"],
    "lesson_completed": ["course_id"],
    "lesson_rated": ["stars"],
    "result_viewed": ["passed"],
    "simulado_abandon": ["progress_percent"],
    "onboarding_step_view": ["step_id"],
    "onboarding_skipped": ["step_index"],
    "mentor_response_received": ["action_type", "priority"],
    "insight_followed": ["action_type"],
    "badge_view": ["badge_key"],
}


@celery_app.task(bind=True, max_retries=2, default_retry_delay=300, name="app.tasks.aggregate_user_events_daily")
def aggregate_user_events_daily(self, target_date_iso: str | None = None):
    """
    Agrega eventos de D-1 na tabela user_event_daily_rollup.

    Args:
        target_date_iso: Data ISO 'YYYY-MM-DD' a processar. Se None, usa ontem.

    Roda noturnamente via Celery Beat às 03:00 BRT.
    Idempotente: ON CONFLICT garante que rodar 2x produz mesmo resultado.
    """
    if target_date_iso:
        target_date = datetime.fromisoformat(target_date_iso).date()
    else:
        # Default: dia anterior em BRT (UTC-3)
        # 03:00 BRT = 06:00 UTC, então "ontem em BRT" é straight-forward
        now_utc = datetime.now(timezone.utc)
        target_date = (now_utc - timedelta(days=1)).date()

    logger.info(f"[event_agg] Processando rollup para {target_date}")

    # Janela de tempo em UTC: dia inteiro em BRT
    # BRT = UTC-3, então "dia X em BRT" = X 03:00 UTC até X+1 03:00 UTC
    day_start_utc = datetime.combine(target_date, datetime.min.time()) + timedelta(hours=3)
    day_end_utc = day_start_utc + timedelta(days=1)

    # Lista de tenants que tiveram eventos nesse dia (não processa tenants vazios)
    tenants_with_events = db.session.execute(
        text("""
            SELECT DISTINCT tenant_id
            FROM user_events
            WHERE created_at >= :start AND created_at < :end
        """),
        {"start": day_start_utc, "end": day_end_utc},
    ).fetchall()

    total_processed = 0
    for (tenant_id,) in tenants_with_events:
        try:
            inserted = _aggregate_tenant_day(tenant_id, target_date, day_start_utc, day_end_utc)
            total_processed += inserted
            logger.info(f"[event_agg] tenant={tenant_id} → {inserted} buckets")
        except Exception as e:
            logger.error(f"[event_agg] tenant={tenant_id} FALHOU: {e}", exc_info=True)
            db.session.rollback()
            continue

    logger.info(f"[event_agg] Concluído: {len(tenants_with_events)} tenants, {total_processed} buckets totais")
    return {
        "date": target_date.isoformat(),
        "tenants": len(tenants_with_events),
        "buckets": total_processed,
    }


def _aggregate_tenant_day(tenant_id: str, rollup_date, day_start_utc, day_end_utc) -> int:
    """Agrega 1 tenant para 1 dia. Retorna número de buckets criados."""

    # Query: pega TODOS os eventos do tenant nesse dia
    rows = db.session.execute(
        text("""
            SELECT event_type, feature_name, user_id, session_id, event_metadata
            FROM user_events
            WHERE tenant_id = :tid
              AND created_at >= :start
              AND created_at < :end
        """),
        {"tid": tenant_id, "start": day_start_utc, "end": day_end_utc},
    ).fetchall()

    if not rows:
        return 0

    # Agrupa em memória: chave = (event_type, feature_name)
    # Para cada bucket, mantém:
    #   - total_count
    #   - set de user_ids únicos
    #   - set de session_ids únicos
    #   - Counter de cada dimensão de metadata
    buckets = defaultdict(lambda: {
        "total": 0,
        "users": set(),
        "sessions": set(),
        "dimensions": defaultdict(Counter),
    })

    for row in rows:
        event_type = row.event_type
        feature_name = row.feature_name
        key = (event_type, feature_name)

        bucket = buckets[key]
        bucket["total"] += 1
        bucket["users"].add(row.user_id)
        bucket["sessions"].add(row.session_id)

        # Drill-down: extrai dimensões interessantes do metadata
        metadata = row.event_metadata or {}
        dimensions = METADATA_DIMENSIONS_BY_EVENT.get(event_type, [])
        for dim in dimensions:
            value = metadata.get(dim)
            if value is None:
                continue
            # Converte para string para serializar em JSONB
            value_str = str(value)
            # Limita strings muito longas (paths podem ser grandes)
            if len(value_str) > 200:
                value_str = value_str[:200]
            bucket["dimensions"][dim][value_str] += 1

    # Insere/atualiza usando ON CONFLICT (idempotente)
    insert_sql = text("""
        INSERT INTO user_event_daily_rollup (
            id, tenant_id, rollup_date, event_type, feature_name,
            total_count, unique_users, unique_sessions, metadata_summary,
            created_at, updated_at
        ) VALUES (
            gen_random_uuid(), :tid, :date, :event_type, :feature_name,
            :total, :users, :sessions, CAST(:summary AS JSONB),
            NOW(), NOW()
        )
        ON CONFLICT (tenant_id, rollup_date, event_type, feature_name)
        DO UPDATE SET
            total_count = EXCLUDED.total_count,
            unique_users = EXCLUDED.unique_users,
            unique_sessions = EXCLUDED.unique_sessions,
            metadata_summary = EXCLUDED.metadata_summary,
            updated_at = NOW()
    """)

    import json
    inserted = 0
    for (event_type, feature_name), bucket in buckets.items():
        # Serializa dimensões: { "by_source": {"discipline_select": 234, ...} }
        summary = {}
        for dim, counter in bucket["dimensions"].items():
            # Top 20 valores por dimensão (evita JSON gigante)
            summary[f"by_{dim}"] = dict(counter.most_common(20))

        db.session.execute(insert_sql, {
            "tid": tenant_id,
            "date": rollup_date,
            "event_type": event_type,
            "feature_name": feature_name,
            "total": bucket["total"],
            "users": len(bucket["users"]),
            "sessions": len(bucket["sessions"]),
            "summary": json.dumps(summary) if summary else None,
        })
        inserted += 1

    db.session.commit()
    return inserted