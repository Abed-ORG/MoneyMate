import json
import os
from dataclasses import dataclass
from urllib import request

from app.schemas.transaction import AiCategorization


GEMINI_ENDPOINT = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    "gemini-1.5-flash:generateContent"
)


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
    rules = [
        ("Food & Dining", ("coffee", "restaurant", "meal", "food", "dining")),
        ("Transport", ("uber", "taxi", "bus", "fuel", "gas", "ride")),
        ("Groceries", ("grocery", "market", "supermarket", "whole foods")),
        ("Shopping", ("amazon", "store", "shop", "mall")),
        ("Entertainment", ("netflix", "spotify", "movie", "ticket", "cinema")),
        ("Housing", ("rent", "mortgage", "lease")),
        ("Utilities", ("electric", "water", "internet", "utility")),
        ("Income", ("salary", "payroll", "invoice", "refund")),
    ]
    for category, keywords in rules:
        if any(keyword in text for keyword in keywords):
            return AiCategorization(
                category=category,
                confidence=90,
                provider="heuristic",
                rationale=(
                    f"Matched vendor/description keywords"
                    f" for {category}."
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


def suggest_category(request_data: GeminiRequest) -> AiCategorization:
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        return _fallback_suggestion(
            request_data.vendor,
            request_data.notes,
            request_data.amount,
        )

    prompt = (
        "Classify this personal finance transaction into exactly one "
        "category. Return strict JSON with keys category, confidence, "
        "rationale.\n\n"
        f"Vendor: {request_data.vendor}\n"
        f"Notes: {request_data.notes}\n"
        f"Amount: {request_data.amount}\n"
        f"Allowed categories: {', '.join(request_data.category_names)}\n"
        f"Past user corrections: "
        f"{', '.join(request_data.correction_history) or 'none'}\n"
    )
    body = {
        "contents": [
            {
                "parts": [{"text": prompt}],
            }
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
            payload = json.loads(response.read().decode("utf-8"))
    except Exception:
        return _fallback_suggestion(
            request_data.vendor,
            request_data.notes,
            request_data.amount,
        )

    try:
        text = payload["candidates"][0]["content"]["parts"][0]["text"]
        data = json.loads(text[text.find("{"):text.rfind("}") + 1])
        category = str(data.get("category", "Other")).strip() or "Other"
        confidence = int(data.get("confidence", 70))
        rationale = str(data.get("rationale", "")).strip()
        if category not in request_data.category_names:
            category = "Other"
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
