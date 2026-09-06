def normalize_async_db_url(url: str) -> str:
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+asyncpg://", 1)
    if url.startswith("postgres://"):  # some providers use the old "postgres://" scheme too
        return url.replace("postgres://", "postgresql+asyncpg://", 1)
    return url
