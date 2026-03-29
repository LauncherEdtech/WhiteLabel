# api/app/routes/courses.py
# CRUD de cursos, disciplinas, módulos e aulas.
# Hierarquia: Course → Subject → Module → Lesson
# SEGURANÇA: Todas as queries filtram por tenant_id — isolamento garantido.

from flask import Blueprint, request, jsonify, g
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from marshmallow import Schema, fields, validate, ValidationError, EXCLUDE

from app.extensions import db, limiter
from app.models.course import (
    Course,
    Subject,
    Module,
    Lesson,
    LessonProgress,
    CourseEnrollment,
)
from app.models.user import User, UserRole
from app.middleware.tenant import (
    resolve_tenant,
    require_tenant,
    require_feature,
    get_current_tenant,
)

courses_bp = Blueprint("courses", __name__)

# ── Helpers de autorização ────────────────────────────────────────────────────


def _is_producer_or_above(claims: dict) -> bool:
    """Produtor admin, staff ou super_admin podem gerenciar conteúdo."""
    return claims.get("role") in (
        UserRole.SUPER_ADMIN.value,
        UserRole.PRODUCER_ADMIN.value,
        UserRole.PRODUCER_STAFF.value,
    )


def _is_student(claims: dict) -> bool:
    return claims.get("role") == UserRole.STUDENT.value


def _get_tenant_course_or_404(course_id: str, tenant_id: str):
    """
    Busca curso por ID garantindo que pertence ao tenant atual.
    SEGURANÇA: Sem o filtro de tenant_id, um aluno poderia acessar
    cursos de outros produtores apenas adivinhando o UUID.
    """
    course = Course.query.filter_by(
        id=course_id,
        tenant_id=tenant_id,
        is_deleted=False,
    ).first()
    if not course:
        return None
    return course


# ── Schemas ───────────────────────────────────────────────────────────────────


class CourseSchema(Schema):
    name = fields.Str(required=True, validate=validate.Length(min=2, max=255))
    description = fields.Str(allow_none=True, load_default=None)
    thumbnail_url = fields.Url(allow_none=True, load_default=None)
    is_active = fields.Bool(load_default=True)

    class Meta:
        unknown = EXCLUDE


class SubjectSchema(Schema):
    name = fields.Str(required=True, validate=validate.Length(min=2, max=255))
    description = fields.Str(allow_none=True, load_default=None)
    color = fields.Str(
        load_default="#4F46E5", validate=validate.Regexp(r"^#[0-9A-Fa-f]{6}$")
    )
    edital_weight = fields.Float(
        load_default=1.0, validate=validate.Range(min=0.1, max=10.0)
    )
    order = fields.Int(load_default=0)

    class Meta:
        unknown = EXCLUDE


class ModuleSchema(Schema):
    name = fields.Str(required=True, validate=validate.Length(min=2, max=255))
    description = fields.Str(allow_none=True, load_default=None)
    order = fields.Int(load_default=0)

    class Meta:
        unknown = EXCLUDE


class LessonSchema(Schema):
    title = fields.Str(required=True, validate=validate.Length(min=2, max=255))
    description = fields.Str(allow_none=True, load_default=None)
    video_url = fields.Str(allow_none=True, load_default=None)
    duration_minutes = fields.Int(load_default=0, validate=validate.Range(min=0))
    material_url = fields.Str(allow_none=True, load_default=None)
    external_url = fields.Str(allow_none=True, load_default=None)
    order = fields.Int(load_default=0)
    is_published = fields.Bool(load_default=False)
    is_free_preview = fields.Bool(load_default=False)

    class Meta:
        unknown = EXCLUDE


class CheckInSchema(Schema):
    """Aluno informa se assistiu ou não à aula."""

    completed = fields.Bool(required=True)
    note = fields.Str(
        allow_none=True, load_default=None, validate=validate.Length(max=500)
    )
    perceived_difficulty = fields.Str(
        allow_none=True,
        load_default=None,
        validate=validate.OneOf(["easy", "ok", "hard"]),
    )

    class Meta:
        unknown = EXCLUDE


# ── Before request ────────────────────────────────────────────────────────────


@courses_bp.before_request
def before_request():
    resolve_tenant()


# ══════════════════════════════════════════════════════════════════════════════
# COURSES
# ══════════════════════════════════════════════════════════════════════════════
# PATCH para api/app/routes/courses.py
# Substitua apenas list_courses() — alunos voltam a ver só cursos matriculados


