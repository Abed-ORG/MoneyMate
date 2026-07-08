# MoneyMate API Reference

Base URL:
- Local: `http://127.0.0.1:8000`
- Production: Render backend URL configured in `VITE_API_URL`

Most endpoints require:

```http
Authorization: Bearer <access_token>
Content-Type: application/json
```

## Auth

### Register

`POST /auth/register`

```json
{
  "full_name": "Demo User",
  "email": "demo@example.com",
  "password": "password-123"
}
```

Returns `201` with the created user.

### Login

`POST /auth/login`

```json
{
  "email": "demo@example.com",
  "password": "password-123"
}
```

Returns:

```json
{
  "access_token": "...",
  "refresh_token": "...",
  "token_type": "bearer"
}
```

### Refresh Token

`POST /auth/refresh`

```json
{
  "refresh_token": "..."
}
```

### Logout

`POST /auth/logout`

```json
{
  "refresh_token": "..."
}
```

Returns `204`.

### Current User

`GET /auth/me`

Returns the authenticated user.

### Password Recovery

`POST /auth/forgot-password`

```json
{
  "email": "demo@example.com"
}
```

`POST /auth/reset-password`

```json
{
  "token": "reset-token-from-email",
  "new_password": "new-password-123"
}
```

## Profile

### Financial Profile

`GET /profile/me`

`PUT /profile/me`

```json
{
  "monthly_income": 3200,
  "currency": "USD",
  "spending_categories": ["Food & Dining", "Transport"]
}
```

### Onboarding

`POST /profile/onboarding`

```json
{
  "monthly_income": 3200,
  "currency": "USD",
  "spending_categories": ["Food & Dining", "Transport"],
  "savings_goals": []
}
```

`POST /profile/onboarding/skip`

### Account Settings

`PUT /profile/account`

```json
{
  "full_name": "Demo User",
  "email": "demo@example.com"
}
```

`PUT /profile/password`

```json
{
  "current_password": "old-password",
  "new_password": "new-password"
}
```

`DELETE /profile/account`

### Monthly Income History

`GET /profile/monthly-income-history?date_from=2026-01-01&date_to=2026-12-31`

## Transactions

### List Transactions

`GET /transactions?page=1&page_size=10&sort_by=date&sort_dir=desc`

Optional filters:
- `search`
- `category`
- `date_from`
- `date_to`
- `amount_min`
- `amount_max`

Returns:

```json
{
  "items": [],
  "total": 0,
  "page": 1,
  "page_size": 10
}
```

### Create Transaction

`POST /transactions`

```json
{
  "date": "2026-07-08T12:00:00Z",
  "amount": -24.5,
  "category": "Food & Dining",
  "vendor": "Cafe Demo",
  "notes": "Lunch"
}
```

### Update Transaction

`PATCH /transactions/{transaction_id}`

```json
{
  "notes": "Lunch with team",
  "amount": -26.75
}
```

### Delete Transaction

`DELETE /transactions/{transaction_id}`

Returns `204`.

### Categories

`GET /transactions/categories`

`POST /transactions/categories`

```json
{
  "name": "Fitness",
  "color": "#49c5b6",
  "is_default": false
}
```

`PATCH /transactions/categories/{category_id}`

`DELETE /transactions/categories/{category_id}`

### AI Categorization

`POST /transactions/suggest`

```json
{
  "amount": -18.5,
  "vendor": "Uber",
  "notes": "Ride home"
}
```

`POST /transactions/{transaction_id}/correction`

```json
{
  "category": "Transport"
}
```

`POST /transactions/bulk-recategorize`

```json
{
  "transaction_ids": ["1", "2"]
}
```

### Import

`POST /transactions/import`

```json
{
  "csv_content": "date,amount,category\n2026-07-08,-24.5,Food & Dining",
  "mapping": {
    "date": "date",
    "amount": "amount",
    "category": "category"
  }
}
```

## Budgets

`GET /budgets/categories`

`GET /budgets?month=7&year=2026`

`POST /budgets`

```json
{
  "category_id": 1,
  "amount": 500,
  "month": 7,
  "year": 2026
}
```

`PATCH /budgets/{budget_id}`

```json
{
  "amount": 450
}
```

`DELETE /budgets/{budget_id}`

`GET /budgets/overview?month=7&year=2026`

`GET /budgets/comparison?month=7&year=2026`

`GET /budgets/alerts?month=7&year=2026`

`GET /budgets/history`

`GET /budgets/history/{year}/{month}`

`POST /budgets/copy-from-previous?month=7&year=2026`

## Goals

`GET /goals`

`POST /goals`

```json
{
  "name": "Emergency fund",
  "target_amount": 3000,
  "current_amount": 250,
  "deadline": "2026-12-31",
  "linked_account": "Savings"
}
```

`PATCH /goals/{goal_id}`

`DELETE /goals/{goal_id}`

`POST /goals/{goal_id}/contributions`

```json
{
  "amount": 100,
  "note": "Payday transfer"
}
```

`POST /goals/ai/calculate`

`POST /goals/ai/projection`

## Analytics And Insights

`GET /analytics/dashboard?start_date=2026-07-01&end_date=2026-07-31&trend_aggregation=daily`

Optional filters:
- `category_ids=1,2`
- `account_ids=1`
- `months=12`

AI insight endpoints:
- `GET /api/spending`
- `GET /api/recurring`
- `GET /api/anomalies`
- `GET /api/monthly-summary`

## Status

`GET /`

`GET /status/db`
