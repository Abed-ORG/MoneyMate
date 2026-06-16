# MoneyMate Frontend

React + Vite + TypeScript frontend foundation for MoneyMate.

## Stack

- React
- Vite
- TypeScript
- React Router
- CSS Modules
- Recharts

## Run Locally

```bash
npm install
npm run dev
```

Open the local Vite URL that appears in the terminal, usually
`http://localhost:5173`.

If the backend is running locally, the frontend will talk to
`http://127.0.0.1:8000` by default. You can override that with `VITE_API_URL`
in a local `.env` file if your API runs somewhere else.

## Useful Checks

```bash
npm run build
```

## Authentication

The client uses the MoneyMate FastAPI authentication endpoints. It reads
`VITE_API_BASE_URL` from `client/.env`, persists access and refresh tokens, and
protects all authenticated application routes.

See the root `AUTH_EMAIL_DATABASE_SETUP.md` for email verification, password
recovery, shared database, and environment setup.