@courses_bp.route("/", methods=["GET"])
@jwt_required()
@require_tenant
def list_courses():
    """
    Lista cursos do tenant.
    - Produtor: todos os cursos (ativos e inativos) + contagem de alunos.
    - Aluno: apenas cursos ativos nos quais está matriculado.
    """
    tenant = get_current_tenant()
    claims = get_jwt()
    user_id = get_jwt_identity()

    if _is_producer_or_above(claims):
        courses = (
            Course.query.filter_by(tenant_id=tenant.id, is_deleted=False)
            .order_by(Course.created_at.desc())
            .all()
        )
        result = []
        for c in courses:
            data = _serialize_course(c)
            data["enrolled_count"] = CourseEnrollment.query.filter_by(
                course_id=c.id,
                tenant_id=tenant.id,
                is_active=True,
                is_deleted=False,
            ).count()
            result.append(data)
        return jsonify({"courses": result}), 200

    # Aluno: apenas cursos em que está matriculado e ativos
    enrollments = CourseEnrollment.query.filter_by(
        tenant_id=tenant.id,
        user_id=user_id,
        is_active=True,
        is_deleted=False,
    ).all()

    course_ids = [e.course_id for e in enrollments]
    if not course_ids:
        return jsonify({"courses": []}), 200

    courses = (
        Course.query.filter(
            Course.id.in_(course_ids),
            Course.tenant_id == tenant.id,
            Course.is_active == True,
            Course.is_deleted == False,
        )
        .order_by(Course.name)
        .all()
    )

    return jsonify({"courses": [_serialize_course(c) for c in courses]}), 200


@courses_bp.route("/", methods=["POST"])
@jwt_required()
@require_tenant
@limiter.limit("30 per hour")
def create_course():
    """
    Cria um novo curso e auto-matricula todos os alunos ativos do tenant.
    """
    claims = get_jwt()
    if not _is_producer_or_above(claims):
        return jsonify({"error": "forbidden", "message": "Acesso negado."}), 403

    schema = CourseSchema()
    try:
        data = schema.load(request.get_json(force=True) or {})
    except ValidationError as e:
        return jsonify({"error": "validation_error", "details": e.messages}), 400

    tenant = get_current_tenant()

    course = Course(
        tenant_id=tenant.id,
        name=data["name"],
        description=data.get("description"),
        thumbnail_url=data.get("thumbnail_url"),
        is_active=data["is_active"],
    )
    db.session.add(course)
    db.session.flush()  # gera course.id sem commitar ainda

    # Auto-matricula todos os alunos ativos do tenant no novo curso
    students = User.query.filter_by(
        tenant_id=tenant.id,
        role=UserRole.STUDENT.value,
        is_active=True,
        is_deleted=False,
    ).all()

    for student in students:
        db.session.add(
            CourseEnrollment(
                tenant_id=tenant.id,
                course_id=course.id,
                user_id=student.id,
                is_active=True,
            )
        )

    db.session.commit()

    return (
        jsonify(
            {
                "message": "Curso criado com sucesso.",
                "course": _serialize_course(course),
                "auto_enrolled": len(students),
            }
        ),
        201,
    )


