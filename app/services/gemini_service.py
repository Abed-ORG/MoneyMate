import json
import os
import re
from dataclasses import dataclass
from datetime import date, datetime
from difflib import SequenceMatcher
from decimal import Decimal
from typing import Any
from urllib import request

from app.schemas.transaction import AiCategorization

from app.schemas.insights import (
    AnomalyDetectionResponse,
    AnomalyTransaction,
    MonthlySummaryResponse,
    RecurringTransaction,
    RecurringDetectionResponse,
    SpendingInsightItem,
    SpendingInsightResponse,
)
from app.schemas.goal import (
    GoalAICalculationRequest,
    GoalAICalculationResponse,
    GoalProjectionPoint,
    GoalProjectionResponse,
)


GEMINI_ENDPOINT = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    "gemini-1.5-flash:generateContent"
)

CATEGORY_CONTEXT: dict[str, dict[str, list[str] | str]] = {
    "Food & Dining": {
        "description": (
            "Restaurants, cafes, coffee shops, takeout, delivery, "
            "snacks, meals, drinks, and food subscriptions."
        ),
        "keywords": [
            "restaurant", "cafe", "coffee", "starbucks", "dining",
            "meal", "lunch", "dinner", "breakfast", "takeout",
            "delivery", "ubereats", "doordash", "grubhub", "drink",
            "latte", "smoothie",
        ],
    },
    "Transport": {
        "description": (
            "Rideshares, taxis, public transit, parking, tolls, "
            "fuel, car washes, and vehicle-related travel costs."
        ),
        "keywords": [
            "uber", "lyft", "taxi", "bus", "train", "metro",
            "subway", "parking", "toll", "fuel", "gas", "shell",
            "chevron", "exxon", "ride",
        ],
    },
    "Housing": {
        "description": (
            "Rent, mortgage, lease payments, property costs, "
            "repairs, maintenance, furniture for the home, "
            "and housing fees."
        ),
        "keywords": [
            "rent", "mortgage", "lease", "apartment", "condo",
            "hoa", "property", "maintenance", "repair",
        ],
    },
    "Groceries": {
        "description": (
            "Supermarkets, grocery stores, fresh food markets, "
            "household food staples, and pantry shopping."
        ),
        "keywords": [
            "grocery", "groceries", "supermarket", "market",
            "whole foods", "aldi", "walmart", "costco", "safeway",
        ],
    },
    "Entertainment": {
        "description": (
            "Streaming, movies, concerts, events, games, hobbies, "
            "subscriptions for fun, and tickets."
        ),
        "keywords": [
            "netflix", "spotify", "movie", "cinema", "concert",
            "game", "ticket", "theater", "show",
        ],
    },
    "Shopping": {
        "description": (
            "Retail purchases, clothing, electronics, "
            "online shopping, Amazon, general stores, "
            "and non-essential consumer buys."
        ),
        "keywords": [
            "amazon", "store", "shop", "mall", "retail",
            "target", "best buy", "walmart", "clothing", "shoes",
        ],
    },
    "Healthcare": {
        "description": (
            "Doctor visits, pharmacies, prescriptions, dental, "
            "vision, therapy, medical devices, "
            "and health insurance copays."
        ),
        "keywords": [
            "pharmacy", "doctor", "medical", "hospital",
            "clinic", "dental", "vision", "prescription",
            "therapy", "health",
        ],
    },
    "Utilities": {
        "description": (
            "Electricity, water, gas bills, internet, phone "
            "service, trash, streaming infrastructure, "
            "and recurring household bills."
        ),
        "keywords": [
            "electric", "water", "internet", "utility", "phone",
            "wifi", "cable", "trash", "sewer",
        ],
    },
    "Education": {
        "description": (
            "Tuition, school fees, courses, books, supplies, "
            "certifications, and learning platforms."
        ),
        "keywords": [
            "tuition", "school", "course", "book", "books",
            "class", "education", "udemy", "coursera",
            "school supplies",
        ],
    },
    "Travel": {
        "description": (
            "Flights, hotels, Airbnbs, vacation rentals, "
            "travel agencies, luggage, "
            "and travel booking expenses."
        ),
        "keywords": [
            "flight", "hotel", "airbnb", "booking", "travel",
            "trip", "vacation", "luggage", "airline",
        ],
    },
    "Personal Care": {
        "description": (
            "Haircuts, salons, spa visits, grooming, cosmetics, "
            "toiletries, and self-care products or services."
        ),
        "keywords": [
            "salon", "spa", "haircut", "barber", "beauty",
            "grooming", "toiletries", "cosmetics", "skincare",
        ],
    },
}

