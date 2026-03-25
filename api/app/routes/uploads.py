# api/app/routes/uploads.py
# Endpoints de upload para S3.
# - Logo do tenant (branding)
# - PDFs de aulas (material de apoio)
# Usa URLs pré-assinadas: o arquivo sobe direto do browser para o S3,
# sem passar pelo servidor Flask (economiza largura de banda e processamento).

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

# Tipos permitidos por categoria
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/svg+xml"}
ALLOWED_PDF_TYPES = {"application/pdf"}

# Limites de tamanho (bytes)
MAX_LOGO_SIZE = 2 * 1024 * 1024  # 2 MB
MAX_PDF_SIZE = 50 * 1024 * 1024  # 50 MB


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
        endpoint_url=f"https://s3.{region}.amazonaws.com",  # ← força endpoint regional
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
        ExpiresIn=300,  # 5 minutos para completar o upload
    )


def _s3_public_url(bucket: str, region: str, key: str) -> str:
    # Virtual-hosted style — evita o 307 redirect
    return f"https://{bucket}.s3.{region}.amazonaws.com/{key}"


@uploads_bp.before_request
def before_request():
    resolve_tenant()


# ── Upload de logo do tenant ───────────────────────────────────────────────────


@uploads_bp.route("/logo/presigned", methods=["POST"])
@jwt_required()
@require_tenant
def logo_presigned_url():
    """
    Gera URL pré-assinada para upload de logo do tenant.
    O browser faz o upload direto para o S3 usando esta URL.
    Após o upload, chama PATCH /uploads/logo/confirm para salvar a URL no branding.
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
        current_app.logger.error(f"S3 presigned error: {e}")
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
    """
    Após o upload direto para o S3, salva a logo_url no branding do tenant.
    """
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
        jsonify(
            {
                "message": "Logo atualizada com sucesso.",
                "logo_url": logo_url,
            }
        ),
        200,
    )


# ── Upload de PDF para aulas ───────────────────────────────────────────────────


@uploads_bp.route("/pdf/presigned", methods=["POST"])
@jwt_required()
@require_tenant
def pdf_presigned_url():
    """
    Gera URL pré-assinada para upload de PDF de material de aula.
    Body: { lesson_id: str, filename: str }
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

    # Garante que a aula pertence ao tenant
    lesson = Lesson.query.filter_by(
        id=lesson_id,
        tenant_id=tenant.id,
        is_deleted=False,
    ).first()
    if not lesson:
        return jsonify({"error": "not_found", "message": "Aula não encontrada."}), 404

    content_type = "application/pdf"
    # Sanitiza nome do arquivo
    safe_name = "".join(c for c in filename if c.isalnum() or c in "._- ")[:100]
    if not safe_name.endswith(".pdf"):
        safe_name += ".pdf"

    key = f"tenants/{tenant.id}/lessons/{lesson_id}/{uuid.uuid4()}_{safe_name}"

    bucket = current_app.config.get("AWS_S3_BUCKET", "")
    if not bucket:
        return (
            jsonify({"error": "s3_not_configured", "message": "S3 não configurado."}),
            500,
        )

    try:
        presigned = _generate_presigned_post(bucket, key, content_type, MAX_PDF_SIZE)
    except ClientError as e:
        current_app.logger.error(f"S3 presigned error: {e}")
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
                "lesson_id": lesson_id,
            }
        ),
        200,
    )


@uploads_bp.route("/pdf/confirm", methods=["PATCH"])
@jwt_required()
@require_tenant
def pdf_confirm():
    """
    Após o upload direto para o S3, salva o material_url na aula.
    Body: { lesson_id: str, material_url: str, filename: str }
    """
    claims = get_jwt()
    if not _is_producer_or_above(claims):
        return jsonify({"error": "forbidden"}), 403

    tenant = get_current_tenant()
    data = request.get_json() or {}

    lesson_id = data.get("lesson_id", "").strip()
    material_url = data.get("material_url", "").strip()
    filename = data.get("filename", "Material").strip()

    if not lesson_id or not material_url:
        return jsonify({"error": "lesson_id e material_url são obrigatórios"}), 400

    lesson = Lesson.query.filter_by(
        id=lesson_id,
        tenant_id=tenant.id,
        is_deleted=False,
    ).first()
    if not lesson:
        return jsonify({"error": "not_found"}), 404

    lesson.material_url = material_url
    db.session.commit()

    return (
        jsonify(
            {
                "message": "Material salvo com sucesso.",
                "material_url": material_url,
                "filename": filename,
            }
        ),
        200,
    )


# ── Listar/remover materiais de uma aula ──────────────────────────────────────


@uploads_bp.route("/pdf/<string:lesson_id>", methods=["DELETE"])
@jwt_required()
@require_tenant
def pdf_delete(lesson_id: str):
    """Remove o material_url de uma aula (não deleta do S3, apenas desvincula)."""
    claims = get_jwt()
    if not _is_producer_or_above(claims):
        return jsonify({"error": "forbidden"}), 403

    tenant = get_current_tenant()
    lesson = Lesson.query.filter_by(
        id=lesson_id,
        tenant_id=tenant.id,
        is_deleted=False,
    ).first()
    if not lesson:
        return jsonify({"error": "not_found"}), 404

    lesson.material_url = None
    db.session.commit()

    return jsonify({"message": "Material removido da aula."}), 200