@courses_bp.route("/<string:course_id>", methods=["GET"])
@jwt_required()
@require_tenant
def get_course(course_id: str):
    """
    Retorna detalhes do curso com toda a árvore de conteúdo:
    Disciplinas → Módulos → Aulas.
    """
    tenant = get_current_tenant()
    claims = get_jwt()
    user_id = get_jwt_identity()

    course = _get_tenant_course_or_404(course_id, tenant.id)
    if not course:
        return jsonify({"error": "not_found", "message": "Curso não encontrado."}), 404

    # Aluno só acessa cursos em que está
    if _is_student(claims) and not course.is_active:
        return jsonify({"error": "not_found", "message": "Curso não encontrado."}), 404

    # Busca progresso do aluno para incluir na resposta
    progress_map = {}
    if _is_student(claims):
        progress_records = LessonProgress.query.filter_by(
            user_id=user_id,
            tenant_id=tenant.id,
            is_deleted=False,
        ).all()
        progress_map = {p.lesson_id: p for p in progress_records}

    # Monta árvore completa
    subjects_data = []
    for subject in sorted(course.subjects, key=lambda s: s.order):
        if subject.is_deleted:
            continue

        modules_data = []
        for module in sorted(subject.modules, key=lambda m: m.order):
            if module.is_deleted:
                continue

            lessons_data = []
            for lesson in sorted(module.lessons, key=lambda l: l.order):
                if lesson.is_deleted:
                    continue
                # Aluno vê apenas aulas publicadas (ou preview gratuitas)
                if _is_student(claims) and not lesson.is_published:
                    continue

                progress = progress_map.get(lesson.id)
                lessons_data.append(_serialize_lesson(lesson, progress))

            modules_data.append(
                {
                    "id": module.id,
                    "name": module.name,
                    "description": module.description,
                    "order": module.order,
                    "lessons": lessons_data,
                    "total_lessons": len(lessons_data),
                }
            )

        subjects_data.append(
            {
                "id": subject.id,
                "name": subject.name,
                "color": subject.color,
                "edital_weight": subject.edital_weight,
                "order": subject.order,
                "modules": modules_data,
            }
        )

    return (
        jsonify(
            {
                "course": {
                    **_serialize_course(course),
                    "subjects": subjects_data,
                }
            }
        ),
        200,
    )


@courses_bp.route("/<string:course_id>", methods=["PUT"])
@jwt_required()
@require_tenant
def update_course(course_id: str):
    """Atualiza dados do curso. Apenas produtor."""
    claims = get_jwt()
    if not _is_producer_or_above(claims):
        return jsonify({"error": "forbidden"}), 403

    tenant = get_current_tenant()
    course = _get_tenant_course_or_404(course_id, tenant.id)
    if not course:
        return jsonify({"error": "not_found"}), 404

    schema = CourseSchema()
    try:
        data = schema.load(request.get_json(force=True) or {})
    except ValidationError as e:
        return jsonify({"error": "validation_error", "details": e.messages}), 400

    course.name = data["name"]
    course.description = data.get("description", course.description)
    course.thumbnail_url = data.get("thumbnail_url", course.thumbnail_url)
    course.is_active = data["is_active"]
    db.session.commit()

    return (
        jsonify({"message": "Curso atualizado.", "course": _serialize_course(course)}),
        200,
    )


@courses_bp.route("/<string:course_id>", methods=["DELETE"])
@jwt_required()
@require_tenant
def delete_course(course_id: str):
    """
    Soft delete do curso. Apenas produtor admin.
    SEGURANÇA: Soft delete preserva histórico e auditoria.
    """
    claims = get_jwt()
    if claims.get("role") not in (
        UserRole.SUPER_ADMIN.value,
        UserRole.PRODUCER_ADMIN.value,
    ):
        return jsonify({"error": "forbidden"}), 403

    tenant = get_current_tenant()
    course = _get_tenant_course_or_404(course_id, tenant.id)
    if not course:
        return jsonify({"error": "not_found"}), 404

    course.soft_delete()
    db.session.commit()

    return jsonify({"message": "Curso removido."}), 200


# ══════════════════════════════════════════════════════════════════════════════
# ENROLLMENTS (matrículas)
# ══════════════════════════════════════════════════════════════════════════════


@courses_bp.route("/<string:course_id>/enroll", methods=["POST"])
@jwt_required()
@require_tenant
def enroll_student(course_id: str):
    """
    Matricula um aluno num curso.
    - Produtor matricula qualquer aluno (passando user_id no body).
    - Aluno só pode se auto-matricular (sem body necessário).
    """
    tenant = get_current_tenant()
    claims = get_jwt()
    current_user_id = get_jwt_identity()

    course = _get_tenant_course_or_404(course_id, tenant.id)
    if not course or not course.is_active:
        return (
            jsonify(
                {"error": "not_found", "message": "Curso não encontrado ou inativo."}
            ),
            404,
        )

    # Define qual usuário será matriculado
    if _is_producer_or_above(claims):
        body = request.get_json(force=True) or {}
        target_user_id = body.get("user_id", current_user_id)
    else:
        target_user_id = current_user_id

    # SEGURANÇA: Garante que o aluno alvo pertence ao mesmo tenant
    target_user = User.query.filter_by(
        id=target_user_id,
        tenant_id=tenant.id,
        is_deleted=False,
    ).first()
    if not target_user:
        return jsonify({"error": "user_not_found"}), 404

    # Verifica se já existe matrícula
    existing = CourseEnrollment.query.filter_by(
        course_id=course.id,
        user_id=target_user_id,
        tenant_id=tenant.id,
    ).first()

    if existing:
        if existing.is_active:
            return jsonify({"message": "Aluno já está matriculado."}), 200
        # Reativa matrícula cancelada
        existing.is_active = True
        existing.is_deleted = False
        db.session.commit()
        return jsonify({"message": "Matrícula reativada."}), 200

    enrollment = CourseEnrollment(
        tenant_id=tenant.id,
        course_id=course.id,
        user_id=target_user_id,
        is_active=True,
    )
    db.session.add(enrollment)
    db.session.commit()

    return jsonify({"message": "Matrícula realizada com sucesso."}), 201


