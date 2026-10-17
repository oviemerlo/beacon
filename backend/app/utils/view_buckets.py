def bucket_view_count(count: int) -> str | None:
    """Privacy/UX bucketing for echo and reply view counts. None means
    'don't show anything yet' — showing exact counts under 5 can make
    a quiet post feel more exposed than useful."""
    if count < 5:
        return None
    if count < 10:
        return "5+"
    if count < 25:
        return "10+"
    if count < 50:
        return "25+"
    if count < 100:
        return "50+"
    if count < 500:
        return "100+"
    if count < 1000:
        return "500+"
    return "1k+"
