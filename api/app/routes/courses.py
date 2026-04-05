# api/app/routes/courses.py
# CRUD de cursos, disciplinas, módulos e aulas.
# Hierarquia: Course → Subject → Module → Lesson
# SEGURANÇA: Todas as queries filtram por tenant_id — isolamento garantido.

from flask import Blueprint, request, jsonify, g
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from marshmallow import Schema, fields, validate, ValidationError, EXCLUDE
from app.models.question import (
    Question,
    Alternative,
    QuestionSourceType,
    DifficultyLevel,
)

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
    video_s3_key = fields.Str(allow_none=True, load_default=None)
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


# ── Reordenar aulas de um módulo ──────────────────────────────────────────────


@courses_bp.route("/modules/<string:module_id>/lessons/reorder", methods=["PUT"])
@jwt_required()
@require_tenant
def reorder_lessons(module_id: str):
    """
    Reordena as aulas de um módulo.
    Body: { "ordered_ids": ["lesson_id_1", "lesson_id_2", ...] }
    Atribui order=0,1,2,... conforme a posição na lista.
    """
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

    body = request.get_json(force=True) or {}
    ordered_ids: list[str] = body.get("ordered_ids", [])
    if not ordered_ids:
        return jsonify({"error": "ordered_ids is required"}), 400

    # Busca todas as aulas do módulo de uma vez
    lessons_map: dict[str, Lesson] = {
        l.id: l
        for l in Lesson.query.filter_by(
            module_id=module.id,
            tenant_id=tenant.id,
            is_deleted=False,
        ).all()
    }

    # Valida que todos os IDs pertencem a este módulo
    for lesson_id in ordered_ids:
        if lesson_id not in lessons_map:
            return (
                jsonify({"error": f"lesson {lesson_id} not found in this module"}),
                404,
            )

    # Atualiza a ordem atomicamente
    for index, lesson_id in enumerate(ordered_ids):
        lessons_map[lesson_id].order = index

    db.session.commit()

    return jsonify({"message": "Aulas reordenadas.", "count": len(ordered_ids)}), 200


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

    max_order = (
        db.session.query(db.func.max(Lesson.order))
        .filter_by(
            module_id=module.id,
            tenant_id=tenant.id,
            is_deleted=False,
        )
        .scalar()
    )
    next_order = (max_order or 0) + 1

    lesson = Lesson(
        tenant_id=tenant.id,
        module_id=module.id,
        title=data["title"],
        description=data.get("description"),
        video_url=data.get("video_url"),
        duration_minutes=data["duration_minutes"],
        external_url=data.get("external_url"),
        order=next_order,
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

    # ✅ FIX 2: só atualiza video_url se foi explicitamente enviado no request
    # Sem isso, toggleLesson (que não manda video_url) apagava a URL salva
    if "video_url" in raw_json:
        lesson.video_url = data.get("video_url")
        # Mutuamente exclusivo: link externo limpa o vídeo hospedado
        if lesson.video_url:
            lesson.video_s3_key = None
    if "external_url" in raw_json:
        lesson.external_url = data.get("external_url")
    if "video_s3_key" in raw_json:
        lesson.video_s3_key = data.get("video_s3_key")

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
    if lesson.video_s3_key:
        from app.routes.uploads import generate_video_presigned_url

        video_url = generate_video_presigned_url(lesson.video_s3_key)
    else:
        video_url = lesson.video_url

    data = {
        "id": lesson.id,
        "title": lesson.title,
        "duration_minutes": lesson.duration_minutes,
        "is_published": lesson.is_published,
        "is_free_preview": lesson.is_free_preview,
        "order": lesson.order,
        "has_ai_summary": bool(lesson.ai_summary),
        "ai_topics": lesson.ai_topics or [],
        "video_url": video_url,  # ← corrigido: usa a variável, não lesson.video_url
        "video_hosted": bool(lesson.video_s3_key),
        "materials": lesson.materials or [],
        "material_url": (
            (lesson.materials or [{}])[0].get("url") if lesson.materials else None
        ),
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
            }
        )
    return data


