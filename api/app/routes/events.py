# api/app/routes/events.py
# Endpoint de tracking de eventos comportamentais.
#
# Recebe BATCHES (1-50 eventos por POST) para reduzir overhead de rede.
# Eventos individuais inválidos são descartados silenciosamente — isso garante
# que clientes desatualizados não quebrem o tracking inteiro do batch.
#
# tenant_id e user_id NUNCA vêm do payload — sempre injetados do JWT.

import json
from datetime import datetime, timezone

from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from marshmallow import Schema, fields, validate, ValidationError, EXCLUDE

from app.extensions import db, limiter
from app.models.user_event import UserEvent
from app.models.user import UserRole
from app.middleware.tenant import resolve_tenant, require_tenant, get_current_tenant


events_bp = Blueprint("events", __name__)


# ══════════════════════════════════════════════════════════════════════════════
# WHITELIST DE EVENTOS — fonte da verdade para o que pode ser rastreado.
# Para adicionar um evento novo, basta acrescentar uma string aqui.
# ══════════════════════════════════════════════════════════════════════════════

ALLOWED_EVENT_TYPES = {
    # Sessão
    "session_start",
    "session_end",
    # Navegação
    "page_view",
    "page_leave",
    # Mentor inteligente
    "mentor_click",
    "mentor_response_received",
    "insight_view",
    "insight_followed",
    # Questões
    "question_filter_used",
    "explanation_read",
    # Simulados (complementam SimuladoAttempt)
    "simulado_abandon",
    "result_viewed",
    # Cronograma
    "schedule_choice_made",
    "item_rescheduled",
    # Gamificação
    "hall_of_fame_view",
    "ranking_view",
    "badge_view",
    "capsule_shared",
    # Aulas
    "lesson_started",
    "lesson_paused",
    "lesson_resumed",
    "material_downloaded",
    "lesson_completed",
    "lesson_rated",
    # Onboarding
    "onboarding_step_view",
    "onboarding_completed",
    "onboarding_skipped",
    # Anúncios (preparação para o marketplace)
    "ad_impression",
    "ad_click",
    "ad_dismissed",
    # Paywall (preparação para o marketplace)
    "feature_blocked_hit",
    "paywall_view",
    "paywall_dismiss",
}

ALLOWED_FEATURE_NAMES = {
    "mentor",
    "simulados",
    "questoes",
    "cronograma",
    "aulas",
    "gamificacao",
    "hall_of_fame",
    "onboarding",
    "ads",
    "paywall",
    "navigation",
    "session",
}

MAX_BATCH_SIZE = 50
MAX_METADATA_BYTES = 2048


# ══════════════════════════════════════════════════════════════════════════════
# SCHEMAS
# ══════════════════════════════════════════════════════════════════════════════

class EventSchema(Schema):
    event_type = fields.Str(
        required=True,
        validate=validate.Length(min=1, max=50),
    )
    feature_name = fields.Str(
        allow_none=True,
        load_default=None,
        validate=validate.Length(max=50),
    )
    target_id = fields.UUID(allow_none=True, load_default=None)
    session_id = fields.UUID(required=True)
    metadata = fields.Dict(allow_none=True, load_default=None)
    client_timestamp = fields.DateTime(allow_none=True, load_default=None)

    class Meta:
        unknown = EXCLUDE


class TrackBatchSchema(Schema):
    events = fields.List(
        fields.Nested(EventSchema),
        required=True,
        validate=validate.Length(min=1, max=MAX_BATCH_SIZE),
    )

    class Meta:
        unknown = EXCLUDE


# ══════════════════════════════════════════════════════════════════════════════
# HOOKS
# ══════════════════════════════════════════════════════════════════════════════

@events_bp.before_request
def before_request():
    if request.method == "OPTIONS":
        return  # CORS preflight
    resolve_tenant()


def _require_super_admin():
    claims = get_jwt()
    if claims.get("role") != UserRole.SUPER_ADMIN.value:
        return jsonify({"error": "forbidden", "message": "Acesso restrito."}), 403
    return None


# ══════════════════════════════════════════════════════════════════════════════
# TRACK — recebe batches do frontend
# ══════════════════════════════════════════════════════════════════════════════

