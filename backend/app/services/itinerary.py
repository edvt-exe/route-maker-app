from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta, time
from math import asin, cos, radians, sin, sqrt
from typing import Iterable

from fastapi import HTTPException, status

from app.schemas.route import (
    DailyItinerary,
    ItineraryWaypoint,
    LocationInput,
    PointOfInterest,
    RouteCreate,
    TransitLeg,
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
ALLOWED_PLACE_TYPES = {
    "historical": {"museum", "tourist_attraction", "historical_landmark", "historic"},
    "culture": {"museum", "art_gallery", "gallery", "tourist_attraction"},
    "attraction": {"museum", "tourist_attraction", "historical_landmark", "viewpoint", "zoo", "theme_park"},
    "cafe": {"cafe"},
    "dining": {"restaurant", "cafe"},
    "park": {"park", "garden"},
}
STATIC_DURATIONS = {"historical": 150, "culture": 150, "attraction": 120, "cafe": 60, "dining": 75, "park": 90}


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
    pacing = {normalize(tag) for tag in preferences.pacing_tags}
    slow = "leisurely stroll" in pacing
    dense = "action packed" in pacing
    base_stops = 3 if slow else 6 if dense else 4
    # A 10-hour dense day can contain ten visits plus its start and final anchors.
    max_stops = min(20, max(base_stops, int(preferences.hours_per_day * 60 / 45)))
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


def budget_matches(poi: PointOfInterest, budget: float) -> bool:
    return poi.cost <= float(budget)


def cuisine_matches(poi: PointOfInterest, cuisines: Iterable[str]) -> bool:
    requested = {normalize(cuisine) for cuisine in cuisines if normalize(cuisine)}
    if not requested or CATEGORY_ALIASES.get(normalize(poi.category), normalize(poi.category)) != "dining":
        return True
    available = {normalize(cuisine) for cuisine in [*poi.cuisine_types, *poi.tags]}
    return any(requested_cuisine in available or any(requested_cuisine in value for value in available) for requested_cuisine in requested)


def dining_budget_matches(poi: PointOfInterest, preferences) -> bool:
    if CATEGORY_ALIASES.get(normalize(poi.category), normalize(poi.category)) != "dining" or preferences.dining_budget is None:
        return True
    return poi.cost * preferences.party_size <= preferences.dining_budget


def category_score(poi: PointOfInterest, selected_categories: set[str], budget: float, transport: str) -> float:
    score = poi.rating * 2
    if selected_categories and CATEGORY_ALIASES.get(normalize(poi.category), normalize(poi.category)) in selected_categories:
        score += 8
    if poi.cost <= budget:
        score += 2
    if transport == "public transport" and poi.near_transit:
        score += 4
    return score


def canonical_place_types(poi: PointOfInterest) -> set[str]:
    category = CATEGORY_ALIASES.get(normalize(poi.category), normalize(poi.category))
    return {normalize(value) for value in poi.place_types} if poi.place_types else ALLOWED_PLACE_TYPES.get(category, set())


def allowed_for_category(poi: PointOfInterest, category: str) -> bool:
    return bool(canonical_place_types(poi) & ALLOWED_PLACE_TYPES.get(category, set()))


def static_duration(poi: PointOfInterest) -> int:
    category = CATEGORY_ALIASES.get(normalize(poi.category), normalize(poi.category))
    return STATIC_DURATIONS.get(category, 90)


def popularity_sort_key(
    poi: PointOfInterest,
    selected_categories: set[str],
    budget: float,
    transport: str,
) -> tuple[float, float, float, float, float, str]:
    """Rank eligible places by quality first, with stable contextual tie-breakers."""
    return (
        -float(poi.rating > 4.5),
        -poi.rating,
        -poi.review_count,
        -poi.popularity_score,
        -category_score(poi, selected_categories, budget, transport),
        normalize(poi.name),
    )


def filter_pois(route: RouteCreate, rules: PlanningRules) -> list[PointOfInterest]:
    selected_categories = canonical_categories(route.preferences.categories)
    budget = route.preferences.budget
    scoped_cities = {normalize(city) for city in route.cities}
    start_locations = [location for plan in route.daily_plans for location in (plan.start, plan.final_destination)]
    if not start_locations and route.waypoints:
        start_locations = [LocationInput(name=route.waypoints[0].name, latitude=route.waypoints[0].latitude, longitude=route.waypoints[0].longitude)]
    candidates = []
    for poi in route.points_of_interest:
        poi_category = CATEGORY_ALIASES.get(normalize(poi.category), normalize(poi.category))
        city_matches = not scoped_cities or poi.city is None or normalize(poi.city) in scoped_cities or any(city in normalize(" ".join(poi.tags + [poi.name])) for city in scoped_cities)
        category_matches = poi.required or not selected_categories or poi_category in selected_categories
        type_matches = poi.required or any(allowed_for_category(poi, selected) for selected in (selected_categories or {poi_category}))
        within_walking_limit = (
            not start_locations
            or route.preferences.transport != "walking"
            or any(haversine_km(start, poi) <= route.preferences.max_walking_distance_km for start in start_locations)
        )
        if not within_walking_limit and not poi.required:
            continue
        if route.preferences.accessibility_required and not poi.wheelchair_accessible and not poi.required:
            continue
        within_radius = not start_locations or any(haversine_km(start, poi) <= 15 for start in start_locations)
        if city_matches and category_matches and type_matches and within_radius and (poi.required or budget_matches(poi, budget)) and cuisine_matches(poi, route.preferences.cuisine_types) and dining_budget_matches(poi, route.preferences):
            candidates.append(poi)
    return candidates


def travel_minutes(distance_km: float, transport: str, transit_wait_minutes: int = 0) -> int:
    speed_kmh = {"walking": 4.5, "public transport": 20.0, "by car": 35.0}.get(transport, 4.5)
    travel = max(5, round(distance_km / speed_kmh * 60))
    return travel + transit_wait_minutes if transport == "public transport" else travel


def transit_to_next(current, next_location, allowed_transport: str, wait_minutes: int = 0) -> TransitLeg:
    from app.services.open_data import osrm_duration_minutes

    distance = haversine_km(current, next_location)
    if distance < 0.01:
        return TransitLeg(transit_mode="stationary", travel_duration_minutes=0)
    walking = osrm_duration_minutes(current, next_location, "walking")
    transit = travel_minutes(distance, "public transport", wait_minutes)
    driving = osrm_duration_minutes(current, next_location, "driving")
    if allowed_transport == "by car":
        mode, duration = ("driving", driving) if driving <= transit else ("transit", transit)
    elif allowed_transport == "public transport":
        mode, duration = "transit", transit
    else:
        mode, duration = "walking", walking
    return TransitLeg(transit_mode=mode, travel_duration_minutes=duration)


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


def inject_parking(current: PointOfInterest, day: int, order_index: int, travel: int = 0) -> ItineraryWaypoint:
    return ItineraryWaypoint(name=f"Public Parking / Garage near {current.name}", category="Public Parking / Garage", latitude=current.latitude, longitude=current.longitude, order_index=order_index, day=day, duration_minutes=15, estimated_cost=0, travel_minutes_from_previous=travel)


def apply_schedule(
    start: ItineraryWaypoint,
    stops: list[ItineraryWaypoint],
    final_destination: ItineraryWaypoint,
    start_time: time,
) -> None:
    """Advance a day clock through travel and visit durations."""
    clock = datetime.combine(date(2000, 1, 1), start_time)
    waypoints = [start, *stops, final_destination]
    for index, waypoint in enumerate(waypoints):
        if index:
            clock += timedelta(minutes=waypoint.travel_minutes_from_previous)
        arrival = clock
        departure = arrival + timedelta(minutes=waypoint.duration_minutes)
        waypoint.arrival_time = arrival.time()
        waypoint.departure_time = departure.time()
        waypoint.schedule_label = f"{arrival.strftime('%I:%M %p')} - {departure.strftime('%I:%M %p')}: {waypoint.name}"
        clock = departure


def generate_itineraries(route: RouteCreate) -> list[DailyItinerary]:
    from app.services.open_data import fetch_pois

    rules = rules_for(route.preferences)
    plans = daily_plans_for(route)
    explicit_anchors = {normalize(location.name) for _, start, final in plans for location in (start, final)}
    explicit_stops = [
        PointOfInterest(name=waypoint.name, category=waypoint.category, latitude=waypoint.latitude, longitude=waypoint.longitude, required=True)
        for waypoint in route.waypoints
        if normalize(waypoint.name) not in explicit_anchors
    ]
    try:
        discovered_pois = fetch_pois(plans)
    except RuntimeError:
        discovered_pois = []
    source_pois = discovered_pois or route.points_of_interest
    candidates = filter_pois(route.model_copy(update={"points_of_interest": [*source_pois, *explicit_stops]}), rules)
    itineraries: list[DailyItinerary] = []
    selected_categories = canonical_categories(route.preferences.categories)
    unassigned = [poi for poi in candidates if "day " not in normalize(poi.category)]
    ranked = sorted(
        unassigned,
        key=lambda poi: popularity_sort_key(
            poi, selected_categories, route.preferences.budget, route.preferences.transport
        ),
    )
    dining_ranked = [
        poi for poi in ranked
        if CATEGORY_ALIASES.get(normalize(poi.category), normalize(poi.category)) == "dining"
    ]
    non_dining_ranked = [
        poi for poi in ranked
        if CATEGORY_ALIASES.get(normalize(poi.category), normalize(poi.category)) != "dining"
    ]
    dining_reserved = dining_ranked[: route.preferences.meals_per_day * len(plans)]
    # Reserve matching meals first, then fill remaining capacity with top attractions.
    route_capacity = rules.max_stops * len(plans)
    ranked = [*dining_reserved, *non_dining_ranked][:route_capacity]
    daily_pools: dict[int, list[PointOfInterest]] = {day: [] for day, _, _ in plans}
    for index, poi in enumerate(ranked):
        day = plans[index % len(plans)][0]
        daily_pools[day].append(poi)
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
        nearby.sort(key=lambda poi: popularity_sort_key(poi, selected_categories, route.preferences.budget, route.preferences.transport))

        meals_scheduled = 0
        visit_count = 0
        while nearby and visit_count < rules.max_stops:
            eligible = [poi for poi in nearby if not (CATEGORY_ALIASES.get(normalize(poi.category), normalize(poi.category)) == "dining" and meals_scheduled >= route.preferences.meals_per_day)]
            if not eligible:
                break
            dining_candidates = [poi for poi in eligible if CATEGORY_ALIASES.get(normalize(poi.category), normalize(poi.category)) == "dining"]
            non_dining_candidates = [poi for poi in eligible if CATEGORY_ALIASES.get(normalize(poi.category), normalize(poi.category)) != "dining"]
            meal_targets = [daily_minutes * 0.5] if route.preferences.meals_per_day == 1 else [daily_minutes * 0.35, daily_minutes * 0.72]
            meal_target = meal_targets[min(meals_scheduled, len(meal_targets) - 1)] if meal_targets else daily_minutes * 0.5
            meal_is_due = dining_candidates and used_minutes >= meal_target - 45
            if meal_is_due:
                eligible = dining_candidates
            elif non_dining_candidates:
                eligible = non_dining_candidates
            next_poi = min(
                eligible,
                key=lambda poi: (
                    abs(used_minutes - meal_target),
                    *popularity_sort_key(poi, selected_categories, route.preferences.budget, route.preferences.transport),
                ) if CATEGORY_ALIASES.get(normalize(poi.category), normalize(poi.category)) == "dining" and meal_is_due else popularity_sort_key(poi, selected_categories, route.preferences.budget, route.preferences.transport),
            )
            leg = transit_to_next(current, next_poi, route.preferences.transport, next_poi.transit_wait_minutes)
            move_minutes = leg.travel_duration_minutes
            visit_minutes = static_duration(next_poi)
            # Required user-selected stops are always included; optional POIs must fit the time budget.
            final_leg_minutes = transit_to_next(next_poi, final, route.preferences.transport).travel_duration_minutes
            if not next_poi.required and used_minutes + move_minutes + visit_minutes + final_leg_minutes > daily_minutes:
                nearby.remove(next_poi)
                continue
            if route.preferences.transport == "by car" and CATEGORY_ALIASES.get(normalize(next_poi.category), normalize(next_poi.category)) in {"historical", "attraction", "culture", "park"}:
                stops.append(inject_parking(next_poi, day, order_index, move_minutes))
                order_index += 1
                move_minutes = 0
            stops.append(make_poi_waypoint(next_poi, day, order_index, move_minutes, visit_minutes))
            order_index += 1
            used_minutes += move_minutes + visit_minutes
            total_cost += next_poi.cost
            canonical_category = CATEGORY_ALIASES.get(normalize(next_poi.category), normalize(next_poi.category))
            visit_count += 1
            if canonical_category == "dining":
                meals_scheduled += 1
            current = next_poi
            nearby.remove(next_poi)

        final_leg = transit_to_next(current, final, route.preferences.transport)
        final_travel = final_leg.travel_duration_minutes
        used_minutes += final_travel
        start_waypoint = make_waypoint(start, f"Day {day} · Start", day, 0)
        final_waypoint = make_waypoint(final, f"Day {day} · Final destination", day, order_index, travel=final_travel)
        scheduled_waypoints = [start_waypoint, *stops, final_waypoint]
        for index, waypoint in enumerate(scheduled_waypoints[:-1]):
            next_waypoint = scheduled_waypoints[index + 1]
            waypoint.transit_to_next = transit_to_next(waypoint, next_waypoint, route.preferences.transport, next_waypoint.travel_minutes_from_previous)
        apply_schedule(start_waypoint, stops, final_waypoint, route.preferences.start_time)
        itineraries.append(DailyItinerary(day=day, start=start_waypoint, stops=stops, final_destination=final_waypoint, total_cost=round(total_cost, 2), scheduled_minutes=used_minutes, buffer_minutes=max(0, daily_minutes - used_minutes)))
    return itineraries


def flatten_itineraries(itineraries: list[DailyItinerary]):
    flattened = []
    for itinerary in itineraries:
        flattened.extend([itinerary.start, *itinerary.stops, itinerary.final_destination])
    return flattened