# ══════════════════════════════════════════════════════════════════════════════
# SUBJECTS (disciplinas)
# ══════════════════════════════════════════════════════════════════════════════


@courses_bp.route("/<string:course_id>/subjects", methods=["POST"])
@jwt_required()
@require_tenant
def create_subject(course_id: str):
    """Cria disciplina dentro de um curso."""
    claims = get_jwt()
    if not _is_producer_or_above(claims):
        return jsonify({"error": "forbidden"}), 403

    tenant = get_current_tenant()
    course = _get_tenant_course_or_404(course_id, tenant.id)
    if not course:
        return jsonify({"error": "not_found"}), 404

    schema = SubjectSchema()
    try:
        data = schema.load(request.get_json(force=True) or {})
    except ValidationError as e:
        return jsonify({"error": "validation_error", "details": e.messages}), 400

    subject = Subject(
        tenant_id=tenant.id,
        course_id=course.id,
        name=data["name"],
        description=data.get("description"),
        color=data["color"],
        edital_weight=data["edital_weight"],
        order=data["order"],
    )
    db.session.add(subject)
    db.session.commit()

    return (
        jsonify(
            {
                "message": "Disciplina criada.",
                "subject": _serialize_subject(subject),
            }
        ),
        201,
    )


@courses_bp.route("/<string:course_id>/subjects/<string:subject_id>", methods=["PUT"])
@jwt_required()
@require_tenant
def update_subject(course_id: str, subject_id: str):
    """Atualiza disciplina."""
    claims = get_jwt()
    if not _is_producer_or_above(claims):
        return jsonify({"error": "forbidden"}), 403

    tenant = get_current_tenant()
    subject = Subject.query.filter_by(
        id=subject_id,
        course_id=course_id,
        tenant_id=tenant.id,
        is_deleted=False,
    ).first()
    if not subject:
        return jsonify({"error": "not_found"}), 404

    schema = SubjectSchema()
    try:
        data = schema.load(request.get_json(force=True) or {})
    except ValidationError as e:
        return jsonify({"error": "validation_error", "details": e.messages}), 400

    subject.name = data["name"]
    subject.description = data.get("description", subject.description)
    subject.color = data["color"]
    subject.edital_weight = data["edital_weight"]
    subject.order = data["order"]
    db.session.commit()

    return (
        jsonify(
            {
                "message": "Disciplina atualizada.",
                "subject": _serialize_subject(subject),
            }
        ),
        200,
    )


@courses_bp.route(
    "/<string:course_id>/subjects/<string:subject_id>", methods=["DELETE"]
)
@jwt_required()
@require_tenant
def delete_subject(course_id: str, subject_id: str):
    """Soft delete de disciplina e todos seus módulos/aulas."""
    claims = get_jwt()
    if claims.get("role") not in (
        UserRole.SUPER_ADMIN.value,
        UserRole.PRODUCER_ADMIN.value,
    ):
        return jsonify({"error": "forbidden"}), 403

    tenant = get_current_tenant()
    subject = Subject.query.filter_by(
        id=subject_id,
        course_id=course_id,
        tenant_id=tenant.id,
        is_deleted=False,
    ).first()
    if not subject:
        return jsonify({"error": "not_found"}), 404

    # Soft delete em cascata: módulos → aulas
    lessons_deleted = 0
    modules_deleted = 0
    for module in subject.modules:
        if not module.is_deleted:
            for lesson in module.lessons:
                if not lesson.is_deleted:
                    lesson.soft_delete()
                    lessons_deleted += 1
            module.soft_delete()
            modules_deleted += 1

    subject.soft_delete()
    db.session.commit()

    return (
        jsonify(
            {
                "message": f"Disciplina removida ({modules_deleted} módulo(s), {lessons_deleted} aula(s) removidos).",
                "modules_deleted": modules_deleted,
                "lessons_deleted": lessons_deleted,
            }
        ),
        200,
    )


