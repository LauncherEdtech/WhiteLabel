# api/tests/test_tenants.py


class TestTenants:

    def test_create_tenant_admin_only(self, client, admin_token, tenant_headers):
        res = client.post("/api/v1/tenants/",
            json={
                "name": "Novo Tenant",
                "slug": "novo-tenant",
                "plan": "basic",
                "admin_email": "admin@novotenant.com",
                "admin_password": "Admin@123456",
                "admin_name": "Admin Novo",
            },
            headers={**tenant_headers,
                     "Authorization": f"Bearer {admin_token}"})
        assert res.status_code in (200, 201)

    def test_create_tenant_producer_forbidden(
        self, client, producer_headers
    ):
        res = client.post("/api/v1/tenants/",
            json={"name": "X", "slug": "x", "plan": "basic",
                  "admin_email": "x@x.com", "admin_password": "X@123456",
                  "admin_name": "X"},
            headers=producer_headers)
        assert res.status_code == 403

    def test_list_tenants_admin(self, client, admin_token, tenant_headers):
        res = client.get("/api/v1/tenants/",
            headers={**tenant_headers,
                     "Authorization": f"Bearer {admin_token}"})
        assert res.status_code == 200

    def test_update_branding(self, client, producer_headers, db):
        from app.models.tenant import Tenant
        tenant = Tenant.query.filter_by(slug="test-platform").first()
        res = client.put(f"/api/v1/tenants/{tenant.id}/branding",
            json={"primary_color": "#DC2626", "platform_name": "Novo Nome"},
            headers=producer_headers)
        assert res.status_code == 200
        assert res.json["branding"]["primary_color"] == "#DC2626"