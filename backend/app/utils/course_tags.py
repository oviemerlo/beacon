"""Canonical course-tag spelling.

CHEM1000, CHEM 1000, and CHEM.  1000 all become CHEM 1000: punctuation and extra
spaces are dropped, then a single space sits between the letter prefix and the rest.
Max length applies to the compact letters+digits form (CHEM1000 is 8).
"""

COURSE_TAG_MAX_LEN = 8


def compact_course_key(value: str) -> str:
    return "".join(ch for ch in (value or "").upper() if ch.isalnum())


def format_course_tag(compact: str) -> str:
    index = 0
    while index < len(compact) and compact[index].isalpha():
        index += 1
    prefix, rest = compact[:index], compact[index:]
    if prefix and rest:
        return f"{prefix} {rest}"
    return compact


def canonical_course_tag(value: str) -> str:
    compact = compact_course_key(value)
    if not compact:
        return ""
    return format_course_tag(compact)
