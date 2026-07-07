# MoneyMate

A smart personal finance and budgeting platform with AI-powered insights. MoneyMate helps users track transactions, set budgets by category, monitor spending patterns, and get AI-generated financial insights in plain language. Built for university graduates and young professionals who want to take control of their money with smart categorization, goal tracking, and an AI financial Q&A assistant.

---

## Features

- **User Authentication** — Secure registration and login with JWT access/refresh tokens, password reset via email
- **Transaction Management** — Manual transaction entry, CSV bank statement import, bulk operations
- **AI Auto-Categorization** — Automatically categorizes transactions by vendor and description using Google Gemini
- **Custom Categories** — Create and manage custom spending categories; user corrections improve AI accuracy over time
- **Budget Tracking** — Monthly budget creation per category with visual progress bars, alerts, and history
- **Savings Goals** — Set savings goals with AI-calculated monthly contributions and timeline projections
- **AI Spending Insights** — Plain-language analysis of spending patterns, anomalies, and recurring transactions
- **Financial Dashboards** — Interactive charts for spending by category, income vs. expenses, trends over time
- **AI Financial Chatbot** — Ask questions about your finances in natural language (e.g., "How much did I spend on groceries this month?")
- **Monthly & Yearly Reports** — Generate reports with CSV and PDF export

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, TypeScript, Vite, React Router v6 |
| **Styling** | CSS Modules |
| **Charts** | Recharts |
| **Backend** | FastAPI (Python 3.11+) |
| **ORM** | SQLAlchemy + Alembic |
| **Database** | PostgreSQL (Neon) |
| **AI** | Google Gemini API |
| **Auth** | JWT (access + refresh tokens) |
| **Email** | Resend |
| **Testing (BE)** | pytest |
| **Testing (FE)** | Vitest, Testing Library |
| **Hosting** | Render (backend), Vercel (frontend) |

---

## Folder Structure

```
MoneyMate/
├── app/                        # FastAPI backend
│   ├── __init__.py
│   ├── main.py                 # FastAPI app entry point
│   ├── db.py                   # Database engine & session
│   ├── crud.py                 # Basic CRUD utilities
│   ├── dependencies.py         # Shared dependencies (auth, db)
│   ├── auth/                   # Authentication module
│   │   ├── routes.py           # Register, login, refresh, logout, reset
│   │   └── services.py         # Auth business logic
│   ├── models/                 # SQLAlchemy models
│   ├── repositories/           # Data access layer
│   ├── routers/                # API route handlers
│   │   ├── analytics.py        # Dashboard analytics
│   │   ├── budgets.py          # Budget CRUD & comparison
│   │   ├── chat.py             # AI chatbot conversations
│   │   ├── goals.py            # Savings goals
│   │   ├── insights.py         # AI spending insights
│   │   ├── items.py            # Generic items (scaffold)
│   │   ├── profile.py          # User profile & onboarding
│   │   ├── status.py           # Health check
│   │   └── transactions.py     # Transaction CRUD & import
│   ├── schemas/                # Pydantic request/response schemas
│   └── services/               # Business logic layer
├── alembic/                    # Database migrations
│   └── versions/               # Migration scripts
├── client/                     # React frontend
│   ├── src/
│   │   ├── components/         # Reusable UI components
│   │   ├── contexts/           # React contexts (Auth, DashboardFilters, Toast)
│   │   ├── hooks/              # Custom hooks
│   │   ├── layouts/            # App shell layout
│   │   ├── pages/              # Page components
│   │   ├── routes/             # Route definitions & guards
│   │   ├── services/           # API client modules
│   │   ├── types/              # TypeScript type definitions
│   │   ├── utils/              # Utility functions
│   │   └── styles/             # Global styles
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   └── vitest.config.ts
├── tests/                      # Backend test suite
│   ├── test_auth_unit.py
│   ├── test_auth_flows.py
│   ├── test_auth_token_utils.py
│   ├── test_budgets.py
│   ├── test_budgets_unit.py
│   ├── test_transactions_unit.py
│   ├── test_transactions_ai.py
│   ├── test_analytics.py
│   ├── test_chat.py
│   ├── test_integration.py
│   └── test_smoke.py
├── server/                     # Legacy / server-side utilities
├── scripts/                    # Utility scripts
│   ├── seed.py                 # Database seeding
│   └── find_long_lines.py
├── vercel.json                 # Vercel deployment config
├── requirements.txt            # Python dependencies
├── pytest.ini                  # Pytest configuration
├── alembic.ini                 # Alembic configuration
├── AUTH_EMAIL_DATABASE_SETUP.md
├── TESTING_README.md
└── README.md
```

