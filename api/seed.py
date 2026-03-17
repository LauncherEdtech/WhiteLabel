# api/seed.py
# Script de seed: popula o banco com dados iniciais para desenvolvimento.
# SEGURANÇA: NUNCA rode em produção com estas credenciais.
# Uso: docker compose run --rm api python seed.py

import sys
import os

# Garante que o app é encontrado
sys.path.insert(0, "/workspace")

from app import create_app
from app.extensions import db
from app.models.tenant import Tenant
from app.models.user import User, UserRole
from app.models.course import Course, Subject, Module, Lesson, CourseEnrollment
from app.models.question import Question, Alternative, DifficultyLevel

app = create_app("development")


def seed_all():
    with app.app_context():
        print("\n🌱 Iniciando seed...\n")

        # ── 1. Super Admin ────────────────────────────────────────────────────
        # SEGURANÇA: Troque estas credenciais antes de qualquer deploy
        super_admin = _seed_super_admin()

        # ── 2. Tenant de teste (infoprodutor) ─────────────────────────────────
        tenant, producer = _seed_tenant()

        # ── 3. Aluno de teste ─────────────────────────────────────────────────
        student = _seed_student(tenant)

        # ── 4. Curso com estrutura completa ───────────────────────────────────
        course = _seed_course(tenant)

        # ── 5. Matrícula do aluno no curso ────────────────────────────────────
        _seed_enrollment(tenant, course, student)

        # ── 6. Questões de exemplo ────────────────────────────────────────────
        _seed_questions(tenant, course)

        db.session.commit()
        print("\n✅ Seed concluído com sucesso!\n")
        _print_summary(super_admin, tenant, producer, student, course)


# ─────────────────────────────────────────────────────────────────────────────


def _seed_super_admin() -> User:
    """
    Cria o super_admin da plataforma (você).
    Não pertence a nenhum tenant — acesso global.
    SEGURANÇA: tenant_id do super_admin aponta para um tenant especial "platform".
    """
    print("  → Criando tenant de plataforma (super_admin)...")

    # Tenant interno da plataforma (não é um infoprodutor)
    platform_tenant = Tenant.query.filter_by(slug="platform").first()
    if not platform_tenant:
        platform_tenant = Tenant(
            name="Plataforma Admin",
            slug="platform",
            plan="enterprise",
            is_active=True,
        )
        db.session.add(platform_tenant)
        db.session.flush()

    print("  → Criando super_admin...")
    admin = User.query.filter_by(
        email="admin@platform.com",
        tenant_id=platform_tenant.id,
    ).first()

    if not admin:
        admin = User(
            tenant_id=platform_tenant.id,
            name="Super Admin",
            email="admin@platform.com",
            role=UserRole.SUPER_ADMIN,
            email_verified=True,
            is_active=True,
        )
        admin.set_password("Admin@123456")  # Troque em produção
        db.session.add(admin)
        db.session.flush()
        print("  ✓ super_admin criado")
    else:
        print("  ✓ super_admin já existe")

    return admin


def _seed_tenant() -> tuple:
    """Cria um tenant de teste (simula um infoprodutor real)."""
    print("  → Criando tenant de teste...")

    tenant = Tenant.query.filter_by(slug="concurso-demo").first()
    if not tenant:
        tenant = Tenant(
            name="Concurso Demo",
            slug="concurso-demo",
            plan="pro",
            is_active=True,
            branding={
                "primary_color": "#7C3AED",
                "secondary_color": "#10B981",
                "logo_url": None,
                "favicon_url": None,
                "platform_name": "Aprova Demo",
                "support_email": "suporte@concursodemo.com",
            },
            features={
                "ai_schedule": True,
                "ai_question_extract": True,
                "simulados": True,
                "analytics_producer": True,
                "ai_tutor_chat": True,
            },
        )
        db.session.add(tenant)
        db.session.flush()
        print("  ✓ tenant criado: concurso-demo")
    else:
        print("  ✓ tenant já existe: concurso-demo")

    # Admin do tenant (o infoprodutor)
    producer = User.query.filter_by(
        email="produtor@concursodemo.com",
        tenant_id=tenant.id,
    ).first()

    if not producer:
        producer = User(
            tenant_id=tenant.id,
            name="João Produtor",
            email="produtor@concursodemo.com",
            role=UserRole.PRODUCER_ADMIN,
            email_verified=True,
            is_active=True,
        )
        producer.set_password("Produtor@123456")
        db.session.add(producer)
        db.session.flush()
        print("  ✓ producer_admin criado")
    else:
        print("  ✓ producer_admin já existe")

    return tenant, producer


