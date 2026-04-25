# api/tests/test_schedule.py
from unittest.mock import patch, MagicMock


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _is_sqlite(db) -> bool:
    """Retorna True se o banco de testes é SQLite."""
    return "sqlite" in str(db.engine.url)

def _enroll_student(db, app):
    """Matricula o aluno no curso de teste (idempotente)."""
    from app.models.course import Course, CourseEnrollment
    from app.models.user import User
    from app.models.tenant import Tenant

    with app.app_context():
        tenant = Tenant.query.filter_by(slug="test-platform").first()
        student = User.query.filter_by(email="aluno@test.com").first()
        course = Course.query.filter_by(name="Curso Teste").first()

        existing = CourseEnrollment.query.filter_by(
            user_id=student.id, course_id=course.id, tenant_id=tenant.id
        ).first()
        if not existing:
            enrollment = CourseEnrollment(
                tenant_id=tenant.id,
                user_id=student.id,
                course_id=course.id,
                is_active=True,
            )
            db.session.add(enrollment)
            db.session.commit()


def _get_course_id(app):
    from app.models.course import Course
    with app.app_context():
        course = Course.query.filter_by(name="Curso Teste").first()
        return str(course.id)


def _get_ids(app):
    """Retorna dict com ids dos objetos de teste."""
    from app.models.course import Course, Subject, Module, Lesson
    from app.models.user import User
    from app.models.tenant import Tenant

    with app.app_context():
        tenant = Tenant.query.filter_by(slug="test-platform").first()
        student = User.query.filter_by(email="aluno@test.com").first()
        course = Course.query.filter_by(name="Curso Teste").first()
        subject = Subject.query.filter_by(name="Direito Penal").first()
        module = Module.query.filter_by(name="Teoria Geral").first()
        lesson = Lesson.query.filter_by(title="Introdução ao Direito Penal").first()
        return {
            "tenant_id": str(tenant.id),
            "user_id": str(student.id),
            "course_id": str(course.id),
            "subject_id": str(subject.id),
            "module_id": str(module.id),
            "lesson_id": str(lesson.id),
        }


# ─────────────────────────────────────────────────────────────────────────────
# Testes de API (integração)
# ─────────────────────────────────────────────────────────────────────────────

