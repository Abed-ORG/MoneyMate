import os

os.environ.setdefault("SECRET_KEY", "test-secret")

from app.services import email_service  # noqa: E402


class DummySMTP:
    def __init__(self, host, port, timeout):
        self.host = host
        self.port = port
        self.timeout = timeout
        self.ehlo_calls = 0
        self.starttls_calls = 0
        self.logged_in_as = None
        self.message = None

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def ehlo(self):
        self.ehlo_calls += 1

    def starttls(self, context=None):
        self.starttls_calls += 1
        assert context is not None

    def login(self, username, password):
        self.logged_in_as = (username, password)

    def send_message(self, message):
        self.message = message


def test_smtp_email_uses_starttls_and_sends_message(monkeypatch):
    captured = {}

    def smtp_factory(host, port, timeout):
        client = DummySMTP(host, port, timeout)
        captured["client"] = client
        return client

    monkeypatch.setenv("SMTP_HOST", "smtp.gmail.com")
    monkeypatch.setenv("SMTP_PORT", "587")
    monkeypatch.setenv("SMTP_USERNAME", "moneymate@gmail.com")
    monkeypatch.setenv("SMTP_PASSWORD", "app-password")
    monkeypatch.setenv("EMAIL_FROM_ADDRESS", "moneymate@gmail.com")
    monkeypatch.setenv("EMAIL_FROM_NAME", "MoneyMate")
    monkeypatch.setenv("SMTP_USE_TLS", "true")
    monkeypatch.setenv("SMTP_USE_SSL", "false")
    monkeypatch.setattr(email_service.smtplib, "SMTP", smtp_factory)

    email_service._send_with_smtp(
        "user@example.com",
        "Test subject",
        "Plain text body",
        "<p>HTML body</p>",
    )

    client = captured["client"]
    assert client.host == "smtp.gmail.com"
    assert client.port == 587
    assert client.timeout == 20
    assert client.ehlo_calls == 2
    assert client.starttls_calls == 1
    assert client.logged_in_as == ("moneymate@gmail.com", "app-password")
    assert client.message["To"] == "user@example.com"
    assert client.message["Subject"] == "Test subject"
