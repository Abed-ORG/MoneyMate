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

## Useful Checks

```bash
npm run build
```

## Demo Auth

Authentication is intentionally mocked for Epic 1. Submitting the login or
register form stores a local demo token and redirects to `/dashboard`. The
logout button clears that token.

The prepared API client reads `VITE_API_URL` from the environment, attaches the
mock token when present, and formats future API errors consistently. It does not
connect to a backend yet.