@events_bp.route("/track", methods=["POST"])
@jwt_required()
@require_tenant
@limiter.limit("120 per minute")  # 120 batches × 50 eventos = até 6000 eventos/min/cliente
def track_events():
    """
    Recebe um batch de eventos.

    - Eventos individuais inválidos são descartados (log debug).
    - Retorna 202 com {accepted, rejected}.
    - 400 só ocorre se o JSON do batch for malformado.
    - tenant_id e user_id são INJETADOS do JWT.
    """
    schema = TrackBatchSchema()
    try:
        data = schema.load(request.get_json(force=True) or {})
    except ValidationError as e:
        return jsonify({"error": "validation_error", "details": e.messages}), 400

    tenant = get_current_tenant()
    user_id = get_jwt_identity()
    server_now = datetime.now(timezone.utc)

    accepted: list[UserEvent] = []
    rejected = 0

    for ev in data["events"]:
        # 1. Whitelist de event_type
        if ev["event_type"] not in ALLOWED_EVENT_TYPES:
            rejected += 1
            current_app.logger.debug(
                f"event rejected — unknown type: {ev['event_type'][:50]}"
            )
            continue

        # 2. Whitelist de feature_name (se fornecido)
        feature_name = ev.get("feature_name")
        if feature_name and feature_name not in ALLOWED_FEATURE_NAMES:
            rejected += 1
            current_app.logger.debug(
                f"event rejected — unknown feature: {feature_name[:50]}"
            )
            continue

        # 3. Limite de tamanho do metadata (evita payloads abusivos)
        meta = ev.get("metadata")
        if meta is not None:
            try:
                size = len(json.dumps(meta))
                if size > MAX_METADATA_BYTES:
                    rejected += 1
                    continue
            except (TypeError, ValueError):
                rejected += 1
                continue

        accepted.append(
            UserEvent(
                tenant_id=tenant.id,
                user_id=user_id,
                session_id=str(ev["session_id"]),
                event_type=ev["event_type"],
                feature_name=feature_name,
                target_id=str(ev["target_id"]) if ev.get("target_id") else None,
                event_metadata=meta,
                client_timestamp=ev.get("client_timestamp"),
                created_at=server_now,
            )
        )

    if accepted:
        try:
            db.session.bulk_save_objects(accepted)
            db.session.commit()
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"event batch insert failed: {e}", exc_info=True)
            return jsonify({"error": "insert_failed"}), 500

    return jsonify({
        "accepted": len(accepted),
        "rejected": rejected,
    }), 202


# ══════════════════════════════════════════════════════════════════════════════
# DEBUG — eventos recentes (super_admin only)
# ══════════════════════════════════════════════════════════════════════════════

@events_bp.route("/recent", methods=["GET"])
@jwt_required()
def recent_events():
    """
    Retorna os 100 eventos mais recentes para debug.
    Filtros opcionais via query params: tenant_id, event_type, user_id.
    """
    err = _require_super_admin()
    if err:
        return err

    tenant_id = request.args.get("tenant_id")
    event_type = request.args.get("event_type")
    user_id = request.args.get("user_id")

    q = UserEvent.query.order_by(UserEvent.created_at.desc())
    if tenant_id:
        q = q.filter(UserEvent.tenant_id == tenant_id)
    if event_type:
        q = q.filter(UserEvent.event_type == event_type)
    if user_id:
        q = q.filter(UserEvent.user_id == user_id)

    rows = q.limit(100).all()

    return jsonify({
        "events": [
            {
                "id": e.id,
                "tenant_id": e.tenant_id,
                "user_id": e.user_id,
                "session_id": e.session_id,
                "event_type": e.event_type,
                "feature_name": e.feature_name,
                "target_id": e.target_id,
                "metadata": e.event_metadata,
                "client_timestamp": e.client_timestamp.isoformat() if e.client_timestamp else None,
                "created_at": e.created_at.isoformat(),
            }
            for e in rows
        ],
        "total": len(rows),
    }), 200


# ══════════════════════════════════════════════════════════════════════════════
# WHITELIST — útil para o frontend saber quais eventos pode disparar
# ══════════════════════════════════════════════════════════════════════════════

@events_bp.route("/allowed", methods=["GET"])
@jwt_required()
def list_allowed():
    """Retorna a whitelist atual de event_types e feature_names."""
    return jsonify({
        "event_types": sorted(ALLOWED_EVENT_TYPES),
        "feature_names": sorted(ALLOWED_FEATURE_NAMES),
        "max_batch_size": MAX_BATCH_SIZE,
        "max_metadata_bytes": MAX_METADATA_BYTES,
    }), 200