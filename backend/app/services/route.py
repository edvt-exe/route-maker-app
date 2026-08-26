from sqlalchemy.orm import Session
from typing import List
from app.models.route import Route, Waypoint
from app.schemas.route import RouteCreate
from app.services.itinerary import flatten_itineraries, generate_itineraries

def create_user_route(db: Session, route: RouteCreate, user_id: int):
    itineraries = generate_itineraries(route)
    generated_waypoints = flatten_itineraries(itineraries)
    db_route = Route(
        title=route.title,
        city=route.city,
        user_id=user_id
    )
    db.add(db_route)
    db.commit()
    db.refresh(db_route)

    waypoints_data = []
    for wp in generated_waypoints:
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
    
    return db_route, itineraries

def get_user_routes(db: Session, user_id: int) -> List[Route]:
    return db.query(Route).filter(Route.user_id == user_id).all()