def _seed_student(tenant: Tenant) -> User:
    """Cria um aluno de teste no tenant."""
    print("  → Criando aluno de teste...")

    student = User.query.filter_by(
        email="aluno@teste.com",
        tenant_id=tenant.id,
    ).first()

    if not student:
        student = User(
            tenant_id=tenant.id,
            name="Maria Aluna",
            email="aluno@teste.com",
            role=UserRole.STUDENT,
            email_verified=True,
            is_active=True,
            study_availability={
                "days": [0, 1, 2, 3, 4],  # Segunda a sexta
                "hours_per_day": 3,
                "preferred_start_time": "19:00",
            },
        )
        student.set_password("Aluno@123456")
        db.session.add(student)
        db.session.flush()
        print("  ✓ aluno criado")
    else:
        print("  ✓ aluno já existe")

    return student


def _seed_course(tenant: Tenant) -> Course:
    """
    Cria um curso completo:
    Curso → Disciplina → Módulo → Aula
    Simula um curso de Delegado de Polícia.
    """
    print("  → Criando estrutura do curso...")

    course = Course.query.filter_by(
        tenant_id=tenant.id,
        name="Delegado de Polícia Civil 2025",
    ).first()

    if course:
        print("  ✓ curso já existe")
        return course

    # ── Curso ──────────────────────────────────────────────────────────────
    course = Course(
        tenant_id=tenant.id,
        name="Delegado de Polícia Civil 2025",
        description="Preparatório completo para concursos de Delegado. "
        "Foco em CESPE/Cebraspe.",
        is_active=True,
    )
    db.session.add(course)
    db.session.flush()

    # ── Disciplinas ────────────────────────────────────────────────────────
    disciplines_data = [
        {
            "name": "Direito Penal",
            "color": "#EF4444",
            "edital_weight": 2.0,
            "modules": [
                {
                    "name": "Teoria Geral do Crime",
                    "lessons": [
                        {
                            "title": "Conceito e Classificação do Crime",
                            "duration_minutes": 45,
                        },
                        {
                            "title": "Tipicidade — Teoria Finalista",
                            "duration_minutes": 60,
                        },
                        {
                            "title": "Ilicitude e suas Excludentes",
                            "duration_minutes": 50,
                        },
                    ],
                },
                {
                    "name": "Crimes contra a Pessoa",
                    "lessons": [
                        {"title": "Homicídio Doloso e Culposo", "duration_minutes": 55},
                        {
                            "title": "Lesão Corporal — Art. 129 CP",
                            "duration_minutes": 40,
                        },
                    ],
                },
            ],
        },
        {
            "name": "Direito Processual Penal",
            "color": "#F59E0B",
            "edital_weight": 1.8,
            "modules": [
                {
                    "name": "Inquérito Policial",
                    "lessons": [
                        {
                            "title": "Natureza Jurídica e Características",
                            "duration_minutes": 35,
                        },
                        {"title": "Instauração e Encerramento", "duration_minutes": 45},
                    ],
                },
            ],
        },
        {
            "name": "Direito Constitucional",
            "color": "#3B82F6",
            "edital_weight": 1.5,
            "modules": [
                {
                    "name": "Direitos Fundamentais",
                    "lessons": [
                        {
                            "title": "Direitos e Garantias Individuais",
                            "duration_minutes": 60,
                        },
                        {"title": "Remédios Constitucionais", "duration_minutes": 50},
                    ],
                },
            ],
        },
    ]

    subjects_map = {}  # slug → Subject (para vincular questões depois)

    for order_s, disc in enumerate(disciplines_data):
        subject = Subject(
            tenant_id=tenant.id,
            course_id=course.id,
            name=disc["name"],
            color=disc["color"],
            edital_weight=disc["edital_weight"],
            order=order_s,
        )
        db.session.add(subject)
        db.session.flush()
        subjects_map[disc["name"]] = subject

        for order_m, mod_data in enumerate(disc["modules"]):
            module = Module(
                tenant_id=tenant.id,
                subject_id=subject.id,
                name=mod_data["name"],
                order=order_m,
            )
            db.session.add(module)
            db.session.flush()

            for order_l, lesson_data in enumerate(mod_data["lessons"]):
                lesson = Lesson(
                    tenant_id=tenant.id,
                    module_id=module.id,
                    title=lesson_data["title"],
                    duration_minutes=lesson_data["duration_minutes"],
                    is_published=True,
                    order=order_l,
                )
                db.session.add(lesson)

    db.session.flush()
    print(f"  ✓ curso criado com {len(disciplines_data)} disciplinas")
    return course


