from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class WaypointBase(BaseModel):
    name: str
    category: str
    latitude: float
    longitude: float
    order_index: int

class WaypointCreate(WaypointBase):
    pass

class WaypointResponse(WaypointBase):
    id: int
    route_id: int

    class Config:
        from_attributes = True

class RouteBase(BaseModel):
    title: str
    city: str

class RouteCreate(RouteBase):
    waypoints: List[WaypointCreate]

class RouteResponse(RouteBase):
    id: int
    user_id: int
    created_at: datetime
    waypoints: List[WaypointResponse]

    class Config:
        from_attributes = True