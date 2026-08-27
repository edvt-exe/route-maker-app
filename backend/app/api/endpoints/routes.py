from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.schemas.route import RouteCreate, RouteResponse, SavedRouteCreate, SavedRouteResponse
from app.services import route as route_service
from app.models.route import SavedRoute
from app.models.user import User
from app.api.deps import get_current_user

router = APIRouter()


@router.post("/save", response_model=SavedRouteResponse, status_code=status.HTTP_201_CREATED)
def save_route(
    saved_route: SavedRouteCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SavedRoute:
    record = SavedRoute(
        user_id=current_user.id,
        title=saved_route.title,
        city=saved_route.city,
        payload=saved_route.payload,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.get("/me", response_model=List[SavedRouteResponse])
def read_saved_routes(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> List[SavedRoute]:
    return db.query(SavedRoute).filter(SavedRoute.user_id == current_user.id).order_by(SavedRoute.created_at.desc()).all()


@router.get("/{route_id}", response_model=SavedRouteResponse)
def read_saved_route(
    route_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SavedRoute:
    record = db.query(SavedRoute).filter(SavedRoute.id == route_id, SavedRoute.user_id == current_user.id).first()
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Saved route not found.")
    return record

@router.post("/", response_model=RouteResponse)
def create_route(
    route: RouteCreate, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    db_route, itineraries = route_service.create_user_route(db=db, route=route, user_id=current_user.id)
    response = RouteResponse.model_validate(db_route)
    return response.model_copy(update={"itineraries": itineraries, "navigation_url": route_service.build_navigation_url(itineraries, route.preferences.transport), "initial_budget": route.preferences.budget})

@router.get("/", response_model=List[RouteResponse])
def read_user_routes(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return route_service.get_user_routes(db=db, user_id=current_user.id)