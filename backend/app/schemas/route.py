from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, time

class WaypointBase(BaseModel):
    name: str
    category: str
    latitude: float
    longitude: float
    order_index: int

class WaypointCreate(WaypointBase):
    pass

class PointOfInterest(BaseModel):
    name: str
    city: Optional[str] = None
    category: str
    latitude: float
    longitude: float
    cost: float = Field(default=0, ge=0)
    duration_minutes: int = Field(default=90, ge=15, le=360)
    rating: float = Field(default=0, ge=0, le=5)
    tags: List[str] = Field(default_factory=list)
    near_transit: bool = False
    transit_wait_minutes: int = Field(default=15, ge=0, le=120)
    is_premium: bool = False
    required: bool = False

class LocationInput(BaseModel):
    name: str
    latitude: float
    longitude: float

class DailyPlanInput(BaseModel):
    day: int = Field(ge=1)
    start: LocationInput
    final_destination: LocationInput

class RoutePreferences(BaseModel):
    trip_type: str = "City break"
    pacing_tags: List[str] = Field(default_factory=list)
    transport: str = "walking"
    budget: str = "$50 - $150"
    categories: List[str] = Field(default_factory=list)
    hours_per_day: float = Field(default=8, gt=0, le=24)
    start_time: time = time(9, 0)
    end_time: time = time(17, 0)
    meals_per_day: int = Field(default=1, ge=0, le=4)
    start_buffer_minutes: int = Field(default=60, ge=0, le=240)
    end_buffer_minutes: int = Field(default=60, ge=0, le=240)

class ItineraryWaypoint(WaypointBase):
    day: int
    estimated_cost: float = 0
    duration_minutes: int = 0
    travel_minutes_from_previous: int = 0

class DailyItinerary(BaseModel):
    day: int
    start: ItineraryWaypoint
    stops: List[ItineraryWaypoint] = Field(default_factory=list)
    final_destination: ItineraryWaypoint
    total_cost: float = 0
    scheduled_minutes: int = 0
    buffer_minutes: int = 0

class WaypointResponse(WaypointBase):
    id: int
    route_id: int

    class Config:
        from_attributes = True

class RouteBase(BaseModel):
    title: str
    city: str

class RouteCreate(RouteBase):
    waypoints: List[WaypointCreate] = Field(default_factory=list)
    cities: List[str] = Field(default_factory=list)
    daily_plans: List[DailyPlanInput] = Field(default_factory=list)
    preferences: RoutePreferences = Field(default_factory=RoutePreferences)
    points_of_interest: List[PointOfInterest] = Field(default_factory=list)

class RouteResponse(RouteBase):
    id: int
    user_id: int
    created_at: datetime
    waypoints: List[WaypointResponse]
    itineraries: List[DailyItinerary] = Field(default_factory=list)

    class Config:
        from_attributes = True