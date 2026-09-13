import httpx
import random
from datetime import datetime, timedelta
from typing import List, Dict, Any
from sqlalchemy.orm import Session

from app.schemas.route import (
    RouteCreate, RouteData, DailyItinerarySchema,
    WaypointSchema, TransitDetails
)


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

    pois_per_day = max(1, len(fetched_pois) // days_count)

    all_waypoints = []
    daily_itineraries = []
    global_order = 0
    total_estimated_cost = 0.0

    for day_index in range(1, days_count + 1):
        day_stops = []
        current_time = datetime.strptime("09:00 AM", "%I:%M %p")

        start_idx = (day_index - 1) * pois_per_day
        end_idx = start_idx + pois_per_day if day_index < days_count else len(fetched_pois)
        day_pois = fetched_pois[start_idx:end_idx]

        if prefs.transport == "by car" and day_pois:
            first_poi = day_pois[0]
            parking_wp = WaypointSchema(
                id=global_order + 9000,
                name=f"Parking near {first_poi.get('name', city)}",
                category="parking",
                latitude=float(first_poi.get('latitude', 44.4268)) + random.uniform(-0.002, 0.002),
                longitude=float(first_poi.get('longitude', 26.1025)) + random.uniform(-0.002, 0.002),
                order_index=global_order,
                arrival_time=current_time.strftime("%I:%M %p"),
                departure_time=(current_time + timedelta(minutes=15)).strftime("%I:%M %p"),
                estimated_cost=15.0
            )
            day_stops.append(parking_wp)
            global_order += 1
            total_estimated_cost += 15.0
            current_time += timedelta(minutes=15)

        for i, poi in enumerate(day_pois):
            travel_time = 15 if prefs.transport == "walking" else (5 if prefs.transport == "by car" else 10)

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
                latitude=float(poi.get("latitude", 0.0)),
                longitude=float(poi.get("longitude", 0.0)),
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