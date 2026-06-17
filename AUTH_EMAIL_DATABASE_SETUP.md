# MoneyMate authentication, password recovery, and database setup

This guide uses placeholders only. Never place a real database password, API
key, Gmail app password, or JWT secret in Git, chat, screenshots, or
`.env.example`.

## 1. Backend `.env`

Create `C:\Users\HP\Downloads\MoneyMate\.env` by copying the root
`.env.example`. Replace the uppercase placeholders locally:

```env
DATABASE_URL=postgresql://USERNAME:PASSWORD@HOST:5432/DATABASE_NAME
SECRET_KEY=replace_with_a_long_random_secret
ACCESS_TOKEN_EXPIRE_MINUTES=1440

FRONTEND_URL=http://localhost:5173
CORS_ALLOW_ORIGINS=http://localhost:5173
PASSWORD_RESET_TOKEN_EXPIRE_MINUTES=30

EMAIL_PROVIDER=resend
RESEND_API_KEY=re_replace_with_your_resend_api_key
EMAIL_FROM_ADDRESS=onboarding@resend.dev
EMAIL_FROM_NAME=MoneyMate
```

`DATABASE_URL`, `SECRET_KEY`, and email credentials are private. Teammates may
use the same shared development `DATABASE_URL`, but each person should receive
it through a private team password manager or another approved private channel.
Do not send it in Git or commit it.

Signup does not require email verification. Newly registered users are created
as verified and can log in immediately. Email credentials are still used for
password reset links.

The team must use the same `SECRET_KEY` only when backend instances need to
accept one another's JWTs. Separate development and production secrets.

## 2. Resend setup (recommended)

1. Sign in to Resend with the team email account.
2. Open **API Keys**, create a sending-access key, and copy it immediately.
3. Put it only in the root `.env` as `RESEND_API_KEY`.
4. For initial development, use `onboarding@resend.dev` as
   `EMAIL_FROM_ADDRESS`. Resend's test sender may restrict recipients to the
   account owner.
5. Before sending to real users, verify a domain in Resend and replace
   `EMAIL_FROM_ADDRESS` with an address on that domain.
6. Install backend dependencies with `pip install -r requirements.txt`.

## 3. Gmail app-password alternative

Use this only if the team chooses SMTP instead of Resend.

1. Enable two-step verification on the dedicated Gmail account.
2. In Google Account security, create an app password for MoneyMate.
3. Do not use the normal Gmail password.
4. In the root `.env`, set:

```env
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your_app_email@gmail.com
SMTP_PASSWORD=replace_with_your_google_app_password
SMTP_FROM_EMAIL=your_app_email@gmail.com
SMTP_FROM_NAME=MoneyMate
SMTP_USE_TLS=true
```

The backend reads these values at send time. Test with a team-owned recipient
first, then remove test accounts and links from shared screenshots.

## 4. Frontend `.env`

Create `C:\Users\HP\Downloads\MoneyMate\client\.env` by copying
`client\.env.example`:

```env
VITE_API_BASE_URL=http://localhost:8000
```

This URL is not a secret. It can differ by teammate if someone runs the API on
a different port. Vite exposes every `VITE_` value to the browser, so never put
private credentials in the frontend `.env`.

## 5. Shared development database

Use a managed PostgreSQL development database reachable by the team. Keep a
separate production database with separate credentials and never point a local
developer environment at production.

Each teammate places the same private development connection string in their
own root `.env`:

```env
DATABASE_URL=postgresql://USERNAME:PASSWORD@HOST:5432/DATABASE_NAME
```

Recommended migration rules:

1. Nominate one teammate to run each new migration against the shared database.
2. Before migrating, back up the shared development database.
3. Review the migration file and confirm `alembic current`.
4. Run `alembic upgrade head` once.
5. Other teammates update their code but do not rerun experimental or edited
   migrations against the shared database.
6. Never rewrite a migration that has already run on a shared environment.
   Add a new forward migration instead.

For isolated automated tests, use a dedicated test database rather than the
shared development database.

## 6. Run and migrate

From the project root:

```powershell
pip install -r requirements.txt
alembic current
alembic upgrade head
python -m uvicorn app.main:app --reload
```

In a second terminal:

```powershell
cd client
npm install
npm run dev
```

## 7. Manual test checklist

1. **Sign up:** Register with an email and password. The login page should say
   the account was created.
2. **Login:** Log in immediately after registration and confirm the dashboard
   or onboarding screen opens.
3. **Persistence:** Refresh the dashboard and confirm the session remains.
4. **Forgot password:** Open `/forgot-password`, submit an email, and confirm
   the response never reveals whether the account exists.
5. **Reset password:** Open the emailed reset link, choose a new password, and
   confirm the link cannot be reused.
6. **Old password/session:** Confirm the old password fails and previous refresh
   sessions have been revoked.
7. **Protected routes:** Log out, then directly open `/dashboard`,
   `/transactions`, `/budgets`, `/goals`, `/reports`, `/chat`, and `/settings`.
   Each should redirect to `/login`.

## 8. What is safe to share

Safe to commit: `.env.example`, migration files, code, and this guide.

Never commit: `.env`, `client/.env`, database passwords, `SECRET_KEY`,
`RESEND_API_KEY`, Gmail app passwords, private production URLs, or copied
reset links.
