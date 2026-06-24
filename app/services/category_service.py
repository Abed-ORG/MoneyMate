"""
AI-powered transaction category suggestion.

Kept separate from insights/goal AI services because this is used by
the transaction repository for inline categorization.
"""

import json
import os
import re
from dataclasses import dataclass
from difflib import SequenceMatcher
from urllib import request

from app.schemas.transaction import AiCategorization

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