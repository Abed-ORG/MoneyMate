# MoneyMate

A smart personal finance and budgeting platform with AI-powered insights. MoneyMate helps users track transactions, set budgets by category, monitor spending patterns, and get AI-generated financial insights in plain language. Built for university graduates and young professionals who want to take control of their money with smart categorization, goal tracking, and an AI financial Q&A assistant.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React (Vite) + CSS |
| Backend | FastAPI (Python) |
| Database | PostgreSQL |
| ORM | SQLAlchemy + Alembic |
| AI | Google Gemini API |
| Auth | JWT |
| Hosting | Vercel |

## Project Structure

```
moneymate/
├── client/          # React frontend
├── server/          # FastAPI backend
├── .gitignore
└── README.md
```

## Team

| Name | Role |
|------|------|
| Celine Salameh | Developer |
| Anthony Abboud | Developer |
| Michel Hajjar | Developer |

## Getting Started

For the current authentication, password recovery, and shared PostgreSQL setup, follow
[`AUTH_EMAIL_DATABASE_SETUP.md`](AUTH_EMAIL_DATABASE_SETUP.md).

### Prerequisites

- Python 3.11+
- Node.js 18+
- npm
- Git
- VS Code (recommended)
- PostgreSQL client

### Setup

1. Clone the repo:
   ```bash
   git clone <repo-url>
   cd moneymate
   ```

2. Switch to the `develop` branch:
   ```bash
   git checkout develop
   ```

3. Install frontend dependencies:
   ```bash
   cd client
   npm install
   ```

4. Set up the backend virtual environment:
   ```bash
   cd ../server
   python -m venv venv
   source venv/bin/activate    # macOS/Linux
   # venv\Scripts\activate     # Windows
   pip install -r requirements.txt
   ```

5. Set up environment variables:
   - Copy `.env.example` to `.env` in the backend root
   - Fill in your PostgreSQL or Neon `DATABASE_URL`, JWT secret, and email settings
   - For the free email setup, use a Gmail account with a Google app password and set `EMAIL_PROVIDER=smtp`
   - For Render deployment, set `CORS_ALLOW_ORIGINS` to the Vercel frontend URL and
     `FRONTEND_URL` to the same public site URL
   - Copy `client/.env.example` to `client/.env` and set `VITE_API_URL` to your
     Render backend URL

6. Run database migrations:
   ```bash
   alembic upgrade head
   ```

7. Start the development servers:
   ```bash
   # Terminal 1 — backend
   cd server
   source venv/bin/activate
   uvicorn app.main:app --reload

   # Terminal 2 — frontend
   cd client
   npm run dev
   ```

   The frontend talks to `http://127.0.0.1:8000` by default if
   `VITE_API_URL` is not set.

8. Optional email smoke test:
   ```bash
   python scripts/send_test_email.py your-own-recipient@example.com
   ```

## Deployment Notes

- Backend: Render
- Database: Neon Postgres
- Frontend: Vercel

The backend reads `DATABASE_URL` directly, so the Neon connection string should be
set in Render environment variables. The frontend reads `VITE_API_URL`, which should
point to the Render backend service URL.

## Developer Documentation

- [API reference](docs/API_REFERENCE.md)
- [Deployment guide](docs/DEPLOYMENT.md)
- [Architecture overview](docs/ARCHITECTURE.md)
- [QA and testing checklist](docs/QA_AND_TESTING.md)

## Git Workflow

This project uses a **two-branch model** with `main` and `develop`.

### Branches

- **`main`** — Production-ready code. Only updated at the end of a sprint before deployment. Never push directly to main.
- **`develop`** — Active development branch. All feature work merges here first.

### How to Work on a Task

1. **Pull the latest from develop:**
   ```bash
   git checkout develop
   git pull origin develop
   ```

2. **Create a feature branch from develop:**
   ```bash
   git checkout -b feature/SCRUM-XX-short-description
   ```
   Use the Jira ticket number in the branch name (e.g., `feature/SCRUM-42-login-page`).

3. **Work on your task.** Commit often with clear messages:
   ```bash
   git add .
   git commit -m "SCRUM-42: Add login form with validation"
   ```

4. **Push your branch:**
   ```bash
   git push origin feature/SCRUM-XX-short-description
   ```

5. **Open a Pull Request (PR) into `develop`:**
   - Go to GitHub and create a PR from your branch into `develop`
   - Add a clear title and description of what you did
   - Request a review from at least one teammate
   - Link the Jira ticket in the PR description

6. **After review and approval**, merge the PR into `develop`.

7. **Delete your feature branch** after merging (GitHub can do this automatically).

### Rules

- Never push directly to `main` or `develop` — always use pull requests
- Keep your feature branches small and focused on one task
- Pull from `develop` frequently to avoid merge conflicts
- Write meaningful commit messages that reference the Jira ticket
- Review your teammates' PRs — everyone reviews, everyone learns

## Key Features

- User registration and authentication with secure financial profile setup
- Manual transaction entry and CSV bank statement import
- AI auto-categorization of transactions by vendor and description
- Custom category management with user corrections that improve AI accuracy
- Monthly budget creation and tracking with visual progress bars and alerts
- Savings goal tracker with AI-calculated monthly contributions
- AI spending insights: plain-language analysis of patterns and anomalies
- Recurring transaction detection (subscriptions, rent, utilities)
- Interactive dashboards: spending by category, income vs. expenses, trends
- AI financial Q&A chatbot: ask questions about your finances in natural language
- Monthly and yearly financial reports with CSV and PDF export
