# api/app/routes/students.py
# Gestão de alunos pelo produtor.
# Produtor pode criar, editar, listar e gerenciar matrículas dos alunos.

import secrets
import string
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt, get_jwt_identity
from marshmallow import Schema, fields, validate, ValidationError, EXCLUDE

from app.extensions import db, limiter
from app.models.user import User, UserRole
from app.models.course import Course, CourseEnrollment
from app.middleware.tenant import resolve_tenant, require_tenant, get_current_tenant

students_bp = Blueprint("students", __name__)


def _require_producer(claims: dict):
    if claims.get("role") not in (
        UserRole.SUPER_ADMIN.value,
        UserRole.PRODUCER_ADMIN.value,
        UserRole.PRODUCER_STAFF.value,
    ):
        return jsonify({"error": "forbidden", "message": "Acesso negado."}), 403
    return None


class CreateStudentSchema(Schema):
    name = fields.Str(required=True, validate=validate.Length(min=2, max=255))
    email = fields.Email(required=True)
    password = fields.Str(validate=validate.Length(min=8, max=128), load_default=None)
    phone = fields.Str(
        allow_none=True, load_default=None, validate=validate.Length(max=20)
    )
    course_ids = fields.List(fields.Str(), load_default=[])  # matrículas iniciais

    class Meta:
        unknown = EXCLUDE


class UpdateStudentSchema(Schema):
    name = fields.Str(validate=validate.Length(min=2, max=255))
    phone = fields.Str(allow_none=True, validate=validate.Length(max=20))
    is_active = fields.Bool()

    class Meta:
        unknown = EXCLUDE


@students_bp.before_request
def before_request():
    resolve_tenant()


# ── Listar alunos ─────────────────────────────────────────────────────────────


@students_bp.route("/", methods=["GET"])
@jwt_required()
@require_tenant
def list_students():
    claims = get_jwt()
    err = _require_producer(claims)
    if err:
        return err

    tenant = get_current_tenant()
    page = int(request.args.get("page", 1))
    per_page = min(int(request.args.get("per_page", 20)), 100)
    search = request.args.get("search", "").strip()
    course_id = request.args.get("course_id")  # filtrar por curso

    query = User.query.filter_by(
        tenant_id=tenant.id,
        role=UserRole.STUDENT.value,
        is_deleted=False,
    )

    if search:
        query = query.filter(
            User.name.ilike(f"%{search}%") | User.email.ilike(f"%{search}%")
        )

    # Filtrar por curso específico
    if course_id:
        enrolled_ids = [
            e.user_id
            for e in CourseEnrollment.query.filter_by(
                tenant_id=tenant.id,
                course_id=course_id,
                is_active=True,
                is_deleted=False,
            ).all()
        ]
        query = query.filter(User.id.in_(enrolled_ids))

    total = query.count()
    students = query.order_by(User.name).paginate(
        page=page, per_page=per_page, error_out=False
    )

    # Busca todas as matrículas dos alunos retornados de uma vez
    student_ids = [s.id for s in students.items]
    enrollments = CourseEnrollment.query.filter(
        CourseEnrollment.user_id.in_(student_ids),
        CourseEnrollment.tenant_id == tenant.id,
        CourseEnrollment.is_active == True,
        CourseEnrollment.is_deleted == False,
    ).all()

    # Mapeia user_id → lista de course_ids
    enrollment_map: dict[str, list[str]] = {}
    for e in enrollments:
        enrollment_map.setdefault(e.user_id, []).append(e.course_id)

    result = []
    for s in students.items:
        prefs = s.preferences or {}
        result.append(
            {
                "id": s.id,
                "name": s.name,
                "email": s.email,
                "phone": prefs.get("phone"),
                "is_active": s.is_active,
                "email_verified": s.email_verified,
                "created_at": s.created_at.isoformat() if s.created_at else None,
                "enrolled_course_ids": enrollment_map.get(s.id, []),
            }
        )

    return (
        jsonify(
            {
                "students": result,
                "pagination": {
                    "page": page,
                    "per_page": per_page,
                    "total": total,
                    "pages": students.pages,
                },
            }
        ),
        200,
    )


# ── Criar aluno ───────────────────────────────────────────────────────────────


