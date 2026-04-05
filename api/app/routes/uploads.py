# api/app/routes/uploads.py
# Endpoints de upload para S3.
# - Logo do tenant (branding)
# - PDFs de aulas (material de apoio)
# - Vídeos de aulas (hospedagem nativa — feature video_hosting)
#
# Padrão: URLs pré-assinadas — arquivo sobe direto do browser para o S3
# sem passar pelo Flask (zero banda do servidor, zero custo de processamento).

import uuid
import boto3
from botocore.exceptions import ClientError
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt, get_jwt_identity

from app.extensions import db
from app.middleware.tenant import resolve_tenant, require_tenant, get_current_tenant
from app.models.user import User, UserRole
from app.models.course import Lesson
from app.models.tenant import Tenant
from sqlalchemy.orm.attributes import flag_modified

uploads_bp = Blueprint("uploads", __name__)

# ── Tipos permitidos ──────────────────────────────────────────────────────────

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/svg+xml"}
ALLOWED_PDF_TYPES = {"application/pdf"}
ALLOWED_VIDEO_TYPES = {"video/mp4", "video/webm", "video/quicktime"}

# ── Limites de tamanho (bytes) ────────────────────────────────────────────────

MAX_LOGO_SIZE = 2 * 1024 * 1024  # 2 MB
MAX_PDF_SIZE = 50 * 1024 * 1024  # 50 MB
MAX_VIDEO_SIZE = 2 * 1024 * 1024 * 1024  # 2 GB


def _is_producer_or_above(claims: dict) -> bool:
    return claims.get("role") in (
        UserRole.SUPER_ADMIN.value,
        UserRole.PRODUCER_ADMIN.value,
        UserRole.PRODUCER_STAFF.value,
    )


def _get_s3_client():
    region = current_app.config.get("AWS_REGION", "sa-east-1")
    return boto3.client(
        "s3",
        region_name=region,
        endpoint_url=f"https://s3.{region}.amazonaws.com",
    )


def _generate_presigned_post(
    bucket: str, key: str, content_type: str, max_size: int
) -> dict:
    """Gera URL pré-assinada para upload direto do browser para o S3."""
    s3 = _get_s3_client()
    return s3.generate_presigned_post(
        Bucket=bucket,
        Key=key,
        Fields={"Content-Type": content_type},
        Conditions=[
            {"Content-Type": content_type},
            ["content-length-range", 1, max_size],
        ],
        ExpiresIn=300,  # 5 min para PDFs/logos
    )


def _s3_public_url(bucket: str, region: str, key: str) -> str:
    return f"https://{bucket}.s3.{region}.amazonaws.com/{key}"


# ── Helper público: presigned GET para leitura ────────────────────────────────


def generate_video_presigned_url(key: str, expiry: int = 7200) -> str | None:
    """
    Gera presigned GET URL para vídeo hospedado no S3.

    Armazena o client boto3 em flask.g para reutilizá-lo durante o request
    inteiro — cursos com muitas aulas não criam múltiplas instâncias.
    Operação puramente local (HMAC-SHA256): sem chamada HTTP ao AWS.

    Args:
        key:    S3 key do vídeo  (ex: "tenants/{id}/videos/{lesson}/{uuid}.mp4")
        expiry: Segundos de validade da URL (default 2h)

    Returns:
        URL assinada ou None em caso de erro/configuração ausente.
    """
    from flask import current_app, g

    try:
        if not hasattr(g, "_s3_client_read"):
            region = current_app.config.get("AWS_REGION", "sa-east-1")
            g._s3_client_read = boto3.client(
                "s3",
                region_name=region,
                endpoint_url=f"https://s3.{region}.amazonaws.com",
            )
        bucket = current_app.config.get("AWS_S3_BUCKET", "")
        if not bucket:
            return None
        return g._s3_client_read.generate_presigned_url(
            "get_object",
            Params={"Bucket": bucket, "Key": key},
            ExpiresIn=expiry,
        )
    except Exception:
        return None


@uploads_bp.before_request
def before_request():
    resolve_tenant()


# ══════════════════════════════════════════════════════════════════════════════
# LOGO DO TENANT
# ══════════════════════════════════════════════════════════════════════════════


