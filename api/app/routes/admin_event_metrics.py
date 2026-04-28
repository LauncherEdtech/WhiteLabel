# api/app/routes/admin_event_metrics.py
# Endpoints de leitura agregada para o painel admin.
#
# Estratégia híbrida:
#   - Datas passadas: lê da user_event_daily_rollup (rápido, ~10ms)
#   - Hoje: query direta na user_events (mais lenta, ~200-500ms para 1 dia)
#
# Permissão: SUPER_ADMIN apenas. Producer NÃO acessa estes endpoints.
#
# Endpoints:
#   GET /heatmap        — uso por evento × dia
#   GET /funnel         — funil de uma feature
#   GET /cohort         — retenção D0/D1/D3/D7/D14/D30 por semana
#   GET /user-journey/<user_id> — timeline raw de 1 aluno

import json
import logging
from datetime import datetime, timedelta, timezone, date

from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt
from sqlalchemy import text

from app.extensions import db, redis_client

logger = logging.getLogger(__name__)

admin_event_metrics_bp = Blueprint("admin_event_metrics", __name__)


# ── Helpers de auth ──────────────────────────────────────────────────────────

def _require_super_admin():
    """Valida que o JWT é de super_admin. Retorna 403 se não for."""
    claims = get_jwt()
    role = claims.get("role")
    if role != "super_admin":
        return jsonify({"error": "forbidden", "message": "Apenas super_admin."}), 403
    return None


# ── Helpers de data ──────────────────────────────────────────────────────────

def _parse_date(s: str | None, default: date) -> date:
    """Parse YYYY-MM-DD ou retorna default."""
    if not s:
        return default
    try:
        return datetime.fromisoformat(s).date()
    except ValueError:
        return default


def _today_brt() -> date:
    """Data de hoje em BRT (UTC-3)."""
    now_utc = datetime.now(timezone.utc)
    return (now_utc - timedelta(hours=3)).date()


def _day_range_utc(d: date) -> tuple[datetime, datetime]:
    """Janela UTC para o dia 'd' em BRT.

    Dia X em BRT = X 03:00 UTC até X+1 03:00 UTC.
    """
    start = datetime.combine(d, datetime.min.time(), tzinfo=timezone.utc) + timedelta(hours=3)
    end = start + timedelta(days=1)
    return start, end


# ═══════════════════════════════════════════════════════════════════════════
# HEATMAP — uso por evento × dia
# ═══════════════════════════════════════════════════════════════════════════

