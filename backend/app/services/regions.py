"""13-region taxonomy used by Premium region targeting and Follow Tags.

Reads backend/region_country.json once at import. Callers should use
ALL_REGIONS, COUNTRY_TO_REGION, REGION_TO_COUNTRIES, and
get_countries_for_region() rather than duplicating the region list.
"""

from __future__ import annotations

import json
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[2]
_DATA_PATH = BACKEND_ROOT / "region_country.json"

with _DATA_PATH.open(encoding="utf-8") as _fh:
    _DATA = json.load(_fh)

ALL_REGIONS: list[str] = list(_DATA["_meta"]["regions"])
COUNTRY_CODE_TO_NAME: dict[str, str] = {}
COUNTRY_TO_REGION: dict[str, str] = {}
REGION_TO_COUNTRIES: dict[str, list[str]] = {region: [] for region in ALL_REGIONS}
for _code, _info in _DATA["countries"].items():
    COUNTRY_CODE_TO_NAME[_code] = _info["name"]
    COUNTRY_TO_REGION[_code] = _info["region"]
    REGION_TO_COUNTRIES.setdefault(_info["region"], []).append(_code)

REGION_COUNTRY_NAMES: dict[str, list[str]] = {
    region: sorted(COUNTRY_CODE_TO_NAME[code] for code in codes if code in COUNTRY_CODE_TO_NAME)
    for region, codes in REGION_TO_COUNTRIES.items()
}

COUNTRY_NAME_TO_REGION: dict[str, str] = {
    name: region for region, names in REGION_COUNTRY_NAMES.items() for name in names
}


def get_countries_for_region(region: str) -> list[str]:
    """Return sorted country/territory names included in a region."""
    return list(REGION_COUNTRY_NAMES.get(region, []))


def get_region_for_country_name(country_name: str) -> str | None:
    return COUNTRY_NAME_TO_REGION.get(country_name)
