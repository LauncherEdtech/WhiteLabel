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
#   GET /funnel         — funil de uma feature (usuários únicos sequenciais)
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
    """Janela UTC para o dia 'd' em BRT."""
    start = datetime.combine(d, datetime.min.time(), tzinfo=timezone.utc) + timedelta(hours=3)
    end = start + timedelta(days=1)
    return start, end


# ═══════════════════════════════════════════════════════════════════════════
# HEATMAP
# ═══════════════════════════════════════════════════════════════════════════

@admin_event_metrics_bp.route("/heatmap", methods=["GET"])
@jwt_required()
def heatmap():
    """Retorna matriz de uso por evento × dia."""
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

    # 1. Histórico (rollup)
    historical_end = min(end, today - timedelta(days=1))
    historical_data = []
    if start <= historical_end:
        params = {"start": start, "end": historical_end}
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
        historical_data = [
            (r[0], r[1], r[2], r[3], r[4])
            for r in db.session.execute(sql, params).fetchall()
        ]

    # 2. Hoje (raw)
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
        today_data = [
            (today, r[0], r[1], r[2], r[3])
            for r in db.session.execute(sql, params).fetchall()
        ]

    # 3. Combina por (event_type, feature_name)
    buckets: dict[tuple, dict] = {}
    for d, event_type, feature_name, total, users in historical_data + today_data:
        key = (event_type, feature_name)
        if key not in buckets:
            buckets[key] = {"daily": {}, "total": 0, "users_max": 0}

        iso = d.isoformat() if hasattr(d, "isoformat") else d
        buckets[key]["daily"][iso] = {
            "total": int(total),
            "unique_users": int(users),
        }
        buckets[key]["total"] += int(total)
        buckets[key]["users_max"] = max(buckets[key]["users_max"], int(users))

    # 4. Top N + preenche zeros
    sorted_keys = sorted(buckets.keys(), key=lambda k: buckets[k]["total"], reverse=True)[:top]

    rows = []
    for event_type, feature_name in sorted_keys:
        b = buckets[(event_type, feature_name)]
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
# FUNNEL — usuários únicos sequenciais
# ═══════════════════════════════════════════════════════════════════════════

