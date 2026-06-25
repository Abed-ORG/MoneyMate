"""AI-powered spending insights, recurring detection, anomaly detection,
and monthly summaries.

Extracted from gemini_service.py to keep files focused and maintainable.
"""

import json
import os
from datetime import datetime
from decimal import Decimal
from typing import Any
from urllib import request

from app.services.gemini_transport import (
    configure_gemini_tls,
    gemini_generate_endpoint,
)
from app.schemas.insights import (
    AnomalyDetectionResponse,
    AnomalyTransaction,
    MonthlySummaryResponse,
    RecurringTransaction,
    RecurringDetectionResponse,
    SpendingInsightItem,
    SpendingInsightResponse,
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


# -- Insights: Spending Pattern Analysis -------------------------------------


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


# -- Insights: Recurring Detection -------------------------------------------


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


# -- Insights: Anomaly Detection ---------------------------------------------


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


# -- Insights: Monthly AI Summary --------------------------------------------


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
