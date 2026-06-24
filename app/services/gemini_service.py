"""
Legacy module — function implementations have been split into:

  - goal_ai_service.py        (goal savings & projection)
  - insights_ai_service.py    (spending insights, recurring, anomalies, summary)
  - category_service.py       (transaction category suggestion)

This file re-exports everything for backward compatibility.
New code should import directly from the split modules.
"""

# Goal AI functions
from app.services.goal_ai_service import (  # noqa: F401
    calculate_goal_projection,
    calculate_goal_savings,
)

# Insights AI functions
from app.services.insights_ai_service import (  # noqa: F401
    analyze_spending_insights,
    detect_anomalies,
    detect_recurring_transactions,
    generate_monthly_summary,
)

# Category helpers
from app.services.category_service import (  # noqa: F401
    COMMON_ALIASES,
    CATEGORY_CONTEXT,
    GEMINI_ENDPOINT,
    GeminiRequest,
    suggest_category,
    _fallback_suggestion,
)