COMMON_ALIASES: dict[str, str] = {
    "mcdo": "Food & Dining",
    "mcd": "Food & Dining",
    "mcdonalds": "Food & Dining",
    "mcdonald's": "Food & Dining",
    "starbucks": "Food & Dining",
    "uber": "Transport",
    "lyft": "Transport",
    "airbnb": "Travel",
    "netflix": "Entertainment",
    "spotify": "Entertainment",
    "amazon": "Shopping",
    "wholefoods": "Groceries",
    "whole food": "Groceries",
    "shell": "Transport",
}


@dataclass
class GeminiRequest:
    vendor: str
    notes: str
    amount: str
    category_names: list[str]
    correction_history: list[str]


def _fallback_suggestion(
    vendor: str, notes: str, amount: str
) -> AiCategorization:
    text = f"{vendor} {notes}".lower()
    compact_text = re.sub(r"[^a-z0-9]+", "", text)

    for alias, category in COMMON_ALIASES.items():
        alias_compact = re.sub(r"[^a-z0-9]+", "", alias.lower())
        if (
            alias in text
            or alias_compact == compact_text
            or alias_compact in compact_text
        ):
            return AiCategorization(
                category=category,
                confidence=96,
                provider="heuristic",
                rationale=(
                    f"Matched common merchant alias "
                    f"for {category}."
                ),
            )

    for category, details in CATEGORY_CONTEXT.items():
        keywords = details["keywords"]
        for keyword in keywords:
            keyword_compact = re.sub(
                r"[^a-z0-9]+", "", keyword.lower()
            )
            if (
                keyword in text
                or keyword_compact in compact_text
                or compact_text
                and (
                    SequenceMatcher(
                        None, compact_text, keyword_compact
                    ).ratio() >= 0.78
                )
            ):
                return AiCategorization(
                    category=category,
                    confidence=92,
                    provider="heuristic",
                    rationale=(
                        "Matched vendor/description "
                        f"keywords for {category}."
                    ),
                )
    return AiCategorization(
        category="Other",
        confidence=58,
        provider="heuristic",
        rationale=(
            f"Used fallback reasoning for {vendor or amount}."
        ),
    )


