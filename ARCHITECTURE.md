# MoneyMate Architecture

This document provides a high-level overview of the MoneyMate application architecture, covering the frontend, backend, database, authentication, API communication, and data flow.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CLIENT (Vercel)                              │
│                                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────────────────┐  │
│  │ Landing  │  │  Auth    │  │  App     │  │  Protected        │  │
│  │  Page    │  │  Pages   │  │  Shell   │  │  Routes           │  │
│  │          │  │          │  │  Layout  │  │  (Dashboard,      │  │
│  │  /       │  │ /login   │  │          │  │   Transactions,   │  │
│  │          │  │ /register│  │ Sidebar  │  │   Budgets,        │  │
│  │          │  │ /forgot- │  │ + Header │  │   Goals,          │  │
│  │          │  │ password │  │          │  │   Reports,        │  │
│  │          │  │ /reset-  │  │          │  │   Chat,           │  │
│  │          │  │ password │  │          │  │   Settings)       │  │
│  └──────────┘  └──────────┘  └──────────┘  └───────────────────┘  │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    API Client Layer                           │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────────┐  │   │
│  │  │ api.ts   │ │ auth.ts  │ │ services/│ │ contexts/      │  │   │
│  │  │ (fetch   │ │ (token   │ │ (budgets,│ │ (AuthContext,   │  │   │
│  │  │ wrapper) │ │  mgmt)   │ │  goals,  │ │  Dashboard-     │  │   │
│  │  │          │ │          │ │  chat,   │ │  Filters,       │  │   │
│  │  │          │ │          │ │  etc.)   │ │  Toast)         │  │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └────────────────┘  │   │
│  └──────────────────────────────────────────────────────────────┘   │
└──────────────────────────┬──────────────────────────────────────────┘
                           │ HTTPS / REST API
                           │ Authorization: Bearer <JWT>
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      BACKEND (Render)                                │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    FastAPI Application                         │   │
│  │                                                                 │
│  │  ┌────────────┐  ┌────────────────┐  ┌────────────────────┐   │   │
│  │  │ Middleware  │  │   Routers      │  │   Dependencies     │   │   │
│  │  │ - CORS     │  │                │  │   - get_db         │   │   │
│  │  │ - JSON     │  │ /auth/*        │  │   - get_current_   │   │   │
│  │  │   Encoder  │  │ /profile/*     │  │     user           │   │   │
│  │  │            │  │ /transactions/*│  └────────────────────┘   │   │
│  │  │            │  │ /budgets/*     │                           │   │
│  │  │            │  │ /goals/*       │  ┌────────────────────┐   │   │
│  │  │            │  │ /analytics/*   │  │   Services         │   │   │
│  │  │            │  │ /api/insights/*│  │   (Business Logic) │   │   │
│  │  │            │  │ /chat/*        │  │                    │   │   │
│  │  │            │  │ /status/*      │  │ - transaction_     │   │   │
│  │  │            │  │ /items/*       │  │   service          │   │   │
│  │  │            │  └────────────────┘  │ - budget_service   │   │   │
│  │  │            │                      │ - goal_service     │   │   │
│  │  │            │                      │ - analytics_       │   │   │
│  │  │            │                      │   service          │   │   │
│  │  │            │                      │ - chat_service     │   │   │
│  │  │            │                      │ - insights_ai_     │   │   │
│  │  │            │                      │   service          │   │   │
│  │  │            │                      │ - profile_service  │   │   │
│  │  │            │                      │ - email_service    │   │   │
│  │  │            │                      └────────────────────┘   │   │
│  │  └────────────┘                                                │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Auth Module                                                  │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │   │
│  │  │ routes.py    │  │ services.py  │  │ utils.py         │   │   │
│  │  │ (endpoints)  │  │ (business    │  │ (JWT encode/     │   │   │
│  │  │              │  │  logic)      │  │  decode,         │   │   │
│  │  │              │  │              │  │  password hash)  │   │   │
│  │  └──────────────┘  └──────────────┘  └──────────────────┘   │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Data Layer                                                   │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │   │
│  │  │ Models       │  │ Repositories │  │ Schemas          │   │   │
│  │  │ (SQLAlchemy) │  │ (DB queries) │  │ (Pydantic)       │   │   │
│  │  │              │  │              │  │                  │   │   │
│  │  │ User         │  │              │  │ Request/Response │   │   │
│  │  │ Transaction  │  │              │  │ Validation       │   │   │
│  │  │ Category     │  │              │  │ Serialization    │   │   │
│  │  │ Budget       │  │              │  │                  │   │   │
│  │  │ Goal         │  │              │  │                  │   │   │
│  │  │ Conversation │  │              │  │                  │   │   │
│  │  │ Message      │  │              │  │                  │   │   │
│  │  └──────────────┘  └──────────────┘  └──────────────────┘   │   │
│  └──────────────────────────────────────────────────────────────┘   │
└──────────────────────────┬──────────────────────────────────────────┘
                           │ SQLAlchemy ORM
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      DATABASE (Neon PostgreSQL)                      │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Tables                                                       │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────────┐   │   │
│  │  │ users    │ │transact- │ │categories│ │ budgets        │   │   │
│  │  │          │ │ ions     │ │          │ │                │   │   │
│  │  │ id       │ │ id       │ │ id       │ │ id             │   │   │
│  │  │ email    │ │ user_id  │ │ user_id  │ │ user_id        │   │   │
│  │  │ password │ │ vendor   │ │ name     │ │ category_id    │   │   │
│  │  │ display_ │ │ amount   │ │ color    │ │ limit_amount   │   │   │
│  │  │ name     │ │ category │ │ icon     │ │ month          │   │   │
│  │  │ currency │ │ date     │ │          │ │ year           │   │   │
│  │  │          │ │ notes    │ │          │ │ spent_amount   │   │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └────────────────┘   │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────────┐   │   │
│  │  │ goals    │ │conversa- │ │ messages │ │ refresh_tokens │   │   │
│  │  │          │ │ tions    │ │          │ │                │   │   │
│  │  │ id       │ │ id       │ │ id       │ │ id             │   │   │
│  │  │ user_id  │ │ user_id  │ │ conv_id  │ │ user_id        │   │   │
│  │  │ name     │ │ title    │ │ role     │ │ token          │   │   │
│  │  │ target   │ │ archived │ │ content  │ │ expires_at     │   │   │
│  │  │ current  │ │          │ │          │ │ revoked        │   │   │
│  │  │ deadline │ │          │ │          │ │                │   │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └────────────────┘   │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                      EXTERNAL SERVICES                               │
│                                                                     │
│  ┌────────────────────┐  ┌────────────────────┐  ┌──────────────┐  │
│  │  Google Gemini AI  │  │  Resend (Email)    │  │  Alembic     │  │
│  │                    │  │                    │  │  (Migrations)│  │
│  │  - Chat responses  │  │  - Password reset  │  │              │  │
│  │  - Category sug-   │  │    emails          │  │  Schema      │  │
│  │    gestions        │  │                    │  │  versioning  │  │
│  │  - Spending        │  │                    │  │              │  │
│  │    insights        │  │                    │  │              │  │
│  │  - Anomaly         │  │                    │  │              │  │
│  │    detection       │  │                    │  │              │  │
│  │  - Goal            │  │                    │  │              │  │
│  │    calculations    │  │                    │  │              │  │
│  └────────────────────┘  └────────────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Frontend Architecture

### Technology Stack

- **React 18** with TypeScript
- **Vite** for build tooling and development server
- **React Router v6** for client-side routing
- **CSS Modules** for component-scoped styling
- **Recharts** for data visualization (charts, graphs)
- **Vitest** + Testing Library for unit tests

### Key Design Decisions

1. **Lazy Loading**: All page components are lazy-loaded using `React.lazy()` and `Suspense` to reduce the initial bundle size.

2. **API Client Layer**: A centralized `api.ts` module wraps the `fetch` API with:
   - Automatic JWT token injection via `Authorization` header
   - JSON serialization/deserialization
   - Error normalization and user-friendly error messages
   - Request caching for GET requests
   - Automatic redirect to login on 401 responses

3. **Context-based State Management**: React Context is used for:
   - **AuthContext**: Manages authentication state (user, tokens, login/logout)
   - **DashboardFiltersContext**: Manages dashboard filter state
   - **ToastContext**: Manages toast notifications

4. **Protected Routes**: A `ProtectedRoute` component wraps authenticated pages and redirects unauthenticated users to the login page.

5. **Component Library**: Reusable UI components are organized under `components/` including:
   - Button, Input, Select, Modal, Card, FormField
   - LoadingSpinner, Toast
   - Budgets, Charts, DashboardAnalytics, SavingsGoalsEditor
   - CategoryIcon

### Frontend Route Structure

| Route | Page | Auth Required |
|-------|------|---------------|
| `/` | Landing Page | No |
| `/login` | Login | No |
| `/register` | Register | No |
| `/forgot-password` | Forgot Password | No |
| `/reset-password` | Reset Password | No |
| `/onboarding` | Onboarding | Yes |
| `/dashboard` | Dashboard | Yes |
| `/transactions` | Transactions | Yes |
| `/budgets` | Budgets | Yes |
| `/goals` | Goals | Yes |
| `/reports/monthly` | Monthly Report | Yes |
| `/reports/annual` | Annual Report | Yes |
| `/settings` | Settings | Yes |
| `*` | 404 Not Found | No |

---

## Backend Architecture

### Technology Stack

- **FastAPI** (Python 3.11+) — async-capable web framework
- **SQLAlchemy** — ORM for database interactions
- **Alembic** — Database migration management
- **Pydantic** — Request/response validation and serialization
- **python-jose** — JWT token encoding/decoding
- **passlib** + **argon2** — Password hashing
- **pytest** — Testing framework

### Application Structure

The backend follows a **layered architecture**:

```
app/
├── main.py              # FastAPI app initialization, CORS, router registration
├── db.py                # Database engine, session factory, Base model
├── dependencies.py      # Shared dependency injection (get_db, get_current_user)
├── crud.py              # Generic CRUD utilities
├── auth/                # Authentication module
│   ├── routes.py        # Auth endpoints (register, login, refresh, etc.)
│   ├── services.py      # Auth business logic
│   ├── services_refresh.py  # Refresh token management
│   └── utils.py         # JWT and password utilities
├── models/              # SQLAlchemy ORM models
├── schemas/             # Pydantic request/response schemas
├── repositories/        # Data access layer (DB queries)
├── services/            # Business logic layer
└── routers/             # API route handlers
```

### Layer Responsibilities

1. **Routers** — Handle HTTP requests/responses, parameter validation, error mapping
2. **Services** — Business logic, orchestration, AI integration
3. **Repositories** — Database query logic (data access)
4. **Models** — SQLAlchemy ORM model definitions
5. **Schemas** — Pydantic models for request validation and response serialization

### API Router Modules

| Router | Prefix | Description |
|--------|--------|-------------|
| `auth/routes.py` | `/auth` | Registration, login, token refresh, password reset |
| `profile.py` | `/profile` | User profile, onboarding, account management |
| `transactions.py` | `/transactions` | Transaction CRUD, import, categorization |
| `budgets.py` | `/budgets` | Budget CRUD, comparison, alerts, history |
| `goals.py` | `/goals` | Savings goals, contributions, AI calculations |
| `analytics.py` | `/analytics` | Dashboard analytics, spending breakdown, trends |
| `insights.py` | `/api` | AI-powered spending insights, anomaly detection |
| `chat.py` | `/chat` | AI chatbot conversations and messages |
| `status.py` | `/status` | Health check endpoints |
| `items.py` | `/items` | Generic scaffold CRUD |

---

## Database Architecture

### Database Provider

- **Neon** (serverless PostgreSQL) for production
- **SQLite** for local development (fallback)

### Key Tables

| Table | Purpose |
|-------|---------|
| `users` | User accounts, credentials, profile info |
| `categories` | User-defined spending categories |
| `transactions` | Financial transactions with vendor, amount, date |
| `budgets` | Monthly budget limits per category |
| `goals` | Savings goals with target amounts and deadlines |
| `goal_contributions` | Individual contributions toward goals |
| `conversations` | AI chat conversation threads |
| `messages` | Individual chat messages (user + AI) |
| `refresh_tokens` | JWT refresh token storage |
| `financial_profiles` | User financial profile and onboarding data |

### ORM & Migrations

- **SQLAlchemy** handles all database interactions
- **Alembic** manages schema migrations in `alembic/versions/`
- On Render deployment, tables are auto-created on startup if migrations haven't been applied

---

## Authentication Flow

```
┌──────────┐         ┌──────────┐         ┌──────────┐
│  Client  │         │  Backend │         │ Database │
└────┬─────┘         └────┬─────┘         └────┬─────┘
     │                    │                    │
     │  POST /auth/register                    │
     │  {email, password}  │                    │
     ├───────────────────►│                    │
     │                    │  Hash password     │
     │                    │  Create user       │
     │                    ├───────────────────►│
     │                    │  User created      │
     │                    │◄───────────────────┤
     │  201 {user}        │                    │
     │◄───────────────────┤                    │
     │                    │                    │
     │  POST /auth/login   │                    │
     │  {email, password}  │                    │
     ├───────────────────►│                    │
     │                    │  Verify password   │
     │                    │  Generate JWT      │
     │                    │  (access + refresh)│
     │                    │  Store refresh     │
     │                    ├───────────────────►│
     │  200 {access_token, │                    │
     │       refresh_token}│                    │
     │◄───────────────────┤                    │
     │                    │                    │
     │  GET /transactions  │                    │
     │  Authorization:     │                    │
     │  Bearer <access>    │                    │
     ├───────────────────►│                    │
     │                    │  Decode JWT        │
     │                    │  Verify signature  │
     │                    │  Extract user_id   │
     │                    │  Query transactions│
     │                    ├───────────────────►│
     │  200 {transactions} │◄──────────────────┤
     │◄───────────────────┤                    │
     │                    │                    │
     │  POST /auth/refresh  │                    │
     │  {refresh_token}    │                    │
     ├───────────────────►│                    │
     │                    │  Validate refresh  │
     │                    │  Revoke old token  │
     │                    │  Issue new tokens  │
     │  200 {new tokens}  │                    │
     │◄───────────────────┤                    │
```

### Token Lifecycle

1. **Registration**: User creates an account with email and password
2. **Login**: Backend validates credentials, returns:
   - `access_token` (short-lived, 30 min) — used for API authentication
   - `refresh_token` (long-lived, 7 days) — used to obtain new access tokens
3. **API Requests**: Client includes `Authorization: Bearer <access_token>` header
4. **Token Refresh**: When access token expires, client uses refresh token to get new tokens
5. **Logout**: Refresh token is revoked in the database

### Password Security

- Passwords are hashed using **argon2** (via `passlib`)
- Password reset tokens are time-limited and single-use
- Email verification is disabled (users are auto-verified on registration)

---

## API Communication

### Request Flow

```
┌──────────┐    HTTPS     ┌──────────┐    ORM     ┌──────────┐
│  Browser │ ──────────►  │  FastAPI │ ────────►  │PostgreSQL│
│  (React) │ ◄──────────  │  Server  │ ◄────────  │  (Neon)  │
└──────────┘    JSON      └──────────┘    Rows    └──────────┘
```

1. **Client** makes an HTTP request via the `api.ts` wrapper
2. **FastAPI** receives the request, runs middleware (CORS), routes to the appropriate handler
3. **Router** extracts parameters, calls the service layer
4. **Service** executes business logic, queries the database via repositories/models
5. **Response** is serialized to JSON via Pydantic schemas and returned to the client

### CORS Configuration

- In development: `CORS_ALLOW_ORIGINS=http://localhost:5173`
- In production: `CORS_ALLOW_ORIGINS=https://your-frontend.vercel.app`
- The backend reads `CORS_ALLOW_ORIGINS` from environment variables
- Supports comma-separated multiple origins

---

## Data Flow Examples

### Creating a Transaction

```
User fills form → React component → api.post("/transactions", data)
  → fetch() with Bearer token → FastAPI router
  → TransactionService.create_transaction()
  → SQLAlchemy INSERT → PostgreSQL
  → Pydantic serialization → JSON response
  → React state update → UI re-render
```

### AI Chat Interaction

```
User types question → ChatPage → api.post("/chat/conversations/{id}/messages", {question})
  → FastAPI router → ChatService.send_message()
  → Save user message to DB
  → Call Google Gemini API with context
  → Save AI response to DB
  → Return response to client
  → React state update → Display AI response
```

### Dashboard Analytics

```
User visits Dashboard → DashboardPage → api.get("/analytics/dashboard?start_date=...&end_date=...")
  → FastAPI router → AnalyticsService.build_dashboard_analytics()
  → Multiple DB queries (spending by category, trends, top vendors)
  → Aggregate and compute statistics
  → Return JSON → Recharts renders charts
```

---

## AI Integration

MoneyMate integrates with **Google Gemini API** for several AI-powered features:

| Feature | AI Service | Description |
|---------|-----------|-------------|
| Transaction Categorization | Gemini | Suggests category based on vendor and description |
| Spending Insights | Gemini | Analyzes patterns and provides plain-language feedback |
| Anomaly Detection | Gemini | Identifies unusual transactions |
| Recurring Detection | Gemini | Finds subscriptions and recurring payments |
| Monthly Summary | Gemini | Generates financial health summary |
| Goal Calculations | Gemini | Calculates required monthly savings |
| Goal Projections | Gemini | Generates month-by-month savings projections |
| Financial Chatbot | Gemini | Answers natural language questions about finances |

The AI services are implemented in `app/services/` with heuristic fallbacks when the AI provider is unavailable.

---

## Testing Strategy

### Backend Tests (pytest)

| Test File | Coverage |
|-----------|----------|
| `test_auth_unit.py` | Authentication unit tests |
| `test_auth_flows.py` | Authentication integration flows |
| `test_auth_token_utils.py` | JWT token utilities |
| `test_transactions_unit.py` | Transaction service unit tests |
| `test_transactions_ai.py` | AI categorization tests |
| `test_budgets.py` | Budget integration tests |
| `test_budgets_unit.py` | Budget service unit tests |
| `test_analytics.py` | Analytics service tests |
| `test_chat.py` | Chat service tests |
| `test_integration.py` | Cross-module integration tests |
| `test_smoke.py` | Basic smoke tests |

### Frontend Tests (Vitest)

| Test File | Coverage |
|-----------|----------|
| `Button.test.tsx` | Button component tests |
| `LoginForm.test.tsx` | Login form tests |
| `Modal.test.tsx` | Modal component tests |
| `RegisterForm.test.tsx` | Registration form tests |

---

## Deployment Architecture

```
                         ┌─────────────────┐
                         │   Vercel (CDN)   │
                         │  React Frontend  │
                         │  moneymate.      │
                         │  vercel.app      │
                         └────────┬────────┘
                                  │ HTTPS
                                  │
                         ┌────────▼────────┐
                         │  Render (Web)    │
                         │  FastAPI Backend │
                         │  moneymate-api.  │
                         │  onrender.com    │
                         └────────┬────────┘
                                  │
                         ┌────────▼────────┐
                         │  Neon (DBaaS)    │
                         │  PostgreSQL      │
                         │  ep-xxx.neon.    │
                         │  tech            │
                         └─────────────────┘
```

- **Frontend**: Static files served via Vercel's global CDN
- **Backend**: Python FastAPI server running on Render
- **Database**: Serverless PostgreSQL on Neon
- **Email**: Resend API for transactional emails
- **AI**: Google Gemini API for AI features