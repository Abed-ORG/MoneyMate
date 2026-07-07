import logging
import os
import smtplib
import ssl
from email.message import EmailMessage
from html import escape
from typing import Protocol
from urllib.parse import quote

logger = logging.getLogger(__name__)


class EmailConfigurationError(Exception):
    pass


class EmailDeliveryError(Exception):
    pass


class SupportsEmailUser(Protocol):
    email: str
    full_name: str


def get_required_setting(*names: str) -> str:
    for name in names:
        value = os.getenv(name, "").strip()
        if value:
            return value
    joined_names = " or ".join(names)
    raise EmailConfigurationError(
        f"{joined_names} must be configured before emails can be sent."
    )


def _env_flag(name: str, default: bool = False) -> bool:
    value = os.getenv(name, "").strip().lower()
    if not value:
        return default
    return value in {"1", "true", "yes", "on"}


def _password_reset_expire_minutes() -> int:
    return int(os.getenv("PASSWORD_RESET_TOKEN_EXPIRE_MINUTES") or "30")


def _frontend_url(path: str, token: str) -> str:
    frontend_url = os.getenv(
        "FRONTEND_URL",
        "http://localhost:5173",
    ).rstrip("/")
    return f"{frontend_url}{path}?token={quote(token, safe='')}"


def _format_duration(minutes: int) -> str:
    if minutes >= 60 and minutes % 60 == 0:
        hours = minutes // 60
        return f"{hours} hour" if hours == 1 else f"{hours} hours"
    return f"{minutes} minute" if minutes == 1 else f"{minutes} minutes"


def _send_with_resend(
    recipient: str,
    subject: str,
    text: str,
    html: str,
) -> None:
    try:
        import resend
    except ImportError as exc:
        raise EmailConfigurationError(
            "The resend package is not installed. "
            "Install backend requirements."
        ) from exc

    resend.api_key = get_required_setting("RESEND_API_KEY")
    from_address = get_required_setting("EMAIL_FROM_ADDRESS")
    from_name = os.getenv("EMAIL_FROM_NAME", "MoneyMate").strip()

    try:
        resend.Emails.send(
            {
                "from": f"{from_name} <{from_address}>",
                "to": [recipient],
                "subject": subject,
                "text": text,
                "html": html,
            }
        )
    except Exception as exc:
        logger.exception("Resend API send failed to %s", recipient)
        raise EmailDeliveryError(
            "MoneyMate could not send the email. Please try again."
        ) from exc


def _send_with_smtp(
    recipient: str,
    subject: str,
    text: str,
    html: str,
) -> None:
    smtp_host = get_required_setting("SMTP_HOST", "EMAIL_HOST")
    smtp_username = get_required_setting("SMTP_USERNAME", "EMAIL_USER")
    smtp_password = get_required_setting("SMTP_PASSWORD", "EMAIL_PASSWORD")
    from_email = (
        os.getenv("EMAIL_FROM_ADDRESS")
        or smtp_username
    ).strip()
    from_name = (
        os.getenv("EMAIL_FROM_NAME")
        or "MoneyMate"
    ).strip()
    smtp_port = int(
        os.getenv("SMTP_PORT") or os.getenv("EMAIL_PORT") or "587"
    )
    use_ssl = _env_flag("SMTP_USE_SSL")
    use_tls = _env_flag("SMTP_USE_TLS", default=not use_ssl)
    timeout_seconds = int(os.getenv("SMTP_TIMEOUT_SECONDS") or "20")

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = f"{from_name} <{from_email}>"
    message["To"] = recipient
    message.set_content(text)
    message.add_alternative(html, subtype="html")

    try:
        smtp_client = smtplib.SMTP_SSL if use_ssl else smtplib.SMTP
        with smtp_client(
            smtp_host,
            smtp_port,
            timeout=timeout_seconds,
        ) as server:
            server.ehlo()
            if use_tls:
                server.starttls(context=ssl.create_default_context())
                server.ehlo()
            server.login(smtp_username, smtp_password)
            server.send_message(message)
    except (OSError, smtplib.SMTPException) as exc:
        logger.exception(
            "SMTP send failed: host=%s port=%s user=%s tls=%s ssl=%s",
            smtp_host,
            smtp_port,
            smtp_username,
            use_tls,
            use_ssl,
        )
        raise EmailDeliveryError(
            "MoneyMate could not send the email. Please try again."
        ) from exc


