# api/app/routes/notifications.py
# Notificações in-platform para alunos.
#
# SEGURANÇA:
#   - Toda query filtra por tenant_id + recipient_id (isolamento duplo)
#   - mark_read valida ownership antes de alterar
#   - Nenhuma rota expõe dados de outro tenant ou usuário

from datetime import datetime, timezone

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from app.extensions import db
from app.middleware.tenant import get_current_tenant, require_tenant, resolve_tenant

notifications_bp = Blueprint("notifications", __name__)


@notifications_bp.before_request
def before_request():
    resolve_tenant()


# ── Serialização ──────────────────────────────────────────────────────────────


def _serialize(n) -> dict:
    return {
        "id": n.id,
        "title": n.title,
        "message": n.message,
        "notification_type": n.notification_type,
        "is_read": n.is_read,
        "read_at": n.read_at.isoformat() if n.read_at else None,
        "created_at": n.created_at.isoformat() if n.created_at else None,
    }


# ── Listar notificações ───────────────────────────────────────────────────────


@notifications_bp.route("/", methods=["GET"])
@jwt_required()
@require_tenant
def list_notifications():
    """
    Lista notificações do usuário autenticado, mais recentes primeiro.
    Duplo filtro tenant_id + recipient_id garante isolamento completo.
    """
    from app.models.notification import Notification

    user_id = get_jwt_identity()
    tenant = get_current_tenant()

    # Sanitiza paginação — evita valores negativos ou absurdos
    try:
        page = max(1, int(request.args.get("page", 1)))
        per_page = min(max(1, int(request.args.get("per_page", 20))), 50)
    except (TypeError, ValueError):
        page, per_page = 1, 20

    paginated = (
        Notification.query.filter_by(
            tenant_id=tenant.id,    # isolamento de tenant
            recipient_id=user_id,   # apenas notificações do usuário logado
            is_deleted=False,
        )
        .order_by(Notification.created_at.desc())
        .paginate(page=page, per_page=per_page, error_out=False)
    )

    return jsonify(
        {
            "notifications": [_serialize(n) for n in paginated.items],
            "total": paginated.total,
            "page": page,
            "pages": paginated.pages,
            "has_next": paginated.has_next,
        }
    ), 200


# ── Contagem de não lidas ─────────────────────────────────────────────────────


@notifications_bp.route("/unread-count", methods=["GET"])
@jwt_required()
@require_tenant
def unread_count():
    """
    Retorna contagem de notificações não lidas.
    Query leve — usada para badge no navbar com polling de 60s.
    Index composto (recipient_id, is_read) garante performance.
    """
    from app.models.notification import Notification

    user_id = get_jwt_identity()
    tenant = get_current_tenant()

    count = Notification.query.filter_by(
        tenant_id=tenant.id,
        recipient_id=user_id,
        is_read=False,
        is_deleted=False,
    ).count()

    return jsonify({"unread_count": count}), 200


# ── Marcar uma notificação como lida ─────────────────────────────────────────


@notifications_bp.route("/<notification_id>/read", methods=["PATCH"])
@jwt_required()
@require_tenant
def mark_read(notification_id):
    """
    Marca uma notificação específica como lida.
    Filtra tenant_id + recipient_id para prevenir IDOR cross-user/cross-tenant.
    Retorna 404 independente de o ID existir em outro tenant (não vaza informação).
    """
    from app.models.notification import Notification

    user_id = get_jwt_identity()
    tenant = get_current_tenant()

    notif = Notification.query.filter_by(
        id=notification_id,
        tenant_id=tenant.id,    # bloqueia cross-tenant
        recipient_id=user_id,   # bloqueia cross-user
        is_deleted=False,
    ).first()

    if not notif:
        return jsonify({"error": "not_found"}), 404

    if not notif.is_read:
        notif.mark_read()
        db.session.commit()

    return jsonify(_serialize(notif)), 200


# ── Marcar todas como lidas ───────────────────────────────────────────────────


@notifications_bp.route("/read-all", methods=["POST"])
@jwt_required()
@require_tenant
def mark_all_read():
    """
    Marca todas as notificações não lidas do usuário como lidas.
    Bulk update sem carregar objetos em memória (synchronize_session=False).
    """
    from app.models.notification import Notification

    user_id = get_jwt_identity()
    tenant = get_current_tenant()
    now = datetime.now(timezone.utc)

    Notification.query.filter_by(
        tenant_id=tenant.id,
        recipient_id=user_id,
        is_read=False,
        is_deleted=False,
    ).update(
        {"is_read": True, "read_at": now},
        synchronize_session=False,
    )

    db.session.commit()

    return jsonify({"message": "Todas as notificações foram marcadas como lidas."}), 200