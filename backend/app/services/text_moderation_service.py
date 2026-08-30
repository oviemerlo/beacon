"""OpenAI text moderation. Fail open — never block posting on an API outage."""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from functools import lru_cache

from openai import APIConnectionError, APIError, APITimeoutError, AsyncOpenAI, AuthenticationError, RateLimitError

from app.utils.config import settings

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class TextModerationResult:
    decision: str
    top_category: str | None
    score: float | None
    raw_result_json: str | None


def _openai_configured() -> bool:
    return bool(settings.OPENAI_API_KEY)


@lru_cache(maxsize=1)
def _openai_client() -> AsyncOpenAI:
    return AsyncOpenAI(api_key=settings.OPENAI_API_KEY)


def _clean(*, raw_result_json: str | None = None) -> TextModerationResult:
    return TextModerationResult("clean", None, None, raw_result_json)


async def moderate_text(text: str) -> TextModerationResult:
    if not _openai_configured():
        logger.error("OpenAI API key missing; failing open as clean")
        return _clean()

    try:
        response = await _openai_client().moderations.create(model="omni-moderation-latest", input=text)
    except (RateLimitError, APIError, APIConnectionError, APITimeoutError, AuthenticationError) as exc:
        logger.error("OpenAI moderations.create failed: %s", exc)
        return _clean()

    if not response.results:
        return _clean()

    first = response.results[0]
    scores = first.category_scores.model_dump()
    raw = json.dumps(
        {
            "categories": first.categories.model_dump(),
            "category_scores": scores,
        }
    )
    if not scores:
        return _clean(raw_result_json=raw)

    top_category = max(scores, key=lambda name: float(scores.get(name) or 0))
    score = float(scores.get(top_category) or 0)
    # Scores are 0.0–1.0; do not compare against Rekognition's 0–100 thresholds.
    if score >= settings.MODERATION_TEXT_REJECT_CONFIDENCE:
        decision = "reject"
    elif score >= settings.MODERATION_TEXT_FLAG_CONFIDENCE:
        decision = "flag"
    else:
        decision = "clean"
    return TextModerationResult(decision, top_category, score, raw)