def _send_email(
    recipient: str,
    subject: str,
    text: str,
    html: str,
) -> None:
    configured_provider = os.getenv("EMAIL_PROVIDER", "").strip().lower()
    if configured_provider:
        provider = configured_provider
    elif os.getenv("RESEND_API_KEY", "").strip():
        provider = "resend"
    else:
        provider = "smtp"

    if provider == "resend":
        _send_with_resend(recipient, subject, text, html)
        return
    if provider in {"smtp", "gmail"}:
        _send_with_smtp(recipient, subject, text, html)
        return
    raise EmailConfigurationError(
        "EMAIL_PROVIDER must be set to 'resend' or 'smtp'."
    )


def _email_html(
    greeting_name: str,
    heading: str,
    description: str,
    action_label: str,
    action_url: str,
    expiry_text: str,
) -> str:
    safe_name = escape(greeting_name)
    safe_url = escape(action_url)
    return "\n".join(
        [
            "<html>",
            '<body style="margin:0;background:#00100d;padding:32px;'
            'font-family:Arial,sans-serif;color:#eaf7ef">',
            '<div style="max-width:560px;margin:auto;'
            'border:1px solid #166534;'
            'border-radius:18px;background:#001b14;padding:32px">',
            '<p style="margin:0 0 24px;color:#49c5b6;font-weight:700">'
            "MoneyMate</p>",
            (
                '<h1 style="margin:0 0 16px;color:#ffffff">'
                f"{escape(heading)}</h1>"
            ),
            f"<p>Hello {safe_name},</p>",
            (
                '<p style="color:#b9cbc1;line-height:1.6">'
                f"{escape(description)}</p>"
            ),
            '<p style="margin:28px 0">',
            (
                f'<a href="{safe_url}" '
                'style="display:inline-block;background:#49c5b6;'
                'color:#00100d;padding:13px 22px;border-radius:10px;'
                'text-decoration:none;font-weight:800">'
                f"{escape(action_label)}"
                "</a>"
            ),
            "</p>",
            (
                '<p style="color:#8da79a;font-size:13px">'
                f"{escape(expiry_text)}</p>"
            ),
            (
                '<p style="color:#8da79a;font-size:13px">If the button does '
                "not work, "
            ),
            f"open this link:<br>{safe_url}</p>",
            "</div>",
            "</body>",
            "</html>",
        ]
    )


def send_password_reset_email(user: SupportsEmailUser, token: str) -> None:
    reset_url = _frontend_url("/reset-password", token)
    duration = _format_duration(_password_reset_expire_minutes())
    text = (
        f"Hello {user.full_name},\n\n"
        "A password reset was requested for your MoneyMate account. "
        "Open this link to choose a new password:\n"
        f"{reset_url}\n\n"
        f"This link expires in {duration}. If you did not request a reset, "
        "you can ignore this email."
    )
    html = _email_html(
        user.full_name,
        "Reset your MoneyMate password",
        (
            "Use the secure link below to choose a new password for "
            "your account."
        ),
        "Reset my password",
        reset_url,
        f"This single-use link expires in {duration}.",
    )
    _send_email(
        user.email,
        "Reset your MoneyMate password",
        text,
        html,
    )


def send_test_email(recipient: str) -> None:
    text = (
        "This is a MoneyMate email configuration test.\n\n"
        "If you received this message, the configured email provider is "
        "working."
    )
    html = _email_html(
        "there",
        "MoneyMate email test",
        "This message confirms that MoneyMate can send email with the current configuration.",
        "Open MoneyMate",
        os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/"),
        "No action is required.",
    )
    _send_email(
        recipient,
        "MoneyMate email test",
        text,
        html,
    )
