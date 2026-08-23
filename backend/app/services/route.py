from sqlalchemy.orm import Session
from typing import List
from app.models.route import Route, Waypoint
from app.schemas.route import RouteCreate

def create_user_route(db: Session, route: RouteCreate, user_id: int) -> Route:
    db_route = Route(
        title=route.title,
        city=route.city,
        user_id=user_id
    )
    db.add(db_route)
    db.commit()
    db.refresh(db_route)

    waypoints_data = []
    for wp in route.waypoints:
        db_waypoint = Waypoint(
            route_id=db_route.id,
            name=wp.name,
            category=wp.category,
            latitude=wp.latitude,
            longitude=wp.longitude,
            order_index=wp.order_index
        )
        waypoints_data.append(db_waypoint)
    
    db.add_all(waypoints_data)
    db.commit()
    db.refresh(db_route)
    
    return db_route

def get_user_routes(db: Session, user_id: int) -> List[Route]:
    return db.query(Route).filter(Route.user_id == user_id).all()