@students_bp.route("/", methods=["POST"])
@jwt_required()
@require_tenant
@limiter.limit("50 per hour")
def create_student():
    """
    Produtor cria um novo aluno.
    - Gera senha aleatória se não fornecida.
    - Matricula automaticamente nos cursos indicados.
    - Em produção: envia email com credenciais (via Celery + Flask-Mail).
    """
    claims = get_jwt()
    err = _require_producer(claims)
    if err:
        return err

    tenant = get_current_tenant()

    schema = CreateStudentSchema()
    try:
        data = schema.load(request.get_json(force=True) or {})
    except ValidationError as e:
        return jsonify({"error": "validation_error", "details": e.messages}), 400

    # Verifica duplicata de email no tenant
    if User.query.filter_by(
        email=data["email"].lower().strip(),
        tenant_id=tenant.id,
        is_deleted=False,
    ).first():
        return (
            jsonify(
                {
                    "error": "email_taken",
                    "message": "Já existe um aluno com este e-mail.",
                }
            ),
            409,
        )

    # Gera senha se não fornecida
    plain_password = data["password"]
    if not plain_password:
        alphabet = string.ascii_letters + string.digits + "!@#$"
        plain_password = "".join(secrets.choice(alphabet) for _ in range(12))

    # Phone armazenado em preferences (sem migration necessária)
    preferences = {
        "timezone": "America/Sao_Paulo",
        "notifications_email": True,
        "notifications_push": True,
        "study_reminder_time": "08:00",
    }
    if data.get("phone"):
        preferences["phone"] = data["phone"]

    student = User(
        tenant_id=tenant.id,
        name=data["name"].strip(),
        email=data["email"].lower().strip(),
        role=UserRole.STUDENT,
        is_active=True,
        email_verified=True,  # Criado pelo produtor = já verificado
        preferences=preferences,
    )
    student.set_password(plain_password)
    db.session.add(student)
    db.session.flush()

    # Matrículas iniciais
    enrolled_courses = []
    for course_id in data.get("course_ids", []):
        course = Course.query.filter_by(
            id=course_id,
            tenant_id=tenant.id,
            is_deleted=False,
        ).first()
        if course:
            enrollment = CourseEnrollment(
                tenant_id=tenant.id,
                course_id=course.id,
                user_id=student.id,
                is_active=True,
            )
            db.session.add(enrollment)
            enrolled_courses.append(course.name)

    db.session.commit()

    # TODO: enviar email de boas-vindas com credenciais via Celery
    # from app.tasks import send_welcome_email
    # send_welcome_email.delay(student.email, student.name, plain_password, tenant.name)

    return (
        jsonify(
            {
                "message": "Aluno criado com sucesso.",
                "student": {
                    "id": student.id,
                    "name": student.name,
                    "email": student.email,
                    "phone": data.get("phone"),
                    "is_active": student.is_active,
                    "enrolled_courses": enrolled_courses,
                },
                # Retorna senha temporária para o produtor compartilhar manualmente
                # enquanto o envio de email não está configurado
                "temp_password": plain_password if not data["password"] else None,
            }
        ),
        201,
    )


# ── Detalhes de um aluno ──────────────────────────────────────────────────────


@students_bp.route("/<string:student_id>", methods=["GET"])
@jwt_required()
@require_tenant
def get_student(student_id: str):
    claims = get_jwt()
    err = _require_producer(claims)
    if err:
        return err

    tenant = get_current_tenant()
    student = User.query.filter_by(
        id=student_id,
        tenant_id=tenant.id,
        role=UserRole.STUDENT.value,
        is_deleted=False,
    ).first_or_404()

    enrollments = CourseEnrollment.query.filter_by(
        user_id=student.id,
        tenant_id=tenant.id,
        is_active=True,
        is_deleted=False,
    ).all()

    enrolled_courses = []
    for e in enrollments:
        course = Course.query.filter_by(id=e.course_id, is_deleted=False).first()
        if course:
            enrolled_courses.append({"id": course.id, "name": course.name})

    prefs = student.preferences or {}
    return (
        jsonify(
            {
                "student": {
                    "id": student.id,
                    "name": student.name,
                    "email": student.email,
                    "phone": prefs.get("phone"),
                    "is_active": student.is_active,
                    "email_verified": student.email_verified,
                    "created_at": (
                        student.created_at.isoformat() if student.created_at else None
                    ),
                    "enrolled_courses": enrolled_courses,
                }
            }
        ),
        200,
    )


# ── Editar aluno ──────────────────────────────────────────────────────────────


