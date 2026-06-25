"""AI-powered goal savings calculations and projections.

Extracted from gemini_service.py to keep files focused and maintainable.
"""

import json
import os
from datetime import date, datetime
from decimal import Decimal
from typing import Any
from urllib import request

from app.services.gemini_transport import (
    configure_gemini_tls,
    gemini_generate_endpoint,
)
from app.schemas.goal import (
    GoalAICalculationRequest,
    GoalAICalculationResponse,
    GoalProjectionPoint,
    GoalProjectionResponse,
)

configure_gemini_tls()
GEMINI_ENDPOINT = gemini_generate_endpoint()


# -- Shared helper -----------------------------------------------------------


def _call_gemini_json(
    prompt: str,
    max_tokens: int = 512,
    temperature: float = 0.3,
) -> dict[str, Any] | None:
    """Call Gemini; return parsed JSON or None on failure."""
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        return None
    body = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": temperature,
            "maxOutputTokens": max_tokens,
        },
    }
    req = request.Request(
        f"{GEMINI_ENDPOINT}?key={api_key}",
        data=json.dumps(body).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with request.urlopen(req, timeout=20) as response:
            payload = json.loads(
                response.read().decode("utf-8")
            )
        text = (
            payload["candidates"][0]["content"]["parts"][0]
            ["text"]
        )
        return json.loads(
            text[text.find("{"):text.rfind("}") + 1]
        )
    except Exception:
        return None


# -- Goal: AI Savings Calculator --------------------------------------------


def _fallback_required_monthly(
    target: Decimal,
    current: Decimal,
    deadline: date | None,
) -> Decimal:
    if not deadline:
        return Decimal("0")
    remaining_days = (
        datetime.combine(deadline, datetime.min.time())
        - datetime.now()
    ).days
    months = max(remaining_days / 30.0, 1)
    needed = max(target - current, Decimal("0"))
    return max(needed / Decimal(str(months)), Decimal("0"))


def calculate_goal_savings(
    request_data: GoalAICalculationRequest,
) -> GoalAICalculationResponse:
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        heuristic = _fallback_required_monthly(
            request_data.target_amount,
            request_data.current_amount,
            request_data.deadline,
        )
        return GoalAICalculationResponse(
            required_monthly=heuristic,
            provider="heuristic",
            rationale=(
                "Calculated based on remaining amount "
                "and months until deadline."
            ),
        )

    prompt = (
        "You are a financial planning assistant. "
        "Calculate the required monthly contribution "
        "to reach a savings goal by its deadline.\n\n"
        f"Target amount: ${request_data.target_amount}\n"
        f"Current saved: ${request_data.current_amount}\n"
        f"Deadline: {request_data.deadline}\n"
        "Return strict JSON with keys: "
        "required_monthly (number, the monthly amount needed), "
        "rationale (string, a brief explanation).\n"
        "Assume contributions are made monthly starting now."
    )
    result = _call_gemini_json(prompt)
    if result and "required_monthly" in result:
        return GoalAICalculationResponse(
            required_monthly=Decimal(
                str(result["required_monthly"])
            ),
            provider="gemini",
            rationale=str(result.get("rationale", "")),
        )
    heuristic = _fallback_required_monthly(
        request_data.target_amount,
        request_data.current_amount,
        request_data.deadline,
    )
    return GoalAICalculationResponse(
        required_monthly=heuristic,
        provider="heuristic",
        rationale=(
            "Gemini unavailable; calculated based on "
            "remaining amount and months until deadline."
        ),
    )


# -- Goal: AI Projection ----------------------------------------------------


def _fallback_projection(
    target: Decimal,
    current: Decimal,
    deadline: date | None,
) -> GoalProjectionResponse:
    points = 6
    remaining = max(target - current, Decimal("0"))
    monthly = Decimal("0")
    if deadline:
        remaining_days = (
            datetime.combine(deadline, datetime.min.time())
            - datetime.now()
        ).days
        months = max(remaining_days / 30.0, 1)
        monthly = max(
            remaining / Decimal(str(months)), Decimal("0")
        )

    projections: list[GoalProjectionPoint] = []
    running = current
    for i in range(points):
        running += monthly
        projected = min(running, target)
        projections.append(
            GoalProjectionPoint(
                month=f"M{i + 1}", projected=projected
            )
        )
        if projected >= target:
            break
    return GoalProjectionResponse(
        projections=projections,
        provider="heuristic",
        rationale=(
            "Linear projection based on "
            "required monthly contribution."
        ),
    )


def calculate_goal_projection(
    request_data: GoalAICalculationRequest,
) -> GoalProjectionResponse:
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        return _fallback_projection(
            request_data.target_amount,
            request_data.current_amount,
            request_data.deadline,
        )

    prompt = (
        "You are a financial planning assistant. "
        "Given a savings goal, generate a month-by-month "
        "projection of how the saved amount grows "
        "over time to reach the target.\n\n"
        f"Target amount: ${request_data.target_amount}\n"
        f"Current saved: ${request_data.current_amount}\n"
        f"Deadline: {request_data.deadline}\n\n"
        "Return strict JSON with keys:\n"
        "- projections: array of objects with 'month' "
        "(string like 'M1', 'M2', ...) and 'projected' "
        "(number, the cumulative saved amount)\n"
        "- rationale: string explaining the projection\n"
        "Generate at most 12 points. "
        "Stop when projected reaches or exceeds target."
    )
    result = _call_gemini_json(prompt, max_tokens=1024)
    if result and "projections" in result:
        projections = [
            GoalProjectionPoint(
                month=p["month"],
                projected=Decimal(str(p["projected"])),
            )
            for p in result["projections"]
        ]
        return GoalProjectionResponse(
            projections=projections,
            provider="gemini",
            rationale=str(result.get("rationale", "")),
        )
    return _fallback_projection(
        request_data.target_amount,
        request_data.current_amount,
        request_data.deadline,
    )
