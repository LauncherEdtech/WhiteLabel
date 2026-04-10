# api/tests/test_auth.py
import pytest


class TestAuth:

    def test_health(self, client):
        res = client.get("/health")
        assert res.status_code == 200
        assert res.json["status"] == "ok"

    def test_health_ready(self, client):
        res = client.get("/health/ready")
        assert res.status_code == 200

    def test_login_success(self, client, tenant_headers):
        res = client.post("/api/v1/auth/login",
            json={"email": "aluno@test.com", "password": "Aluno@123456"},
            headers=tenant_headers)
        assert res.status_code == 200
        assert "access_token" in res.json
        assert "refresh_token" in res.json
        assert res.json["user"]["role"] == "student"

    def test_login_wrong_password(self, client, tenant_headers):
        res = client.post("/api/v1/auth/login",
            json={"email": "aluno@test.com", "password": "wrongpass"},
            headers=tenant_headers)
        assert res.status_code == 401

    def test_login_wrong_email(self, client, tenant_headers):
        res = client.post("/api/v1/auth/login",
            json={"email": "nonexistent@test.com", "password": "Aluno@123456"},
            headers=tenant_headers)
        assert res.status_code == 401
        assert "credenciais" in res.json["message"].lower() or \
               "inválid" in res.json["message"].lower()

    def test_login_invalid_tenant(self, client):
        res = client.post("/api/v1/auth/login",
            json={"email": "aluno@test.com", "password": "Aluno@123456"},
            headers={"X-Tenant-Slug": "nonexistent-tenant"})
        assert res.status_code in (404, 403)

    def test_me_authenticated(self, client, student_headers):
        res = client.get("/api/v1/auth/me", headers=student_headers)
        assert res.status_code == 200
        assert res.json["email"] == "aluno@test.com"

    def test_me_unauthenticated(self, client, tenant_headers):
        res = client.get("/api/v1/auth/me", headers=tenant_headers)
        assert res.status_code == 401

    def test_register(self, client, tenant_headers):
        res = client.post("/api/v1/auth/register",
            json={"name": "Novo Aluno", "email": "novo@test.com",
                  "password": "Novo@123456"},
            headers=tenant_headers)
        assert res.status_code in (201, 200)
        assert "user_id" in res.json

    def test_register_duplicate_email(self, client, tenant_headers):
        res = client.post("/api/v1/auth/register",
            json={"name": "Dup", "email": "aluno@test.com",
                  "password": "Dup@123456"},
            headers=tenant_headers)
        assert res.status_code == 409

    def test_refresh_token(self, client, tenant_headers):
        login = client.post("/api/v1/auth/login",
            json={"email": "aluno@test.com", "password": "Aluno@123456"},
            headers=tenant_headers)
        refresh_token = login.json["refresh_token"]
        res = client.post("/api/v1/auth/refresh",
            headers={**tenant_headers, "Authorization": f"Bearer {refresh_token}"})
        assert res.status_code == 200
        assert "access_token" in res.json

    def test_update_profile(self, client, student_headers):
        res = client.put("/api/v1/auth/profile",
            json={"name": "Maria Silva"},
            headers=student_headers)
        assert res.status_code == 200
        assert res.json["user"]["name"] == "Maria Silva"

    def test_forgot_password_returns_200_always(self, client, tenant_headers):
        for email in ["aluno@test.com", "nonexistent@test.com"]:
            res = client.post("/api/v1/auth/forgot-password",
                json={"email": email}, headers=tenant_headers)
            assert res.status_code == 200