def _seed_enrollment(tenant: Tenant, course: Course, student: User):
    """Matricula o aluno de teste no curso."""
    from app.models.course import CourseEnrollment

    existing = CourseEnrollment.query.filter_by(
        course_id=course.id,
        user_id=student.id,
    ).first()

    if not existing:
        enrollment = CourseEnrollment(
            tenant_id=tenant.id,
            course_id=course.id,
            user_id=student.id,
            is_active=True,
        )
        db.session.add(enrollment)
        print("  ✓ aluno matriculado no curso")
    else:
        print("  ✓ matrícula já existe")


def _seed_questions(tenant: Tenant, course: Course):
    """
    Cria questões de exemplo com metadados completos.
    Simula o output do pipeline Gemini.
    """
    print("  → Criando questões de exemplo...")

    # Busca a disciplina Direito Penal para vincular
    subject = Subject.query.filter_by(
        tenant_id=tenant.id,
        name="Direito Penal",
    ).first()

    if not subject:
        print("  ⚠ disciplina não encontrada, pulando questões")
        return

    # Verifica se já existem questões
    existing_count = Question.query.filter_by(tenant_id=tenant.id).count()
    if existing_count > 0:
        print(f"  ✓ {existing_count} questões já existem")
        return

    questions_data = [
        {
            "statement": (
                "Segundo a teoria finalista da ação, adotada pelo Código Penal brasileiro, "
                "o dolo e a culpa integram:"
            ),
            "difficulty": DifficultyLevel.MEDIUM,
            "exam_board": "CESPE",
            "exam_year": 2023,
            "exam_name": "Delegado PC-DF 2023",
            "discipline": "Direito Penal",
            "topic": "Teoria Geral do Crime",
            "subtopic": "Tipicidade",
            "competency": "Compreender os elementos da conduta na teoria finalista",
            "correct_key": "b",
            "correct_justification": (
                "Pela teoria finalista de Hans Welzel, o dolo e a culpa são elementos "
                "subjetivos do tipo penal (fato típico), e não da culpabilidade como "
                "preconizava a teoria causalista. O CP brasileiro adotou o finalismo "
                "ao reformar sua Parte Geral em 1984."
            ),
            "alternatives": [
                {
                    "key": "a",
                    "text": "À culpabilidade, como elementos normativos da conduta.",
                    "justification": (
                        "Incorreta. Esta era a posição da teoria causalista (clássica), "
                        "que situava dolo e culpa na culpabilidade. O finalismo, adotado "
                        "pelo CP/84, deslocou-os para o fato típico."
                    ),
                },
                {
                    "key": "b",
                    "text": "Ao fato típico, como elementos subjetivos da conduta.",
                    "justification": None,  # É a correta
                },
                {
                    "key": "c",
                    "text": "À antijuridicidade, como elementos descritivos do injusto.",
                    "justification": (
                        "Incorreta. A antijuridicidade (ilicitude) trata das causas "
                        "de exclusão do crime (legítima defesa, estado de necessidade etc.), "
                        "não sendo sede do dolo ou culpa."
                    ),
                },
                {
                    "key": "d",
                    "text": "À punibilidade, como condição objetiva de aplicação da pena.",
                    "justification": (
                        "Incorreta. A punibilidade é consequência jurídica do crime, "
                        "não elemento estrutural do delito onde se situam dolo e culpa."
                    ),
                },
                {
                    "key": "e",
                    "text": "À tipicidade formal, como elementos objetivos do tipo.",
                    "justification": (
                        "Incorreta. Dolo e culpa são elementos SUBJETIVOS (internos, "
                        "psíquicos) do tipo, não objetivos. Elementos objetivos são "
                        "aqueles externos, perceptíveis sensorialmente."
                    ),
                },
            ],
        },
        {
            "statement": (
                "Sobre o estado de necessidade como causa excludente da ilicitude, "
                "assinale a alternativa INCORRETA:"
            ),
            "difficulty": DifficultyLevel.HARD,
            "exam_board": "FCC",
            "exam_year": 2022,
            "exam_name": "Delegado PC-SP 2022",
            "discipline": "Direito Penal",
            "topic": "Teoria Geral do Crime",
            "subtopic": "Ilicitude",
            "competency": "Identificar os requisitos do estado de necessidade",
            "correct_key": "c",
            "correct_justification": (
                "O estado de necessidade exige que o agente não tenha o dever legal "
                "de enfrentar o perigo (art. 24, §1º, CP). Bombeiros, policiais e "
                "salva-vidas, por exemplo, têm esse dever e não podem invocar o "
                "estado de necessidade para se omitir."
            ),
            "alternatives": [
                {
                    "key": "a",
                    "text": "O perigo deve ser atual ou iminente.",
                    "justification": (
                        "Correta — e portanto não é a resposta pedida. "
                        "O art. 24 do CP exige perigo atual. Perigo passado ou futuro "
                        "remoto não autoriza o estado de necessidade."
                    ),
                },
                {
                    "key": "b",
                    "text": "O bem sacrificado deve ser de valor igual ou inferior ao bem preservado.",
                    "justification": (
                        "Correta — não é a resposta pedida. A proporcionalidade "
                        "(razoabilidade entre bens) é requisito implícito do estado "
                        "de necessidade justificante."
                    ),
                },
                {
                    "key": "c",
                    "text": "O agente com dever legal de enfrentar o perigo pode invocar o estado de necessidade normalmente.",
                    "justification": None,  # É a correta (a incorreta pedida)
                },
                {
                    "key": "d",
                    "text": "A situação de perigo não pode ter sido criada voluntariamente pelo agente.",
                    "justification": (
                        "Correta — não é a resposta pedida. Quem cria dolosamente "
                        "a situação de perigo não pode se beneficiar do estado de "
                        "necessidade (actio libera in causa)."
                    ),
                },
                {
                    "key": "e",
                    "text": "É admissível o estado de necessidade para proteger direito alheio.",
                    "justification": (
                        "Correta — não é a resposta pedida. O art. 24 CP permite "
                        "o estado de necessidade próprio ou de terceiro ('a si próprio "
                        "ou a outrem')."
                    ),
                },
            ],
        },
        {
            "statement": (
                "Assinale a alternativa que apresenta corretamente "
                "uma característica do inquérito policial:"
            ),
            "difficulty": DifficultyLevel.EASY,
            "exam_board": "VUNESP",
            "exam_year": 2023,
            "exam_name": "Delegado PC-SP 2023",
            "discipline": "Direito Processual Penal",
            "topic": "Inquérito Policial",
            "subtopic": "Características",
            "competency": "Conhecer as características do inquérito policial",
            "correct_key": "a",
            "correct_justification": (
                "O inquérito policial é inquisitorial (não há contraditório pleno), "
                "escrito, sigiloso e dispensável (o MP pode oferecer denúncia sem ele "
                "se houver elementos suficientes de autoria e materialidade)."
            ),
            "alternatives": [
                {
                    "key": "a",
                    "text": "É dispensável para o oferecimento da ação penal pública.",
                    "justification": None,  # correta
                },
                {
                    "key": "b",
                    "text": "É obrigatório e vincula o Ministério Público ao seu conteúdo.",
                    "justification": (
                        "Incorreta em dois pontos: o IP é dispensável e não vincula "
                        "o MP, que forma sua convicção de forma independente ao "
                        "decidir pelo arquivamento ou denúncia."
                    ),
                },
                {
                    "key": "c",
                    "text": "Admite pleno contraditório entre indiciado e autoridade policial.",
                    "justification": (
                        "Incorreta. O IP é inquisitorial, sem contraditório pleno. "
                        "O contraditório e ampla defesa incidem no processo penal, "
                        "não na fase investigatória."
                    ),
                },
                {
                    "key": "d",
                    "text": "Tem natureza jurisdicional, podendo o delegado decretar prisão preventiva.",
                    "justification": (
                        "Incorreta. O IP tem natureza administrativa. "
                        "Somente o juiz pode decretar prisão preventiva "
                        "(art. 311 CPP). O delegado pode apenas representar pela prisão."
                    ),
                },
                {
                    "key": "e",
                    "text": "Uma vez instaurado, não pode ser arquivado pela autoridade policial.",
                    "justification": (
                        "Parcialmente correta, mas incompleta e enganosa. "
                        "O delegado não arquiva — quem determina o arquivamento é o "
                        "juiz, a requerimento do MP (art. 17 CPP). Contudo a afirmação "
                        "como apresentada induz a erro ao não explicar quem pode arquivar."
                    ),
                },
            ],
        },
    ]

    for q_data in questions_data:
        # Busca subject da disciplina correta
        q_subject = (
            Subject.query.filter_by(
                tenant_id=tenant.id,
                name=q_data["discipline"],
            ).first()
            or subject
        )

        question = Question(
            tenant_id=tenant.id,
            subject_id=q_subject.id,
            statement=q_data["statement"],
            difficulty=q_data["difficulty"],
            exam_board=q_data["exam_board"],
            exam_year=q_data["exam_year"],
            exam_name=q_data["exam_name"],
            discipline=q_data["discipline"],
            topic=q_data["topic"],
            subtopic=q_data["subtopic"],
            competency=q_data["competency"],
            correct_alternative_key=q_data["correct_key"],
            correct_justification=q_data["correct_justification"],
            is_active=True,
            is_reviewed=True,  # Seed já é revisado
        )
        db.session.add(question)
        db.session.flush()

        for alt_data in q_data["alternatives"]:
            alt = Alternative(
                tenant_id=tenant.id,
                question_id=question.id,
                key=alt_data["key"],
                text=alt_data["text"],
                distractor_justification=alt_data.get("justification"),
            )
            db.session.add(alt)

    print(
        f"  ✓ {len(questions_data)} questões criadas com alternativas e justificativas"
    )


