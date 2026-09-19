"""
Forgot Password — real email sending via SMTP (stdlib smtplib, no
third-party email SDK required - works with any standard SMTP provider:
Gmail SMTP, SendGrid SMTP relay, Mailgun, AWS SES SMTP, Mailtrap,
Postmark, your own mail server, etc).

Required environment variables (see .env.example):
    SMTP_HOST
    SMTP_PORT
    SMTP_USERNAME
    SMTP_PASSWORD
    SMTP_FROM_EMAIL
    SMTP_USE_TLS        ("true"/"false", default "true")
    FRONTEND_URL         (used to build the reset link, e.g. http://localhost:3000)

This module NEVER logs the raw token, password, or SMTP credentials.
"""
import os
import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("aeos_backend.email")

SMTP_HOST = os.getenv("SMTP_HOST")
SMTP_PORT = os.getenv("SMTP_PORT")
SMTP_USERNAME = os.getenv("SMTP_USERNAME")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
SMTP_FROM_EMAIL = os.getenv("SMTP_FROM_EMAIL")
SMTP_USE_TLS = os.getenv("SMTP_USE_TLS", "true").lower() == "true"
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

REQUIRED_SMTP_VARS = [
    "SMTP_HOST", "SMTP_PORT", "SMTP_USERNAME", "SMTP_PASSWORD", "SMTP_FROM_EMAIL",
]


class EmailConfigError(Exception):
    """Raised when required SMTP environment variables are missing."""
    pass


class EmailSendError(Exception):
    """Raised when the SMTP server rejects the message or the connection fails."""
    pass


def _missing_smtp_vars() -> list[str]:
    values = {
        "SMTP_HOST": SMTP_HOST,
        "SMTP_PORT": SMTP_PORT,
        "SMTP_USERNAME": SMTP_USERNAME,
        "SMTP_PASSWORD": SMTP_PASSWORD,
        "SMTP_FROM_EMAIL": SMTP_FROM_EMAIL,
    }
    return [name for name, value in values.items() if not value]


def build_reset_url(raw_token: str) -> str:
    return f"{FRONTEND_URL.rstrip('/')}/reset-password?token={raw_token}"


def send_password_reset_email(to_email: str, reset_url: str) -> None:
    """
    Sends the password reset email over real SMTP.

    Raises:
        EmailConfigError: required SMTP_* env vars are missing.
        EmailSendError: the SMTP server rejected the message, or the
            connection/authentication failed.

    Never raises silently and never fabricates success - callers must
    treat any exception here as "the email was not delivered."
    """
    missing = _missing_smtp_vars()
    if missing:
        logger.error(
            "Password reset email NOT sent: missing required SMTP environment "
            "variables: %s", ", ".join(missing)
        )
        raise EmailConfigError(
            f"Email service is not configured. Missing environment variables: {', '.join(missing)}"
        )

    masked_recipient = _mask_email(to_email)

    message = MIMEMultipart("alternative")
    message["Subject"] = "Reset your AEOS password"
    message["From"] = SMTP_FROM_EMAIL
    message["To"] = to_email

    text_body = (
        "We received a request to reset your AEOS password.\n\n"
        f"Reset your password using this link (valid for a limited time):\n{reset_url}\n\n"
        "If you did not request this, you can safely ignore this email."
    )
    html_body = f"""
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2>Reset your AEOS password</h2>
      <p>We received a request to reset your AEOS password.</p>
      <p>
        <a href="{reset_url}" style="background:#4f46e5;color:#fff;padding:10px 20px;
           border-radius:6px;text-decoration:none;display:inline-block;">
          Reset Password
        </a>
      </p>
      <p>Or copy and paste this link into your browser:<br>
        <span style="word-break:break-all;">{reset_url}</span>
      </p>
      <p style="color:#666;font-size:13px;">
        This link will expire soon. If you did not request this, you can safely ignore this email.
      </p>
    </div>
    """

    message.attach(MIMEText(text_body, "plain"))
    message.attach(MIMEText(html_body, "html"))

    try:
        port = int(SMTP_PORT)
        with smtplib.SMTP(SMTP_HOST, port, timeout=10) as server:
            if SMTP_USE_TLS:
                server.starttls()
            server.login(SMTP_USERNAME, SMTP_PASSWORD)
            server.sendmail(SMTP_FROM_EMAIL, [to_email], message.as_string())
        logger.info("Password reset email sent successfully to %s", masked_recipient)
    except (smtplib.SMTPException, OSError, ValueError) as e:
        # Log the failure type/reason, but never the token, password, or SMTP credentials.
        logger.error(
            "Password reset email FAILED to send to %s: %s: %s",
            masked_recipient, type(e).__name__, str(e)
        )
        raise EmailSendError(f"Failed to send email: {type(e).__name__}") from e


def _mask_email(email: str) -> str:
    """user@example.com -> u***@example.com, for safe logging."""
    try:
        local, domain = email.split("@", 1)
        if len(local) <= 1:
            masked_local = "*"
        else:
            masked_local = local[0] + "***"
        return f"{masked_local}@{domain}"
    except ValueError:
        return "***"
