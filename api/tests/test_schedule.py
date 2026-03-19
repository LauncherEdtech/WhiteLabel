# api/tests/test_schedule.py


class TestSchedule:

    def test_generate_schedule(self, client, student_headers, db):
        from app.models.course import Course

        course = Course.query.filter_by(name="Curso Teste").first()

        res = client.post(
            "/api/v1/schedule/generate",
            json={"course_id": str(course.id)},
            headers=student_headers,
        )
        assert res.status_code in (200, 201)

    def test_get_schedule(self, client, student_headers):
        res = client.get("/api/v1/schedule/", headers=student_headers)
        assert res.status_code == 200

    def test_update_availability(self, client, student_headers):
        res = client.post(
            "/api/v1/schedule/availability",
            json={
                "days": [0, 1, 2, 3, 4],
                "hours_per_day": 2,
                "preferred_start_time": "19:00",
            },
            headers=student_headers,
        )
        assert res.status_code == 200


class TestSimulados:

    def test_list_simulados(self, client, student_headers):
        res = client.get("/api/v1/simulados/", headers=student_headers)
        assert res.status_code == 200

    def test_create_simulado_producer(self, client, producer_headers, db):
        from app.models.course import Course

        course = Course.query.filter_by(name="Curso Teste").first()

        res = client.post(
            "/api/v1/simulados/auto-generate",
            json={
                "course_id": str(course.id),
                "title": "Simulado Teste",
                "time_limit_minutes": 60,
                "total_questions": 5,
            },
            headers=producer_headers,
        )
        # Pode ser 400 se não há questões suficientes — é ok
        assert res.status_code in (200, 201, 400)

    def test_create_simulado_student_forbidden(self, client, student_headers, db):
        from app.models.course import Course

        course = Course.query.filter_by(name="Curso Teste").first()

        res = client.post(
            "/api/v1/simulados/auto-generate",
            json={
                "course_id": str(course.id),
                "title": "Indevido",
                "time_limit_minutes": 30,
                "total_questions": 5,
            },
            headers=student_headers,
        )
        assert res.status_code == 403
