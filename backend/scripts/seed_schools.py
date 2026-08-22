"""
Seed schools from the Hipo university-domains dataset.

Run from backend/: python -m scripts.seed_schools

Source (checked into the repo):
  university-domains-list/world_universities_and_domains.json

Each JSON object maps to School(name, country, email_domains). Duplicate
(name, country) rows are merged so their domains are unioned. Re-running
upserts email_domains from the file (dataset is source of truth).
"""

from __future__ import annotations

import argparse
import asyncio
import json
from collections import defaultdict
from pathlib import Path

from sqlalchemy.dialects.postgresql import insert

from app.db.session import AsyncSessionLocal
from app.models.school import School

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_SOURCE = REPO_ROOT / "university-domains-list" / "world_universities_and_domains.json"
CHUNK_SIZE = 500


def _normalize_domain(value: str) -> str | None:
    domain = value.lower().strip().rstrip(".")
    if domain.startswith("www."):
        domain = domain[4:]
    if not domain or "@" in domain or "/" in domain or " " in domain or ":" in domain:
        return None
    return domain


def load_schools(source: Path) -> tuple[list[dict], int]:
    raw = json.loads(source.read_text(encoding="utf-8"))
    if not isinstance(raw, list):
        raise ValueError(f"Expected a JSON array in {source}")

    merged: dict[tuple[str, str], set[str]] = defaultdict(set)
    skipped = 0
    for entry in raw:
        if not isinstance(entry, dict):
            skipped += 1
            continue
        name = str(entry.get("name") or "").strip()[:200]
        country = str(entry.get("country") or "").strip()[:100]
        domains = {_normalize_domain(str(item)) for item in (entry.get("domains") or [])}
        domains.discard(None)
        if not name or not country or not domains:
            skipped += 1
            continue
        merged[(name, country)].update(domains)

    rows = [
        {"name": name, "country": country, "email_domains": sorted(domains)}
        for (name, country), domains in sorted(merged.items())
    ]
    return rows, skipped


async def seed(source: Path) -> None:
    rows, skipped = load_schools(source)
    created_or_updated = 0
    async with AsyncSessionLocal() as db:
        for start in range(0, len(rows), CHUNK_SIZE):
            chunk = rows[start : start + CHUNK_SIZE]
            stmt = insert(School).values(chunk)
            stmt = stmt.on_conflict_do_update(
                constraint="uq_school_name_country",
                set_={"email_domains": stmt.excluded.email_domains},
            )
            result = await db.execute(stmt)
            created_or_updated += result.rowcount or 0
        await db.commit()
    print(
        f"Seeded {len(rows)} schools from {source} "
        f"({created_or_updated} rows inserted/updated, {skipped} source rows skipped)."
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed the schools table from the university-domains dataset.")
    parser.add_argument(
        "--source",
        type=Path,
        default=DEFAULT_SOURCE,
        help="Path to world_universities_and_domains.json",
    )
    args = parser.parse_args()
    if not args.source.is_file():
        raise SystemExit(f"University dataset not found: {args.source}")
    asyncio.run(seed(args.source))


if __name__ == "__main__":
    main()