@admin_event_metrics_bp.route("/heatmap", methods=["GET"])
@jwt_required()
def heatmap():
    """
    Retorna matriz de uso por evento × dia.

    Query params:
      - start_date=YYYY-MM-DD (default: 30 dias atrás)
      - end_date=YYYY-MM-DD (default: hoje)
      - tenant_id=uuid (opcional, default: consolidado de todos)
      - top=N (default: 30, limita aos N eventos com maior volume)
    """
    forbidden = _require_super_admin()
    if forbidden:
        return forbidden

    today = _today_brt()
    start = _parse_date(request.args.get("start_date"), today - timedelta(days=29))
    end = _parse_date(request.args.get("end_date"), today)
    tenant_id = request.args.get("tenant_id")
    top = min(int(request.args.get("top", 30)), 100)

    if start > end:
        return jsonify({"error": "bad_request", "message": "start_date > end_date"}), 400

    # ── 1. Lê dados históricos do rollup (até ontem) ─────────────────────
    historical_end = min(end, today - timedelta(days=1))
    historical_data = []
    if start <= historical_end:
        params = {
            "start": start,
            "end": historical_end,
        }
        tenant_filter = ""
        if tenant_id:
            tenant_filter = "AND tenant_id = :tid"
            params["tid"] = tenant_id

        sql = text(f"""
            SELECT rollup_date, event_type, feature_name,
                   SUM(total_count) AS total_count,
                   SUM(unique_users) AS unique_users
            FROM user_event_daily_rollup
            WHERE rollup_date >= :start AND rollup_date <= :end
            {tenant_filter}
            GROUP BY rollup_date, event_type, feature_name
        """)
        historical_data = db.session.execute(sql, params).fetchall()

    # ── 2. Lê dados de HOJE direto da user_events (se entra na janela) ───
    today_data = []
    if start <= today <= end:
        day_start, day_end = _day_range_utc(today)
        params = {"start": day_start, "end": day_end}
        tenant_filter = ""
        if tenant_id:
            tenant_filter = "AND tenant_id = :tid"
            params["tid"] = tenant_id

        sql = text(f"""
            SELECT event_type, feature_name,
                   COUNT(*) AS total_count,
                   COUNT(DISTINCT user_id) AS unique_users
            FROM user_events
            WHERE created_at >= :start AND created_at < :end
            {tenant_filter}
            GROUP BY event_type, feature_name
        """)
        today_rows = db.session.execute(sql, params).fetchall()
        today_data = [(today, *row) for row in today_rows]

    # ── 3. Combina e estrutura por (event_type, feature_name) ────────────
    # buckets[(event_type, feature_name)] = {date: {total, users}, totals: {total, users}}
    buckets: dict[tuple, dict] = {}
    all_data = list(historical_data) + today_data

    for row in all_data:
        if len(row) == 5:
            d, event_type, feature_name, total, users = row
        else:
            d, event_type, feature_name, total, users = row[0], row[1], row[2], row[3], row[4]

        key = (event_type, feature_name)
        if key not in buckets:
            buckets[key] = {"daily": {}, "total": 0, "users_max": 0}

        buckets[key]["daily"][d.isoformat() if hasattr(d, "isoformat") else d] = {
            "total": int(total),
            "unique_users": int(users),
        }
        buckets[key]["total"] += int(total)
        buckets[key]["users_max"] = max(buckets[key]["users_max"], int(users))

    # ── 4. Ordena por total desc e limita a top N ────────────────────────
    sorted_keys = sorted(buckets.keys(), key=lambda k: buckets[k]["total"], reverse=True)[:top]

    rows = []
    for event_type, feature_name in sorted_keys:
        b = buckets[(event_type, feature_name)]
        # Preenche dias sem dados com zero
        daily = []
        cur = start
        while cur <= end:
            iso = cur.isoformat()
            entry = b["daily"].get(iso, {"total": 0, "unique_users": 0})
            daily.append({"date": iso, "total": entry["total"], "unique_users": entry["unique_users"]})
            cur += timedelta(days=1)

        rows.append({
            "event_type": event_type,
            "feature_name": feature_name,
            "daily": daily,
            "totals": {
                "total": b["total"],
                "unique_users_peak": b["users_max"],
            },
        })

    return jsonify({
        "start_date": start.isoformat(),
        "end_date": end.isoformat(),
        "tenant_id": tenant_id,
        "rows": rows,
    }), 200


# ═══════════════════════════════════════════════════════════════════════════
# FUNNEL — funil de uma feature
# ═══════════════════════════════════════════════════════════════════════════

# Mapeamento feature_name → stages do funil.
# Cada stage tem nome amigável + lista de event_types que contam.
FUNNEL_DEFINITIONS = {
    "mentor": [
        {"name": "viewed", "label": "Viu o widget", "event_types": ["mentor_click"]},
        {"name": "engaged", "label": "Recebeu resposta", "event_types": ["mentor_response_received"]},
        {"name": "actioned", "label": "Seguiu sugestão", "event_types": ["insight_followed"]},
    ],
    "questoes": [
        {"name": "filtered", "label": "Filtrou questões", "event_types": ["question_filter_used"]},
        {"name": "explained", "label": "Leu explicação", "event_types": ["explanation_read"]},
    ],
    "simulados": [
        {"name": "started", "label": "Iniciou simulado", "event_types": ["page_view"]},  # placeholder
        {"name": "completed", "label": "Viu resultado", "event_types": ["result_viewed"]},
        {"name": "abandoned", "label": "Abandonou", "event_types": ["simulado_abandon"]},
    ],
    "aulas": [
        {"name": "started", "label": "Abriu aula", "event_types": ["lesson_started"]},
        {"name": "completed", "label": "Concluiu", "event_types": ["lesson_completed"]},
        {"name": "rated", "label": "Avaliou", "event_types": ["lesson_rated"]},
    ],
    "gamification": [
        {"name": "viewed", "label": "Viu Hall of Fame", "event_types": ["hall_of_fame_view"]},
        {"name": "engaged", "label": "Viu badge", "event_types": ["badge_view"]},
        {"name": "shared", "label": "Compartilhou cápsula", "event_types": ["capsule_shared"]},
    ],
    "onboarding": [
        {"name": "viewed", "label": "Viu welcome", "event_types": ["onboarding_step_view"]},
        {"name": "completed", "label": "Concluiu", "event_types": ["onboarding_completed"]},
    ],
    "cronograma": [
        {"name": "decided", "label": "Escolheu cronograma", "event_types": ["schedule_choice_made"]},
    ],
}


