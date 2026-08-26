from sqlalchemy import func
from sqlalchemy.orm import Session
from app.models.user import User
from app.schemas.user import UserCreate
from app.core.security import get_password_hash, verify_password


def get_user_by_email(db: Session, email: str) -> User | None:
    return db.query(User).filter(func.lower(User.email) == email.lower()).first()


def get_user_by_name(db: Session, name: str) -> User | None:
    return db.query(User).filter(func.lower(User.name) == name.lower()).first()


def password_is_used(db: Session, password: str) -> bool:
    return any(verify_password(password, user.hashed_password) for user in db.query(User).all())


def get_user_by_id(db: Session, user_id: int) -> User | None:
    return db.query(User).filter(User.id == user_id).first()


def create_user(db: Session, user: UserCreate) -> User:
    db_user = User(
        name=user.name,
        email=user.email,
        hashed_password=get_password_hash(user.password),
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user