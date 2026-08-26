from __future__ import annotations

from dataclasses import dataclass
from math import asin, cos, radians, sin, sqrt
from typing import Iterable

from fastapi import HTTPException, status

from app.schemas.route import (
    DailyItinerary,
    ItineraryWaypoint,
    LocationInput,
    PointOfInterest,
    RouteCreate,
)


CATEGORY_ALIASES = {
    "historical landmarks": "historical",
    "arts & culture": "culture",
    "local cafes": "cafe",
    "fine dining": "dining",
    "attractions": "attraction",
    "historical": "historical",
    "culture": "culture",
    "cafe": "cafe",
    "dining": "dining",
    "parks & gardens": "park",
    "public park": "park",
    "viewpoints": "attraction",
}
SUPPORTED_CATEGORIES = {"historical", "culture", "cafe", "dining", "attraction", "park"}
BUDGET_LIMITS = {"Under $50": 50.0, "$50 - $150": 150.0, "$150+": float("inf")}


@dataclass(frozen=True)
class PlanningRules:
    max_stops: int
    attraction_minutes: int
    travel_factor: float
    radius_km: float
    buffer_minutes: int


def normalize(value: str) -> str:
    return " ".join(value.casefold().replace("_", " ").split())


def rules_for(preferences) -> PlanningRules:
    trip_type = normalize(preferences.trip_type)
    pacing = {normalize(tag) for tag in preferences.pacing_tags}
    slow = trip_type == "slow holiday" or "leisurely stroll" in pacing
    dense = trip_type in {"weekend escape", "city break"} or "action packed" in pacing
    base_stops = 3 if slow else 6 if dense else 4
    # A 10-hour dense day can contain ten visits plus its start and final anchors.
    max_stops = min(10, max(base_stops, int(preferences.hours_per_day)))
    return PlanningRules(
        max_stops=max_stops,
        attraction_minutes=120 if slow or "leisurely stroll" in pacing else 45 if dense or "action packed" in pacing else 90,
        travel_factor=1.3 if preferences.transport == "walking" else 1.0,
        radius_km=3.0 if preferences.transport == "walking" else 8.0 if preferences.transport == "public transport" else 30.0,
        buffer_minutes=max(90 if slow else 30, preferences.start_buffer_minutes + preferences.end_buffer_minutes),
    )


def haversine_km(first: LocationInput | PointOfInterest, second: LocationInput | PointOfInterest) -> float:
    latitude_delta = radians(second.latitude - first.latitude)
    longitude_delta = radians(second.longitude - first.longitude)
    first_latitude = radians(first.latitude)
    second_latitude = radians(second.latitude)
    value = sin(latitude_delta / 2) ** 2 + cos(first_latitude) * cos(second_latitude) * sin(longitude_delta / 2) ** 2
    return 6371 * 2 * asin(sqrt(value))


def canonical_categories(categories: Iterable[str]) -> set[str]:
    return {canonical for category in categories if (canonical := CATEGORY_ALIASES.get(normalize(category), normalize(category))) in SUPPORTED_CATEGORIES}


def budget_matches(poi: PointOfInterest, budget: str) -> bool:
    normalized_budget = normalize(budget)
    if normalized_budget == "under $50":
        return poi.cost <= 50
    if normalized_budget == "$50 - $150":
        return poi.cost <= 150
    return poi.is_premium or poi.cost >= 150 or "premium" in {normalize(tag) for tag in poi.tags}


def category_score(poi: PointOfInterest, selected_categories: set[str], budget: str, transport: str) -> float:
    score = poi.rating * 2
    if selected_categories and CATEGORY_ALIASES.get(normalize(poi.category), normalize(poi.category)) in selected_categories:
        score += 8
    if budget == "Under $50" and poi.cost == 0:
        score += 5
    if budget == "$150+" and poi.is_premium:
        score += 5
    if transport == "public transport" and poi.near_transit:
        score += 4
    return score