@admin_event_metrics_bp.route("/funnel", methods=["GET"])
@jwt_required()
def funnel():
    """
    Retorna funil de uma feature.

    Query params:
      - feature_name=mentor (obrigatório)
      - start_date, end_date (opcionais)
      - tenant_id=uuid (opcional)
    """
    forbidden = _require_super_admin()
    if forbidden:
        return forbidden

    feature_name = request.args.get("feature_name")
    if not feature_name or feature_name not in FUNNEL_DEFINITIONS:
        return jsonify({
            "error": "bad_request",
            "message": f"feature_name é obrigatório. Valores aceitos: {list(FUNNEL_DEFINITIONS.keys())}",
        }), 400

    today = _today_brt()
    start = _parse_date(request.args.get("start_date"), today - timedelta(days=29))
    end = _parse_date(request.args.get("end_date"), today)
    tenant_id = request.args.get("tenant_id")

    stages = FUNNEL_DEFINITIONS[feature_name]

    # Para cada stage, conta eventos no período (rollup + hoje direto)
    stage_results = []
    for stage in stages:
        total = _count_events_in_range(stage["event_types"], start, end, tenant_id)
        stage_results.append({
            "name": stage["name"],
            "label": stage["label"],
            "event_types": stage["event_types"],
            "count": total,
        })

    # Calcula percentuais relativos ao primeiro stage
    base = stage_results[0]["count"] if stage_results else 0
    for r in stage_results:
        r["pct_of_base"] = round(100.0 * r["count"] / base, 1) if base > 0 else 0.0

    # Drop-off entre stages consecutivos
    drop_off = []
    for i in range(1, len(stage_results)):
        prev = stage_results[i - 1]
        curr = stage_results[i]
        lost = prev["count"] - curr["count"]
        pct = round(100.0 * lost / prev["count"], 1) if prev["count"] > 0 else 0.0
        drop_off.append({
            "from": prev["name"],
            "to": curr["name"],
            "lost": lost,
            "pct": pct,
        })

    return jsonify({
        "feature_name": feature_name,
        "start_date": start.isoformat(),
        "end_date": end.isoformat(),
        "tenant_id": tenant_id,
        "stages": stage_results,
        "drop_off": drop_off,
    }), 200


def _count_events_in_range(event_types: list[str], start: date, end: date, tenant_id: str | None) -> int:
    """Conta total de eventos de tipos específicos numa janela. Híbrido rollup + user_events."""
    today = _today_brt()
    historical_end = min(end, today - timedelta(days=1))
    total = 0

    # Rollup (datas passadas)
    if start <= historical_end:
        params = {"start": start, "end": historical_end, "types": tuple(event_types)}
        tenant_filter = ""
        if tenant_id:
            tenant_filter = "AND tenant_id = :tid"
            params["tid"] = tenant_id

        sql = text(f"""
            SELECT COALESCE(SUM(total_count), 0)
            FROM user_event_daily_rollup
            WHERE rollup_date >= :start AND rollup_date <= :end
              AND event_type IN :types
              {tenant_filter}
        """)
        total += int(db.session.execute(sql, params).scalar() or 0)

    # Hoje (raw)
    if start <= today <= end:
        day_start, day_end = _day_range_utc(today)
        params = {"start": day_start, "end": day_end, "types": tuple(event_types)}
        tenant_filter = ""
        if tenant_id:
            tenant_filter = "AND tenant_id = :tid"
            params["tid"] = tenant_id

        sql = text(f"""
            SELECT COUNT(*)
            FROM user_events
            WHERE created_at >= :start AND created_at < :end
              AND event_type IN :types
              {tenant_filter}
        """)
        total += int(db.session.execute(sql, params).scalar() or 0)

    return total