@students_bp.route("/<string:student_id>", methods=["PUT"])
@jwt_required()
@require_tenant
def update_student(student_id: str):
    claims = get_jwt()
    err = _require_producer(claims)
    if err:
        return err

    tenant = get_current_tenant()
    student = User.query.filter_by(
        id=student_id,
        tenant_id=tenant.id,
        role=UserRole.STUDENT.value,
        is_deleted=False,
    ).first_or_404()

    schema = UpdateStudentSchema()
    try:
        data = schema.load(request.get_json(force=True) or {})
    except ValidationError as e:
        return jsonify({"error": "validation_error", "details": e.messages}), 400

    if "name" in data:
        student.name = data["name"].strip()
    if "is_active" in data:
        student.is_active = data["is_active"]
    if "phone" in data:
        prefs = dict(student.preferences or {})
        if data["phone"]:
            prefs["phone"] = data["phone"]
        else:
            prefs.pop("phone", None)
        student.preferences = prefs
        from sqlalchemy.orm.attributes import flag_modified

        flag_modified(student, "preferences")

    db.session.commit()

    prefs = student.preferences or {}
    return (
        jsonify(
            {
                "message": "Aluno atualizado.",
                "student": {
                    "id": student.id,
                    "name": student.name,
                    "email": student.email,
                    "phone": prefs.get("phone"),
                    "is_active": student.is_active,
                },
            }
        ),
        200,
    )


# ── Gerenciar matrículas de um aluno ──────────────────────────────────────────


@students_bp.route("/<string:student_id>/enrollments", methods=["PUT"])
@jwt_required()
@require_tenant
def manage_student_enrollments(student_id: str):
    """
    Substitui as matrículas do aluno.
    Body: { "course_ids": ["id1", "id2"] }
    Cursos ausentes na lista têm matrícula desativada.
    """
    claims = get_jwt()
    err = _require_producer(claims)
    if err:
        return err

    tenant = get_current_tenant()
    student = User.query.filter_by(
        id=student_id,
        tenant_id=tenant.id,
        role=UserRole.STUDENT.value,
        is_deleted=False,
    ).first_or_404()

    data = request.get_json() or {}
    desired_course_ids = set(data.get("course_ids", []))

    # Valida que todos os course_ids pertencem ao tenant
    valid_courses = {
        c.id
        for c in Course.query.filter(
            Course.id.in_(desired_course_ids),
            Course.tenant_id == tenant.id,
            Course.is_deleted == False,
        ).all()
    }

    # Busca matrículas existentes
    existing = {
        e.course_id: e
        for e in CourseEnrollment.query.filter_by(
            user_id=student.id,
            tenant_id=tenant.id,
        ).all()
    }

    enrolled = []
    unenrolled = []

    # Ativa ou cria matrículas para cursos desejados
    for course_id in valid_courses:
        if course_id in existing:
            if not existing[course_id].is_active:
                existing[course_id].is_active = True
                existing[course_id].is_deleted = False
                enrolled.append(course_id)
        else:
            db.session.add(
                CourseEnrollment(
                    tenant_id=tenant.id,
                    course_id=course_id,
                    user_id=student.id,
                    is_active=True,
                )
            )
            enrolled.append(course_id)

    # Desativa matrículas não listadas
    for course_id, enrollment in existing.items():
        if course_id not in valid_courses and enrollment.is_active:
            enrollment.is_active = False
            unenrolled.append(course_id)

    db.session.commit()

    return (
        jsonify(
            {
                "message": "Matrículas atualizadas.",
                "enrolled_count": len(enrolled),
                "unenrolled_count": len(unenrolled),
                "active_course_ids": list(valid_courses),
            }
        ),
        200,
    )


# ── Matrículas de um curso ────────────────────────────────────────────────────


@students_bp.route("/by-course/<string:course_id>", methods=["GET"])
@jwt_required()
@require_tenant
def students_by_course(course_id: str):
    """Lista alunos matriculados em um curso específico."""
    claims = get_jwt()
    err = _require_producer(claims)
    if err:
        return err

    tenant = get_current_tenant()

    course = Course.query.filter_by(
        id=course_id, tenant_id=tenant.id, is_deleted=False
    ).first_or_404()

    # Todos os alunos do tenant com flag de matrícula neste curso
    all_students = (
        User.query.filter_by(
            tenant_id=tenant.id,
            role=UserRole.STUDENT.value,
            is_deleted=False,
        )
        .order_by(User.name)
        .all()
    )

    enrolled_ids = {
        e.user_id
        for e in CourseEnrollment.query.filter_by(
            course_id=course_id,
            tenant_id=tenant.id,
            is_active=True,
            is_deleted=False,
        ).all()
    }

    result = []
    for s in all_students:
        prefs = s.preferences or {}
        result.append(
            {
                "id": s.id,
                "name": s.name,
                "email": s.email,
                "phone": prefs.get("phone"),
                "is_active": s.is_active,
                "is_enrolled": s.id in enrolled_ids,
            }
        )

    return (
        jsonify(
            {
                "course": {"id": course.id, "name": course.name},
                "students": result,
                "total": len(result),
                "enrolled_count": len(enrolled_ids),
            }
        ),
        200,
    )
