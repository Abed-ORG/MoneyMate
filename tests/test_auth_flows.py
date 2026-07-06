from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

import app.models  # noqa: F401
from app.auth import routes as auth_routes
from app.auth.services import (
    create_user,
    issue_password_reset_token,
    reset_user_password,
)
from app.auth.utils import verify_password
from app.db import Base
from app.dependencies import get_db
from app.main import app
from app.schemas.user import UserCreate


def test_new_users_are_verified_and_password_reset_tokens_are_single_use():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()

    user = create_user(
        session,
        UserCreate(
            full_name="Test User",
            email="test@example.com",
            password="old-password",
        ),
    )

    assert user.is_email_verified is True
    assert user.email_verified_at is not None
    assert user.email_verification_token_hash is None
    assert user.email_verification_expires_at is None

    reset_token = issue_password_reset_token(session, user)
    assert (
        reset_user_password(session, reset_token, "new-password") is not None
    )
    assert (
        reset_user_password(session, reset_token, "another-password") is None
    )
    assert verify_password("new-password", user.hashed_password)

    session.close()


def test_auth_endpoints_create_verified_account_and_support_password_reset(
    monkeypatch,
):
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    test_session = sessionmaker(bind=engine)()
    sent_tokens = {}

    def override_get_db():
        yield test_session

    def capture_reset(user, token):
        sent_tokens["reset"] = token

    app.dependency_overrides[get_db] = override_get_db
    monkeypatch.setattr(
        auth_routes,
        "send_password_reset_email",
        capture_reset,
    )

    try:
        client = TestClient(app)
        credentials = {
            "email": "endpoint@example.com",
            "password": "old-password",
        }
        registration = client.post(
            "/auth/register",
            json={**credentials, "full_name": "Endpoint User"},
        )
        assert registration.status_code == 201
        assert registration.json()["is_email_verified"] is True

        login = client.post("/auth/login", json=credentials)
        assert login.status_code == 200
        assert login.json()["access_token"]

        forgot = client.post(
            "/auth/forgot-password",
            json={"email": credentials["email"]},
        )
        assert forgot.status_code == 200

        reset = client.post(
            "/auth/reset-password",
            json={
                "token": sent_tokens["reset"],
                "new_password": "new-password",
            },
        )
        assert reset.status_code == 200

        old_login = client.post("/auth/login", json=credentials)
        assert old_login.status_code == 401
        new_login = client.post(
            "/auth/login",
            json={
                "email": credentials["email"],
                "password": "new-password",
            },
        )
        assert new_login.status_code == 200
    finally:
        app.dependency_overrides.clear()
        test_session.close()


def test_authenticated_user_can_delete_account():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    test_session = sessionmaker(bind=engine)()

    def override_get_db():
        yield test_session

    app.dependency_overrides[get_db] = override_get_db

    try:
        client = TestClient(app)
        credentials = {
            "email": "delete-me@example.com",
            "password": "delete-password",
        }
        registration = client.post(
            "/auth/register",
            json={**credentials, "full_name": "Delete Me"},
        )
        assert registration.status_code == 201

        login = client.post("/auth/login", json=credentials)
        assert login.status_code == 200
        headers = {
            "Authorization": f"Bearer {login.json()['access_token']}",
        }

        response = client.delete("/profile/account", headers=headers)
        assert response.status_code == 204

        deleted_login = client.post("/auth/login", json=credentials)
        assert deleted_login.status_code == 401
    finally:
        app.dependency_overrides.clear()
        test_session.close()