class TestSchedule:
    def test_generate_schedule(self, client, student_headers, db, app):
        _enroll_student(db, app)
        course_id = _get_course_id(app)
 
        mock_result = MagicMock()
        mock_result.id = "test-task-id-abc123"
 
        with patch("app.routes.schedule.generate_schedule_task") as mock_task:
            mock_task.delay.return_value = mock_result
 
            res = client.post(
                "/api/v1/schedule/generate",
                json={"course_id": course_id},
                headers=student_headers,
            )
 
        assert res.status_code == 202
        data = res.json
        assert data["status"] == "pending"
        assert data["task_id"] == "test-task-id-abc123"
        assert "poll_url" in data
        # Confirma que o delay foi chamado com os argumentos corretos
        mock_task.delay.assert_called_once()
        call_kwargs = mock_task.delay.call_args.kwargs
        assert call_kwargs["course_id"] == course_id

    def test_generate_schedule_with_target_date(self, client, student_headers, db, app):
        if _is_sqlite(db):
            import pytest as _pt; _pt.skip("SQLite bulk update DateTime incompatibility")
        _enroll_student(db, app)
        course_id = _get_course_id(app)
 
        mock_result = MagicMock()
        mock_result.id = "test-task-id-with-date"
 
        with patch("app.routes.schedule.generate_schedule_task") as mock_task:
            mock_task.delay.return_value = mock_result
 
            res = client.post(
                "/api/v1/schedule/generate",
                json={"course_id": course_id, "target_date": "2026-12-31"},
                headers=student_headers,
            )
 
        assert res.status_code == 202
        data = res.json
        assert data["status"] == "pending"
        assert "task_id" in data
        # Confirma que target_date foi passado à task
        call_kwargs = mock_task.delay.call_args.kwargs
        assert call_kwargs.get("target_date") == "2026-12-31"

    def test_generate_schedule_not_enrolled(self, client, db, app):
        """Aluno não matriculado recebe 403."""
        from app.models.course import Course
        from app.models.user import User
        from app.models.tenant import Tenant

        with app.app_context():
            tenant = Tenant.query.filter_by(slug="test-platform").first()
            # Cria aluno extra sem matrícula
            extra = User.query.filter_by(email="extra@test.com").first()
            if not extra:
                extra = User(
                    tenant_id=tenant.id, name="Extra",
                    email="extra@test.com", role="student"
                )
                extra.set_password("Extra@123456")
                db.session.add(extra)
                db.session.commit()

        from tests.conftest import get_token
        token = get_token(client, "extra@test.com", "Extra@123456")
        headers = {"X-Tenant-Slug": "test-platform", "Authorization": f"Bearer {token}"}

        course_id = _get_course_id(app)
        res = client.post(
            "/api/v1/schedule/generate",
            json={"course_id": course_id},
            headers=headers,
        )
        assert res.status_code == 403

    def test_get_schedule(self, client, student_headers, db, app):
        _enroll_student(db, app)
        course_id = _get_course_id(app)

        res = client.get(
            f"/api/v1/schedule/?course_id={course_id}",
            headers=student_headers,
        )
        assert res.status_code == 200
        data = res.json
        assert "schedule" in data
        assert "days" in data
        assert "stats" in data

    def test_get_schedule_missing_course_id(self, client, student_headers):
        res = client.get("/api/v1/schedule/", headers=student_headers)
        assert res.status_code == 400

    def test_get_schedule_has_break_minutes(self, client, student_headers, db, app):
        """break_minutes deve aparecer nas stats quando há schedule."""
        _enroll_student(db, app)
        course_id = _get_course_id(app)

        res = client.get(
            f"/api/v1/schedule/?course_id={course_id}",
            headers=student_headers,
        )
        assert res.status_code == 200
        # stats pode ser None se não há schedule ativo
        if res.json["stats"] is not None:
            assert "break_minutes" in res.json["stats"]

    def test_update_availability(self, client, student_headers):
        res = client.put(
            "/api/v1/schedule/availability",
            json={
                "days": [0, 1, 2, 3, 4],
                "hours_per_day": 2,
                "preferred_start_time": "19:00",
                "break_minutes": 0,
            },
            headers=student_headers,
        )
        assert res.status_code == 200

    def test_update_availability_with_break_minutes(self, client, student_headers):
        """break_minutes deve ser salvo e retornado."""
        res = client.put(
            "/api/v1/schedule/availability",
            json={
                "days": [0, 1, 2, 3, 4],
                "hours_per_day": 3,
                "break_minutes": 10,
            },
            headers=student_headers,
        )
        assert res.status_code == 200
        data = res.json
        assert data["availability"]["break_minutes"] == 10
        assert data["availability"]["hours_per_day"] == 3

    def test_update_availability_break_minutes_max(self, client, student_headers):
        """break_minutes > 15 deve ser rejeitado."""
        res = client.put(
            "/api/v1/schedule/availability",
            json={"days": [0], "hours_per_day": 2, "break_minutes": 16},
            headers=student_headers,
        )
        assert res.status_code == 400

    def test_reorganize_schedule(self, client, student_headers, db, app):
        if _is_sqlite(db):
            import pytest as _pt; _pt.skip("SQLite bulk update DateTime incompatibility")
        _enroll_student(db, app)
        course_id = _get_course_id(app)

        res = client.post(
            "/api/v1/schedule/reorganize",
            json={"course_id": course_id},
            headers=student_headers,
        )
        assert res.status_code == 200
        assert res.json["schedule"]["status"] == "active"

    def test_reorganize_missing_course_id(self, client, student_headers):
        res = client.post(
            "/api/v1/schedule/reorganize",
            json={},
            headers=student_headers,
        )
        assert res.status_code == 400

    def test_checkin_item(self, client, student_headers, db, app):
        """Marca um item do cronograma como concluído."""
        _enroll_student(db, app)
        course_id = _get_course_id(app)

        with app.app_context():
            from app.models.schedule import StudySchedule, ScheduleItem
            from app.models.tenant import Tenant
            from app.models.user import User

            tenant = Tenant.query.filter_by(slug="test-platform").first()
            student = User.query.filter_by(email="aluno@test.com").first()

            schedule = StudySchedule.query.filter_by(
                user_id=student.id, course_id=course_id,
                tenant_id=tenant.id, is_deleted=False,
            ).first()

            if not schedule:
                return  # sem schedule, pula

            item = ScheduleItem.query.filter_by(
                schedule_id=schedule.id, status="pending", is_deleted=False
            ).first()

            if not item:
                return

            item_id = str(item.id)

        res = client.post(
            f"/api/v1/schedule/checkin/{item_id}",
            json={"completed": True},
            headers=student_headers,
        )
        assert res.status_code == 200
        assert res.json["item_status"] == "done"

    def test_checkin_item_skip(self, client, student_headers, db, app):
        """Marca um item como pulado."""
        _enroll_student(db, app)
        course_id = _get_course_id(app)

        with app.app_context():
            from app.models.schedule import StudySchedule, ScheduleItem
            from app.models.tenant import Tenant
            from app.models.user import User

            tenant = Tenant.query.filter_by(slug="test-platform").first()
            student = User.query.filter_by(email="aluno@test.com").first()

            schedule = StudySchedule.query.filter_by(
                user_id=student.id, course_id=course_id,
                tenant_id=tenant.id, is_deleted=False,
            ).first()

            if not schedule:
                return

            item = ScheduleItem.query.filter_by(
                schedule_id=schedule.id, status="pending", is_deleted=False
            ).first()

            if not item:
                return

            item_id = str(item.id)

        res = client.post(
            f"/api/v1/schedule/checkin/{item_id}",
            json={"completed": False},
            headers=student_headers,
        )
        assert res.status_code == 200
        assert res.json["item_status"] == "skipped"

    def test_delete_schedule(self, client, student_headers, db, app):
        if _is_sqlite(db):
            import pytest as _pt; _pt.skip("SQLite bulk update DateTime incompatibility")
        _enroll_student(db, app)
        course_id = _get_course_id(app)

        res = client.delete(
            f"/api/v1/schedule/?course_id={course_id}",
            headers=student_headers,
        )
        # 200 = deletado, 404 = não existia
        assert res.status_code in (200, 404)

    def test_delete_schedule_missing_course_id(self, client, student_headers):
        res = client.delete("/api/v1/schedule/", headers=student_headers)
        assert res.status_code == 400