# Cada stage tem: nome, label, event_types (lista) + ordem cronológica esperada.
# O funnel conta apenas usuários que passaram por TODOS os stages anteriores.
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
    """Funil sequencial de usuários únicos por feature."""
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

    # Janela em UTC
    start_utc, _ = _day_range_utc(start)
    _, end_utc = _day_range_utc(end)

    # ── Funnel correto: para cada stage, conta users únicos que tiveram
    # eventos de TODOS os stages anteriores + deste stage.
    #
    # Ex: stage 0 = "mentor_click", stage 1 = "mentor_response_received",
    # stage 2 = "insight_followed".
    # - Stage 0: COUNT(DISTINCT user_id) WHERE event_type IN (mentor_click)
    # - Stage 1: COUNT(DISTINCT user_id) WHERE user passou no stage 0 E
    #            tem evento mentor_response_received
    # - Stage 2: COUNT(DISTINCT user_id) WHERE user passou nos stages 0 e 1 E
    #            tem evento insight_followed
    #
    # SQL com EXISTS encadeados é a forma mais limpa de expressar isso.

    def _build_stage_query(stage_idx: int) -> tuple[str, dict]:
        """Constrói SQL e params para contar users únicos no stage_idx,
        respeitando a sequência de stages anteriores."""
        params = {
            "start": start_utc,
            "end": end_utc,
        }
        tenant_filter = ""
        if tenant_id:
            tenant_filter = "AND tenant_id = :tid"
            params["tid"] = tenant_id

        # Stage atual
        params[f"types_{stage_idx}"] = tuple(stages[stage_idx]["event_types"])

        # WHERE base do stage atual
        base_where = f"""
            event_type IN :types_{stage_idx}
            AND created_at >= :start AND created_at < :end
            {tenant_filter}
        """

        # Para cada stage anterior, adiciona um EXISTS
        exists_clauses = []
        for prev_idx in range(stage_idx):
            params[f"types_{prev_idx}"] = tuple(stages[prev_idx]["event_types"])
            exists_clauses.append(f"""
                EXISTS (
                    SELECT 1 FROM user_events ue{prev_idx}
                    WHERE ue{prev_idx}.user_id = ue.user_id
                      AND ue{prev_idx}.event_type IN :types_{prev_idx}
                      AND ue{prev_idx}.created_at >= :start
                      AND ue{prev_idx}.created_at < :end
                      AND ue{prev_idx}.created_at <= ue.created_at
                      {tenant_filter.replace("tenant_id", f"ue{prev_idx}.tenant_id")}
                )
            """)

        exists_sql = ""
        if exists_clauses:
            exists_sql = "AND " + "\nAND ".join(exists_clauses)

        sql = f"""
            SELECT COUNT(DISTINCT ue.user_id)
            FROM user_events ue
            WHERE {base_where}
            {exists_sql}
        """
        return sql, params

    stage_results = []
    for idx, stage in enumerate(stages):
        sql, params = _build_stage_query(idx)
        count = int(db.session.execute(text(sql), params).scalar() or 0)
        stage_results.append({
            "name": stage["name"],
            "label": stage["label"],
            "event_types": stage["event_types"],
            "unique_users": count,
        })

    # Pcts relativos ao primeiro stage (base)
    base = stage_results[0]["unique_users"] if stage_results else 0
    for r in stage_results:
        r["pct_of_base"] = round(100.0 * r["unique_users"] / base, 1) if base > 0 else 0.0

    # Drop-off entre stages consecutivos (sempre >= 0 porque é sequencial)
    drop_off = []
    for i in range(1, len(stage_results)):
        prev = stage_results[i - 1]
        curr = stage_results[i]
        lost = max(0, prev["unique_users"] - curr["unique_users"])
        pct = round(100.0 * lost / prev["unique_users"], 1) if prev["unique_users"] > 0 else 0.0
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


# ═══════════════════════════════════════════════════════════════════════════
# COHORT — retenção semanal
# ═══════════════════════════════════════════════════════════════════════════