def filter_pois(route: RouteCreate, rules: PlanningRules) -> list[PointOfInterest]:
    selected_categories = canonical_categories(route.preferences.categories)
    budget = route.preferences.budget
    scoped_cities = {normalize(city) for city in route.cities}
    candidates = []
    for poi in route.points_of_interest:
        poi_category = CATEGORY_ALIASES.get(normalize(poi.category), normalize(poi.category))
        city_matches = not scoped_cities or (poi.city and normalize(poi.city) in scoped_cities) or any(city in normalize(" ".join(poi.tags + [poi.name])) for city in scoped_cities)
        category_matches = poi.required or not selected_categories or poi_category in selected_categories or any(selected in normalize(tag) for tag in poi.tags for selected in selected_categories)
        if city_matches and category_matches and (poi.required or budget_matches(poi, budget)):
            candidates.append(poi)
    return candidates


def travel_minutes(distance_km: float, transport: str, transit_wait_minutes: int = 0) -> int:
    speed_kmh = {"walking": 4.5, "public transport": 20.0, "by car": 35.0}.get(transport, 4.5)
    travel = max(5, round(distance_km / speed_kmh * 60))
    return travel + transit_wait_minutes if transport == "public transport" else travel


def make_waypoint(location: LocationInput, category: str, day: int, order_index: int, duration: int = 0, cost: float = 0, travel: int = 0) -> ItineraryWaypoint:
    return ItineraryWaypoint(name=location.name, category=category, latitude=location.latitude, longitude=location.longitude, order_index=order_index, day=day, duration_minutes=duration, estimated_cost=cost, travel_minutes_from_previous=travel)


def make_poi_waypoint(poi: PointOfInterest, day: int, order_index: int, travel: int, duration: int) -> ItineraryWaypoint:
    return ItineraryWaypoint(name=poi.name, category=poi.category, latitude=poi.latitude, longitude=poi.longitude, order_index=order_index, day=day, duration_minutes=duration, estimated_cost=poi.cost, travel_minutes_from_previous=travel)


def daily_plans_for(route: RouteCreate) -> list[tuple[int, LocationInput, LocationInput]]:
    if route.daily_plans:
        return [(plan.day, plan.start, plan.final_destination) for plan in sorted(route.daily_plans, key=lambda plan: plan.day)]
    if len(route.waypoints) < 2:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Provide a start and final destination for every day.")
    first = route.waypoints[0]
    last = route.waypoints[-1]
    start = LocationInput(name=first.name, latitude=first.latitude, longitude=first.longitude)
    final = LocationInput(name=last.name, latitude=last.latitude, longitude=last.longitude)
    return [(1, start, final)]


def inject_parking(current: PointOfInterest, day: int, order_index: int) -> ItineraryWaypoint:
    return ItineraryWaypoint(name=f"Public Parking / Garage near {current.name}", category="Public Parking / Garage", latitude=current.latitude, longitude=current.longitude, order_index=order_index, day=day, duration_minutes=15, estimated_cost=0)


