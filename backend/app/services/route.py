from sqlalchemy.orm import Session
from typing import List
from urllib.parse import urlencode
from app.models.route import Route, Waypoint
from app.schemas.route import DailyItinerary, RouteCreate
from app.services.itinerary import flatten_itineraries, generate_itineraries


def build_navigation_url(itineraries: list[DailyItinerary], transport: str) -> str | None:
    """Build a Google Maps universal directions URL in itinerary order."""
    waypoints = flatten_itineraries(itineraries)
    if len(waypoints) < 2:
        return None

    coordinates = [f"{waypoint.latitude:.6f},{waypoint.longitude:.6f}" for waypoint in waypoints]
    params = {
        "api": "1",
        "origin": coordinates[0],
        "destination": coordinates[-1],
        "travelmode": {"walking": "walking", "public transport": "transit", "by car": "driving"}.get(transport, "walking"),
    }
    if len(coordinates) > 2:
        params["waypoints"] = "|".join(coordinates[1:-1])
    return f"https://www.google.com/maps/dir/?{urlencode(params)}"

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