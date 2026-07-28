"""
Run once against a fresh database: python -m scripts.seed_tags
Seeds a starter tag taxonomy. Extend this list as needed — the schema
supports arbitrary tags of type 'nationality' or 'hobby'.
"""

import asyncio

from sqlalchemy import select

from app.db.session import AsyncSessionLocal
from app.models.tag import Tag

NATIONALITIES = [
    "Nigeria", "Kenya", "Ghana", "India", "Pakistan", "Philippines", "China",
    "Mexico", "Brazil", "Ukraine", "Poland", "Vietnam", "Syria", "Somalia",
    "Jamaica", "Colombia", "South Korea", "Ethiopia", "Afghanistan", "Iran",
]

HOBBIES = [
    "Football", "Basketball", "Cricket", "Cooking", "Board Games", "Hiking",
    "Photography", "Reading", "Live Music", "Gardening", "Cycling", "Chess",
    "Language Exchange", "Dance", "Volunteering", "Faith Groups", "Gaming",
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
        await db.commit()
    print(f"Seeded {len(NATIONALITIES)} nationality tags and {len(HOBBIES)} hobby tags.")


if __name__ == "__main__":
    asyncio.run(seed())
