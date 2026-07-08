from decimal import Decimal

from app.services.insights_ai_service import analyze_spending_insights


def test_empty_spending_insights_returns_valid_response(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)

    response = analyze_spending_insights([])

    assert response.provider == "heuristic"
    assert response.top_category == ""
    assert response.top_category_spend == Decimal("0")
    assert response.insights == []