# ═══════════════════════════════════════════════════════════════════════════
# COHORT — retenção por semana
# ═══════════════════════════════════════════════════════════════════════════

@admin_event_metrics_bp.route("/cohort", methods=["GET"])
@jwt_required()
def cohort():
    """
    Retenção D0/D1/D3/D7/D14/D30 por cohort semanal.

    Query params:
      - weeks=12 (default: últimas 12 semanas completas)
      - tenant_id=uuid (opcional)

    Resultado é cacheado no Redis com TTL de 1h por (weeks, tenant_id).
    """
    forbidden = _require_super_admin()
    if forbidden:
        return forbidden

    weeks = min(int(request.args.get("weeks", 12)), 52)
    tenant_id = request.args.get("tenant_id")

    # Cache key
    cache_key = f"cohort:{weeks}:{tenant_id or 'all'}"
    try:
        cached = redis_client.get(cache_key)
        if cached:
            return jsonify(json.loads(cached)), 200
    except Exception as e:
        logger.warning(f"[cohort] Redis get falhou: {e}")

    today = _today_brt()
    # Cohort se baseia em data do PRIMEIRO evento do usuário.
    # Vamos pegar usuários cujo primeiro evento foi nas últimas N semanas.
    earliest = today - timedelta(weeks=weeks)
    earliest_dt, _ = _day_range_utc(earliest)

    # Para cohort precisamos olhar a user_events diretamente
    # (rollup não preserva user_id × first_event_date).
    # Otimização: query única pega first_event_date por user, agrupa por semana.

    params = {"earliest": earliest_dt}
    tenant_filter = ""
    if tenant_id:
        tenant_filter = "AND tenant_id = :tid"
        params["tid"] = tenant_id

    # Step 1: identifica primeiro evento de cada user e seu cohort week (segunda-feira)
    sql_first_events = text(f"""
        WITH first_events AS (
            SELECT
                user_id,
                MIN(created_at) AS first_at,
                DATE_TRUNC('week', MIN(created_at) AT TIME ZONE 'America/Sao_Paulo')::DATE AS cohort_week
            FROM user_events
            WHERE created_at >= :earliest
            {tenant_filter}
            GROUP BY user_id
        )
        SELECT user_id, cohort_week
        FROM first_events
    """)
    first_events = db.session.execute(sql_first_events, params).fetchall()

    # Agrupa users por cohort week
    cohorts_users: dict[date, list[str]] = {}
    for row in first_events:
        user_id, cohort_week = row.user_id, row.cohort_week
        cohorts_users.setdefault(cohort_week, []).append(user_id)

    # Step 2: para cada cohort, calcula retenção em D1, D3, D7, D14, D30
    retention_days = [0, 1, 3, 7, 14, 30]
    cohorts_result = []

    for cohort_week in sorted(cohorts_users.keys(), reverse=True):
        users = cohorts_users[cohort_week]
        cohort_size = len(users)
        if cohort_size == 0:
            continue

        retention = {}
        for d in retention_days:
            window_start = cohort_week + timedelta(days=d)
            window_end = window_start + timedelta(days=1)
            # window em UTC
            ws_utc = datetime.combine(window_start, datetime.min.time(), tzinfo=timezone.utc) + timedelta(hours=3)
            we_utc = datetime.combine(window_end, datetime.min.time(), tzinfo=timezone.utc) + timedelta(hours=3)

            # Conta quantos users do cohort tiveram evento nesse dia
            count_sql = text(f"""
                SELECT COUNT(DISTINCT user_id)
                FROM user_events
                WHERE user_id = ANY(:users)
                  AND created_at >= :ws AND created_at < :we
                  {tenant_filter}
            """)
            count_params = {"users": users, "ws": ws_utc, "we": we_utc}
            if tenant_id:
                count_params["tid"] = tenant_id
            active = int(db.session.execute(count_sql, count_params).scalar() or 0)
            retention[f"d{d}"] = round(100.0 * active / cohort_size, 1)

        cohorts_result.append({
            "cohort_week": cohort_week.isoformat(),
            "size": cohort_size,
            "retention": retention,
        })

    response = {
        "weeks": weeks,
        "tenant_id": tenant_id,
        "cohorts": cohorts_result,
    }

    # Cacheia 1h
    try:
        redis_client.setex(cache_key, 3600, json.dumps(response))
    except Exception as e:
        logger.warning(f"[cohort] Redis set falhou: {e}")

    return jsonify(response), 200


