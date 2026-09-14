import httpx
import logging
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

_geocode_cache: Dict[str, Tuple[float, float]] = {}


async def geocode_address(address: str, city: str) -> Tuple[float, float]:
    """
    Resolves free-text address (or the city itself) to real (latitude,
    longitude) via Nominatim/OpenStreetMap, so start/end waypoints and the
    city-center fallback land at their real location on the map instead of
    a placeholder or another city's hardcoded coordinates.

    Returns (0.0, 0.0) on any failure — callers must treat that as
    "unknown" and fall back to something sane (e.g. the city center),
    never display it as a real pin.
    """
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
    """
    Translates the main app's RouteCreate/RoutePreferences into the exact
    payload contract expected by the WayFinder-Agent microservice
    (see travel-agent-service/app/schemas.py::TravelSearchRequest).

    Kept as a pure function (no I/O) so it's unit-testable on its own,
    separate from the actual HTTP call in fetch_pois_from_agent.
    """
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
            # Surface the agent's actual error body (e.g. Pydantic validation details on a 422) instead of a generic "422 Unprocessable Content" with no explanation of which field failed.
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

    # City center is the safe fallback whenever a specific address cant be geocoded — never hardcode another city's coordinates here.
    city_lat, city_lon = await geocode_address(city, city)

    pois_per_day = max(1, len(fetched_pois) // days_count)

    all_waypoints = []
    daily_itineraries = []
    global_order = 0
    total_estimated_cost = 0.0

    for day_index in range(1, days_count + 1):
        day_stops = []
        current_time = datetime.strptime("09:00 AM", "%I:%M %p")

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

        start_idx = (day_index - 1) * pois_per_day
        end_idx = start_idx + pois_per_day if day_index < days_count else len(fetched_pois)
        day_pois = fetched_pois[start_idx:end_idx]

        for i, poi in enumerate(day_pois):
            travel_time = 15 if prefs.transport == "walking" else (5 if prefs.transport == "by car" else 10)

            if prefs.transport == "by car":
                parking_wp = WaypointSchema(
                    id=global_order + 9000,
                    name=f"Parking near {poi.get('name', city)}",
                    category="parking",
                    latitude=float(poi.get('latitude', city_lat)) + random.uniform(-0.002, 0.002),
                    longitude=float(poi.get('longitude', city_lon)) + random.uniform(-0.002, 0.002),
                    order_index=global_order,
                    arrival_time=current_time.strftime("%I:%M %p"),
                    departure_time=(current_time + timedelta(minutes=5)).strftime("%I:%M %p"),
                    estimated_cost=5.0,
                )
                day_stops.append(parking_wp)
                global_order += 1
                total_estimated_cost += 5.0
                current_time += timedelta(minutes=5)

            current_time += timedelta(minutes=travel_time)
            arrival = current_time.strftime("%I:%M %p")

            duration_minutes = 60
            schedule_lbl = poi.get("schedule_label", "").lower()
            if "lunch" in schedule_lbl or "dinner" in schedule_lbl or "meal" in schedule_lbl:
                duration_minutes = 90

            current_time += timedelta(minutes=duration_minutes)
            departure = current_time.strftime("%I:%M %p")

            cost = float(poi.get("estimated_cost", 0.0))

            wp = WaypointSchema(
                id=global_order + 1000,
                name=poi.get("name", "Unknown Location"),
                category=poi.get("category", "attraction"),
                latitude=float(poi.get("latitude", city_lat)),
                longitude=float(poi.get("longitude", city_lon)),
                order_index=global_order,
                arrival_time=arrival,
                departure_time=departure,
                schedule_label=poi.get("schedule_label", f"{duration_minutes} min visit"),
                estimated_cost=cost,
                travel_minutes_from_previous=travel_time,
                transit_to_next=TransitDetails(
                    transit_mode=prefs.transport,
                    travel_duration_minutes=travel_time
                ) if i < len(day_pois) - 1 else None
            )
            day_stops.append(wp)
            global_order += 1
            total_estimated_cost += cost

        final_name = plan_final.get("name") or start_name
        if final_name == start_name:
            final_lat, final_lon = start_lat, start_lon
        else:
            final_lat, final_lon = await geocode_address(final_name, city)
            if (final_lat, final_lon) == (0.0, 0.0):
                final_lat, final_lon = city_lat, city_lon

        travel_time_back = 15 if prefs.transport == "walking" else (5 if prefs.transport == "by car" else 10)
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