@admin_event_metrics_bp.route("/cohort", methods=["GET"])
@jwt_required()
def cohort():
    """
    Retenção D0/D1/D3/D7/D14/D30 por cohort semanal.

    Cohort week = início ISO da semana (segunda-feira) em que o usuário fez
    seu primeiro evento.

    D0 = sempre 100% (todos os users têm pelo menos o primeiro evento).
    Dn = % de users do cohort com QUALQUER evento entre os dias [first_at, first_at + n].
       (cumulativo até n dias após primeiro evento, NÃO no dia exato n)

    Cacheado no Redis com TTL de 1h por (weeks, tenant_id).
    """
    forbidden = _require_super_admin()
    if forbidden:
        return forbidden

    weeks = min(int(request.args.get("weeks", 12)), 52)
    tenant_id = request.args.get("tenant_id")

    cache_key = f"cohort:{weeks}:{tenant_id or 'all'}"
    try:
        cached = redis_client.get(cache_key)
        if cached:
            return jsonify(json.loads(cached)), 200
    except Exception as e:
        logger.warning(f"[cohort] Redis get falhou: {e}")

    today = _today_brt()
    earliest = today - timedelta(weeks=weeks)
    earliest_dt, _ = _day_range_utc(earliest)

    params = {"earliest": earliest_dt}
    tenant_filter = ""
    if tenant_id:
        tenant_filter = "AND tenant_id = :tid"
        params["tid"] = tenant_id

    # ── Query única: para cada usuário, calcula primeira data + dias com atividade
    # CTE 1: first_event = primeira aparição de cada user no período
    # CTE 2: activity_days = lista de dias distintos com eventos por user
    # Final: cruza para saber, para cada user, em quais dias depois do primeiro
    #        ele teve atividade. Agrupa por cohort_week.

    sql = text(f"""
        WITH first_events AS (
            SELECT
                user_id,
                MIN(created_at) AS first_at,
                MIN(created_at)::DATE AS first_date,
                DATE_TRUNC('week', MIN(created_at) AT TIME ZONE 'America/Sao_Paulo')::DATE AS cohort_week
            FROM user_events
            WHERE created_at >= :earliest
            {tenant_filter}
            GROUP BY user_id
        ),
        user_activity AS (
            SELECT
                ue.user_id,
                fe.cohort_week,
                fe.first_date,
                (ue.created_at::DATE - fe.first_date) AS days_since_first
            FROM user_events ue
            JOIN first_events fe ON fe.user_id = ue.user_id
            WHERE ue.created_at >= :earliest
            {tenant_filter.replace('tenant_id', 'ue.tenant_id')}
        )
        SELECT
            cohort_week,
            COUNT(DISTINCT user_id) AS cohort_size,
            COUNT(DISTINCT CASE WHEN days_since_first <= 0 THEN user_id END) AS active_d0,
            COUNT(DISTINCT CASE WHEN days_since_first BETWEEN 1 AND 1 THEN user_id END) AS active_d1,
            COUNT(DISTINCT CASE WHEN days_since_first BETWEEN 1 AND 3 THEN user_id END) AS active_d3,
            COUNT(DISTINCT CASE WHEN days_since_first BETWEEN 1 AND 7 THEN user_id END) AS active_d7,
            COUNT(DISTINCT CASE WHEN days_since_first BETWEEN 1 AND 14 THEN user_id END) AS active_d14,
            COUNT(DISTINCT CASE WHEN days_since_first BETWEEN 1 AND 30 THEN user_id END) AS active_d30
        FROM user_activity
        GROUP BY cohort_week
        ORDER BY cohort_week DESC
    """)

    rows = db.session.execute(sql, params).fetchall()

    cohorts_result = []
    for row in rows:
        cohort_size = int(row.cohort_size)
        if cohort_size == 0:
            continue
        cohorts_result.append({
            "cohort_week": row.cohort_week.isoformat(),
            "size": cohort_size,
            "retention": {
                "d0": round(100.0 * row.active_d0 / cohort_size, 1),
                "d1": round(100.0 * row.active_d1 / cohort_size, 1),
                "d3": round(100.0 * row.active_d3 / cohort_size, 1),
                "d7": round(100.0 * row.active_d7 / cohort_size, 1),
                "d14": round(100.0 * row.active_d14 / cohort_size, 1),
                "d30": round(100.0 * row.active_d30 / cohort_size, 1),
            },
        })

    response = {
        "weeks": weeks,
        "tenant_id": tenant_id,
        "cohorts": cohorts_result,
    }

    try:
        redis_client.setex(cache_key, 3600, json.dumps(response))
    except Exception as e:
        logger.warning(f"[cohort] Redis set falhou: {e}")

    return jsonify(response), 200


# ═══════════════════════════════════════════════════════════════════════════
# USER JOURNEY
# ═══════════════════════════════════════════════════════════════════════════

@admin_event_metrics_bp.route("/user-journey/<string:user_id>", methods=["GET"])
@jwt_required()
def user_journey(user_id: str):
    """Timeline cronológica de eventos de um usuário específico."""
    forbidden = _require_super_admin()
    if forbidden:
        return forbidden

    limit = min(int(request.args.get("limit", 200)), 1000)
    today = _today_brt()
    start = _parse_date(request.args.get("start_date"), today - timedelta(days=89))
    end = _parse_date(request.args.get("end_date"), today)

    start_utc, _ = _day_range_utc(start)
    _, end_utc = _day_range_utc(end)

    user_info_sql = text("""
        SELECT u.id, u.name, u.email, u.tenant_id, t.name AS tenant_name
        FROM users u
        LEFT JOIN tenants t ON t.id = u.tenant_id
        WHERE u.id = :uid
    """)
    user_row = db.session.execute(user_info_sql, {"uid": user_id}).first()
    if not user_row:
        return jsonify({"error": "not_found", "message": "Usuário não encontrado."}), 404

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