def generate_itineraries(route: RouteCreate) -> list[DailyItinerary]:
    rules = rules_for(route.preferences)
    plans = daily_plans_for(route)
    explicit_anchors = {normalize(location.name) for _, start, final in plans for location in (start, final)}
    explicit_stops = [
        PointOfInterest(name=waypoint.name, category=waypoint.category, latitude=waypoint.latitude, longitude=waypoint.longitude, required=True)
        for waypoint in route.waypoints
        if normalize(waypoint.name) not in explicit_anchors
    ]
    candidates = filter_pois(route.model_copy(update={"points_of_interest": [*route.points_of_interest, *explicit_stops]}), rules)
    itineraries: list[DailyItinerary] = []
    unassigned = [poi for poi in candidates if "day " not in normalize(poi.category)]
    grouped: dict[str, list[PointOfInterest]] = {}
    for poi in unassigned:
        category = CATEGORY_ALIASES.get(normalize(poi.category), normalize(poi.category))
        grouped.setdefault(category, []).append(poi)
    interleaved: list[PointOfInterest] = []
    while grouped:
        for category in list(grouped):
            interleaved.append(grouped[category].pop(0))
            if not grouped[category]:
                del grouped[category]
    # Give every day its own pool so the first day cannot consume the whole trip.
    daily_pools: dict[int, list[PointOfInterest]] = {day: [] for day, _, _ in plans}
    for index, poi in enumerate(interleaved):
        day = plans[index % len(plans)][0]
        daily_pools[day].append(poi)
    selected_categories = canonical_categories(route.preferences.categories)
    daily_minutes = round(route.preferences.hours_per_day * 60)

    for day, start, final in plans:
        current: LocationInput | PointOfInterest = start
        stops: list[ItineraryWaypoint] = []
        used_minutes = 0
        total_cost = 0.0
        order_index = 1
        day_candidates = [poi for poi in candidates if normalize(f"day {day}") in normalize(poi.category)]
        planning_pool = [*daily_pools[day], *day_candidates]
        nearby = planning_pool[:]
        nearby.sort(key=lambda poi: (-category_score(poi, selected_categories, route.preferences.budget, route.preferences.transport), haversine_km(start, poi)))

        category_counts: dict[str, int] = {}
        meals_scheduled = 0
        visit_count = 0
        while nearby and visit_count < rules.max_stops:
            eligible = [poi for poi in nearby if not (CATEGORY_ALIASES.get(normalize(poi.category), normalize(poi.category)) == "dining" and meals_scheduled >= route.preferences.meals_per_day)]
            if not eligible:
                break
            next_poi = min(eligible, key=lambda poi: (category_counts.get(CATEGORY_ALIASES.get(normalize(poi.category), normalize(poi.category)), 0) if selected_categories else 0, -category_score(poi, selected_categories, route.preferences.budget, route.preferences.transport), haversine_km(current, poi)))
            distance = haversine_km(current, next_poi)
            move_minutes = travel_minutes(distance, route.preferences.transport, next_poi.transit_wait_minutes)
            visit_minutes = min(next_poi.duration_minutes, rules.attraction_minutes)
            # Required user-selected stops are always included; optional POIs must fit the time budget.
            if not next_poi.required and used_minutes + move_minutes + visit_minutes > daily_minutes - rules.buffer_minutes:
                nearby.remove(next_poi)
                continue
            if route.preferences.transport == "by car" and CATEGORY_ALIASES.get(normalize(next_poi.category), normalize(next_poi.category)) in {"historical", "attraction", "culture", "park"}:
                stops.append(inject_parking(next_poi, day, order_index))
                order_index += 1
            stops.append(make_poi_waypoint(next_poi, day, order_index, move_minutes, visit_minutes))
            order_index += 1
            used_minutes += move_minutes + visit_minutes
            total_cost += next_poi.cost
            canonical_category = CATEGORY_ALIASES.get(normalize(next_poi.category), normalize(next_poi.category))
            category_counts[canonical_category] = category_counts.get(canonical_category, 0) + 1
            visit_count += 1
            if canonical_category == "dining":
                meals_scheduled += 1
            current = next_poi
            nearby.remove(next_poi)

        final_travel = travel_minutes(haversine_km(current, final), route.preferences.transport)
        used_minutes += final_travel
        final_waypoint = make_waypoint(final, f"Day {day} · Final destination", day, order_index, travel=final_travel)
        start_waypoint = make_waypoint(start, f"Day {day} · Start", day, 0)
        itineraries.append(DailyItinerary(day=day, start=start_waypoint, stops=stops, final_destination=final_waypoint, total_cost=round(total_cost, 2), scheduled_minutes=used_minutes, buffer_minutes=max(0, daily_minutes - used_minutes)))
    return itineraries


def flatten_itineraries(itineraries: list[DailyItinerary]):
    flattened = []
    for itinerary in itineraries:
        flattened.extend([itinerary.start, *itinerary.stops, itinerary.final_destination])
    return flattened