@uploads_bp.route("/logo/presigned", methods=["POST"])
@jwt_required()
@require_tenant
def logo_presigned_url():
    """
    Gera URL pré-assinada para upload de logo do tenant.
    O browser faz o upload direto para o S3.
    Após o upload, chama PATCH /uploads/logo/confirm para salvar no branding.
    """
    claims = get_jwt()
    if not _is_producer_or_above(claims):
        return jsonify({"error": "forbidden"}), 403

    tenant = get_current_tenant()
    data = request.get_json() or {}

    content_type = data.get("content_type", "")
    if content_type not in ALLOWED_IMAGE_TYPES:
        return (
            jsonify(
                {
                    "error": "invalid_type",
                    "message": f"Tipo não permitido. Use: {', '.join(ALLOWED_IMAGE_TYPES)}",
                }
            ),
            400,
        )

    ext = content_type.split("/")[1].replace("svg+xml", "svg")
    key = f"tenants/{tenant.id}/logo/{uuid.uuid4()}.{ext}"

    bucket = current_app.config.get("AWS_S3_BUCKET", "")
    if not bucket:
        return (
            jsonify({"error": "s3_not_configured", "message": "S3 não configurado."}),
            500,
        )

    try:
        presigned = _generate_presigned_post(bucket, key, content_type, MAX_LOGO_SIZE)
    except ClientError as e:
        current_app.logger.error(f"S3 logo presigned error: {e}")
        return (
            jsonify({"error": "s3_error", "message": "Erro ao gerar URL de upload."}),
            500,
        )

    region = current_app.config.get("AWS_REGION", "sa-east-1")
    public_url = _s3_public_url(bucket, region, key)

    return (
        jsonify(
            {
                "upload_url": presigned["url"],
                "fields": presigned["fields"],
                "public_url": public_url,
                "key": key,
            }
        ),
        200,
    )


@uploads_bp.route("/logo/confirm", methods=["PATCH"])
@jwt_required()
@require_tenant
def logo_confirm():
    """Após upload para o S3, salva a logo_url no branding do tenant."""
    claims = get_jwt()
    if not _is_producer_or_above(claims):
        return jsonify({"error": "forbidden"}), 403

    tenant = get_current_tenant()
    data = request.get_json() or {}
    logo_url = data.get("logo_url", "").strip()

    if not logo_url or not logo_url.startswith("https://"):
        return jsonify({"error": "invalid_url", "message": "URL inválida."}), 400

    branding = dict(tenant.branding or {})
    branding["logo_url"] = logo_url
    tenant.branding = branding
    flag_modified(tenant, "branding")
    db.session.commit()

    return (
        jsonify({"message": "Logo atualizada com sucesso.", "logo_url": logo_url}),
        200,
    )


# ══════════════════════════════════════════════════════════════════════════════
# PDF DE AULAS — suporte a múltiplos materiais por aula
# ══════════════════════════════════════════════════════════════════════════════


@uploads_bp.route("/pdf/presigned", methods=["POST"])
@jwt_required()
@require_tenant
def pdf_presigned_url():
    """
    Gera URL pré-assinada para upload de PDF.
    Body: { lesson_id: str, filename: str }
    Inalterado — o frontend continua usando este endpoint.
    """
    claims = get_jwt()
    if not _is_producer_or_above(claims):
        return jsonify({"error": "forbidden"}), 403

    tenant = get_current_tenant()
    data = request.get_json() or {}

    lesson_id = data.get("lesson_id", "").strip()
    filename = data.get("filename", "material.pdf").strip()

    if not lesson_id:
        return jsonify({"error": "lesson_id obrigatório"}), 400

    lesson = Lesson.query.filter_by(
        id=lesson_id, tenant_id=tenant.id, is_deleted=False
    ).first()
    if not lesson:
        return jsonify({"error": "not_found"}), 404

    content_type = "application/pdf"
    safe_name = "".join(c for c in filename if c.isalnum() or c in "._- ")[:100]
    if not safe_name.endswith(".pdf"):
        safe_name += ".pdf"

    key = f"tenants/{tenant.id}/lessons/{lesson_id}/{uuid.uuid4()}_{safe_name}"
    bucket = current_app.config.get("AWS_S3_BUCKET", "")
    if not bucket:
        return jsonify({"error": "s3_not_configured"}), 500

    try:
        presigned = _generate_presigned_post(bucket, key, content_type, MAX_PDF_SIZE)
    except ClientError as e:
        current_app.logger.error(f"S3 PDF presigned error: {e}")
        return jsonify({"error": "s3_error"}), 500

    region = current_app.config.get("AWS_REGION", "sa-east-1")
    public_url = _s3_public_url(bucket, region, key)

    return jsonify({
        "upload_url": presigned["url"],
        "fields": presigned["fields"],
        "public_url": public_url,
        "key": key,
        "lesson_id": lesson_id,
    }), 200


