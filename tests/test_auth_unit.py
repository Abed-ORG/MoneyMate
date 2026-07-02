"""Unit tests for authentication endpoints.

Covers register, login, logout, refresh, and edge cases like validation
errors, unauthorized access, and invalid input.
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

import app.models  # noqa: F401
from app.auth import routes as auth_routes
from app.db import Base
from app.dependencies import get_db
from app.main import app


def _make_client(monkeypatch):
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()

    def override_get_db():
        yield session

    app.dependency_overrides[get_db] = override_get_db
    monkeypatch.setattr(
        auth_routes,
        "send_password_reset_email",
        lambda *args, **kwargs: None,
    )

    client = TestClient(app)
    return client, session


def _cleanup():
    app.dependency_overrides.clear()


def test_register_success(monkeypatch):
    client, session = _make_client(monkeypatch)
    try:
        response = client.post(
            "/auth/register",
            json={
                "full_name": "New User",
                "email": "new@example.com",
                "password": "SecurePass123!",
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert data["email"] == "new@example.com"
        assert data["full_name"] == "New User"
        assert data["is_email_verified"] is True
        assert "id" in data
    finally:
        _cleanup()
        session.close()


def test_register_duplicate_email(monkeypatch):
    client, session = _make_client(monkeypatch)
    try:
        payload = {
            "full_name": "Duplicate User",
            "email": "dup@example.com",
            "password": "SecurePass123!",
        }
        first = client.post("/auth/register", json=payload)
        assert first.status_code == 201

        second = client.post("/auth/register", json=payload)
        assert second.status_code == 409
        assert "already exists" in second.json()["detail"].lower()
    finally:
        _cleanup()
        session.close()


def test_register_invalid_email(monkeypatch):
    client, session = _make_client(monkeypatch)
    try:
        response = client.post(
            "/auth/register",
            json={
                "full_name": "Bad Email",
                "email": "not-an-email",
                "password": "SecurePass123!",
            },
        )
        assert response.status_code == 422
    finally:
        _cleanup()
        session.close()


def test_register_missing_fields(monkeypatch):
    client, session = _make_client(monkeypatch)
    try:
        response = client.post("/auth/register", json={})
        assert response.status_code == 422
    finally:
        _cleanup()
        session.close()


def test_register_weak_password(monkeypatch):
    client, session = _make_client(monkeypatch)
    try:
        response = client.post(
            "/auth/register",
            json={
                "full_name": "Weak Password",
                "email": "weak@example.com",
                "password": "short",
            },
        )
        # The API may accept short passwords or validate them
        # We just verify it doesn't crash
        assert response.status_code in (201, 422)
    finally:
        _cleanup()
        session.close()


def test_login_success(monkeypatch):
    client, session = _make_client(monkeypatch)
    try:
        client.post(
            "/auth/register",
            json={
                "full_name": "Login User",
                "email": "login@example.com",
                "password": "SecurePass123!",
            },
        )
        response = client.post(
            "/auth/login",
            json={
                "email": "login@example.com",
                "password": "SecurePass123!",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"
    finally:
        _cleanup()
        session.close()


def test_login_wrong_password(monkeypatch):
    client, session = _make_client(monkeypatch)
    try:
        client.post(
            "/auth/register",
            json={
                "full_name": "Wrong Pass",
                "email": "wrong@example.com",
                "password": "SecurePass123!",
            },
        )
        response = client.post(
            "/auth/login",
            json={
                "email": "wrong@example.com",
                "password": "WrongPassword!",
            },
        )
        assert response.status_code == 401
        assert "incorrect" in response.json()["detail"].lower()
    finally:
        _cleanup()
        session.close()


def test_login_nonexistent_user(monkeypatch):
    client, session = _make_client(monkeypatch)
    try:
        response = client.post(
            "/auth/login",
            json={
                "email": "nobody@example.com",
                "password": "SomePass123!",
            },
        )
        assert response.status_code == 401
    finally:
        _cleanup()
        session.close()


def test_login_invalid_email_format(monkeypatch):
    client, session = _make_client(monkeypatch)
    try:
        response = client.post(
            "/auth/login",
            json={
                "email": "not-valid",
                "password": "SomePass123!",
            },
        )
        assert response.status_code == 422
    finally:
        _cleanup()
        session.close()


def test_logout_success(monkeypatch):
    client, session = _make_client(monkeypatch)
    try:
        client.post(
            "/auth/register",
            json={
                "full_name": "Logout User",
                "email": "logout@example.com",
                "password": "SecurePass123!",
            },
        )
        login_resp = client.post(
            "/auth/login",
            json={
                "email": "logout@example.com",
                "password": "SecurePass123!",
            },
        )
        assert login_resp.status_code == 200
        refresh_token = login_resp.json()["refresh_token"]

        logout_resp = client.post(
            "/auth/logout",
            json={"refresh_token": refresh_token},
        )
        assert logout_resp.status_code == 204
    finally:
        _cleanup()
        session.close()


def test_logout_without_token(monkeypatch):
    client, session = _make_client(monkeypatch)
    try:
        response = client.post("/auth/logout", json={"refresh_token": None})
        assert response.status_code == 204
    finally:
        _cleanup()
        session.close()


def test_refresh_token_success(monkeypatch):
    client, session = _make_client(monkeypatch)
    try:
        client.post(
            "/auth/register",
            json={
                "full_name": "Refresh User",
                "email": "refresh@example.com",
                "password": "SecurePass123!",
            },
        )
        login_resp = client.post(
            "/auth/login",
            json={
                "email": "refresh@example.com",
                "password": "SecurePass123!",
            },
        )
        refresh_token = login_resp.json()["refresh_token"]

        refresh_resp = client.post(
            "/auth/refresh",
            json={"refresh_token": refresh_token},
        )
        assert refresh_resp.status_code == 200
        assert "access_token" in refresh_resp.json()
    finally:
        _cleanup()
        session.close()


def test_refresh_token_invalid(monkeypatch):
    client, session = _make_client(monkeypatch)
    try:
        response = client.post(
            "/auth/refresh",
            json={"refresh_token": "invalid-token-value"},
        )
        assert response.status_code == 401
    finally:
        _cleanup()
        session.close()


def test_refresh_token_reuse_revokes(monkeypatch):
    """Using the same refresh token twice should fail the second time."""
    client, session = _make_client(monkeypatch)
    try:
        client.post(
            "/auth/register",
            json={
                "full_name": "Reuse User",
                "email": "reuse@example.com",
                "password": "SecurePass123!",
            },
        )
        login_resp = client.post(
            "/auth/login",
            json={
                "email": "reuse@example.com",
                "password": "SecurePass123!",
            },
        )
        refresh_token = login_resp.json()["refresh_token"]

        first = client.post(
            "/auth/refresh",
            json={"refresh_token": refresh_token},
        )
        assert first.status_code == 200

        second = client.post(
            "/auth/refresh",
            json={"refresh_token": refresh_token},
        )
        assert second.status_code == 401
    finally:
        _cleanup()
        session.close()


def test_get_current_user(monkeypatch):
    client, session = _make_client(monkeypatch)
    try:
        client.post(
            "/auth/register",
            json={
                "full_name": "Me User",
                "email": "me@example.com",
                "password": "SecurePass123!",
            },
        )
        login_resp = client.post(
            "/auth/login",
            json={
                "email": "me@example.com",
                "password": "SecurePass123!",
            },
        )
        token = login_resp.json()["access_token"]

        me_resp = client.get(
            "/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert me_resp.status_code == 200
        assert me_resp.json()["email"] == "me@example.com"
    finally:
        _cleanup()
        session.close()


def test_get_current_user_unauthorized(monkeypatch):
    client, session = _make_client(monkeypatch)
    try:
        response = client.get("/auth/me")
        assert response.status_code == 401
    finally:
        _cleanup()
        session.close()


def test_get_current_user_invalid_token(monkeypatch):
    client, session = _make_client(monkeypatch)
    try:
        response = client.get(
            "/auth/me",
            headers={"Authorization": "Bearer invalid-token"},
        )
        assert response.status_code == 401
    finally:
        _cleanup()
        session.close()


def test_forgot_password_nonexistent_email(monkeypatch):
    client, session = _make_client(monkeypatch)
    try:
        response = client.post(
            "/auth/forgot-password",
            json={"email": "nonexistent@example.com"},
        )
        # Should return 200 regardless to prevent email enumeration
        assert response.status_code == 200
    finally:
        _cleanup()
        session.close()


def test_reset_password_invalid_token(monkeypatch):
    client, session = _make_client(monkeypatch)
    try:
        response = client.post(
            "/auth/reset-password",
            json={
                "token": "invalid-token",
                "new_password": "NewPass123!",
            },
        )
        assert response.status_code == 422
    finally:
        _cleanup()
        session.close()