# ══════════════════════════════════════════════════════════════════════════════
# MODULES
# ══════════════════════════════════════════════════════════════════════════════


@courses_bp.route("/subjects/<string:subject_id>/modules", methods=["POST"])
@jwt_required()
@require_tenant
def create_module(subject_id: str):
    """Cria módulo dentro de uma disciplina."""
    claims = get_jwt()
    if not _is_producer_or_above(claims):
        return jsonify({"error": "forbidden"}), 403

    tenant = get_current_tenant()
    subject = Subject.query.filter_by(
        id=subject_id,
        tenant_id=tenant.id,
        is_deleted=False,
    ).first()
    if not subject:
        return jsonify({"error": "not_found"}), 404

    schema = ModuleSchema()
    try:
        data = schema.load(request.get_json(force=True) or {})
    except ValidationError as e:
        return jsonify({"error": "validation_error", "details": e.messages}), 400

    module = Module(
        tenant_id=tenant.id,
        subject_id=subject.id,
        name=data["name"],
        description=data.get("description"),
        order=data["order"],
    )
    db.session.add(module)
    db.session.commit()

    return (
        jsonify(
            {
                "message": "Módulo criado.",
                "module": {"id": module.id, "name": module.name, "order": module.order},
            }
        ),
        201,
    )


# ══════════════════════════════════════════════════════════════════════════════
# LESSONS (aulas)
# ══════════════════════════════════════════════════════════════════════════════


@courses_bp.route("/modules/<string:module_id>/lessons", methods=["POST"])
@jwt_required()
@require_tenant
def create_lesson(module_id: str):
    """Cria aula dentro de um módulo."""
    claims = get_jwt()
    if not _is_producer_or_above(claims):
        return jsonify({"error": "forbidden"}), 403

    tenant = get_current_tenant()
    module = Module.query.filter_by(
        id=module_id,
        tenant_id=tenant.id,
        is_deleted=False,
    ).first()
    if not module:
        return jsonify({"error": "not_found"}), 404

    schema = LessonSchema()
    try:
        data = schema.load(request.get_json(force=True) or {})
    except ValidationError as e:
        return jsonify({"error": "validation_error", "details": e.messages}), 400

    lesson = Lesson(
        tenant_id=tenant.id,
        module_id=module.id,
        title=data["title"],
        description=data.get("description"),
        video_url=data.get("video_url"),
        duration_minutes=data["duration_minutes"],
        material_url=data.get("material_url"),
        external_url=data.get("external_url"),
        order=data["order"],
        is_published=data.get("is_published", True),  # Publicada por padrão
        is_free_preview=data.get("is_free_preview", False),
    )
    db.session.add(lesson)
    db.session.commit()

    return (
        jsonify(
            {
                "message": "Aula criada.",
                "lesson": _serialize_lesson(lesson),
            }
        ),
        201,
    )


@courses_bp.route("/modules/<string:module_id>", methods=["PUT"])
@jwt_required()
@require_tenant
def update_module(module_id: str):
    """Atualiza módulo. Apenas produtor."""
    claims = get_jwt()
    if not _is_producer_or_above(claims):
        return jsonify({"error": "forbidden"}), 403

    tenant = get_current_tenant()
    module = Module.query.filter_by(
        id=module_id,
        tenant_id=tenant.id,
        is_deleted=False,
    ).first()
    if not module:
        return jsonify({"error": "not_found"}), 404

    schema = ModuleSchema()
    try:
        data = schema.load(request.get_json(force=True) or {})
    except ValidationError as e:
        return jsonify({"error": "validation_error", "details": e.messages}), 400

    module.name = data["name"]
    if "description" in data:
        module.description = data.get("description")
    if "order" in data:
        module.order = data["order"]

    db.session.commit()

    return (
        jsonify(
            {
                "message": "Módulo atualizado.",
                "module": {"id": module.id, "name": module.name, "order": module.order},
            }
        ),
        200,
    )