# ═══════════════════════════════════════════════════════════════════════════
# USER JOURNEY — timeline raw de 1 aluno
# ═══════════════════════════════════════════════════════════════════════════

@admin_event_metrics_bp.route("/user-journey/<string:user_id>", methods=["GET"])
@jwt_required()
def user_journey(user_id: str):
    """
    Retorna timeline cronológica de eventos de um usuário específico.

    Query params:
      - limit=200 (default, max 1000)
      - start_date, end_date (opcionais)
    """
    forbidden = _require_super_admin()
    if forbidden:
        return forbidden

    limit = min(int(request.args.get("limit", 200)), 1000)
    today = _today_brt()
    start = _parse_date(request.args.get("start_date"), today - timedelta(days=89))
    end = _parse_date(request.args.get("end_date"), today)

    start_utc, _ = _day_range_utc(start)
    _, end_utc = _day_range_utc(end)

    # Busca info do usuário
    user_info_sql = text("""
        SELECT u.id, u.name, u.email, u.tenant_id, t.name AS tenant_name
        FROM users u
        LEFT JOIN tenants t ON t.id = u.tenant_id
        WHERE u.id = :uid
    """)
    user_row = db.session.execute(user_info_sql, {"uid": user_id}).first()
    if not user_row:
        return jsonify({"error": "not_found", "message": "Usuário não encontrado."}), 404

    # Busca eventos (mais recentes primeiro)
    events_sql = text("""
        SELECT
            id, event_type, feature_name, target_id,
            event_metadata, session_id, created_at
        FROM user_events
        WHERE user_id = :uid
          AND created_at >= :start AND created_at < :end
        ORDER BY created_at DESC
        LIMIT :limit
    """)
    events = db.session.execute(events_sql, {
        "uid": user_id, "start": start_utc, "end": end_utc, "limit": limit,
    }).fetchall()

    # Estatísticas básicas
    stats_sql = text("""
        SELECT
            COUNT(*) AS total,
            MIN(created_at) AS first_at,
            MAX(created_at) AS last_at
        FROM user_events
        WHERE user_id = :uid
    """)
    stats_row = db.session.execute(stats_sql, {"uid": user_id}).first()

    return jsonify({
        "user_id": str(user_row.id),
        "user_name": user_row.name,
        "user_email": user_row.email,
        "tenant_id": str(user_row.tenant_id),
        "tenant_name": user_row.tenant_name,
        "stats": {
            "total_events_all_time": int(stats_row.total or 0),
            "first_event_at": stats_row.first_at.isoformat() if stats_row.first_at else None,
            "last_event_at": stats_row.last_at.isoformat() if stats_row.last_at else None,
        },
        "filters": {
            "start_date": start.isoformat(),
            "end_date": end.isoformat(),
            "limit": limit,
        },
        "events": [
            {
                "id": str(e.id),
                "event_type": e.event_type,
                "feature_name": e.feature_name,
                "target_id": str(e.target_id) if e.target_id else None,
                "metadata": e.event_metadata or {},
                "session_id": str(e.session_id) if e.session_id else None,
                "created_at": e.created_at.isoformat(),
            }
            for e in events
        ],
    }), 200