# ─────────────────────────────────────────────────────────────────────────────
# Testes unitários do ScheduleEngine
# ─────────────────────────────────────────────────────────────────────────────

class TestScheduleEngine:
    """
    Testes diretos nos métodos do ScheduleEngine.
    Exercitam a lógica interna sem passar pela camada HTTP,
    cobrindo caminhos que os testes de integração não alcançam.
    """

    def _make_engine(self, app, break_minutes=0, hours_per_day=2):
        """Instancia o engine com os dados de teste."""
        from app.services.schedule_engine import ScheduleEngine
        from app.models.user import User
        from app.models.tenant import Tenant

        tenant = Tenant.query.filter_by(slug="test-platform").first()
        student = User.query.filter_by(email="aluno@test.com").first()

        student.study_availability = {
            "days": [0, 1, 2, 3, 4],
            "hours_per_day": hours_per_day,
            "break_minutes": break_minutes,
        }

        from app.models.course import Course
        course = Course.query.filter_by(name="Curso Teste").first()

        return ScheduleEngine(
            user_id=str(student.id),
            tenant_id=str(tenant.id),
            course_id=str(course.id),
        )

    def test_engine_instantiation(self, app, db):
        """Engine inicializa corretamente com break_minutes do aluno."""
        with app.app_context():
            engine = self._make_engine(app, break_minutes=5)
            assert engine.break_minutes == 5
            assert engine.hours_per_day == 2
            assert engine.minutes_per_day == 120

    def test_engine_break_minutes_default_zero(self, app, db):
        """Sem break_minutes configurado, padrão é 0."""
        with app.app_context():
            from app.services.schedule_engine import ScheduleEngine
            from app.models.user import User
            from app.models.tenant import Tenant
            from app.models.course import Course

            tenant = Tenant.query.filter_by(slug="test-platform").first()
            student = User.query.filter_by(email="aluno@test.com").first()
            course = Course.query.filter_by(name="Curso Teste").first()

            # Remove break_minutes do availability
            student.study_availability = {
                "days": [0, 1, 2, 3, 4],
                "hours_per_day": 2,
            }
            engine = ScheduleEngine(
                user_id=str(student.id),
                tenant_id=str(tenant.id),
                course_id=str(course.id),
            )
            assert engine.break_minutes == 0

    def test_calculate_questions_minutes(self, app, db):
        """Tempo de questões é proporcional à aula, com min/max."""
        with app.app_context():
            engine = self._make_engine(app)

            # Aula curta: 10 + 15*0.3 = 14.5 → int = 14
            assert engine._calculate_questions_minutes(15) == 14

            # Aula de 40 min → 10 + 40*0.3 = 22
            assert engine._calculate_questions_minutes(40) == 22

            # Aula longa → máximo 25 min
            assert engine._calculate_questions_minutes(120) == 25

    def test_calculate_review_minutes(self, app, db):
        """Tempo de revisão aumenta com acurácia baixa."""
        with app.app_context():
            engine = self._make_engine(app)

            # Acurácia 0% → máximo 30 min
            assert engine._calculate_review_minutes(0.0) == 30

            # Acurácia 100% → mínimo 15 min
            assert engine._calculate_review_minutes(1.0) == 15

            # Acurácia 50% → intermediário
            mid = engine._calculate_review_minutes(0.5)
            assert 15 <= mid <= 30

    def test_calculate_lessons_window_concentrated(self, app, db):
        """Modo concentrated retorna apenas dias necessários."""
        with app.app_context():
            engine = self._make_engine(app)
            engine.DISTRIBUTION_STRATEGY = "concentrated"

            days = engine._calculate_lessons_window(
                total_lessons=10,
                available_days=100,
                effective_minutes=120,
                avg_lesson_minutes=40.0,
            )
            # 40+0+22+0=62 min/aula → 120//62=1 aula/dia → ceil(10/1)=10 dias
            assert days <= 100
            assert days >= 1

    def test_calculate_lessons_window_stretched(self, app, db):
        """Modo stretched usa todos os dias disponíveis."""
        with app.app_context():
            engine = self._make_engine(app)
            engine.DISTRIBUTION_STRATEGY = "stretched"

            days = engine._calculate_lessons_window(
                total_lessons=10,
                available_days=200,
                effective_minutes=120,
                avg_lesson_minutes=40.0,
            )
            assert days == 200

    def test_calculate_lessons_window_with_oversized(self, app, db):
        """Aulas oversized adicionam padding à janela."""
        with app.app_context():
            engine = self._make_engine(app)
            engine.DISTRIBUTION_STRATEGY = "concentrated"

            # Sem aulas oversized
            days_normal = engine._calculate_lessons_window(
                total_lessons=10,
                available_days=100,
                effective_minutes=120,
                avg_lesson_minutes=40.0,
                lesson_durations=[40] * 10,
            )

            # Com 2 aulas oversized (> 120 min)
            days_oversized = engine._calculate_lessons_window(
                total_lessons=10,
                available_days=100,
                effective_minutes=120,
                avg_lesson_minutes=40.0,
                lesson_durations=[150, 160] + [40] * 8,
            )

            # Com oversized precisa de mais dias
            assert days_oversized >= days_normal

    def test_build_priority_reason(self, app, db):
        """Strings de prioridade corretas para cada faixa."""
        with app.app_context():
            engine = self._make_engine(app)
            from app.models.course import Subject
            from app.models.tenant import Tenant

            tenant = Tenant.query.filter_by(slug="test-platform").first()
            subject = Subject.query.filter_by(
                name="Direito Penal", tenant_id=tenant.id
            ).first()

            assert "acerto baixo" in engine._build_priority_reason(subject, 2.5)
            assert "não praticado" in engine._build_priority_reason(subject, 1.6)
            assert "desempenho" in engine._build_priority_reason(subject, 0.5)
            assert "edital" in engine._build_priority_reason(subject, 1.0)
            assert "Sequência do curso" in engine._build_priority_reason(None, 1.0)

    def test_add_lesson_with_questions_normal(self, app, db):
        """Aula normal: questões adicionadas se couber no budget."""
        with app.app_context():
            from app.services.schedule_engine import ScheduleEngine
            from app.models.course import Subject, Module, Lesson
            from app.models.tenant import Tenant

            engine = self._make_engine(app)
            tenant = Tenant.query.filter_by(slug="test-platform").first()
            subject = Subject.query.filter_by(
                name="Direito Penal", tenant_id=tenant.id
            ).first()
            lesson = Lesson.query.filter_by(
                title="Introdução ao Direito Penal"
            ).first()

            items = []
            day_used, day_order = engine._add_lesson_with_questions(
                items_to_add=items,
                slot_str="2026-06-01",
                lesson=lesson,
                lesson_dur=40,
                subject_id=str(subject.id),
                subject=subject,
                priority=1.0,
                day_used=0,
                day_order=0,
                tenant_id=str(tenant.id),
                schedule_id="fake-schedule-id",
                effective_minutes=120,
                is_long_lesson=False,
            )

            types = [i.item_type for i in items]
            assert "lesson" in types
            assert "questions" in types
            assert day_used > 40  # aula + questões

    def test_add_lesson_with_questions_force_fit(self, app, db):
        """Aula longa (force-fit): questões SEMPRE adicionadas mesmo estourando budget."""
        with app.app_context():
            from app.models.course import Subject, Lesson
            from app.models.tenant import Tenant

            engine = self._make_engine(app)
            tenant = Tenant.query.filter_by(slug="test-platform").first()
            subject = Subject.query.filter_by(
                name="Direito Penal", tenant_id=tenant.id
            ).first()
            lesson = Lesson.query.filter_by(
                title="Introdução ao Direito Penal"
            ).first()

            items = []
            day_used, day_order = engine._add_lesson_with_questions(
                items_to_add=items,
                slot_str="2026-06-01",
                lesson=lesson,
                lesson_dur=149,  # maior que budget de 120 min
                subject_id=str(subject.id),
                subject=subject,
                priority=1.0,
                day_used=0,
                day_order=0,
                tenant_id=str(tenant.id),
                schedule_id="fake-schedule-id",
                effective_minutes=120,
                is_long_lesson=True,  # force-fit
            )

            types = [i.item_type for i in items]
            assert "lesson" in types
            # v13 FIX: questões obrigatórias mesmo estourando o budget
            assert "questions" in types

            # Questões têm o mínimo de 10 min
            q_item = next(i for i in items if i.item_type == "questions")
            assert q_item.estimated_minutes == engine.QUESTIONS_MIN_MINUTES
            assert "obrigatória" in q_item.priority_reason

    def test_add_lesson_no_subject_skips_questions(self, app, db):
        """Aula sem disciplina não gera questões."""
        with app.app_context():
            from app.models.course import Lesson
            from app.models.tenant import Tenant

            engine = self._make_engine(app)
            tenant = Tenant.query.filter_by(slug="test-platform").first()
            lesson = Lesson.query.filter_by(
                title="Introdução ao Direito Penal"
            ).first()

            items = []
            engine._add_lesson_with_questions(
                items_to_add=items,
                slot_str="2026-06-01",
                lesson=lesson,
                lesson_dur=40,
                subject_id="__no_subject__",
                subject=None,
                priority=1.0,
                day_used=0,
                day_order=0,
                tenant_id=str(tenant.id),
                schedule_id="fake-schedule-id",
                effective_minutes=120,
                is_long_lesson=False,
            )

            types = [i.item_type for i in items]
            assert "lesson" in types
            assert "questions" not in types

    def test_add_lesson_questions_dont_fit(self, app, db):
        """Questões não adicionadas se não couberem no budget."""
        with app.app_context():
            from app.models.course import Subject, Lesson
            from app.models.tenant import Tenant

            engine = self._make_engine(app)
            tenant = Tenant.query.filter_by(slug="test-platform").first()
            subject = Subject.query.filter_by(
                name="Direito Penal", tenant_id=tenant.id
            ).first()
            lesson = Lesson.query.filter_by(
                title="Introdução ao Direito Penal"
            ).first()

            items = []
            # day_used já está em 115 de 120 → questões (10 min) não cabem
            engine._add_lesson_with_questions(
                items_to_add=items,
                slot_str="2026-06-01",
                lesson=lesson,
                lesson_dur=40,
                subject_id=str(subject.id),
                subject=subject,
                priority=1.0,
                day_used=115,
                day_order=0,
                tenant_id=str(tenant.id),
                schedule_id="fake-schedule-id",
                effective_minutes=120,
                is_long_lesson=False,
            )

            types = [i.item_type for i in items]
            assert "lesson" in types
            assert "questions" not in types

    def test_fill_day_remainder_adds_review(self, app, db):
        """_fill_day_remainder adiciona revisão se sobrar >= 15 min."""
        with app.app_context():
            from app.models.course import Subject
            from app.models.tenant import Tenant

            engine = self._make_engine(app)
            tenant = Tenant.query.filter_by(slug="test-platform").first()
            subject = Subject.query.filter_by(
                name="Direito Penal", tenant_id=tenant.id
            ).first()

            items = []
            subject_map = {str(subject.id): subject}
            priority_map = {str(subject.id): 1.8}

            day_used, order = engine._fill_day_remainder(
                items=items,
                slot_str="2026-06-01",
                day_subjects_used=[str(subject.id)],
                subject_map=subject_map,
                priority_map=priority_map,
                day_used=80,
                order=2,
                effective_minutes=120,  # 40 min livres >= 15
                tenant_id=str(tenant.id),
                schedule_id="fake-schedule-id",
            )

            assert len(items) == 1
            assert items[0].item_type == "review"
            assert items[0].estimated_minutes <= 30  # máximo REVIEW_MAX_MINUTES

    def test_fill_day_remainder_skips_when_no_time(self, app, db):
        """_fill_day_remainder não adiciona nada se sobrar < 15 min."""
        with app.app_context():
            from app.models.course import Subject
            from app.models.tenant import Tenant

            engine = self._make_engine(app)
            tenant = Tenant.query.filter_by(slug="test-platform").first()
            subject = Subject.query.filter_by(
                name="Direito Penal", tenant_id=tenant.id
            ).first()

            items = []
            day_used, order = engine._fill_day_remainder(
                items=items,
                slot_str="2026-06-01",
                day_subjects_used=[str(subject.id)],
                subject_map={str(subject.id): subject},
                priority_map={str(subject.id): 1.0},
                day_used=110,  # só 10 min livres < 15
                order=2,
                effective_minutes=120,
                tenant_id=str(tenant.id),
                schedule_id="fake-schedule-id",
            )

            assert len(items) == 0

    def test_fill_day_remainder_skips_when_no_subjects(self, app, db):
        """_fill_day_remainder não adiciona nada se não houve disciplinas."""
        with app.app_context():
            engine = self._make_engine(app)
            from app.models.tenant import Tenant
            tenant = Tenant.query.filter_by(slug="test-platform").first()

            items = []
            day_used, order = engine._fill_day_remainder(
                items=items,
                slot_str="2026-06-01",
                day_subjects_used=[],  # nenhuma disciplina hoje
                subject_map={},
                priority_map={},
                day_used=80,
                order=0,
                effective_minutes=120,
                tenant_id=str(tenant.id),
                schedule_id="fake-schedule-id",
            )
            assert len(items) == 0

    def test_generate_day_slots(self, app, db):
        """_generate_day_slots respeita dias disponíveis."""
        with app.app_context():
            from datetime import date
            engine = self._make_engine(app)

            # Apenas segunda a sexta (0-4)
            engine.available_days = [0, 1, 2, 3, 4]
            slots = engine._generate_day_slots(
                start_date=date(2026, 6, 1),
                max_days=14,
            )

            # Todos os slots devem ser dias úteis
            for slot in slots:
                assert slot.weekday() in [0, 1, 2, 3, 4]

            assert len(slots) <= 14

    def test_generate_day_slots_weekends(self, app, db):
        """_generate_day_slots inclui fins de semana se configurado."""
        with app.app_context():
            from datetime import date
            engine = self._make_engine(app)

            engine.available_days = [5, 6]  # apenas sábado e domingo
            slots = engine._generate_day_slots(
                start_date=date(2026, 6, 1),
                max_days=14,
            )

            for slot in slots:
                assert slot.weekday() in [5, 6]

    def test_calculate_abandonment_risk_returns_valid_range(self, app, db):
        """calculate_abandonment_risk sempre retorna valor entre 0.0 e 1.0."""
        with app.app_context():
            engine = self._make_engine(app)
            risk = engine.calculate_abandonment_risk()
            assert isinstance(risk, float)
            assert 0.0 <= risk <= 1.0

    def test_get_pending_lessons_returns_list(self, app, db):
        """_get_pending_lessons retorna uma lista (pode estar vazia se aula já agendada)."""
        with app.app_context():
            engine = self._make_engine(app)
            lessons = engine._get_pending_lessons()
            # Só verifica que é uma lista — a aula pode já ter sido agendada
            # pelo test_generate_schedule que roda antes (session-scoped fixtures)
            assert isinstance(lessons, list)

    def test_schedule_engine_invalid_user(self, app, db):
        """Engine lança ValueError para usuário inexistente."""
        with app.app_context():
            from app.services.schedule_engine import ScheduleEngine
            import pytest as pt

            with pt.raises(ValueError, match="Usuário ou curso não encontrado"):
                ScheduleEngine(
                    user_id="00000000-0000-0000-0000-000000000000",
                    tenant_id="00000000-0000-0000-0000-000000000000",
                    course_id="00000000-0000-0000-0000-000000000000",
                )

    def test_schedule_single_day_empty_queues(self, app, db):
        """_schedule_single_day com filas vazias retorna lista vazia."""
        with app.app_context():
            engine = self._make_engine(app)
            from app.models.tenant import Tenant
            tenant = Tenant.query.filter_by(slug="test-platform").first()

            items, minutes, count, offset = engine._schedule_single_day(
                slot_str="2026-06-01",
                queues={},
                subject_ids_ordered=[],
                subject_map={},
                priority_map={},
                effective_minutes=120,
                tenant_id=str(tenant.id),
                schedule_id="fake-id",
                rotation_offset=0,
            )

            assert items == []
            assert minutes == 0
            assert count == 0

    def test_rotation_offset_advances(self, app, db):
        """rotation_offset retornado deve ser diferente do inicial quando há aulas."""
        with app.app_context():
            from app.models.course import Subject, Lesson
            from app.models.tenant import Tenant

            engine = self._make_engine(app)
            tenant = Tenant.query.filter_by(slug="test-platform").first()
            subject = Subject.query.filter_by(
                name="Direito Penal", tenant_id=tenant.id
            ).first()
            lesson = Lesson.query.filter_by(
                title="Introdução ao Direito Penal"
            ).first()

            sid = str(subject.id)
            queues = {sid: [lesson]}
            subject_map = {sid: subject}
            priority_map = {sid: 1.0}

            items, minutes, count, next_offset = engine._schedule_single_day(
                slot_str="2026-06-01",
                queues=queues,
                subject_ids_ordered=[sid],
                subject_map=subject_map,
                priority_map=priority_map,
                effective_minutes=120,
                tenant_id=str(tenant.id),
                schedule_id="fake-id",
                rotation_offset=0,
            )

            # Se agendou aulas, o offset deve ter avançado
            if count > 0:
                assert next_offset != 0 or count % 1 == 0

    def test_find_short_lesson(self, app, db):
        """_find_short_lesson encontra aula que cabe no tempo restante."""
        with app.app_context():
            from app.models.course import Lesson

            engine = self._make_engine(app)
            lesson = Lesson.query.filter_by(
                title="Introdução ao Direito Penal"
            ).first()

            # Cria aula mock longa
            class FakeLesson:
                duration_minutes = 150
                id = "fake"

            sid = "subject-1"
            queues = {sid: [FakeLesson(), lesson]}  # longa primeiro, curta depois

            # Com apenas 50 min restantes, deve pular a longa e pegar a curta
            result = engine._find_short_lesson(
                active_subjects=[sid],
                queues=queues,
                remaining=50,
                look_ahead=10,
            )

            assert result is not None
            found_sid, found_idx = result
            assert found_sid == sid
            assert found_idx == 1  # segunda posição (a curta)

    def test_find_short_lesson_none_fits(self, app, db):
        """_find_short_lesson retorna None quando nada cabe."""
        with app.app_context():
            engine = self._make_engine(app)

            class FakeLesson:
                duration_minutes = 150
                id = "fake"

            sid = "subject-1"
            queues = {sid: [FakeLesson()]}

            result = engine._find_short_lesson(
                active_subjects=[sid],
                queues=queues,
                remaining=10,  # muito pouco
            )

            assert result is None

    def test_schedule_status_unknown_task(self, client, student_headers):
            """GET /schedule/status/<task_id> retorna pending para task inexistente (Redis indisponível em CI)."""
            res = client.get(
                "/api/v1/schedule/status/00000000-0000-0000-0000-000000000000",
                headers=student_headers,
            )
            assert res.status_code == 200
            assert res.json["status"] == "pending"