@courses_bp.route("/modules/<string:module_id>", methods=["DELETE"])
@jwt_required()
@require_tenant
def delete_module(module_id: str):
    """
    Soft delete de módulo e todas as suas aulas.
    Apenas produtor admin.
    """
    claims = get_jwt()
    if claims.get("role") not in (
        UserRole.SUPER_ADMIN.value,
        UserRole.PRODUCER_ADMIN.value,
    ):
        return jsonify({"error": "forbidden"}), 403

    tenant = get_current_tenant()
    module = Module.query.filter_by(
        id=module_id,
        tenant_id=tenant.id,
        is_deleted=False,
    ).first()
    if not module:
        return jsonify({"error": "not_found"}), 404

    # Soft delete de todas as aulas do módulo primeiro
    lessons_deleted = 0
    for lesson in module.lessons:
        if not lesson.is_deleted:
            lesson.soft_delete()
            lessons_deleted += 1

    module.soft_delete()
    db.session.commit()

    return (
        jsonify(
            {
                "message": f"Módulo removido ({lessons_deleted} aula(s) também removida(s)).",
                "lessons_deleted": lessons_deleted,
            }
        ),
        200,
    )


@courses_bp.route("/lessons/<string:lesson_id>", methods=["GET"])
@jwt_required()
@require_tenant
def get_lesson(lesson_id: str):
    """
    Retorna detalhes de uma aula.
    Aluno: precisa estar matriculado no curso pai.
    """
    tenant = get_current_tenant()
    claims = get_jwt()
    user_id = get_jwt_identity()

    lesson = Lesson.query.filter_by(
        id=lesson_id,
        tenant_id=tenant.id,
        is_deleted=False,
    ).first()
    if not lesson:
        return jsonify({"error": "not_found"}), 404

    # SEGURANÇA: Aluno só acessa aulas publicadas do curso em que está matriculado
    if _is_student(claims):
        if not lesson.is_published and not lesson.is_free_preview:
            return jsonify({"error": "not_found"}), 404

        # Verifica matrícula no curso via module → subject → course
        module = Module.query.get(lesson.module_id)
        subject = Subject.query.get(module.subject_id)
        enrollment = CourseEnrollment.query.filter_by(
            course_id=subject.course_id,
            user_id=user_id,
            tenant_id=tenant.id,
            is_active=True,
        ).first()
        if not enrollment:
            return jsonify({"error": "not_enrolled"}), 403

    progress = (
        LessonProgress.query.filter_by(
            lesson_id=lesson.id,
            user_id=user_id,
            tenant_id=tenant.id,
        ).first()
        if _is_student(claims)
        else None
    )

    return jsonify({"lesson": _serialize_lesson(lesson, progress, full=True)}), 200


@courses_bp.route("/lessons/<string:lesson_id>/checkin", methods=["POST"])
@jwt_required()
@require_tenant
def checkin_lesson(lesson_id: str):
    """
    Aluno faz check-in na aula: informa se assistiu ou não.
    Fonte de dados primária para o cronograma inteligente.
    """
    tenant = get_current_tenant()
    user_id = get_jwt_identity()

    lesson = Lesson.query.filter_by(
        id=lesson_id,
        tenant_id=tenant.id,
        is_deleted=False,
    ).first()
    if not lesson:
        return jsonify({"error": "not_found"}), 404

    schema = CheckInSchema()
    try:
        data = schema.load(request.get_json(force=True) or {})
    except ValidationError as e:
        return jsonify({"error": "validation_error", "details": e.messages}), 400

    # Busca ou cria registro de progresso
    progress = LessonProgress.query.filter_by(
        lesson_id=lesson.id,
        user_id=user_id,
        tenant_id=tenant.id,
    ).first()

    if not progress:
        progress = LessonProgress(
            tenant_id=tenant.id,
            lesson_id=lesson.id,
            user_id=user_id,
        )
        db.session.add(progress)

    from datetime import datetime, timezone

    now_iso = datetime.now(timezone.utc).isoformat()

    progress.status = "watched" if data["completed"] else "not_watched"
    progress.watch_percentage = 1.0 if data["completed"] else progress.watch_percentage
    progress.last_watched_at = now_iso

    db.session.commit()

    # TODO: Disparar task Celery para recalcular cronograma
    # from app.tasks.schedule_tasks import recalculate_schedule
    # recalculate_schedule.delay(user_id, tenant.id)

    return (
        jsonify(
            {
                "message": "Check-in registrado.",
                "status": progress.status,
                "completed": data["completed"],
            }
        ),
        200,
    )


