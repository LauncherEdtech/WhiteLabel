# api/tests/test_questions.py
import pytest


class TestQuestions:

    def test_list_questions(self, client, student_headers):
        res = client.get("/api/v1/questions/", headers=student_headers)
        assert res.status_code == 200
        assert "questions" in res.json
        assert "pagination" in res.json

    def test_list_questions_filter_difficulty(self, client, student_headers):
        res = client.get(
            "/api/v1/questions/?difficulty=medium", headers=student_headers
        )
        assert res.status_code == 200

    def test_list_questions_filter_not_answered(self, client, student_headers):
        res = client.get(
            "/api/v1/questions/?not_answered=true", headers=student_headers
        )
        assert res.status_code == 200

    def test_create_question_producer(self, client, producer_headers):
        res = client.post(
            "/api/v1/questions/",
            json={
                "statement": "Nova questão de teste?",
                "difficulty": "easy",
                "discipline": "Direito Penal",
                "correct_alternative_key": "a",
                "alternatives": [
                    {"key": "a", "text": "Alternativa A"},
                    {"key": "b", "text": "Alternativa B"},
                    {"key": "c", "text": "Alternativa C"},
                    {"key": "d", "text": "Alternativa D"},
                ],
            },
            headers=producer_headers,
        )
        assert res.status_code in (200, 201)

    def test_create_question_student_forbidden(self, client, student_headers):
        res = client.post(
            "/api/v1/questions/",
            json={"statement": "Indevida?", "alternatives": []},
            headers=student_headers,
        )
        assert res.status_code == 403

    def test_answer_question_correct(self, client, student_headers, db):
        from app.models.question import Question

        q = Question.query.first()
        res = client.post(
            f"/api/v1/questions/{q.id}/answer",
            json={
                "chosen_alternative_key": q.correct_alternative_key,
                "response_time_seconds": 30,
            },
            headers=student_headers,
        )
        assert res.status_code == 200
        data = res.json
        # Aceita tanto {"result": {"is_correct": ...}} quanto {"is_correct": ...}
        is_correct = data.get("result", data).get("is_correct")
        assert is_correct is True

    def test_answer_question_wrong(self, client, student_headers, db):
        from app.models.question import Question

        q = Question.query.first()
        wrong_key = next(
            k for k in ["a", "b", "c", "d"] if k != q.correct_alternative_key
        )
        res = client.post(
            f"/api/v1/questions/{q.id}/answer",
            json={"chosen_alternative_key": wrong_key},
            headers=student_headers,
        )
        assert res.status_code == 200
        data = res.json
        is_correct = data.get("result", data).get("is_correct")
        assert is_correct is False

    def test_my_history(self, client, student_headers):
        res = client.get("/api/v1/questions/my-history", headers=student_headers)
        assert res.status_code == 200


class TestQuestionSecurity:

    def test_tenant_isolation(self, client, db):
        """Aluno de um tenant não pode ver questões de outro."""
        from app.models.tenant import Tenant
        from app.models.user import User
        from app.models.question import Question

        t2 = Tenant(
            name="Tenant 2",
            slug="tenant-2",
            plan="basic",
            is_active=True,
            features={},
            branding={},
        )
        db.session.add(t2)
        db.session.flush()

        u2 = User(tenant_id=t2.id, name="Aluno2", email="aluno2@t2.com", role="student")
        u2.set_password("Aluno2@123456")
        db.session.add(u2)
        db.session.commit()

        res = client.post(
            "/api/v1/auth/login",
            json={"email": "aluno2@t2.com", "password": "Aluno2@123456"},
            headers={"X-Tenant-Slug": "tenant-2"},
        )
        token2 = res.json["access_token"]

        q = Question.query.first()
        res2 = client.post(
            f"/api/v1/questions/{q.id}/answer",
            json={"chosen_alternative_key": "a"},
            headers={"X-Tenant-Slug": "tenant-2", "Authorization": f"Bearer {token2}"},
        )
        assert res2.status_code in (403, 404)
