from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.utils.config import settings
from app.utils.db import normalize_async_db_url

engine = create_async_engine(normalize_async_db_url(settings.DATABASE_URL), echo=(settings.ENVIRONMENT == "development"), pool_pre_ping=True)

AsyncSessionLocal = async_sessionmaker(bind=engine, expire_on_commit=False, class_=AsyncSession)


async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        yield session
