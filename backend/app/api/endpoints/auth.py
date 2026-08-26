from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import verify_password, create_access_token
from app.api.deps import get_current_user
from app.services.user import get_user_by_email, get_user_by_name, password_is_used, create_user
from app.schemas.auth import LoginRequest, RegisterRequest, AuthResponse
from app.schemas.user import UserCreate, UserResponse
from app.models.user import User

router = APIRouter()


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def register(body: RegisterRequest, db: Session = Depends(get_db)) -> AuthResponse:
    """Register a new user and return an access token."""
    if get_user_by_email(db, email=body.email) or get_user_by_name(db, name=body.name):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="That name or email is already in use.",
        )
    if password_is_used(db, body.password):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="That password is already in use. Choose a different password.",
        )

    user_in = UserCreate(name=body.name.strip(), email=body.email.lower(), password=body.password)
    try:
        user = create_user(db=db, user=user_in)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="That name or email is already in use.",
        ) from None
    token = create_access_token(subject=user.id)

    return AuthResponse(
        access_token=token,
        user=UserResponse.model_validate(user),
    )


@router.post("/login", response_model=AuthResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)) -> AuthResponse:
    """Authenticate a user and return an access token."""
    identifier = body.identifier.strip()
    user = get_user_by_email(db, email=identifier) if "@" in identifier else get_user_by_name(db, name=identifier)
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
        )

    token = create_access_token(subject=user.id)

    return AuthResponse(
        access_token=token,
        user=UserResponse.model_validate(user),
    )


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)) -> UserResponse:
    """Return the currently authenticated user."""
    return UserResponse.model_validate(current_user)