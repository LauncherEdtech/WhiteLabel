# api/tests/test_events.py
from uuid import uuid4


class TestEventsTrack:

    def test_track_single_event(self, client, student_headers):
        session_id = str(uuid4())
        res = client.post(
            "/api/v1/events/track",
            json={
                "events": [{
                    "event_type": "page_view",
                    "feature_name": "navigation",
                    "session_id": session_id,
                    "metadata": {"path": "/dashboard"},
                }]
            },
            headers=student_headers,
        )
        assert res.status_code == 202
        assert res.json["accepted"] == 1
        assert res.json["rejected"] == 0

    def test_track_batch(self, client, student_headers):
        session_id = str(uuid4())
        events = [
            {
                "event_type": "page_view",
                "feature_name": "navigation",
                "session_id": session_id,
                "metadata": {"path": f"/page-{i}"},
            }
            for i in range(10)
        ]
        res = client.post(
            "/api/v1/events/track",
            json={"events": events},
            headers=student_headers,
        )
        assert res.status_code == 202
        assert res.json["accepted"] == 10

    def test_unknown_event_type_rejected_silently(self, client, student_headers):
        session_id = str(uuid4())
        res = client.post(
            "/api/v1/events/track",
            json={
                "events": [
                    {"event_type": "page_view", "session_id": session_id},
                    {"event_type": "evento_que_nao_existe", "session_id": session_id},
                ]
            },
            headers=student_headers,
        )
        assert res.status_code == 202
        assert res.json["accepted"] == 1
        assert res.json["rejected"] == 1

    def test_unknown_feature_name_rejected(self, client, student_headers):
        session_id = str(uuid4())
        res = client.post(
            "/api/v1/events/track",
            json={
                "events": [{
                    "event_type": "page_view",
                    "feature_name": "feature_invalida",
                    "session_id": session_id,
                }]
            },
            headers=student_headers,
        )
        assert res.status_code == 202
        assert res.json["accepted"] == 0
        assert res.json["rejected"] == 1

    def test_oversized_metadata_rejected(self, client, student_headers):
        session_id = str(uuid4())
        big_payload = {"data": "x" * 3000}  # > 2 KB
        res = client.post(
            "/api/v1/events/track",
            json={
                "events": [{
                    "event_type": "page_view",
                    "session_id": session_id,
                    "metadata": big_payload,
                }]
            },
            headers=student_headers,
        )
        assert res.status_code == 202
        assert res.json["accepted"] == 0
        assert res.json["rejected"] == 1

    def test_track_requires_auth(self, client, tenant_headers):
        res = client.post(
            "/api/v1/events/track",
            json={"events": [{"event_type": "page_view", "session_id": str(uuid4())}]},
            headers=tenant_headers,
        )
        assert res.status_code == 401

    def test_empty_batch_rejected(self, client, student_headers):
        res = client.post(
            "/api/v1/events/track",
            json={"events": []},
            headers=student_headers,
        )
        assert res.status_code == 400

    def test_oversized_batch_rejected(self, client, student_headers):
        session_id = str(uuid4())
        events = [
            {"event_type": "page_view", "session_id": session_id}
            for _ in range(51)
        ]
        res = client.post(
            "/api/v1/events/track",
            json={"events": events},
            headers=student_headers,
        )
        assert res.status_code == 400

    def test_tenant_isolation_via_jwt(self, client, student_headers, db):
        """tenant_id vem do JWT, não do payload — não pode ser forjado."""
        from app.models.user_event import UserEvent

        session_id = str(uuid4())
        client.post(
            "/api/v1/events/track",
            json={
                "events": [{
                    "event_type": "page_view",
                    "feature_name": "navigation",
                    "session_id": session_id,
                }]
            },
            headers=student_headers,
        )

        events = UserEvent.query.filter_by(session_id=session_id).all()
        assert len(events) == 1
        assert events[0].tenant_id is not None
        assert events[0].user_id is not None


class TestEventsAdmin:

    def test_recent_events_super_admin_only(
        self, client, student_headers, admin_token, tenant_headers
    ):
        # Aluno não pode
        res = client.get("/api/v1/events/recent", headers=student_headers)
        assert res.status_code == 403

        # Super admin pode
        res = client.get(
            "/api/v1/events/recent",
            headers={**tenant_headers, "Authorization": f"Bearer {admin_token}"},
        )
        assert res.status_code == 200
        assert "events" in res.json

    def test_allowed_endpoint(self, client, student_headers):
        res = client.get("/api/v1/events/allowed", headers=student_headers)
        assert res.status_code == 200
        assert "page_view" in res.json["event_types"]
        assert "mentor" in res.json["feature_names"]
        assert res.json["max_batch_size"] == 50
        assert res.json["max_metadata_bytes"] == 2048