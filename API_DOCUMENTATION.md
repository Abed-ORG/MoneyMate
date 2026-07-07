# MoneyMate API Documentation

This document covers all backend API endpoints. The API is built with **FastAPI** and is available at the base URL configured in `VITE_API_URL` (default: `http://127.0.0.1:8000`).

Interactive Swagger UI documentation is available at `/docs` when the backend is running.

---

## Table of Contents

1. [Authentication](#1-authentication)
2. [Profile & Onboarding](#2-profile--onboarding)
3. [Transactions](#3-transactions)
4. [Budgets](#4-budgets)
5. [Goals](#5-goals)
6. [Analytics](#6-analytics)
7. [AI Insights](#7-ai-insights)
8. [Chat / AI Assistant](#8-chat--ai-assistant)
9. [Status](#9-status)
10. [Items (Scaffold)](#10-items-scaffold)

---

## 1. Authentication

All auth endpoints are prefixed with `/auth`.

### POST /auth/register

Register a new user account.

**Authentication:** None

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecureP@ss1",
  "display_name": "John Doe",
  "currency": "USD"
}
```

**Response `201 Created`:**
```json
{
  "id": 1,
  "email": "user@example.com",
  "display_name": "John Doe",
  "currency": "USD",
  "is_verified": true,
  "created_at": "2025-06-01T10:00:00Z"
}
```

**Errors:**
| Status | Detail |
|--------|--------|
| 409 | An account with this email already exists. |

---

### POST /auth/login

Authenticate and receive access + refresh tokens.

**Authentication:** None

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecureP@ss1"
}
```

**Response `200 OK`:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "dGhpcyBpcyBhIHJlZnJl...",
  "token_type": "bearer"
}
```

**Errors:**
| Status | Detail |
|--------|--------|
| 401 | The email or password you entered is incorrect. |

---

### POST /auth/refresh

Obtain a new access token using a refresh token.

**Authentication:** None

**Request Body:**
```json
{
  "refresh_token": "dGhpcyBpcyBhIHJlZnJl..."
}
```

**Response `200 OK`:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "new-refresh-token...",
  "token_type": "bearer"
}
```

**Errors:**
| Status | Detail |
|--------|--------|
| 401 | Your session has expired. Please log in again. |

---

### POST /auth/logout

Revoke a refresh token.

**Authentication:** None (token is provided in request body)

**Request Body:**
```json
{
  "refresh_token": "dGhpcyBpcyBhIHJlZnJl..."
}
```

**Response `204 No Content`** (no body)

---

### POST /auth/forgot-password

Request a password reset email.

**Authentication:** None

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Response `200 OK`:**
```json
{
  "message": "If an account with this email exists, a reset link has been sent."
}
```

---

### POST /auth/reset-password

Reset password using a token received via email.

**Authentication:** None

**Request Body:**
```json
{
  "token": "reset-token-from-email",
  "new_password": "NewSecureP@ss1"
}
```

**Response `200 OK`:**
```json
{
  "message": "Your password has been reset. You can now log in with your new password."
}
```

**Errors:**
| Status | Detail |
|--------|--------|
| 400 | This password reset link is invalid or has expired. |

---

### GET /auth/me

Return the currently authenticated user's information.

**Authentication:** Required (Bearer token)

**Headers:** `Authorization: Bearer <access_token>`

**Response `200 OK`:**
```json
{
  "id": 1,
  "email": "user@example.com",
  "display_name": "John Doe",
  "currency": "USD",
  "is_verified": true,
  "created_at": "2025-06-01T10:00:00Z"
}
```

---

## 2. Profile & Onboarding

All profile endpoints are prefixed with `/profile`.  
**Authentication:** Required (Bearer token) for all endpoints.

### GET /profile/me

Get the financial profile for the current user. Creates one if it doesn't exist.

**Response `200 OK`:**
```json
{
  "id": 1,
  "monthly_income": 5000.0,
  "savings_goal_percentage": 20,
  "onboarding_completed": true,
  "risk_tolerance": "moderate"
}
```

---

### POST /profile/onboarding

Complete the onboarding questionnaire with financial profile data.

**Request Body:**
```json
{
  "monthly_income": 5000.0,
  "savings_goal_percentage": 20,
  "risk_tolerance": "moderate",
  "currency": "USD"
}
```

**Response `200 OK`:**
```json
{
  "id": 1,
  "monthly_income": 5000.0,
  "savings_goal_percentage": 20,
  "onboarding_completed": true,
  "risk_tolerance": "moderate"
}
```

---

### POST /profile/onboarding/skip

Skip the onboarding process. Creates a default financial profile.

**Response `200 OK`:**
```json
{
  "id": 1,
  "monthly_income": 0,
  "savings_goal_percentage": 0,
  "onboarding_completed": false,
  "risk_tolerance": null
}
```

---

### PUT /profile/me

Update the financial profile.

**Request Body:**
```json
{
  "monthly_income": 5500.0,
  "savings_goal_percentage": 25,
  "risk_tolerance": "conservative"
}
```

**Response `200 OK`:** Returns the updated profile.

---

### PUT /profile/account

Update account details (display name, email, currency).

**Request Body:**
```json
{
  "display_name": "Jane Doe",
  "email": "jane@example.com",
  "currency": "EUR"
}
```

**Response `200 OK`:**
```json
{
  "id": 1,
  "email": "jane@example.com",
  "display_name": "Jane Doe",
  "currency": "EUR",
  "is_verified": true,
  "created_at": "2025-06-01T10:00:00Z"
}
```

**Errors:**
| Status | Detail |
|--------|--------|
| 409 | An account with this email already exists. |

---

### PUT /profile/password

Change the current user's password.

**Request Body:**
```json
{
  "current_password": "OldP@ss1",
  "new_password": "NewP@ss1"
}
```

**Response `204 No Content`**

**Errors:**
| Status | Detail |
|--------|--------|
| 400 | Your current password is incorrect. |

---

### DELETE /profile/account

Permanently delete the user's account and all associated data.

**Response `204 No Content`**

---

## 3. Transactions

All transaction endpoints are prefixed with `/transactions`.  
**Authentication:** Required (Bearer token) for all endpoints.

### GET /transactions

List transactions with pagination, sorting, and filters.

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | int | 1 | Page number (>= 1) |
| `page_size` | int | 10 | Items per page (1-100) |
| `sort_by` | string | "date" | Sort field: `date`, `amount`, `vendor` |
| `sort_dir` | string | "desc" | Sort direction: `asc` or `desc` |
| `search` | string | - | Search text for vendor/notes |
| `category` | string | - | Filter by category name |
| `date_from` | datetime | - | Filter: start date |
| `date_to` | datetime | - | Filter: end date |
| `amount_min` | decimal | - | Filter: minimum amount |
| `amount_max` | decimal | - | Filter: maximum amount |

**Response `200 OK`:**
```json
{
  "items": [
    {
      "id": "txn_abc123",
      "vendor": "Supermarket",
      "amount": 45.50,
      "category": "Groceries",
      "occurred_at": "2025-06-15T14:30:00Z",
      "notes": "Weekly groceries",
      "created_at": "2025-06-15T14:30:00Z"
    }
  ],
  "total": 1,
  "page": 1,
  "page_size": 10,
  "total_pages": 1
}
```

---

### POST /transactions

Create a new transaction.

**Request Body:**
```json
{
  "vendor": "Supermarket",
  "amount": 45.50,
  "category": "Groceries",
  "occurred_at": "2025-06-15T14:30:00Z",
  "notes": "Weekly groceries"
}
```

**Response `201 Created`:**
```json
{
  "id": "txn_abc123",
  "vendor": "Supermarket",
  "amount": 45.50,
  "category": "Groceries",
  "occurred_at": "2025-06-15T14:30:00Z",
  "notes": "Weekly groceries",
  "created_at": "2025-06-15T14:30:00Z"
}
```

---

### PATCH /transactions/{transaction_id}

Update an existing transaction.

**Request Body:**
```json
{
  "vendor": "Updated Vendor",
  "amount": 50.00,
  "category": "Food",
  "notes": "Updated notes"
}
```

**Response `200 OK`:** Returns the updated transaction.

**Errors:**
| Status | Detail |
|--------|--------|
| 404 | Transaction not found. |

---

### DELETE /transactions/{transaction_id}

Delete a transaction.

**Response `204 No Content`**

**Errors:**
| Status | Detail |
|--------|--------|
| 404 | Transaction not found. |

---

### POST /transactions/bulk

Bulk import multiple transactions.

**Request Body:**
```json
{
  "transactions": [
    {
      "vendor": "Store A",
      "amount": 20.00,
      "category": "Shopping",
      "occurred_at": "2025-06-01T10:00:00Z"
    },
    {
      "vendor": "Store B",
      "amount": 35.00,
      "category": "Food",
      "occurred_at": "2025-06-02T12:00:00Z"
    }
  ]
}
```

**Response `200 OK`:**
```json
{
  "imported": 2,
  "errors": []
}
```

---

### POST /transactions/import

Import transactions from a CSV file (sent as JSON with parsed rows).

**Request Body:**
```json
{
  "rows": [
    {"date": "2025-06-01", "description": "Payment", "amount": "-50.00"},
    {"date": "2025-06-02", "description": "Deposit", "amount": "200.00"}
  ]
}
```

**Response `200 OK`:**
```json
{
  "imported": 2,
  "errors": []
}
```

---

### POST /transactions/suggest

Get an AI-generated category suggestion for a transaction.

**Request Body:**
```json
{
  "vendor": "Netflix",
  "notes": "Monthly subscription",
  "amount": 15.99
}
```

**Response `200 OK`:**
```json
{
  "category": "Entertainment",
  "confidence": 0.95
}
```

---

### POST /transactions/{transaction_id}/correction

Correct the category of a transaction (used to train AI categorization).

**Request Body:**
```json
{
  "corrected_category": "Utilities"
}
```

**Response `200 OK`:** Returns the updated transaction.

**Errors:**
| Status | Detail |
|--------|--------|
| 404 | Transaction not found. |

---

### POST /transactions/bulk-recategorize

Bulk recategorize multiple transactions at once.

**Request Body:**
```json
{
  "transaction_ids": ["txn_1", "txn_2", "txn_3"],
  "category": "Transportation"
}
```

**Response `200 OK`:**
```json
[
  {"id": "txn_1", "vendor": "Uber", "amount": 25.00, "category": "Transportation"},
  {"id": "txn_2", "vendor": "Gas Station", "amount": 40.00, "category": "Transportation"}
]
```

---

### Transaction Categories

#### GET /transactions/categories

List all user-defined categories.

**Response `200 OK`:**
```json
[
  {"id": "cat_1", "name": "Groceries", "color": "#4CAF50", "icon": "shopping-cart"},
  {"id": "cat_2", "name": "Transportation", "color": "#2196F3", "icon": "car"}
]
```

#### POST /transactions/categories

Create a new category.

**Request Body:**
```json
{
  "name": "Healthcare",
  "color": "#F44336",
  "icon": "medkit"
}
```

**Response `201 Created`:**
```json
{
  "id": "cat_3",
  "name": "Healthcare",
  "color": "#F44336",
  "icon": "medkit"
}
```

#### PATCH /transactions/categories/{category_id}

Update a category.

**Request Body:**
```json
{
  "name": "Health & Wellness",
  "color": "#E91E63"
}
```

**Response `200 OK`**

**Errors:**
| Status | Detail |
|--------|--------|
| 404 | Category not found. |

#### DELETE /transactions/categories/{category_id}

Delete a category.

**Response `204 No Content`**

**Errors:**
| Status | Detail |
|--------|--------|
| 404 | Category not found. |

---

## 4. Budgets

All budget endpoints are prefixed with `/budgets`.  
**Authentication:** Required (Bearer token) for all endpoints.

### GET /budgets

List budgets with optional filters.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `month` | int (1-12) | Filter by month |
| `year` | int | Filter by year |
| `category_id` | int | Filter by category |

**Response `200 OK`:**
```json
[
  {
    "id": 1,
    "category_id": 1,
    "category_name": "Groceries",
    "limit_amount": 500.00,
    "spent_amount": 320.00,
    "month": 6,
    "year": 2025
  }
]
```

---

### POST /budgets

Create a new budget.

**Request Body:**
```json
{
  "category_id": 1,
  "limit_amount": 500.00,
  "month": 6,
  "year": 2025
}
```

**Response `201 Created`:**
```json
{
  "id": 1,
  "category_id": 1,
  "category_name": "Groceries",
  "limit_amount": 500.00,
  "spent_amount": 0.00,
  "month": 6,
  "year": 2025
}
```

**Errors:**
| Status | Detail |
|--------|--------|
| 400 | Select one of your spending categories. |
| 409 | A budget already exists for this category and month. |

---

### GET /budgets/categories

List available budget categories.

**Response `200 OK`:**
```json
[
  {"id": 1, "name": "Groceries"},
  {"id": 2, "name": "Transportation"}
]
```

---

### GET /budgets/overview

Get a detailed budget overview for a specific month/year.

**Query Parameters:**
| Parameter | Type | Required |
|-----------|------|----------|
| `month` | int (1-12) | Yes |
| `year` | int | Yes |

**Response `200 OK`:**
```json
{
  "total_budgeted": 2000.00,
  "total_spent": 1500.00,
  "remaining": 500.00,
  "categories": [
    {
      "category": "Groceries",
      "limit": 500.00,
      "spent": 320.00,
      "percentage": 64
    }
  ]
}
```

---

### GET /budgets/comparison

Get budget vs. actual comparison for a specific month/year.

**Query Parameters:**
| Parameter | Type | Required |
|-----------|------|----------|
| `month` | int (1-12) | Yes |
| `year` | int | Yes |

**Response `200 OK`:**
```json
[
  {
    "category": "Groceries",
    "budgeted": 500.00,
    "actual": 320.00,
    "difference": 180.00,
    "status": "under"
  }
]
```

---

### GET /budgets/alerts

Get budget alerts for a specific month/year (categories nearing or exceeding limits).

**Query Parameters:**
| Parameter | Type | Required |
|-----------|------|----------|
| `month` | int (1-12) | Yes |
| `year` | int | Yes |

**Response `200 OK`:**
```json
[
  {
    "category": "Dining Out",
    "limit": 200.00,
    "spent": 185.00,
    "percentage": 92.5,
    "alert": "warning"
  },
  {
    "category": "Entertainment",
    "limit": 100.00,
    "spent": 120.00,
    "percentage": 120,
    "alert": "exceeded"
  }
]
```

---

### POST /budgets/copy-from-previous

Copy all budgets from the previous month to the specified month.

**Query Parameters:**
| Parameter | Type | Required |
|-----------|------|----------|
| `month` | int (1-12) | Yes |
| `year` | int | Yes |

**Response `200 OK`:**
```json
[
  {"id": 2, "category_name": "Groceries", "limit_amount": 500.00, "month": 7, "year": 2025}
]
```

---

### GET /budgets/history

Get budget history (summary of all months with budgets).

**Response `200 OK`:**
```json
{
  "months": [
    {"month": 6, "year": 2025, "total_budgeted": 2000.00, "total_spent": 1500.00},
    {"month": 7, "year": 2025, "total_budgeted": 2100.00, "total_spent": 1800.00}
  ]
}
```

---

### GET /budgets/history/{year}/{month}

Get detailed budget overview for a specific historical month.

**Response `200 OK`:** Same shape as `/budgets/overview`.

---

### GET /budgets/{budget_id}

Get a single budget by ID.

**Response `200 OK`**

**Errors:**
| Status | Detail |
|--------|--------|
| 404 | Budget not found. |

---

### PATCH /budgets/{budget_id}

Update a budget.

**Request Body:**
```json
{
  "limit_amount": 600.00
}
```

**Response `200 OK`**

**Errors:**
| Status | Detail |
|--------|--------|
| 404 | Budget not found. |
| 400 | Select one of your spending categories. |
| 409 | A budget already exists for this category and month. |

---

### DELETE /budgets/{budget_id}

Delete a budget.

**Response `204 No Content`**

**Errors:**
| Status | Detail |
|--------|--------|
| 404 | Budget not found. |

---

## 5. Goals

All goal endpoints are prefixed with `/goals`.  
**Authentication:** Required (Bearer token) for all endpoints.

### GET /goals

List all savings goals.

**Response `200 OK`:**
```json
{
  "items": [
    {
      "id": 1,
      "name": "Emergency Fund",
      "target_amount": 10000.00,
      "current_amount": 2500.00,
      "deadline": "2025-12-31",
      "status": "active",
      "monthly_contribution": 500.00
    }
  ]
}
```

---

### POST /goals

Create a new savings goal.

**Request Body:**
```json
{
  "name": "Emergency Fund",
  "target_amount": 10000.00,
  "deadline": "2025-12-31",
  "monthly_contribution": 500.00
}
```

**Response `201 Created`:**
```json
{
  "id": 1,
  "name": "Emergency Fund",
  "target_amount": 10000.00,
  "current_amount": 0.00,
  "deadline": "2025-12-31",
  "status": "active",
  "monthly_contribution": 500.00
}
```

---

### PATCH /goals/{goal_id}

Update a savings goal.

**Request Body:**
```json
{
  "name": "Updated Goal",
  "target_amount": 12000.00,
  "monthly_contribution": 600.00
}
```

**Response `200 OK`**

**Errors:**
| Status | Detail |
|--------|--------|
| 404 | Goal not found. |

---

### DELETE /goals/{goal_id}

Delete a savings goal.

**Response `204 No Content`**

**Errors:**
| Status | Detail |
|--------|--------|
| 404 | Goal not found. |

---

### POST /goals/{goal_id}/contributions

Log a contribution to a savings goal.

**Request Body:**
```json
{
  "amount": 500.00,
  "date": "2025-06-15"
}
```

**Response `200 OK`:** Returns the updated goal.

**Errors:**
| Status | Detail |
|--------|--------|
| 404 | Goal not found. |

---

### AI-Powered Goal Calculations

#### POST /goals/ai/calculate

Calculate the required monthly savings to reach a goal by its deadline.

**Request Body:**
```json
{
  "target_amount": 10000.00,
  "current_amount": 0.00,
  "deadline": "2025-12-31",
  "monthly_income": 5000.00,
  "monthly_expenses": 3500.00
}
```

**Response `200 OK`:**
```json
{
  "required_monthly_savings": 1666.67,
  "feasible": true,
  "months_until_deadline": 6,
  "message": "You need to save $1,666.67 per month to reach your goal."
}
```

#### POST /goals/ai/projection

Get a month-by-month projection for a savings goal.

**Request Body:** Same as `/goals/ai/calculate`.

**Response `200 OK`:**
```json
{
  "projections": [
    {"month": 7, "year": 2025, "projected_balance": 1666.67},
    {"month": 8, "year": 2025, "projected_balance": 3333.34}
  ],
  "target_date": "2025-12-31",
  "total_needed": 10000.00
}
```

---

## 6. Analytics

All analytics endpoints are prefixed with `/analytics`.  
**Authentication:** Required (Bearer token) for all endpoints.

### GET /analytics/dashboard

Get dashboard analytics including spending breakdown, trends, and summaries.

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `start_date` | date | 1st of current month | Start date |
| `end_date` | date | Today | End date |
| `category_ids` | string | - | Comma-separated category IDs |
| `account_ids` | string | - | Comma-separated account IDs |
| `trend_aggregation` | string | "daily" | `daily`, `weekly`, `monthly` |
| `months` | int | 12 | Number of months for trend (1-36) |

**Response `200 OK`:**
```json
{
  "total_spent": 1500.00,
  "total_income": 5000.00,
  "net_savings": 3500.00,
  "category_breakdown": [
    {"category": "Groceries", "amount": 400.00, "percentage": 26.67},
    {"category": "Rent", "amount": 800.00, "percentage": 53.33}
  ],
  "trend": [
    {"date": "2025-06-01", "spent": 50.00, "income": 5000.00},
    {"date": "2025-06-02", "spent": 30.00, "income": 0.00}
  ],
  "top_vendors": [
    {"vendor": "Supermarket", "amount": 200.00, "count": 4}
  ]
}
```

**Errors:**
| Status | Detail |
|--------|--------|
| 400 | Validation error (e.g., invalid date range). |

---

## 7. AI Insights

All AI insights endpoints are prefixed with the `/api` path.  
**Authentication:** Required (Bearer token) for all endpoints.

### POST /api/insights/spending

Generate AI-powered analysis of spending patterns.

**Response `200 OK`:**
```json
{
  "insights": [
    "Your grocery spending increased by 15% compared to last month.",
    "You spent the most on dining out this month at $320."
  ],
  "suggestions": [
    "Consider setting a dining out budget of $250 per month.",
    "You could save $100 by cooking at home 3 more times per week."
  ]
}
```

---

### POST /api/insights/recurring

Detect recurring transactions and subscriptions using AI.

**Response `200 OK`:**
```json
{
  "recurring": [
    {"vendor": "Netflix", "amount": 15.99, "frequency": "monthly", "confidence": 0.98},
    {"vendor": "Gym", "amount": 50.00, "frequency": "monthly", "confidence": 0.95},
    {"vendor": "Spotify", "amount": 9.99, "frequency": "monthly", "confidence": 0.97}
  ],
  "total_monthly_subscriptions": 75.98
}
```

---

### POST /api/insights/anomalies

Detect unusual or anomalous spending using AI.

**Response `200 OK`:**
```json
{
  "anomalies": [
    {"vendor": "Electronics Store", "amount": 1200.00, "date": "2025-06-10", "reason": "Significantly higher than your average transaction of $45"},
    {"vendor": "Travel Agency", "amount": 2500.00, "date": "2025-06-12", "reason": "Unusual one-time expense"}
  ]
}
```

---

### POST /api/insights/monthly-summary

Generate a monthly financial health summary using AI.

**Response `200 OK`:**
```json
{
  "summary": "This month you earned $5,000 and spent $3,200, saving $1,800 (36% savings rate). Your top spending category was Housing at $1,000. Overall, your financial health is good, but consider reducing dining out expenses.",
  "month": 6,
  "year": 2025,
  "total_income": 5000.00,
  "total_expenses": 3200.00,
  "savings_rate": 36.0
}
```

---

## 8. Chat / AI Assistant

All chat endpoints are prefixed with `/chat`.  
**Authentication:** Required (Bearer token) for all endpoints.

### POST /chat/conversations

Create a new conversation.

**Request Body (optional):**
```json
{
  "title": "June Expenses"
}
```

**Response `201 Created`:**
```json
{
  "id": 1,
  "title": "June Expenses",
  "created_at": "2025-06-15T10:00:00Z",
  "updated_at": "2025-06-15T10:00:00Z"
}
```

---

### GET /chat/conversations

List all conversations for the current user (paginated).

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | int | 1 | Page number |
| `page_size` | int | 20 | Items per page (1-50) |

**Response `200 OK`:**
```json
{
  "items": [
    {"id": 1, "title": "June Expenses", "created_at": "2025-06-15T10:00:00Z", "message_count": 5}
  ],
  "total": 1,
  "page": 1,
  "page_size": 20
}
```

---

### GET /chat/conversations/{conversation_id}

Get details of a single conversation.

**Response `200 OK`:**
```json
{
  "id": 1,
  "title": "June Expenses",
  "messages": [
    {"id": 1, "role": "user", "content": "How much did I spend on groceries this month?", "created_at": "2025-06-15T10:00:00Z"},
    {"id": 2, "role": "assistant", "content": "You spent $320 on groceries this month.", "created_at": "2025-06-15T10:00:05Z"}
  ],
  "created_at": "2025-06-15T10:00:00Z",
  "updated_at": "2025-06-15T10:00:05Z"
}
```

**Errors:**
| Status | Detail |
|--------|--------|
| 404 | Conversation not found. |

---

### PATCH /chat/conversations/{conversation_id}

Rename a conversation.

**Request Body:**
```json
{
  "title": "Updated Title"
}
```

**Response `200 OK`**

**Errors:**
| Status | Detail |
|--------|--------|
| 404 | Conversation not found. |

---

### DELETE /chat/conversations/{conversation_id}

Archive (soft-delete) a conversation.

**Response `204 No Content`**

**Errors:**
| Status | Detail |
|--------|--------|
| 404 | Conversation not found. |

---

### GET /chat/conversations/{conversation_id}/messages

Get messages for a conversation (paginated, newest first).

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | int | 30 | Number of messages (1-100) |
| `before_message_id` | int | - | Cursor for pagination |

**Response `200 OK`:**
```json
{
  "items": [
    {"id": 2, "role": "assistant", "content": "You spent $320 on groceries this month.", "created_at": "2025-06-15T10:00:05Z"},
    {"id": 1, "role": "user", "content": "How much did I spend on groceries this month?", "created_at": "2025-06-15T10:00:00Z"}
  ],
  "has_more": false
}
```

**Errors:**
| Status | Detail |
|--------|--------|
| 404 | Conversation not found. |

---

### POST /chat/conversations/{conversation_id}/messages

Send a message to the AI assistant and get a response.

**Request Body:**
```json
{
  "question": "How much did I spend on groceries this month?"
}
```

**Response `200 OK`:**
```json
{
  "message": {
    "id": 3,
    "role": "assistant",
    "content": "You spent $320 on groceries this month, which is within your $500 budget.",
    "created_at": "2025-06-15T10:05:00Z"
  },
  "conversation_id": 1
}
```

**Errors:**
| Status | Detail |
|--------|--------|
| 404 | Conversation not found. |
| 503 | AI service temporarily unavailable. |

---

### POST /chat/conversations/{conversation_id}/messages/{message_id}/retry

Retry generating an AI response for a specific user message.

**Response `200 OK`:** Same shape as sending a message.

**Errors:**
| Status | Detail |
|--------|--------|
| 404 | Conversation not found. |
| 503 | AI service temporarily unavailable. |

---

## 9. Status

### GET /status/db

Health check for the database connection.

**Authentication:** None

**Response `200 OK`:**
```json
{
  "db": "ok"
}
```

**Errors:**
| Status | Detail |
|--------|--------|
| 503 | Database unavailable. |

---

## 10. Items (Scaffold)

These endpoints are scaffold/generic items and are prefixed with `/items`.  
**Authentication:** None

### POST /items

Create a new generic item.

**Request Body:**
```json
{
  "name": "Sample Item",
  "description": "A sample item description"
}
```

**Response `200 OK`:**
```json
{
  "id": 1,
  "name": "Sample Item",
  "description": "A sample item description"
}
```

---

### GET /items

List generic items.

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `skip` | int | 0 | Number of items to skip |
| `limit` | int | 100 | Max items to return |

**Response `200 OK`:**
```json
[
  {"id": 1, "name": "Sample Item", "description": "A sample item description"}
]
```

---

### GET /items/{item_id}

Get a single generic item by ID.

**Response `200 OK`:**
```json
{"id": 1, "name": "Sample Item", "description": "A sample item description"}
```

**Errors:**
| Status | Detail |
|--------|--------|
| 404 | Item not found. |

---

## Common Error Responses

### 401 Unauthorized
```json
{
  "detail": "Not authenticated"
}
```

### 403 Forbidden
```json
{
  "detail": "You do not have permission to perform this action"
}
```

### 422 Validation Error
```json
{
  "detail": [
    {
      "loc": ["body", "email"],
      "msg": "field required",
      "type": "value_error.missing"
    }
  ]
}
```

### 500 Internal Server Error
```json
{
  "detail": "Internal server error"
}