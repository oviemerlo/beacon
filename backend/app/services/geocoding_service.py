"""Server-side reverse geocoding with city-level granularity only."""

import httpx

from app.core.config import settings

_GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json"
_RESULT_TYPES = "locality|postal_town|administrative_area_level_2|administrative_area_level_1"
_REQUEST_TIMEOUT_SECONDS = 5.0


def _pick_component(components: list[dict], preferred_types: tuple[str, ...], value_key: str = "long_name") -> str | None:
    for component_type in preferred_types:
        for component in components:
            types = component.get("types") or []
            if component_type in types:
                value = component.get(value_key)
                if isinstance(value, str) and value.strip():
                    return value.strip()
    return None


def reverse_geocode(latitude: float, longitude: float) -> str | None:
    """
    Returns a coarse label like "City, Region" or None.

    Design constraints:
    - Never raises; this is best-effort enrichment only.
    - Uses result_type filter so we never request street-level output.
    """
    api_key = settings.GOOGLE_GEOCODING_API_KEY.strip()
    if not api_key:
        return None

    params = {
        "latlng": f"{latitude},{longitude}",
        "result_type": _RESULT_TYPES,
        "key": api_key,
    }

    try:
        response = httpx.get(_GEOCODE_URL, params=params, timeout=_REQUEST_TIMEOUT_SECONDS)
        response.raise_for_status()
        payload = response.json()
    except Exception:
        return None

    if payload.get("status") != "OK":
        return None

    results = payload.get("results")
    if not isinstance(results, list) or not results:
        return None

    components = []
    for result in results:
        if isinstance(result, dict):
            address_components = result.get("address_components")
            if isinstance(address_components, list):
                components.extend([c for c in address_components if isinstance(c, dict)])

    if not components:
        return None

    city = _pick_component(
        components,
        ("locality", "postal_town", "administrative_area_level_2"),
        value_key="long_name",
    )
    region = _pick_component(
        components,
        ("administrative_area_level_1", "country"),
        value_key="short_name",
    )

    if not city and not region:
        return None
    if city and region:
        return f"{city}, {region}"
    return city or region
