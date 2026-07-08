# Deployment Guide

MoneyMate deploys as:
- Frontend: Vercel
- Backend: Render
- Database: Neon Postgres

## 1. Prepare Environment Variables

Backend environment variables on Render:

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST/neondb?sslmode=require
SECRET_KEY=<long-random-secret>
ACCESS_TOKEN_EXPIRE_MINUTES=1440
FRONTEND_URL=https://your-vercel-site.vercel.app
CORS_ALLOW_ORIGINS=https://your-vercel-site.vercel.app
GEMINI_API_KEY=<gemini-key>
GEMINI_MODEL=gemini-2.5-flash
EMAIL_PROVIDER=resend
EMAIL_FROM_ADDRESS=onboarding@resend.dev
EMAIL_FROM_NAME=MoneyMate
RESEND_API_KEY=<resend-key>
```

Frontend environment variables on Vercel:

```env
VITE_API_URL=https://your-render-backend.onrender.com
```

Do not put secrets in `client/.env`, Vercel public variables, Git, screenshots, or chat.

## 2. Backend On Render

1. Create a Render web service from the repository.
2. Set the root directory to the repository root.
3. Use Python 3.11 or newer.
4. Build command:

```bash
pip install -r requirements.txt
```

5. Start command:

```bash
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

6. Add the environment variables listed above.
7. Deploy.

## 3. Database Migrations

Run migrations against the Neon database before the final demo:

```powershell
alembic current
alembic upgrade head
```

Only one teammate should run migrations against a shared database. Do not edit a migration that has already been applied; add a new migration instead.

## 4. Frontend On Vercel

1. Create a Vercel project from the repository.
2. Set the root directory to `client`.
3. Build command:

```bash
npm run build
```

4. Output directory:

```text
dist
```

5. Add `VITE_API_URL`.
6. Deploy.

## 5. Post-Deploy Checks

1. Open the Vercel URL.
2. Register a new demo account.
3. Confirm login works.
4. Add a transaction.
5. Create a budget and check the dashboard.
6. Create and delete a goal.
7. Confirm password reset does not reveal whether an account exists.
8. Open browser dev tools and confirm there are no CORS errors.

## Rollback

Frontend:
- Revert to the previous Vercel deployment.

Backend:
- Revert to the previous Render deployment.
- If a migration caused the issue, use the migration downgrade only after confirming data safety.