@uploads_bp.route("/pdf/confirm", methods=["PATCH"])
@jwt_required()
@require_tenant
def pdf_confirm():
    """
    Após upload para o S3, ADICIONA o material ao array materials da aula.
    Body: { lesson_id: str, material_url: str, filename: str }
    """
    claims = get_jwt()
    if not _is_producer_or_above(claims):
        return jsonify({"error": "forbidden"}), 403

    tenant = get_current_tenant()
    data = request.get_json() or {}

    lesson_id = data.get("lesson_id", "").strip()
    material_url = data.get("material_url", "").strip()
    filename = data.get("filename", "Material.pdf").strip()

    if not lesson_id or not material_url:
        return jsonify({"error": "lesson_id e material_url são obrigatórios"}), 400

    lesson = Lesson.query.filter_by(
        id=lesson_id, tenant_id=tenant.id, is_deleted=False
    ).first()
    if not lesson:
        return jsonify({"error": "not_found"}), 404

    new_material = {
        "id": str(uuid.uuid4()),
        "url": material_url,
        "filename": filename,
    }

    current = list(lesson.materials or [])
    current.append(new_material)
    lesson.materials = current
    flag_modified(lesson, "materials")
    db.session.commit()

    return jsonify({
        "message": "Material adicionado.",
        "material": new_material,
        "total": len(current),
    }), 200


@uploads_bp.route("/pdf/<string:lesson_id>/<string:material_id>", methods=["DELETE"])
@jwt_required()
@require_tenant
def pdf_delete_one(lesson_id: str, material_id: str):
    """Remove um material específico pelo seu ID do array materials."""
    claims = get_jwt()
    if not _is_producer_or_above(claims):
        return jsonify({"error": "forbidden"}), 403

    tenant = get_current_tenant()
    lesson = Lesson.query.filter_by(
        id=lesson_id, tenant_id=tenant.id, is_deleted=False
    ).first()
    if not lesson:
        return jsonify({"error": "not_found"}), 404

    current = list(lesson.materials or [])
    updated = [m for m in current if m.get("id") != material_id]

    if len(updated) == len(current):
        return jsonify({"error": "material not found"}), 404

    lesson.materials = updated
    flag_modified(lesson, "materials")
    db.session.commit()

    return jsonify({"message": "Material removido.", "remaining": len(updated)}), 200


@uploads_bp.route("/pdf/<string:lesson_id>", methods=["DELETE"])
@jwt_required()
@require_tenant
def pdf_delete_all(lesson_id: str):
    """Remove TODOS os materiais de uma aula (mantido para compatibilidade)."""
    claims = get_jwt()
    if not _is_producer_or_above(claims):
        return jsonify({"error": "forbidden"}), 403

    tenant = get_current_tenant()
    lesson = Lesson.query.filter_by(
        id=lesson_id, tenant_id=tenant.id, is_deleted=False
    ).first()
    if not lesson:
        return jsonify({"error": "not_found"}), 404

    lesson.materials = []
    flag_modified(lesson, "materials")
    db.session.commit()

    return jsonify({"message": "Todos os materiais removidos."}), 200


# ══════════════════════════════════════════════════════════════════════════════
# VÍDEO DE AULAS  (feature: video_hosting)
# ══════════════════════════════════════════════════════════════════════════════


