from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
import hashlib
import logging
import secrets
import smtplib
from uuid import uuid4

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.user import AuthChallenge, User

logger = logging.getLogger(__name__)


def create_challenge(db: Session, user: User) -> tuple[AuthChallenge, str]:
    code = f"{secrets.randbelow(1_000_000):06d}"
    challenge = AuthChallenge(
        id=str(uuid4()),
        user_id=user.id,
        code_hash=hashlib.sha256(code.encode("ascii")).hexdigest(),
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=settings.OTP_EXPIRE_MINUTES),
    )
    db.add(challenge)
    db.commit()
    db.refresh(challenge)
    return challenge, code


def send_otp_email(user: User, code: str) -> None:
    if settings.OTP_DELIVERY_MODE == "console":
        logger.warning("OTP for %s (local development only): %s", user.email, code)
        return
    if not settings.SMTP_HOST:
        raise RuntimeError("Configure SMTP_HOST or set OTP_DELIVERY_MODE=console for local development.")

    message = EmailMessage()
    message["Subject"] = "Your Route Maker verification code"
    message["From"] = settings.SMTP_FROM_EMAIL
    message["To"] = user.email
    message.set_content(
        f"Your verification code is {code}. It expires in {settings.OTP_EXPIRE_MINUTES} minutes."
    )
    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as smtp:
            if settings.SMTP_USE_TLS:
                smtp.starttls()
            if settings.SMTP_USERNAME and settings.SMTP_PASSWORD:
                smtp.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
            smtp.send_message(message)
    except OSError as error:
        raise RuntimeError("The verification email could not be sent.") from error


def verify_challenge(db: Session, challenge_id: str, code: str) -> User | None:
    challenge = db.get(AuthChallenge, challenge_id)
    now = datetime.now(timezone.utc)
    expires_at = challenge.expires_at.replace(tzinfo=timezone.utc) if challenge and challenge.expires_at.tzinfo is None else challenge.expires_at if challenge else None
    if not challenge or challenge.used or expires_at < now:
        return None
    if challenge.attempts >= settings.OTP_MAX_ATTEMPTS:
        return None

    challenge.attempts += 1
    if not secrets.compare_digest(
        challenge.code_hash, hashlib.sha256(code.encode("ascii")).hexdigest()
    ):
        db.commit()
        return None

    challenge.used = True
    db.commit()
    return db.get(User, challenge.user_id)