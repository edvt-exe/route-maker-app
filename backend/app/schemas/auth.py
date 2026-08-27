from pydantic import BaseModel, EmailStr, Field, field_validator

from app.schemas.user import UserResponse


class LoginRequest(BaseModel):
    identifier: str = Field(min_length=2)
    password: str


class RegisterRequest(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(min_length=8)

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        value = value.strip()
        if len(value) < 2:
            raise ValueError("Name must contain at least 2 characters.")
        return value

    @field_validator("email")
    @classmethod
    def reject_disposable_email(cls, value: EmailStr) -> EmailStr:
        disposable_domains = {
            "10minutemail.com", "guerrillamail.com", "mailinator.com", "sharklasers.com",
            "tempmail.com", "temp-mail.org", "yopmail.com", "getnada.com", "throwaway.email",
        }
        domain = str(value).rsplit("@", 1)[-1].lower().rstrip(".")
        if domain in disposable_domains:
            raise ValueError("Temporary or disposable email addresses are not allowed.")
        return value

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        if len(value.encode("utf-8")) > 72:
            raise ValueError("Password cannot be longer than 72 bytes.")
        requirements = (
            (any(character.islower() for character in value), "a lowercase letter"),
            (any(character.isupper() for character in value), "an uppercase letter"),
            (any(character.isdigit() for character in value), "a number"),
            (any(not character.isalnum() for character in value), "a special character"),
        )
        missing = [label for passed, label in requirements if not passed]
        if missing:
            raise ValueError(f"Password must contain {', '.join(missing)}.")
        return value


class AuthResponse(BaseModel):
    access_token: str | None = None
    token_type: str = "bearer"
    user: UserResponse
    requires_2fa: bool = True
    challenge_id: str | None = None


class VerifyOTPRequest(BaseModel):
    challenge_id: str = Field(min_length=36, max_length=36)
    code: str = Field(pattern=r"^\d{6}$")
