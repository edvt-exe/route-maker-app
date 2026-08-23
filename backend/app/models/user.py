from sqlalchemy import Column, Integer, String, Float, Boolean
from sqlalchemy.orm import relationship
from app.core.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    walking_speed_kmh = Column(Float, default=4.5) 
    is_active = Column(Boolean, default=True)

    routes = relationship("Route", back_populates="user", cascade="all, delete-orphan")