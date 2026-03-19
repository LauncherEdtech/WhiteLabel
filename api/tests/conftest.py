# api/tests/conftest.py
import pytest
from app import create_app
from app.extensions import db as _db
from app.models.tenant import Tenant
from app.models.user import User
from app.models.course import Course, Subject, Module, Lesson
from app.models.question import Question, Alternative


@pytest.fixture(scope="session")
def app():
    """Cria app Flask com banco SQLite em memória para testes."""
    app = create_app("testing")
    with app.app_context():
        _db.create_all()
        _seed_test_data()
        yield app
        _db.drop_all()


@pytest.fixture(scope="session")
def client(app):
    return app.test_client()


@pytest.fixture(scope="session")
def db(app):
    return _db


def _seed_test_data():
    """Cria dados mínimos para testes."""
    # Tenant
    tenant = Tenant(
        name="Test Platform",
        slug="test-platform",
        plan="pro",
        is_active=True,
        features={"simulados": True, "ai_features": True},
        branding={"primary_color": "#4F46E5", "platform_name": "Test"},
    )
    _db.session.add(tenant)
    _db.session.flush()

    # Super Admin
    admin = User(tenant_id=tenant.id, name="Admin", email="admin@test.com", role="super_admin")
    admin.set_password("Admin@123456")
    _db.session.add(admin)

    # Produtor
    producer = User(tenant_id=tenant.id, name="Produtor", email="produtor@test.com", role="producer_admin")
    producer.set_password("Produtor@123456")
    _db.session.add(producer)

    # Aluno
    student = User(tenant_id=tenant.id, name="Aluno", email="aluno@test.com", role="student")
    student.set_password("Aluno@123456")
    _db.session.add(student)

    # Curso
    course = Course(tenant_id=tenant.id, name="Curso Teste", is_active=True)
    _db.session.add(course)
    _db.session.flush()

    # Disciplina + Módulo + Aula
    subject = Subject(
        course_id=course.id, tenant_id=tenant.id,
        name="Direito Penal", color="#EF4444",
        edital_weight=2.0, order=1,
    )
    _db.session.add(subject)
    _db.session.flush()

    module = Module(subject_id=subject.id, name="Teoria Geral", order=1)
    _db.session.add(module)
    _db.session.flush()

    lesson = Lesson(
        module_id=module.id, title="Introdução ao Direito Penal",
        duration_minutes=45, order=1, is_published=True,
    )
    _db.session.add(lesson)
    _db.session.flush()

    # Questão
    question = Question(
        tenant_id=tenant.id, subject_id=subject.id,
        statement="Qual é o princípio da legalidade?",
        difficulty="medium", discipline="Direito Penal",
        correct_alternative_key="a",
        correct_justification="Nullum crimen sine lege.",
    )
    _db.session.add(question)
    _db.session.flush()

    for key, text in [("a","Não há crime sem lei anterior"), ("b","Toda conduta é crime"), ("c","A lei retroage"), ("d","O juiz cria crimes")]:
        _db.session.add(Alternative(question_id=question.id, key=key, text=text))

    _db.session.commit()


# ── Helpers de autenticação ───────────────────────────────────────────────────

def get_token(client, email: str, password: str) -> str:
    res = client.post("/api/v1/auth/login",
        json={"email": email, "password": password},
        headers={"X-Tenant-Slug": "test-platform"})
    return res.json["access_token"]


@pytest.fixture
def student_token(client):
    return get_token(client, "aluno@test.com", "Aluno@123456")

@pytest.fixture
def producer_token(client):
    return get_token(client, "produtor@test.com", "Produtor@123456")

@pytest.fixture
def admin_token(client):
    return get_token(client, "admin@test.com", "Admin@123456")

@pytest.fixture
def tenant_headers():
    return {"X-Tenant-Slug": "test-platform"}

@pytest.fixture
def student_headers(student_token):
    return {"X-Tenant-Slug": "test-platform", "Authorization": f"Bearer {student_token}"}

@pytest.fixture
def producer_headers(producer_token):
    return {"X-Tenant-Slug": "test-platform", "Authorization": f"Bearer {producer_token}"}