def _print_summary(super_admin, tenant, producer, student, course):
    """Imprime resumo das credenciais para uso imediato nos testes."""
    print("=" * 60)
    print("📋 CREDENCIAIS DE TESTE")
    print("=" * 60)
    print()
    print("🔑 SUPER ADMIN (acesso global)")
    print(f"   Email:  admin@platform.com")
    print(f"   Senha:  Admin@123456")
    print(f"   Header: X-Tenant-Slug: platform")
    print()
    print("🏢 PRODUTOR (tenant: concurso-demo)")
    print(f"   Email:  produtor@concursodemo.com")
    print(f"   Senha:  Produtor@123456")
    print(f"   Header: X-Tenant-Slug: concurso-demo")
    print()
    print("📚 ALUNO (tenant: concurso-demo)")
    print(f"   Email:  aluno@teste.com")
    print(f"   Senha:  Aluno@123456")
    print(f"   Header: X-Tenant-Slug: concurso-demo")
    print()
    print("=" * 60)
    print("🚀 TESTAR:")
    print("   curl -s -X POST http://localhost:5000/api/v1/auth/login \\")
    print('     -H "Content-Type: application/json" \\')
    print('     -H "X-Tenant-Slug: concurso-demo" \\')
    print(
        '     -d \'{"email":"aluno@teste.com","password":"Aluno@123456"}\' | python3 -m json.tool'
    )
    print("=" * 60)


if __name__ == "__main__":
    seed_all()
