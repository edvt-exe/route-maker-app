from __future__ import annotations

from math import cos, radians
from typing import Iterable

import requests

from app.schemas.route import LocationInput, PointOfInterest
from app.services.itinerary import haversine_km, normalize

OVERPASS_ENDPOINTS = (
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
)
OSRM_ENDPOINT = "https://router.project-osrm.org/route/v1"
OSM_TIMEOUT_SECONDS = 20

TAG_TO_CATEGORY = {
    "museum": "culture",
    "attraction": "attraction",
    "historic": "historical",
    "cafe": "cafe",
    "restaurant": "dining",
}


def _center(plans: Iterable[tuple[int, LocationInput, LocationInput]]) -> LocationInput:
    locations = [location for _, start, final in plans for location in (start, final)]
    return LocationInput(
        name="route center",
        latitude=sum(location.latitude for location in locations) / len(locations),
        longitude=sum(location.longitude for location in locations) / len(locations),
    )


def _query(center: LocationInput) -> dict:
    lat_delta = 15 / 111
    lon_delta = 15 / max(111 * 0.25, 111 * abs(cos(radians(center.latitude))))
    south, west = center.latitude - lat_delta, center.longitude - lon_delta
    north, east = center.latitude + lat_delta, center.longitude + lon_delta
    # These are the only OSM tags accepted by the planner. No generic business query exists.
    query = f"""[out:json][timeout:20];
(
  nwr["tourism"="museum"]({south},{west},{north},{east});
  nwr["tourism"="attraction"]({south},{west},{north},{east});
  nwr["historic"]({south},{west},{north},{east});
  nwr["amenity"="cafe"]({south},{west},{north},{east});
  nwr["amenity"="restaurant"]({south},{west},{north},{east});
);
out center tags;"""
    last_error: Exception | None = None
    for endpoint in OVERPASS_ENDPOINTS:
        try:
            response = requests.post(endpoint, data={"data": query}, timeout=OSM_TIMEOUT_SECONDS)
            response.raise_for_status()
            return response.json()
        except (requests.RequestException, ValueError) as error:
            last_error = error
    raise RuntimeError("Overpass is unavailable") from last_error


def fetch_pois(plans: Iterable[tuple[int, LocationInput, LocationInput]]) -> list[PointOfInterest]:
    plan_list = list(plans)
    center = _center(plan_list)
    data = _query(center)
    pois: list[PointOfInterest] = []
    seen: set[str] = set()
    for element in data.get("elements", []):
        tags = element.get("tags", {})
        name = tags.get("name")
        latitude = element.get("lat", element.get("center", {}).get("lat"))
        longitude = element.get("lon", element.get("center", {}).get("lon"))
        if not name or latitude is None or longitude is None:
            continue
        osm_type = tags.get("tourism") or tags.get("amenity") or ("historic" if "historic" in tags else "")
        category = TAG_TO_CATEGORY.get(osm_type)
        if not category:
            continue
        key = normalize(name)
        if key in seen:
            continue
        seen.add(key)
        significant = bool(tags.get("wikipedia") or tags.get("wikidata"))
        pois.append(PointOfInterest(
            name=name,
            category=category,
            place_types=[osm_type],
            latitude=float(latitude),
            longitude=float(longitude),
            rating=4.8 if significant else 0,
            review_count=100000 if significant else 0,
            popularity_score=1 if significant else 0,
            cuisine_types=[value.strip() for value in tags.get("cuisine", "").split(";") if value.strip()],
            wheelchair_accessible=tags.get("wheelchair") == "yes",
            tags=list(tags.values()),
            required=False,
        ))
    return pois


def osrm_duration_minutes(first, second, mode: str, fallback_wait: int = 0) -> int:
    profile = "driving" if mode == "driving" else "foot"
    coordinates = f"{first.longitude},{first.latitude};{second.longitude},{second.latitude}"
    try:
        response = requests.get(f"{OSRM_ENDPOINT}/{profile}/{coordinates}", params={"overview": "false"}, timeout=10)
        response.raise_for_status()
        seconds = response.json()["routes"][0]["duration"]
        return max(1, round(seconds / 60))
    except (requests.RequestException, KeyError, IndexError, TypeError, ValueError):
        distance = haversine_km(first, second)
        speed = 35 if mode == "driving" else 4.5
        return max(5, round(distance / speed * 60)) + (fallback_wait if mode == "transit" else 0)