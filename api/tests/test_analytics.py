# api/tests/test_analytics.py


class TestAnalytics:

    def test_student_dashboard(self, client, student_headers):
        res = client.get("/api/v1/analytics/student/dashboard",
            headers=student_headers)
        assert res.status_code == 200
        data = res.json
        assert "questions" in data
        assert "time_studied" in data
        assert "discipline_performance" in data
        assert "insights" in data

    def test_student_dashboard_structure(self, client, student_headers):
        res = client.get("/api/v1/analytics/student/dashboard",
            headers=student_headers)
        q = res.json["questions"]
        assert "total_answered" in q
        assert "overall_accuracy" in q

    def test_producer_overview(self, client, producer_headers):
        res = client.get("/api/v1/analytics/producer/overview",
            headers=producer_headers)
        assert res.status_code == 200
        assert "overview" in res.json
        assert "at_risk_students" in res.json

    def test_producer_students_list(self, client, producer_headers):
        res = client.get("/api/v1/analytics/producer/students",
            headers=producer_headers)
        assert res.status_code == 200
        assert "students" in res.json

    def test_student_cannot_access_producer_analytics(
        self, client, student_headers
    ):
        res = client.get("/api/v1/analytics/producer/overview",
            headers=student_headers)
        assert res.status_code == 403