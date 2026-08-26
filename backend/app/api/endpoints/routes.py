from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.schemas.route import RouteCreate, RouteResponse
from app.services import route as route_service
from app.models.user import User
from app.api.deps import get_current_user

router = APIRouter()

@router.post("/", response_model=RouteResponse)
def create_route(
    route: RouteCreate, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    db_route, itineraries = route_service.create_user_route(db=db, route=route, user_id=current_user.id)
    response = RouteResponse.model_validate(db_route)
    return response.model_copy(update={"itineraries": itineraries})

@router.get("/", response_model=List[RouteResponse])
def read_user_routes(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return route_service.get_user_routes(db=db, user_id=current_user.id)