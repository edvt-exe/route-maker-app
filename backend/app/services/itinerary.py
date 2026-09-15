import httpx
import logging
import math
import random
from datetime import datetime, timedelta
from typing import List, Dict, Any, Tuple
from sqlalchemy.orm import Session

from app.schemas.route import (
    RouteCreate, RouteData, DailyItinerarySchema,
    WaypointSchema, TransitDetails
)

logger = logging.getLogger("itinerary")

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
OSRM_ROUTE_URL = "https://router.project-osrm.org/route/v1"

PARKING_RATE_PER_HOUR = 3.0

OSRM_PROFILE_BY_TRANSPORT = {
    "walking": "foot",
    "by car": "driving",
}

AVERAGE_SPEED_KMH = {
    "walking": 4.5,
    "by car": 25.0,
    "public transport": 18.0,
}

_geocode_cache: Dict[str, Tuple[float, float]] = {}


def haversine_km(a: Tuple[float, float], b: Tuple[float, float]) -> float:
    """Great-circle distance between two (lat, lon) points, in kilometers."""
    lat1, lon1 = a
    lat2, lon2 = b
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    h = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlambda / 2) ** 2
    return 2 * r * math.asin(math.sqrt(h))


async def get_travel_time_minutes(
    origin: Tuple[float, float], destination: Tuple[float, float], transport: str
) -> int:
    """
    Real travel time between two points, in whole minutes.

    Tries OSRM (actual road-network duration) first for walking/driving;
    falls back to a straight-line-distance / average-speed estimate if
    OSRM is unavailable, times out, or the mode has no road profile
    (public transport has no real road-routing equivalent here).
    """
    if origin == (0.0, 0.0) or destination == (0.0, 0.0):
        return 10

    profile = OSRM_PROFILE_BY_TRANSPORT.get(transport)
    if profile:
        try:
            url = (
                f"{OSRM_ROUTE_URL}/{profile}/"
                f"{origin[1]},{origin[0]};{destination[1]},{destination[0]}?overview=false"
            )
            async with httpx.AsyncClient(timeout=8.0) as client:
                response = await client.get(url)
                response.raise_for_status()
                data = response.json()
                duration_seconds = data["routes"][0]["duration"]
                return max(1, round(duration_seconds / 60))
        except Exception as exc:
            logger.warning("OSRM travel-time lookup failed (%s) — falling back to distance estimate.", exc)

    distance_km = haversine_km(origin, destination)
    speed_kmh = AVERAGE_SPEED_KMH.get(transport, 15.0)
    return max(1, round(distance_km / speed_kmh * 60))


async def geocode_address(address: str, city: str) -> Tuple[float, float]:
    query = address if city.lower() in address.lower() else f"{address}, {city}"
    if query in _geocode_cache:
        return _geocode_cache[query]

    headers = {"User-Agent": "WayFinder-Agent/1.0 (student project; contact via GitHub edvt-exe)"}
    params = {"q": query, "format": "json", "limit": 1}

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(NOMINATIM_URL, params=params, headers=headers)
            response.raise_for_status()
            results = response.json()
    except Exception as exc:
        logger.warning("Geocoding failed for '%s': %s", query, exc)
        return (0.0, 0.0)

    if not results:
        logger.warning("Geocoding returned no results for '%s'", query)
        return (0.0, 0.0)

    lat, lon = float(results[0]["lat"]), float(results[0]["lon"])
    _geocode_cache[query] = (lat, lon)
    return (lat, lon)


def _build_agent_payload(request: RouteCreate) -> Dict[str, Any]:
    prefs = request.preferences
    real_start_point = request.city
    if request.daily_plans:
        first_day_start = request.daily_plans[0].get("start", {})
        if isinstance(first_day_start, dict) and first_day_start.get("name"):
            real_start_point = first_day_start["name"]

    return {
        "city": request.city,
        "startPoint": real_start_point,
        "days": len(request.daily_plans) if request.daily_plans else 1,
        "transport": prefs.transport,
        "max_budget": prefs.budget or 1000.0,
        "pacing": prefs.pacing,
        "categories": prefs.categories or ["Landmarks", "Culture"],
        "vibe": prefs.vibe,
        "hours_per_day": prefs.hours_per_day,
        "meals_per_day": prefs.meals_per_day,
        "accessibility_required": prefs.accessibility_required,
        "tourist_level": prefs.tourist_level,
        "free_only": prefs.free_only,
        "budget_allocation": prefs.budget_allocation,
        "dining_style": prefs.dining_style,
        "cuisine": prefs.cuisine,
        "dietary_restrictions": prefs.dietary_restrictions,
        "weather_preference": prefs.weather_preference,
        "group_type": prefs.group_type,
        "child_age": prefs.child_age,
        "pet_friendly": prefs.pet_friendly,
    }