---

## Installation

### Prerequisites

- **Python 3.11+**
- **Node.js 18+**
- **npm**
- **Git**
- **PostgreSQL client** (for local database)
- **VS Code** (recommended)

### 1. Clone the Repository

```bash
git clone https://github.com/abdulhamid-chanouha/MoneyMate.git
cd MoneyMate
```

### 2. Backend Setup

```bash
# Create a virtual environment
python -m venv venv

# Activate it
# macOS/Linux:
source venv/bin/activate
# Windows:
# venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### 3. Frontend Setup

```bash
cd client
npm install
cd ..
```

### 4. Environment Variables

Create a `.env` file in the project root (or copy from `.env.example`):

```bash
# Database
DATABASE_URL=postgresql://user:password@host:5432/moneymate

# JWT
SECRET_KEY=your-secret-key
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

# Email (Resend)
RESEND_API_KEY=re_xxxxx

# CORS
CORS_ALLOW_ORIGINS=http://localhost:5173
FRONTEND_URL=http://localhost:5173

# AI
GEMINI_API_KEY=your-gemini-api-key
```

Create `client/.env`:

```bash
VITE_API_URL=http://127.0.0.1:8000
```

### 5. Database Migrations

```bash
alembic upgrade head
```

### 6. Seed Data (Optional)

```bash
python scripts/seed.py
```

---

## Running Locally

Start both servers in separate terminals:

```bash
# Terminal 1 — Backend
cd MoneyMate
source venv/bin/activate    # or venv\Scripts\activate on Windows
uvicorn app.main:app --reload
# API available at http://127.0.0.1:8000

# Terminal 2 — Frontend
cd MoneyMate/client
npm run dev
# UI available at http://localhost:5173
```

The frontend will proxy API calls to `http://127.0.0.1:8000` by default.

---

## Building for Production

### Backend

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### Frontend

```bash
cd client
npm run build
# Output in client/dist/
```

---

## Testing

### Backend Tests

```bash
# Run all backend tests
pytest

# Run with coverage
pytest --cov=app

# Run specific test file
pytest tests/test_transactions_unit.py
```

### Frontend Tests

```bash
cd client

# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage
```

---

## Deployment

See the [Deployment Guide](./DEPLOYMENT_GUIDE.md) for detailed deployment instructions.

| Service | Provider |
|---------|----------|
| Backend API | Render |
| Frontend | Vercel |
| Database | Neon (PostgreSQL) |

---

## API Documentation

Full API documentation is available in [API_DOCUMENTATION.md](./API_DOCUMENTATION.md).

Interactive API docs are also available at `/docs` when the backend is running (Swagger UI).

---

## Architecture

A high-level architecture overview is provided in [ARCHITECTURE.md](./ARCHITECTURE.md).

---

## Team

| Name | Role |
|------|------|
| Celine Salameh | Developer |
| Anthony Abboud | Developer |
| Michel Hajjar | Developer |

---

## Git Workflow

This project uses a **two-branch model** with `main` and `develop`.

### Branches

- **`main`** — Production-ready code. Only updated at sprint end before deployment.
- **`develop`** — Active development branch. All feature work merges here.

### Workflow

1. Pull latest from `develop`
2. Create a feature branch: `git checkout -b feature/SCRUM-XX-description`
3. Commit with clear messages referencing the Jira ticket
4. Push and open a PR into `develop`
5. Request review, merge after approval, delete the branch

### Rules

- Never push directly to `main` or `develop` — always use PRs
- Keep feature branches small and focused
- Pull from `develop` frequently to avoid conflicts
- Everyone reviews PRs

---

## License

This project is for educational purposes as part of a university capstone project.