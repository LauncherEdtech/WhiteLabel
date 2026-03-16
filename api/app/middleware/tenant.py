# api/app/middleware/tenant.py
# SEGURANÇA: Resolve o tenant a partir do domínio de cada request.
# Toda a aplicação opera dentro do contexto de um tenant após este middleware.

from functools import wraps
from flask import request, g, jsonify
from sqlalchemy import or_

from app.extensions import db
from app.models.tenant import Tenant


def resolve_tenant():
    """
    Resolve o tenant atual com base no header ou domínio da requisição.

    Estratégias (em ordem de prioridade):
    1. Header X-Tenant-Slug (para chamadas internas / admin)
    2. Host da requisição (domínio customizado do produtor)

    SEGURANÇA:
    - Tenant inativo retorna 403 (não 404 — evita enumeração)
    - g.tenant é o único ponto de verdade; código downstream não deve
      aceitar tenant_id do request body ou query params
    """
    host = request.host.lower().split(":")[0]  # Remove porta se houver

    # Domínios que não precisam de tenant (API admin interna)
    EXCLUDED_HOSTS = {"localhost", "127.0.0.1", "api.platform.internal"}

    # Prioridade 1: Header explícito (usado pelo super_admin e testes)
    tenant_slug = request.headers.get("X-Tenant-Slug")

    tenant = None

    if tenant_slug:
        # SEGURANÇA: Sanitiza o slug antes de usar na query
        tenant_slug = tenant_slug.strip().lower()[:100]
        tenant = Tenant.query.filter_by(
            slug=tenant_slug,
            is_deleted=False,
        ).first()

    elif host not in EXCLUDED_HOSTS:
        # Prioridade 2: Resolve pelo domínio do request
        tenant = Tenant.query.filter(
            or_(
                Tenant.custom_domain == host,
                # Subdomínio padrão: slug.platform.com
                Tenant.slug == host.split(".")[0],
            ),
            Tenant.is_deleted == False,
        ).first()

    # Armazena no contexto do request (g é thread-safe no Flask)
    g.tenant = tenant


def require_tenant(f):
    """
    Decorator: garante que o endpoint tem um tenant válido e ativo.
    Use em todas as rotas que não são admin/super_admin.

    SEGURANÇA: Falha fechada — sem tenant, sem acesso.
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        if not hasattr(g, "tenant") or g.tenant is None:
            return jsonify({
                "error": "tenant_not_found",
                "message": "Plataforma não encontrada.",
            }), 404

        if not g.tenant.is_active:
            # SEGURANÇA: 403 e não 404 para tenant inativo
            return jsonify({
                "error": "tenant_inactive",
                "message": "Esta plataforma está inativa.",
            }), 403

        return f(*args, **kwargs)
    return decorated


def require_feature(feature_name: str):
    """
    Decorator: garante que a feature está habilitada para o tenant.
    Use em rotas de módulos opcionais (ex: AI, simulados premium).

    Exemplo de uso:
        @require_feature("simulados")
        def create_simulado(): ...
    """
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            tenant = getattr(g, "tenant", None)
            if not tenant:
                return jsonify({"error": "tenant_required"}), 403

            if not tenant.is_feature_enabled(feature_name):
                return jsonify({
                    "error": "feature_not_available",
                    "message": f"O módulo '{feature_name}' não está disponível no seu plano.",
                }), 403

            return f(*args, **kwargs)
        return decorated
    return decorator


def get_current_tenant() -> Tenant:
    """Helper: retorna o tenant do contexto atual. Lança erro se não existir."""
    tenant = getattr(g, "tenant", None)
    if not tenant:
        raise RuntimeError("Tenant não resolvido. Verifique o middleware.")
    return tenant