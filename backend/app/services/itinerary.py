from __future__ import annotations
from dataclasses import dataclass
from datetime import date, datetime, timedelta, time
from math import asin, cos, radians, sin, sqrt
from typing import Iterable

from fastapi import HTTPException, status
from app.schemas.route import (
    DailyItinerary, ItineraryWaypoint, LocationInput, 
    PointOfInterest, RouteCreate, TransitLeg
)

# --- CONSTANTS & CONFIGURATION ---
CATEGORY_ALIASES = {
    "historical landmarks": "historical", "arts & culture": "culture",
    "local cafes": "cafe", "fine dining": "dining",
    "attractions": "attraction", "historical": "historical",
    "culture": "culture", "cafe": "cafe", "dining": "dining",
    "parks & gardens": "park", "public park": "park", "viewpoints": "attraction",
}
SUPPORTED_CATEGORIES = {"historical", "culture", "cafe", "dining", "attraction", "park"}
ALLOWED_PLACE_TYPES = {
    "historical": {"museum", "tourist_attraction", "historical_landmark", "historic"},
    "culture": {"museum", "art_gallery", "gallery", "tourist_attraction"},
    "attraction": {"museum", "tourist_attraction", "historical_landmark", "viewpoint", "zoo", "theme_park"},
    "cafe": {"cafe"}, "dining": {"restaurant", "cafe"}, "park": {"park", "garden"},
}
STATIC_DURATIONS = {"historical": 150, "culture": 150, "attraction": 120, "cafe": 60, "dining": 75, "park": 90}

@dataclass(frozen=True)
class PlanningRules:
    max_stops: int
    attraction_minutes: int
    travel_factor: float
    radius_km: float
    buffer_minutes: int

# --- UTILITY FUNCTIONS ---
def normalize(value: str) -> str:
    return " ".join(value.casefold().replace("_", " ").split())

def haversine_km(first: LocationInput | PointOfInterest, second: LocationInput | PointOfInterest) -> float:
    lat_delta = radians(second.latitude - first.latitude)
    lon_delta = radians(second.longitude - first.longitude)
    val = sin(lat_delta / 2) ** 2 + cos(radians(first.latitude)) * cos(radians(second.latitude)) * sin(lon_delta / 2) ** 2
    return 6371 * 2 * asin(sqrt(val))

def canonical_categories(categories: Iterable[str]) -> set[str]:
    return {canonical for c in categories if (canonical := CATEGORY_ALIASES.get(normalize(c), normalize(c))) in SUPPORTED_CATEGORIES}

# --- SCORING & FILTERING ---
def category_score(poi: PointOfInterest, selected_categories: set[str], budget: float, transport: str) -> float:
    score = poi.rating * 2
    canonical = CATEGORY_ALIASES.get(normalize(poi.category), normalize(poi.category))
    if selected_categories and canonical in selected_categories:
        score += 8
    if poi.cost <= budget:
        score += 2
    if transport == "public transport" and poi.near_transit:
        score += 4
    return score

def popularity_sort_key(poi: PointOfInterest, selected_categories: set[str], budget: float, transport: str):
    return (
        -float(poi.rating > 4.5), -poi.rating, -poi.review_count, -poi.popularity_score,
        -category_score(poi, selected_categories, budget, transport), normalize(poi.name)
    )

def filter_pois(route: RouteCreate, rules: PlanningRules) -> list[PointOfInterest]:
    selected_categories = canonical_categories(route.preferences.categories)
    scoped_cities = {normalize(city) for city in route.cities}
    candidates = []
    
    for poi in route.points_of_interest:
        poi_category = CATEGORY_ALIASES.get(normalize(poi.category), normalize(poi.category))
        is_city_match = not scoped_cities or poi.city is None or normalize(poi.city) in scoped_cities
        is_cat_match = poi.required or not selected_categories or poi_category in selected_categories
        
        if is_city_match and is_cat_match and (poi.required or poi.cost <= route.preferences.budget):
            candidates.append(poi)
            
    return candidates

# --- TIME & TRAVEL ---
def travel_minutes(distance_km: float, transport: str, transit_wait_minutes: int = 0) -> int:
    speed_kmh = {"walking": 4.5, "public transport": 20.0, "by car": 35.0}.get(transport, 4.5)
    travel = max(5, round(distance_km / speed_kmh * 60))
    return travel + transit_wait_minutes if transport == "public transport" else travel

def transit_to_next(current, next_location, allowed_transport: str, wait_minutes: int = 0) -> TransitLeg:
    from app.services.open_data import osrm_duration_minutes
    distance = haversine_km(current, next_location)
    if distance < 0.01:
        return TransitLeg(transit_mode="stationary", travel_duration_minutes=0)
        
    transit = travel_minutes(distance, "public transport", wait_minutes)
    if allowed_transport == "by car":
        driving = osrm_duration_minutes(current, next_location, "driving")
        return TransitLeg(transit_mode="driving" if driving <= transit else "transit", travel_duration_minutes=min(driving, transit))
    elif allowed_transport == "public transport":
        return TransitLeg(transit_mode="transit", travel_duration_minutes=transit)
        
    walking = osrm_duration_minutes(current, next_location, "walking")
    return TransitLeg(transit_mode="walking", travel_duration_minutes=walking)