@courses_bp.route("/lessons/<string:lesson_id>", methods=["PUT"])
@jwt_required()
@require_tenant
def update_lesson(lesson_id: str):
    """Atualiza aula. Apenas produtor."""
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

    # ✅ FIX 2: guarda o JSON bruto ANTES de passar pelo marshmallow
    # Marshmallow aplica load_default=None em campos ausentes, tornando impossível
    # distinguir "não enviado" de "enviado como null". O raw_json resolve isso.
    raw_json = request.get_json(force=True) or {}

    schema = LessonSchema()
    try:
        data = schema.load(raw_json)
    except ValidationError as e:
        return jsonify({"error": "validation_error", "details": e.messages}), 400

    lesson.title = data["title"]
    lesson.description = data.get("description", lesson.description)
    lesson.duration_minutes = data.get("duration_minutes", lesson.duration_minutes)
    lesson.order = data.get("order", lesson.order)
    lesson.is_published = data["is_published"]
    lesson.is_free_preview = data.get("is_free_preview", lesson.is_free_preview)

    if "material_url" in raw_json:
        lesson.material_url = data.get("material_url")
    # ✅ FIX 2: só atualiza video_url se foi explicitamente enviado no request
    # Sem isso, toggleLesson (que não manda video_url) apagava a URL salva
    if "video_url" in raw_json:
        lesson.video_url = data.get("video_url")
    if "external_url" in raw_json:
        lesson.external_url = data.get("external_url")

    db.session.commit()

    return (
        jsonify({"message": "Aula atualizada.", "lesson": _serialize_lesson(lesson)}),
        200,
    )


# ── Serializers ───────────────────────────────────────────────────────────────


def _serialize_course(course: Course) -> dict:
    return {
        "id": course.id,
        "name": course.name,
        "description": course.description,
        "thumbnail_url": course.thumbnail_url,
        "is_active": course.is_active,
        "created_at": course.created_at.isoformat() if course.created_at else None,
    }


def _serialize_subject(subject: Subject) -> dict:
    return {
        "id": subject.id,
        "name": subject.name,
        "description": subject.description,
        "color": subject.color,
        "edital_weight": subject.edital_weight,
        "order": subject.order,
    }


def _serialize_lesson(lesson: Lesson, progress=None, full: bool = False) -> dict:
    data = {
        "id": lesson.id,
        "title": lesson.title,
        "duration_minutes": lesson.duration_minutes,
        "is_published": lesson.is_published,
        "is_free_preview": lesson.is_free_preview,
        "order": lesson.order,
        "has_ai_summary": bool(lesson.ai_summary),
        "ai_topics": lesson.ai_topics or [],
        "video_url": lesson.video_url,
        "material_url": lesson.material_url,
        "external_url": lesson.external_url,
        "progress": (
            {
                "status": progress.status if progress else "not_started",
                "watch_percentage": progress.watch_percentage if progress else 0.0,
                "last_watched_at": progress.last_watched_at if progress else None,
            }
            if progress is not None
            else {"status": "not_started", "watch_percentage": 0.0}
        ),
    }
    if full:
        data.update(
            {
                "description": lesson.description,
                "ai_summary": lesson.ai_summary,
                # material_url já está acima — não duplicar
            }
        )
    return data


@courses_bp.route("/lessons/<string:lesson_id>", methods=["DELETE"])
@jwt_required()
@require_tenant
def delete_lesson(lesson_id: str):
    """
    Soft delete de aula. Apenas produtor admin.
    """
    claims = get_jwt()
    if claims.get("role") not in (
        UserRole.SUPER_ADMIN.value,
        UserRole.PRODUCER_ADMIN.value,
    ):
        return jsonify({"error": "forbidden"}), 403

    tenant = get_current_tenant()
    lesson = Lesson.query.filter_by(
        id=lesson_id,
        tenant_id=tenant.id,
        is_deleted=False,
    ).first()
    if not lesson:
        return jsonify({"error": "not_found"}), 404

    lesson.soft_delete()
    db.session.commit()

    return jsonify({"message": "Aula removida."}), 200
