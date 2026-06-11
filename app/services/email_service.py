import os
import smtplib
from email.message import EmailMessage
from html import escape

from app.auth.utils import create_email_verification_token
from app.models.user import User


class EmailConfigurationError(Exception):
    pass


class EmailDeliveryError(Exception):
    pass


def get_required_setting(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise EmailConfigurationError(
            f"{name} is required before verification emails can be sent."
        )
    return value


def send_verification_email(user: User) -> None:
    smtp_host = get_required_setting("SMTP_HOST")
    smtp_username = get_required_setting("SMTP_USERNAME")
    smtp_password = get_required_setting("SMTP_PASSWORD")
    from_email = os.getenv("SMTP_FROM_EMAIL", smtp_username).strip()
    from_name = os.getenv("SMTP_FROM_NAME", "MoneyMate").strip()
    frontend_url = (
        os.getenv("FRONTEND_URL", "http://127.0.0.1:5173").rstrip("/")
    )
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    use_tls = os.getenv("SMTP_USE_TLS", "true").lower() in {"1", "true", "yes"}

    token = create_email_verification_token(user.id, user.email)
    verification_url = f"{frontend_url}/verify-email?token={token}"

    message = EmailMessage()
    message["Subject"] = "Verify your MoneyMate account"
    message["From"] = f"{from_name} <{from_email}>"
    message["To"] = user.email
    message_text = (
        "Welcome to MoneyMate.\n\n"
        "Verify your email address by opening this link:\n"
        f"{verification_url}\n\n"
        "This link expires in 24 hours. If you did not create this account, "
        "you can ignore this email."
    )
    message.set_content(message_text)
    style_value = (
        "display:inline-block;"
        "background:#064e3b;"
        "color:#fff;"
        "padding:12px 20px;"
        "border-radius:8px;"
        "text-decoration:none"
    )

    anchor = (
        f'      <a href="{escape(verification_url)}" '
        f'style="{style_value}">'
    )

    html_lines = [
        "<html>",
        '  <body style="font-family:Arial,sans-serif;color:#022c22">',
        "    <h1>Welcome to MoneyMate</h1>",
        f"    <p>Hello {escape(user.full_name)},</p>",
        "    <p>Confirm your email address to finish creating your ",
        "account.</p>",
        "    <p>",
        anchor,
        "        Verify my email",
        "      </a>",
        "    </p>",
        "    <p>This link expires in 24 hours.</p>",
        "  </body>",
        "</html>",
    ]

    message.add_alternative(
        "\n".join(html_lines),
        subtype="html",
    )

    try:
        with smtplib.SMTP(smtp_host, smtp_port, timeout=20) as server:
            if use_tls:
                server.starttls()
            server.login(smtp_username, smtp_password)
            server.send_message(message)
    except (OSError, smtplib.SMTPException) as exc:
        raise EmailDeliveryError(
            "MoneyMate could not send the verification email. "
            "Please try again."
        ) from exc