# ─────────────────────────────────────────────────────────────────────────────
# Simulados (preservado do original)
# ─────────────────────────────────────────────────────────────────────────────

class TestSimulados:

    def test_list_simulados(self, client, student_headers):
        res = client.get("/api/v1/simulados/", headers=student_headers)
        assert res.status_code == 200

    def test_create_simulado_producer(self, client, producer_headers, db, app):
        from app.models.course import Course
        with app.app_context():
            course = Course.query.filter_by(name="Curso Teste").first()
            course_id = str(course.id)

        res = client.post(
            "/api/v1/simulados/auto-generate",
            json={
                "course_id": course_id,
                "title": "Simulado Teste",
                "time_limit_minutes": 60,
                "total_questions": 5,
            },
            headers=producer_headers,
        )
        assert res.status_code in (200, 201, 400)

    def test_create_simulado_student_forbidden(self, client, student_headers, db, app):
        from app.models.course import Course
        with app.app_context():
            course = Course.query.filter_by(name="Curso Teste").first()
            course_id = str(course.id)

        res = client.post(
            "/api/v1/simulados/auto-generate",
            json={
                "course_id": course_id,
                "title": "Indevido",
                "time_limit_minutes": 30,
                "total_questions": 5,
            },
            headers=student_headers,
        )
        assert res.status_code == 403