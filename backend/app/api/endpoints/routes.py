from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.schemas.route import RouteCreate, RouteResponse
from app.services import route as route_service

router = APIRouter()

@router.post("/", response_model=RouteResponse)
def create_route(
    route: RouteCreate, 
    user_id: int, 
    db: Session = Depends(get_db)
):
    """
    Creates a new route with multiple waypoints for a specific user.
    """
    return route_service.create_user_route(db=db, route=route, user_id=user_id)

@router.get("/", response_model=List[RouteResponse])
def read_user_routes(
    user_id: int, 
    db: Session = Depends(get_db)
):
    """
    Retrieves all routes created by a specific user.
    """
    return route_service.get_user_routes(db=db, user_id=user_id)