@uploads_bp.route("/video/presigned", methods=["POST"])
@jwt_required()
@require_tenant
def video_presigned_url():
    """
    Gera URL pré-assinada para upload de vídeo de aula.
    Requer feature video_hosting ativada no tenant.

    Body: { lesson_id: str, filename: str, content_type: str }

    A condição starts-with na policy garante que mesmo com uma URL vazada
    o upload só pode ir para o prefixo do tenant correto — sem escalada lateral.
    """
    claims = get_jwt()
    if not _is_producer_or_above(claims):
        return jsonify({"error": "forbidden"}), 403

    tenant = get_current_tenant()

    # ── Feature gate ──────────────────────────────────────────────────────────
    if not tenant.is_feature_enabled("video_hosting"):
        return (
            jsonify(
                {
                    "error": "feature_disabled",
                    "message": "Hospedagem de vídeos não disponível neste plano.",
                }
            ),
            403,
        )

    data = request.get_json() or {}
    lesson_id = data.get("lesson_id", "").strip()
    filename = data.get("filename", "video.mp4").strip()
    content_type = data.get("content_type", "video/mp4").strip()

    if not lesson_id:
        return jsonify({"error": "lesson_id obrigatório"}), 400

    if content_type not in ALLOWED_VIDEO_TYPES:
        return (
            jsonify(
                {
                    "error": "invalid_type",
                    "message": f"Tipo não permitido. Use: {', '.join(sorted(ALLOWED_VIDEO_TYPES))}",
                }
            ),
            400,
        )

    lesson = Lesson.query.filter_by(
        id=lesson_id, tenant_id=tenant.id, is_deleted=False
    ).first()
    if not lesson:
        return jsonify({"error": "not_found", "message": "Aula não encontrada."}), 404

    # Sanitiza extensão do arquivo
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "mp4"
    if ext not in {"mp4", "webm", "mov"}:
        ext = "mp4"

    key = f"tenants/{tenant.id}/videos/{lesson_id}/{uuid.uuid4()}.{ext}"
    bucket = current_app.config.get("AWS_S3_BUCKET", "")
    if not bucket:
        return (
            jsonify({"error": "s3_not_configured", "message": "S3 não configurado."}),
            500,
        )

    try:
        s3 = _get_s3_client()
        presigned = s3.generate_presigned_post(
            Bucket=bucket,
            Key=key,
            Fields={"Content-Type": content_type},
            Conditions=[
                {"Content-Type": content_type},
                ["content-length-range", 1, MAX_VIDEO_SIZE],
                # SEGURANÇA: upload só pode ir para o prefixo exclusivo do tenant
                ["starts-with", "$key", f"tenants/{tenant.id}/videos/"],
            ],
            ExpiresIn=3600,  # 1h — vídeos grandes podem levar tempo para subir
        )
    except ClientError as e:
        current_app.logger.error(f"S3 video presigned error: {e}")
        return (
            jsonify({"error": "s3_error", "message": "Erro ao gerar URL de upload."}),
            500,
        )

    return (
        jsonify(
            {
                "upload_url": presigned["url"],
                "fields": presigned["fields"],
                "key": key,
                "lesson_id": lesson_id,
            }
        ),
        200,
    )


@uploads_bp.route("/video/confirm", methods=["PATCH"])
@jwt_required()
@require_tenant
def video_confirm():
    """
    Após o upload direto para o S3, vincula o video_s3_key à aula.
    Limpa video_url externo automaticamente — os dois campos são mutuamente exclusivos.

    Body: { lesson_id: str, key: str }
    """
    claims = get_jwt()
    if not _is_producer_or_above(claims):
        return jsonify({"error": "forbidden"}), 403

    tenant = get_current_tenant()

    if not tenant.is_feature_enabled("video_hosting"):
        return jsonify({"error": "feature_disabled"}), 403

    data = request.get_json() or {}
    lesson_id = data.get("lesson_id", "").strip()
    s3_key = data.get("key", "").strip()

    if not lesson_id or not s3_key:
        return jsonify({"error": "lesson_id e key são obrigatórios"}), 400

    # SEGURANÇA: valida que a key pertence ao prefixo do tenant —
    # impede que um produtor vincule arquivos de outro tenant às suas aulas.
    expected_prefix = f"tenants/{tenant.id}/videos/"
    if not s3_key.startswith(expected_prefix):
        return (
            jsonify(
                {"error": "invalid_key", "message": "Key inválida para este tenant."}
            ),
            400,
        )

    lesson = Lesson.query.filter_by(
        id=lesson_id, tenant_id=tenant.id, is_deleted=False
    ).first()
    if not lesson:
        return jsonify({"error": "not_found"}), 404

    # Remove link externo — não pode ter os dois simultaneamente
    lesson.video_url = None
    lesson.video_s3_key = s3_key
    db.session.commit()

    return (
        jsonify(
            {
                "message": "Vídeo hospedado vinculado à aula.",
                "lesson_id": lesson_id,
                "video_hosted": True,
            }
        ),
        200,
    )


@uploads_bp.route("/video/<string:lesson_id>", methods=["DELETE"])
@jwt_required()
@require_tenant
def video_delete(lesson_id: str):
    """
    Desvincula o vídeo hospedado da aula.
    Não deleta o arquivo do S3 — use lifecycle policy no bucket para limpeza.
    """
    claims = get_jwt()
    if not _is_producer_or_above(claims):
        return jsonify({"error": "forbidden"}), 403

    tenant = get_current_tenant()
    lesson = Lesson.query.filter_by(
        id=lesson_id, tenant_id=tenant.id, is_deleted=False
    ).first()
    if not lesson:
        return jsonify({"error": "not_found"}), 404

    lesson.video_s3_key = None
    db.session.commit()

    return jsonify({"message": "Vídeo hospedado removido da aula."}), 200
