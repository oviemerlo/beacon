"""
Run once against a fresh database: python -m scripts.seed_tags
Seeds a starter tag taxonomy. Extend this list as needed — the schema
supports arbitrary tags of type 'nationality', 'hobby', or 'community'.
"""

import asyncio

import pycountry
from sqlalchemy import select

from app.db.session import AsyncSessionLocal
from app.models.tag import Tag

NATIONALITIES = sorted(
    {
        getattr(country, "common_name", None) or country.name
        for country in pycountry.countries
    }
)

HOBBIES = [
    "Football", "Basketball", "Cricket", "Cooking", "Board Games", "Tennis", "Hiking",
    "Photography", "Reading", "Live Music", "Gardening", "Cycling", "Chess",
    "Language Exchange", "Dance", "Volunteering", "Faith Groups", "Gaming",
]

COMMUNITY = [
    "LGBT-friendly",
    "Women's group",
    "Newcomer meetup",
    "Family-friendly",
    "Students",
    "Professionals",
    "Parents",
    "Seniors",
    "Faith-based",
    "Disability-friendly",
]


async def seed():
    async with AsyncSessionLocal() as db:
        for label in NATIONALITIES:
            exists = await db.execute(select(Tag.id).where(Tag.tag_type == "nationality", Tag.label == label))
            if exists.scalar_one_or_none() is None:
                db.add(Tag(tag_type="nationality", label=label))
        for label in HOBBIES:
            exists = await db.execute(select(Tag.id).where(Tag.tag_type == "hobby", Tag.label == label))
            if exists.scalar_one_or_none() is None:
                db.add(Tag(tag_type="hobby", label=label))
        for label in COMMUNITY:
            exists = await db.execute(select(Tag.id).where(Tag.tag_type == "community", Tag.label == label))
            if exists.scalar_one_or_none() is None:
                db.add(Tag(tag_type="community", label=label))
        await db.commit()
    print(
        f"Seeded {len(NATIONALITIES)} nationality tags, {len(HOBBIES)} hobby tags, "
        f"and {len(COMMUNITY)} community tags."
    )


if __name__ == "__main__":
    asyncio.run(seed())
