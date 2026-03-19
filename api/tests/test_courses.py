# api/tests/test_courses.py
import pytest


class TestCourses:

    def test_list_courses_student(self, client, student_headers):
        res = client.get("/api/v1/courses/", headers=student_headers)
        assert res.status_code == 200
        assert "courses" in res.json

    def test_list_courses_producer(self, client, producer_headers):
        res = client.get("/api/v1/courses/", headers=producer_headers)
        assert res.status_code == 200

    def test_list_courses_unauthenticated(self, client, tenant_headers):
        res = client.get("/api/v1/courses/", headers=tenant_headers)
        assert res.status_code == 401

    def test_create_course_producer(self, client, producer_headers):
        res = client.post("/api/v1/courses/",
            json={"name": "Novo Curso", "description": "Desc", "is_active": True},
            headers=producer_headers)
        assert res.status_code in (200, 201)
        assert res.json["course"]["name"] == "Novo Curso"

    def test_create_course_student_forbidden(self, client, student_headers):
        res = client.post("/api/v1/courses/",
            json={"name": "Curso Indevido"},
            headers=student_headers)
        assert res.status_code == 403

    def test_get_course_detail(self, client, student_headers, db):
        from app.models.course import Course
        course = Course.query.filter_by(name="Curso Teste").first()
        res = client.get(f"/api/v1/courses/{course.id}", headers=student_headers)
        assert res.status_code == 200
        assert "subjects" in res.json["course"]

    def test_create_subject(self, client, producer_headers, db):
        from app.models.course import Course
        course = Course.query.filter_by(name="Curso Teste").first()
        res = client.post(f"/api/v1/courses/{course.id}/subjects",
            json={"name": "Processo Penal", "color": "#3B82F6",
                  "edital_weight": 1.5, "order": 2},
            headers=producer_headers)
        assert res.status_code in (200, 201)

    def test_enroll_student(self, client, student_headers, db):
        from app.models.course import Course
        course = Course.query.filter_by(name="Curso Teste").first()
        res = client.post(f"/api/v1/courses/{course.id}/enroll",
            headers=student_headers)
        assert res.status_code in (200, 201, 409)  # 409 se já matriculado