# ══════════════════════════════════════════════════════════════════════════════
# QUESTÕES DA AULA — source_type="lesson"
# Completamente separadas do banco geral de concursos.
# ══════════════════════════════════════════════════════════════════════════════


@courses_bp.route("/lessons/<string:lesson_id>/questions", methods=["GET"])
@jwt_required()
@require_tenant
def list_lesson_questions(lesson_id: str):
    """
    Lista questões geradas pelo Gemini para uma aula específica.

    Estas questões são source_type="lesson" e vinculadas à lesson_id.
    São COMPLETAMENTE separadas do banco de questões de concurso:
    - Não aparecem em GET /questions/
    - Não entram em simulados automáticos
    - Não alimentam o cronograma global

    Aluno vê as questões da aula sem o gabarito.
    Produtor vê tudo (inclusive gabarito e status de revisão).
    """
    tenant = get_current_tenant()
    user_id = get_jwt_identity()
    claims = get_jwt()

    # Verifica que a aula pertence ao tenant
    lesson = Lesson.query.filter_by(
        id=lesson_id,
        tenant_id=tenant.id,
        is_deleted=False,
    ).first()
    if not lesson:
        return jsonify({"error": "not_found"}), 404

    is_producer = _is_producer_or_above(claims)

    # Busca APENAS questões desta aula específica
    questions_query = Question.query.filter_by(
        tenant_id=tenant.id,
        lesson_id=lesson_id,
        source_type=QuestionSourceType.LESSON,
        is_active=True,
        is_deleted=False,
    )

    # Aluno só vê questões já revisadas/aprovadas pelo produtor
    if not is_producer:
        questions_query = questions_query.filter_by(is_reviewed=True)

    questions = questions_query.order_by(Question.created_at.asc()).all()

    # Carrega última tentativa do aluno para cada questão
    from app.routes.questions import _get_last_attempts_map, _serialize_question

    attempt_map = _get_last_attempts_map(user_id, tenant.id, [q.id for q in questions])

    return (
        jsonify(
            {
                "lesson_id": lesson_id,
                "lesson_title": lesson.title,
                "total": len(questions),
                "questions": [
                    _serialize_question(
                        q,
                        attempt_map.get(q.id),
                        include_answer=is_producer,  # produtor vê gabarito; aluno vê após responder
                    )
                    for q in questions
                ],
            }
        ),
        200,
    )