def suggest_category(
    request_data: GeminiRequest,
) -> AiCategorization:
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        return _fallback_suggestion(
            request_data.vendor,
            request_data.notes,
            request_data.amount,
        )

    category_guidance = "\n".join(
        f"- {name}: {details['description']}"
        for name, details in CATEGORY_CONTEXT.items()
        if name in request_data.category_names
    )
    prompt = (
        "Classify this personal finance transaction "
        "into exactly one "
        "category. Return strict JSON with keys category, "
        "confidence, rationale.\n"
        "Important: never choose Other if any specific "
        "category is a reasonable fit.\n"
        "Use Other only when the merchant, notes, and amount "
        "are unrelated to every listed category.\n\n"
        "Be tolerant of abbreviations, misspellings, "
        "and merchant aliases "
        "such as mcdo or mcdonalds "
        "for fast-food purchases.\n\n"
        f"Vendor: {request_data.vendor}\n"
        f"Notes: {request_data.notes}\n"
        f"Amount: {request_data.amount}\n"
        "Allowed categories: "
        f"{', '.join(request_data.category_names)}\n"
        "Category guidance:\n"
        f"{category_guidance}\n"
        "Past user corrections: "
        f"{', '.join(request_data.correction_history) or 'none'}\n"
    )
    body = {
        "contents": [
            {"parts": [{"text": prompt}]}
        ],
        "generationConfig": {
            "temperature": 0.2,
            "maxOutputTokens": 128,
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
    except Exception:
        return _fallback_suggestion(
            request_data.vendor,
            request_data.notes,
            request_data.amount,
        )

    try:
        text = (
            payload["candidates"][0]["content"]["parts"][0]
            ["text"]
        )
        data = json.loads(
            text[text.find("{"):text.rfind("}") + 1]
        )
        category = (
            str(data.get("category", "Other")).strip() or "Other"
        )
        confidence = int(data.get("confidence", 70))
        rationale = str(data.get("rationale", "")).strip()
        fallback = _fallback_suggestion(
            request_data.vendor,
            request_data.notes,
            request_data.amount,
        )
        if category not in request_data.category_names:
            category = fallback.category
            confidence = max(confidence, fallback.confidence)
            rationale = rationale or fallback.rationale
        elif (
            category == "Other"
            and fallback.category != "Other"
        ):
            category = fallback.category
            confidence = max(confidence, fallback.confidence)
            rationale = fallback.rationale
        return AiCategorization(
            category=category,
            confidence=max(0, min(100, confidence)),
            provider="gemini",
            rationale=rationale[:240],
        )
    except Exception:
        return _fallback_suggestion(
            request_data.vendor,
            request_data.notes,
            request_data.amount,
        )


# -- Helper: call Gemini, return parsed JSON ------------------------


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


# -- Goal: AI Savings Calculator ------------------------------------


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


# -- Goal: AI Projection --------------------------------------------


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


# -- Insights: Spending Pattern Analysis -----------------------------


def _fallback_spending_insights(
    transactions: list[dict],
) -> SpendingInsightResponse:
    by_category: dict[str, list[float]] = {}
    for tx in transactions:
        cat = tx.get("category", "Other")
        amt = abs(float(tx.get("amount", 0)))
        by_category.setdefault(cat, []).append(amt)

    if not by_category:
        return SpendingInsightResponse(
            summary=(
                "Add transactions to "
                "generate spending insights."
            ),
            provider="heuristic",
        )

    sorted_cats = sorted(
        by_category.items(),
        key=lambda x: sum(x[1]),
        reverse=True,
    )
    top_cat = sorted_cats[0]
    total_spend = sum(sum(v) for v in by_category.values())

    insights_list: list[SpendingInsightItem] = []
    for cat, amounts in sorted_cats:
        cat_total = sum(amounts)
        pct = (
            round((cat_total / total_spend * 100), 1)
            if total_spend else 0
        )
        insights_list.append(
            SpendingInsightItem(
                category=cat,
                total=Decimal(str(cat_total)),
                transaction_count=len(amounts),
                percentage=pct,
                insight=(
                    f"Spent ${cat_total:.2f} in "
                    f"{cat} ({pct}% of total)."
                ),
            )
        )

    summary = (
        f"Spending is concentrated in {top_cat[0]}, "
        f"which accounts for ${sum(top_cat[1]):.2f} "
        f"of the total ${total_spend:.2f}."
    )
    return SpendingInsightResponse(
        summary=summary,
        top_category=top_cat[0],
        top_category_spend=Decimal(
            str(sum(top_cat[1]))
        ),
        insights=insights_list,
        provider="heuristic",
    )


def analyze_spending_insights(
    transactions: list[dict],
) -> SpendingInsightResponse:
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        return _fallback_spending_insights(transactions)

    tx_summary = "\n".join(
        f"- {tx.get('vendor', 'unknown')}: "
        f"${abs(float(tx.get('amount', 0))):.2f} "
        f"[{tx.get('category', 'Other')}]"
        for tx in transactions[:50]
    )
    prompt = (
        "You are a personal finance analyst. "
        "Analyze the following transactions and provide "
        "insights about spending patterns, "
        "habits, and trends.\n\n"
        "Transactions "
        f"({min(len(transactions), 50)} shown):\n"
        f"{tx_summary}\n\n"
        "Return strict JSON with keys:\n"
        "- summary: string (plain-language "
        "summary of spending patterns)\n"
        "- top_category: string "
        "(category with highest spending)\n"
        "- top_category_spend: number "
        "(total spent in top category)\n"
        "- insights: array of objects with "
        "'category', 'total' (number), "
        "'transaction_count' (number), "
        "'percentage' (number, 0-100), "
        "'insight' (string, "
        "plain-language observation)\n"
        "Be specific and actionable."
    )
    result = _call_gemini_json(prompt, max_tokens=1024)
    if result and "insights" in result:
        insights_list = [
            SpendingInsightItem(
                category=item["category"],
                total=Decimal(str(item["total"])),
                transaction_count=(
                    item["transaction_count"]
                ),
                percentage=float(item["percentage"]),
                insight=item.get("insight", ""),
            )
            for item in result["insights"]
        ]
        return SpendingInsightResponse(
            summary=str(result.get("summary", "")),
            top_category=str(
                result.get("top_category", "")
            ),
            top_category_spend=Decimal(
                str(result.get("top_category_spend", 0))
            ),
            insights=insights_list,
            provider="gemini",
        )
    return _fallback_spending_insights(transactions)


# -- Insights: Recurring Detection ----------------------------------


def _fallback_recurring_detection(
    transactions: list[dict],
) -> RecurringDetectionResponse:
    vendor_map: dict[str, list[dict]] = {}
    for tx in transactions:
        vendor = tx.get("vendor", "").lower().strip()
        if vendor:
            vendor_map.setdefault(vendor, []).append(tx)

    recurring: list[RecurringTransaction] = []
    for vendor, txs in vendor_map.items():
        if len(txs) >= 2:
            amounts = {
                abs(float(t.get("amount", 0))) for t in txs
            }
            if len(amounts) <= 2:
                recurring.append(
                    RecurringTransaction(
                        vendor=vendor,
                        category=txs[0].get(
                            "category", "Other"
                        ),
                        amount=Decimal(
                            str(min(amounts))
                        ),
                        frequency="monthly",
                        confidence=round(
                            min(
                                0.5 + len(txs) * 0.15,
                                0.95,
                            ),
                            2,
                        ),
                        transaction_ids=[
                            str(t.get("id", ""))
                            for t in txs
                        ],
                    )
                )
    return RecurringDetectionResponse(
        recurring=recurring,
        provider="heuristic",
        rationale=(
            "Identified vendors appearing "
            "at least twice with similar amounts."
        ),
    )


def detect_recurring_transactions(
    transactions: list[dict],
) -> RecurringDetectionResponse:
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        return _fallback_recurring_detection(transactions)

    tx_summary = "\n".join(
        f"- {tx.get('vendor', 'unknown')}: "
        f"${abs(float(tx.get('amount', 0))):.2f} "
        f"on {tx.get('date', '')} "
        f"[{tx.get('category', 'Other')}]"
        for tx in transactions[:100]
    )
    prompt = (
        "You are a personal finance analyst. "
        "Identify recurring subscriptions and charges "
        "from the following transactions. "
        "Look for vendors that appear regularly "
        "with similar amounts.\n\n"
        f"Transactions:\n{tx_summary}\n\n"
        "Return strict JSON with keys:\n"
        "- recurring: array of objects with "
        "'vendor' (string), 'category' (string), "
        "'amount' (number), "
        "'frequency' (string, e.g. 'monthly', 'yearly'), "
        "'confidence' (number 0-1), "
        "'last_detected' (string ISO date or null), "
        "'transaction_ids' (array of strings)\n"
        "- rationale: string explanation"
    )
    result = _call_gemini_json(prompt, max_tokens=1024)
    if result and "recurring" in result:
        recurring_list = [
            RecurringTransaction(
                vendor=item["vendor"],
                category=item.get("category", "Other"),
                amount=Decimal(str(item["amount"])),
                frequency=item.get(
                    "frequency", "monthly"
                ),
                confidence=float(
                    item.get("confidence", 0.5)
                ),
                last_detected=(
                    datetime.fromisoformat(
                        item["last_detected"]
                    )
                    if item.get("last_detected")
                    else None
                ),
                transaction_ids=[
                    str(tid)
                    for tid in item.get(
                        "transaction_ids", []
                    )
                ],
            )
            for item in result["recurring"]
        ]
        return RecurringDetectionResponse(
            recurring=recurring_list,
            provider="gemini",
            rationale=str(result.get("rationale", "")),
        )
    return _fallback_recurring_detection(transactions)


# -- Insights: Anomaly Detection ------------------------------------


def _fallback_anomaly_detection(
    transactions: list[dict],
) -> AnomalyDetectionResponse:
    if not transactions:
        return AnomalyDetectionResponse(
            anomalies=[],
            provider="heuristic",
            rationale="No transactions to analyze.",
        )

    by_category: dict[
        str, list[tuple[int, dict]]
    ] = {}
    for idx, tx in enumerate(transactions):
        cat = tx.get("category", "Other")
        by_category.setdefault(cat, []).append((idx, tx))

    anomalies: list[AnomalyTransaction] = []
    for cat, items in by_category.items():
        amounts = [
            abs(float(tx.get("amount", 0)))
            for _, tx in items
        ]
        if not amounts:
            continue
        avg = sum(amounts) / len(amounts)
        threshold = avg * 2.5
        for _, tx in items:
            amt = abs(float(tx.get("amount", 0)))
            if amt > threshold:
                anomalies.append(
                    AnomalyTransaction(
                        transaction_id=str(
                            tx.get("id", "")
                        ),
                        vendor=str(
                            tx.get("vendor", "unknown")
                        ),
                        amount=Decimal(str(amt)),
                        category=cat,
                        date=(
                            datetime.fromisoformat(
                                str(tx.get("date", ""))
                            )
                            if tx.get("date")
                            else datetime.now()
                        ),
                        reason=(
                            f"${amt:.2f} is "
                            f"{((amt / avg) - 1) * 100:.0f}%"
                            f" above the average of "
                            f"${avg:.2f} in {cat}."
                        ),
                        severity=(
                            "high"
                            if amt > threshold * 1.5
                            else "medium"
                        ),
                    )
                )

    return AnomalyDetectionResponse(
        anomalies=anomalies,
        provider="heuristic",
        rationale=(
            "Flagged transactions where amount "
            "exceeds 2.5x the category average."
        ),
    )


def detect_anomalies(
    transactions: list[dict],
) -> AnomalyDetectionResponse:
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        return _fallback_anomaly_detection(transactions)

    tx_summary = "\n".join(
        f"- {tx.get('vendor', 'unknown')}: "
        f"${abs(float(tx.get('amount', 0))):.2f} "
        f"[{tx.get('category', 'Other')}]"
        for tx in transactions[:100]
    )
    prompt = (
        "You are a personal finance fraud and "
        "anomaly detection assistant. Review these "
        "transactions and flag any that appear "
        "unusual, unexpected, or significantly above "
        "normal spending patterns.\n\n"
        f"Transactions:\n{tx_summary}\n\n"
        "Return strict JSON with keys:\n"
        "- anomalies: array of objects with "
        "'transaction_id' (string), 'vendor' (string), "
        "'amount' (number), 'category' (string), "
        "'date' (string ISO date), "
        "'reason' (string explaining why unusual), "
        "'severity' (string: 'low', 'medium', 'high')\n"
        "- rationale: string explanation "
        "of the detection approach"
    )
    result = _call_gemini_json(prompt, max_tokens=1024)
    if result and "anomalies" in result:
        anomaly_list = [
            AnomalyTransaction(
                transaction_id=str(
                    item["transaction_id"]
                ),
                vendor=item.get("vendor", "unknown"),
                amount=Decimal(str(item["amount"])),
                category=item.get("category", "Other"),
                date=(
                    datetime.fromisoformat(item["date"])
                    if item.get("date")
                    else datetime.now()
                ),
                reason=item.get("reason", ""),
                severity=item.get("severity", "medium"),
            )
            for item in result["anomalies"]
        ]
        return AnomalyDetectionResponse(
            anomalies=anomaly_list,
            provider="gemini",
            rationale=str(result.get("rationale", "")),
        )
    return _fallback_anomaly_detection(transactions)


# -- Insights: Monthly AI Summary -----------------------------------


def _fallback_monthly_summary(
    transactions: list[dict],
) -> MonthlySummaryResponse:
    total_income = sum(
        float(tx.get("amount", 0))
        for tx in transactions
        if float(tx.get("amount", 0)) > 0
    )
    total_expenses = sum(
        abs(float(tx.get("amount", 0)))
        for tx in transactions
        if float(tx.get("amount", 0)) < 0
    )
    net = total_income - total_expenses

    if not transactions:
        return MonthlySummaryResponse(
            summary=(
                "No transaction data available "
                "for this period. Add transactions "
                "to generate a monthly "
                "financial health report."
            ),
            provider="heuristic",
        )

    summary = (
        f"During this period, total income was "
        f"${total_income:.2f} and total expenses were "
        f"${total_expenses:.2f}, "
        f"resulting in a net of ${net:.2f}. "
    )
    if net > 0:
        summary += (
            "You are spending less than "
            "you earn, which is positive."
        )
    else:
        summary += (
            "Expenses exceed income, "
            "consider reviewing your budget."
        )
    return MonthlySummaryResponse(
        summary=summary, provider="heuristic"
    )


def generate_monthly_summary(
    transactions: list[dict],
) -> MonthlySummaryResponse:
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        return _fallback_monthly_summary(transactions)

    tx_summary = "\n".join(
        f"- {tx.get('vendor', 'unknown')}: "
        f"${abs(float(tx.get('amount', 0))):.2f} "
        f"[{tx.get('category', 'Other')}] "
        f"on {tx.get('date', '')}"
        for tx in transactions[:100]
    )
    total_income = sum(
        float(tx.get("amount", 0))
        for tx in transactions
        if float(tx.get("amount", 0)) > 0
    )
    total_expenses = sum(
        abs(float(tx.get("amount", 0)))
        for tx in transactions
        if float(tx.get("amount", 0)) < 0
    )

    prompt = (
        "You are a personal finance advisor. "
        "Generate a concise monthly financial "
        "health report "
        "with key takeaways and actionable "
        "recommendations "
        "based on the following transactions.\n\n"
        "Period summary: Income "
        f"${total_income:.2f}, "
        f"Expenses ${total_expenses:.2f}\n\n"
        f"Transactions:\n{tx_summary}\n\n"
        "Return strict JSON with keys:\n"
        "- summary: string (2-4 sentences covering "
        "key patterns, trends, and recommendations)\n"
        "Be encouraging and constructive."
    )
    result = _call_gemini_json(prompt, max_tokens=512)
    if result and "summary" in result:
        return MonthlySummaryResponse(
            summary=str(result["summary"]),
            provider="gemini",
        )
    return _fallback_monthly_summary(transactions)