def apply_schedule(start: ItineraryWaypoint, stops: list[ItineraryWaypoint], final: ItineraryWaypoint, start_time: time):
    clock = datetime.combine(date(2000, 1, 1), start_time)
    for waypoint in [start, *stops, final]:
        if waypoint != start:
            clock += timedelta(minutes=waypoint.travel_minutes_from_previous)
        arrival = clock
        departure = arrival + timedelta(minutes=waypoint.duration_minutes)
        waypoint.arrival_time, waypoint.departure_time = arrival.time(), departure.time()
        waypoint.schedule_label = f"{arrival.strftime('%I:%M %p')} - {departure.strftime('%I:%M %p')}: {waypoint.name}"
        clock = departure

# --- CORE ENGINE ---
def rules_for(preferences) -> PlanningRules:
    pacing = {normalize(tag) for tag in preferences.pacing_tags}
    max_stops = min(20, max(3 if "leisurely stroll" in pacing else 6, int(preferences.hours_per_day * 60 / 45)))
    return PlanningRules(
        max_stops=max_stops,
        attraction_minutes=120 if "leisurely stroll" in pacing else 90,
        travel_factor=1.3 if preferences.transport == "walking" else 1.0,
        radius_km=30.0, buffer_minutes=60
    )

def generate_itineraries(route: RouteCreate) -> list[DailyItinerary]:
    from app.services.open_data import fetch_pois
    rules = rules_for(route.preferences)
    plans = [(p.day, p.start, p.final_destination) for p in sorted(route.daily_plans, key=lambda p: p.day)]
    
    try:
        discovered_pois = fetch_pois(plans)
    except RuntimeError:
        discovered_pois = []
        
    candidates = filter_pois(route.model_copy(update={"points_of_interest": [*discovered_pois, *route.points_of_interest]}), rules)
    selected_categories = canonical_categories(route.preferences.categories)
    ranked = sorted(candidates, key=lambda p: popularity_sort_key(p, selected_categories, route.preferences.budget, route.preferences.transport))
    
    itineraries = []
    for day, start, final in plans:
        daily_pool = [p for p in ranked if p not in flatten_itineraries(itineraries)]
        itineraries.append(_plan_single_day(day, start, final, daily_pool, route, rules, selected_categories))
        
    return itineraries

def _plan_single_day(day: int, start: LocationInput, final: LocationInput, pool: list[PointOfInterest], route: RouteCreate, rules: PlanningRules, categories: set[str]) -> DailyItinerary:
    current = start
    stops, used_minutes, total_cost = [], 0, 0.0
    daily_minutes = round(route.preferences.hours_per_day * 60)
    
    while pool and len(stops) < rules.max_stops:
        next_poi = pool.pop(0) # In a real scenario, re-evaluate closest POI here
        
        leg = transit_to_next(current, next_poi, route.preferences.transport, next_poi.transit_wait_minutes)
        visit_mins = STATIC_DURATIONS.get(CATEGORY_ALIASES.get(normalize(next_poi.category)), 90)
        
        if used_minutes + leg.travel_duration_minutes + visit_mins > daily_minutes:
            continue
            
        stops.append(ItineraryWaypoint(
            name=next_poi.name, category=next_poi.category, latitude=next_poi.latitude, 
            longitude=next_poi.longitude, order_index=len(stops)+1, day=day, 
            duration_minutes=visit_mins, estimated_cost=next_poi.cost, 
            travel_minutes_from_previous=leg.travel_duration_minutes
        ))
        
        used_minutes += leg.travel_duration_minutes + visit_mins
        total_cost += next_poi.cost
        current = next_poi

    final_leg = transit_to_next(current, final, route.preferences.transport)
    start_wp = ItineraryWaypoint(name=start.name, category=f"Day {day} Start", latitude=start.latitude, longitude=start.longitude, order_index=0, day=day)
    final_wp = ItineraryWaypoint(name=final.name, category=f"Day {day} End", latitude=final.latitude, longitude=final.longitude, order_index=len(stops)+1, day=day, travel_minutes_from_previous=final_leg.travel_duration_minutes)
    
    apply_schedule(start_wp, stops, final_wp, route.preferences.start_time)
    
    return DailyItinerary(
        day=day, start=start_wp, stops=stops, final_destination=final_wp,
        total_cost=round(total_cost, 2), scheduled_minutes=used_minutes, buffer_minutes=max(0, daily_minutes - used_minutes)
    )

def flatten_itineraries(itineraries: list[DailyItinerary]):
    return [wp for it in itineraries for wp in [it.start, *it.stops, it.final_destination]]