@courses_bp.route("/lessons/<string:lesson_id>/questions/generate", methods=["POST"])
@jwt_required()
@require_tenant
@require_feature("ai_features")
def generate_lesson_questions(lesson_id: str):
    """
    Dispara geração de questões para uma aula via Gemini (Celery assíncrono).

    Apenas produtor pode acionar.
    As questões geradas são source_type="lesson" e ficam vinculadas à lesson_id.
    O produtor pode revisar e publicar antes que os alunos vejam (is_reviewed=False por padrão).

    Body (opcional):
    {
        "count": 5,           // Número de questões a gerar (default: 5, max: 10)
        "difficulty": "medium" // Dificuldade desejada (default: "medium")
    }
    """
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

    # Valida que a aula tem conteúdo suficiente para gerar questões
    has_content = (
        lesson.description
        or lesson.ai_summary
        or (lesson.ai_topics and len(lesson.ai_topics) > 0)
        or lesson.title
    )
    if not has_content:
        return (
            jsonify(
                {
                    "error": "insufficient_content",
                    "message": "A aula não tem descrição ou resumo suficiente para gerar questões. "
                    "Adicione uma descrição ou aguarde o resumo automático ser gerado.",
                }
            ),
            422,
        )

    body = request.get_json(force=True) or {}
    count = min(int(body.get("count", 5)), 10)  # máx 10 por vez
    difficulty = body.get("difficulty", "medium")
    if difficulty not in ("easy", "medium", "hard"):
        difficulty = "medium"

    # Conta questões já existentes para esta aula
    existing = Question.query.filter_by(
        tenant_id=tenant.id,
        lesson_id=lesson_id,
        source_type=QuestionSourceType.LESSON,
        is_deleted=False,
    ).count()

    # Dispara Celery task — resposta imediata, geração acontece em background
    try:
        from app.tasks import generate_lesson_questions_task

        task = generate_lesson_questions_task.delay(
            lesson_id=lesson_id,
            tenant_id=tenant.id,
            count=count,
            difficulty=difficulty,
        )
        task_id = task.id
    except Exception as e:
        # Se Celery não estiver disponível, tenta executar sincronamente
        import logging

        logging.getLogger(__name__).warning(
            f"Celery indisponível, executando sync: {e}"
        )
        try:
            from app.tasks import generate_lesson_questions_task

            generate_lesson_questions_task(
                lesson_id=lesson_id,
                tenant_id=tenant.id,
                count=count,
                difficulty=difficulty,
            )
            task_id = None
        except Exception as e2:
            return (
                jsonify(
                    {
                        "error": "generation_failed",
                        "message": "Não foi possível iniciar a geração de questões. Verifique se o serviço de IA está configurado.",
                    }
                ),
                503,
            )

    return (
        jsonify(
            {
                "message": f"Geração de {count} questão(ões) iniciada.",
                "lesson_id": lesson_id,
                "lesson_title": lesson.title,
                "count_requested": count,
                "existing_questions": existing,
                "task_id": task_id,
                "status": "processing",
                "note": "As questões aparecerão em GET /lessons/{lesson_id}/questions quando prontas. "
                "O produtor deve revisar antes de publicar.",
            }
        ),
        202,
    )


@courses_bp.route(
    "/lessons/<string:lesson_id>/questions/<string:question_id>", methods=["DELETE"]
)
@jwt_required()
@require_tenant
def delete_lesson_question(lesson_id: str, question_id: str):
    """
    Remove uma questão específica de uma aula (soft delete).
    Apenas produtor pode remover.
    """
    claims = get_jwt()
    if not _is_producer_or_above(claims):
        return jsonify({"error": "forbidden"}), 403

    tenant = get_current_tenant()

    question = Question.query.filter_by(
        id=question_id,
        lesson_id=lesson_id,
        tenant_id=tenant.id,
        source_type=QuestionSourceType.LESSON,
        is_deleted=False,
    ).first()
    if not question:
        return jsonify({"error": "not_found"}), 404

    question.is_deleted = True
    question.is_active = False
    db.session.commit()

    return jsonify({"message": "Questão da aula removida."}), 200


@courses_bp.route(
    "/lessons/<string:lesson_id>/questions/<string:question_id>/approve",
    methods=["POST"],
)
@jwt_required()
@require_tenant
def approve_lesson_question(lesson_id: str, question_id: str):
    """
    Marca uma questão de aula como revisada/aprovada pelo produtor.
    Questões não revisadas ficam visíveis apenas para o produtor.
    Após aprovação, ficam visíveis para os alunos.
    """
    claims = get_jwt()
    if not _is_producer_or_above(claims):
        return jsonify({"error": "forbidden"}), 403

    tenant = get_current_tenant()

    question = Question.query.filter_by(
        id=question_id,
        lesson_id=lesson_id,
        tenant_id=tenant.id,
        source_type=QuestionSourceType.LESSON,
        is_deleted=False,
    ).first()
    if not question:
        return jsonify({"error": "not_found"}), 404

    question.is_reviewed = True
    db.session.commit()

    from app.routes.questions import _serialize_question

    return (
        jsonify(
            {
                "message": "Questão aprovada e visível para alunos.",
                "question": _serialize_question(question, include_answer=True),
            }
        ),
        200,
    )


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
