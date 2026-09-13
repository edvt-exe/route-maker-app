from pydantic import BaseModel
from typing import List, Optional, Dict, Any


class TransitDetails(BaseModel):
    transit_mode: str
    travel_duration_minutes: int


class WaypointSchema(BaseModel):
    id: Optional[int] = None
    name: str
    category: str
    latitude: float
    longitude: float
    order_index: int
    arrival_time: Optional[str] = None
    departure_time: Optional[str] = None
    schedule_label: Optional[str] = None
    transit_to_next: Optional[TransitDetails] = None
    estimated_cost: Optional[float] = 0.0
    travel_minutes_from_previous: Optional[int] = None


class DailyItinerarySchema(BaseModel):
    day: int
    start: WaypointSchema
    stops: List[WaypointSchema]
    final_destination: WaypointSchema


class RouteData(BaseModel):
    title: str
    city: str
    waypoints: List[WaypointSchema]
    itineraries: List[DailyItinerarySchema]
    navigation_url: Optional[str] = None
    initial_budget: Optional[float] = None


class RoutePreferences(BaseModel):
    transport: str = "walking"
    budget: Optional[float] = 0.0
    pacing: str = "Balanced"
    categories: List[str] = []
    vibe: str = "Local/Authentic"
    hours_per_day: int = 8
    meals_per_day: int = 2
    accessibility_required: bool = False

    tourist_level: int = 3
    free_only: bool = False
    budget_allocation: int = 50
    dining_style: List[str] = []
    cuisine: Optional[str] = None
    dietary_restrictions: List[str] = []
    weather_preference: str = "Mostly Outdoor"
    group_type: str = "Solo"
    child_age: Optional[str] = None
    pet_friendly: bool = False


class RouteCreate(BaseModel):
    title: str
    city: str
    cities: List[str] = []
    daily_plans: List[Dict[str, Any]] = []
    preferences: RoutePreferences