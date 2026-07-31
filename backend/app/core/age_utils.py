from datetime import date


def calculate_age(date_of_birth: date, today: date | None = None) -> int:
    """Returns full years elapsed at `today` (defaults to current date)."""
    reference_day = today or date.today()
    years = reference_day.year - date_of_birth.year
    if (reference_day.month, reference_day.day) < (date_of_birth.month, date_of_birth.day):
        years -= 1
    return years


def validate_date_of_birth(
    date_of_birth: date,
    *,
    min_age_years: int,
    max_age_years: int = 120,
    today: date | None = None,
) -> str | None:
    """
    Returns a human-readable validation error or None when valid.

    Kept framework-agnostic so services can map to domain exceptions.
    """
    reference_day = today or date.today()
    if date_of_birth > reference_day:
        return "Birthdate cannot be in the future"

    years = calculate_age(date_of_birth, reference_day)
    if years < min_age_years:
        return f"Must be at least {min_age_years} years old"
    if years > max_age_years:
        return "Birthdate is invalid"
    return None