async def fetch_pois_from_agent(request: RouteCreate) -> List[Dict[str, Any]]:
    """
    Sends the user filters to the AI Agent microservice and receives a list of real POIs.
    """
    agent_url = "http://localhost:8001/api/v1/agent/search"
    payload = _build_agent_payload(request)

    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(agent_url, json=payload)
        if response.status_code >= 400:
            try:
                detail = response.json()
            except ValueError:
                detail = response.text
            raise ValueError(f"WayFinder-Agent rejected the request ({response.status_code}): {detail}")
        data = response.json()
        return data.get("pois", [])


async def generate_itinerary(db: Session, request: RouteCreate) -> RouteData:
    prefs = request.preferences
    city = request.city
    days_count = len(request.daily_plans) if request.daily_plans else 1

    try:
        fetched_pois = await fetch_pois_from_agent(request)
    except Exception as e:
        raise ValueError(f"Failed to fetch data from AI Agent: {str(e)}")

    if not fetched_pois:
        raise ValueError("The AI Agent returned zero POIs. Try relaxing the budget or filters.")

    city_lat, city_lon = await geocode_address(city, city)

    pois_per_day = max(1, len(fetched_pois) // days_count)

    all_waypoints = []
    daily_itineraries = []
    global_order = 0
    total_estimated_cost = 0.0

    for day_index in range(1, days_count + 1):
        day_stops = []
        try:
            current_time = datetime.strptime(prefs.start_time, "%H:%M")
            day_end_time = datetime.strptime(prefs.end_time, "%H:%M")
        except (ValueError, TypeError):
            logger.warning("Invalid start_time/end_time (%r/%r) — falling back to 09:00-18:00.", prefs.start_time, prefs.end_time)
            current_time = datetime.strptime("09:00", "%H:%M")
            day_end_time = datetime.strptime("18:00", "%H:%M")

        day_plan = request.daily_plans[day_index - 1] if day_index - 1 < len(request.daily_plans) else {}
        plan_start = day_plan.get("start", {}) if isinstance(day_plan, dict) else {}
        plan_final = day_plan.get("final_destination", {}) if isinstance(day_plan, dict) else {}

        start_name = plan_start.get("name") or city
        start_lat, start_lon = await geocode_address(start_name, city)
        if (start_lat, start_lon) == (0.0, 0.0):
            start_lat, start_lon = city_lat, city_lon

        day_stops.append(WaypointSchema(
            id=global_order + 8000,
            name=start_name,
            category="start_point",
            latitude=start_lat,
            longitude=start_lon,
            order_index=global_order,
            arrival_time=current_time.strftime("%I:%M %p"),
            departure_time=current_time.strftime("%I:%M %p"),
            estimated_cost=0.0,
        ))
        global_order += 1

        prev_coord = (start_lat, start_lon)

        start_idx = (day_index - 1) * pois_per_day
        end_idx = start_idx + pois_per_day if day_index < days_count else len(fetched_pois)
        day_pois = fetched_pois[start_idx:end_idx]

        for i, poi in enumerate(day_pois):
            poi_coord = (float(poi.get("latitude", city_lat)), float(poi.get("longitude", city_lon)))

            travel_time = await get_travel_time_minutes(prev_coord, poi_coord, prefs.transport)
            current_time += timedelta(minutes=travel_time)

            if current_time > day_end_time:
                logger.warning(
                    "Day %d would run past end_time (%s) — stopping at %d of %d planned stops.",
                    day_index, prefs.end_time, i, len(day_pois),
                )
                break

            duration_minutes = 60
            schedule_lbl = poi.get("schedule_label", "").lower()
            if "lunch" in schedule_lbl or "dinner" in schedule_lbl or "meal" in schedule_lbl:
                duration_minutes = 90

            poi_cost = float(poi.get("estimated_cost", 0.0))

            parking_cost = 0.0
            if prefs.transport == "by car":
                parking_cost = round(PARKING_RATE_PER_HOUR * max(1, math.ceil(duration_minutes / 60)), 2)

            if prefs.budget and prefs.budget > 0:
                projected_total = total_estimated_cost + poi_cost + parking_cost
                if projected_total > prefs.budget:
                    logger.warning(
                        "Adding '%s' would push the trip over budget (%.2f > %.2f) — stopping here.",
                        poi.get("name", "?"), projected_total, prefs.budget,
                    )
                    break

            if prefs.transport == "by car":
                walk_from_parking = 3
                parking_wp = WaypointSchema(
                    id=global_order + 9000,
                    name=f"Parking near {poi.get('name', city)}",
                    category="parking",
                    latitude=poi_coord[0] + random.uniform(-0.002, 0.002),
                    longitude=poi_coord[1] + random.uniform(-0.002, 0.002),
                    order_index=global_order,
                    arrival_time=current_time.strftime("%I:%M %p"),
                    departure_time=(current_time + timedelta(minutes=walk_from_parking)).strftime("%I:%M %p"),
                    estimated_cost=parking_cost,
                    travel_minutes_from_previous=travel_time,
                )
                day_stops.append(parking_wp)
                global_order += 1
                total_estimated_cost += parking_cost
                current_time += timedelta(minutes=walk_from_parking)

            arrival = current_time.strftime("%I:%M %p")
            current_time += timedelta(minutes=duration_minutes)
            departure = current_time.strftime("%I:%M %p")

            wp = WaypointSchema(
                id=global_order + 1000,
                name=poi.get("name", "Unknown Location"),
                category=poi.get("category", "attraction"),
                latitude=poi_coord[0],
                longitude=poi_coord[1],
                order_index=global_order,
                arrival_time=arrival,
                departure_time=departure,
                schedule_label=poi.get("schedule_label", f"{duration_minutes} min visit"),
                estimated_cost=poi_cost,
                travel_minutes_from_previous=travel_time,
                transit_to_next=TransitDetails(
                    transit_mode=prefs.transport,
                    travel_duration_minutes=travel_time
                ) if i < len(day_pois) - 1 else None
            )
            day_stops.append(wp)
            global_order += 1
            total_estimated_cost += poi_cost
            prev_coord = poi_coord

        final_name = plan_final.get("name") or start_name
        if final_name == start_name:
            final_lat, final_lon = start_lat, start_lon
        else:
            final_lat, final_lon = await geocode_address(final_name, city)
            if (final_lat, final_lon) == (0.0, 0.0):
                final_lat, final_lon = city_lat, city_lon

        travel_time_back = await get_travel_time_minutes(prev_coord, (final_lat, final_lon), prefs.transport)
        current_time += timedelta(minutes=travel_time_back)

        day_stops.append(WaypointSchema(
            id=global_order + 8500,
            name=final_name,
            category="end_point",
            latitude=final_lat,
            longitude=final_lon,
            order_index=global_order,
            arrival_time=current_time.strftime("%I:%M %p"),
            departure_time=current_time.strftime("%I:%M %p"),
            estimated_cost=0.0,
            travel_minutes_from_previous=travel_time_back,
        ))
        global_order += 1

        if not day_stops:
            continue

        start_wp = day_stops[0]
        final_wp = day_stops[-1]
        intermediate_stops = day_stops[1:-1] if len(day_stops) > 2 else (day_stops[1:] if len(day_stops) == 2 else [])

        daily_itineraries.append(
            DailyItinerarySchema(
                day=day_index,
                start=start_wp,
                stops=intermediate_stops,
                final_destination=final_wp
            )
        )
        all_waypoints.extend(day_stops)

    return RouteData(
        title=f"{request.title}",
        city=request.city,
        waypoints=all_waypoints,
        itineraries=daily_itineraries,
        initial_budget=request.preferences.budget or total_estimated_cost
    )