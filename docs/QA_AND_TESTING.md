# QA And Testing

## Automated Checks

Backend:

```powershell
.\.venv\Scripts\python.exe -m pytest -q
```

Frontend type check:

```powershell
cd client
npm.cmd run build
```

The build runs `tsc --noEmit` before Vite production bundling.

## Critical Coverage Already Included

Backend tests cover:
- auth registration, login, password reset, and account deletion
- refresh token utilities
- transaction category management, AI categorization fallback, corrections, and bulk recategorization
- register -> login -> create -> list -> update -> delete transaction workflow
- budget CRUD, duplicate prevention, ownership checks, calculations, history, alerts, and copy-from-previous-month behavior
- analytics aggregation
- email service configuration behavior
- chat service behavior

## Coverage Threshold

Target minimum before production hardening:
- Backend service/router coverage: 70%
- Critical auth, transaction, budget workflow coverage: must stay present

This repository does not currently include a coverage plugin in `requirements.txt`, so coverage reporting should be enabled in a separate dev dependency pass with `pytest-cov` rather than being bolted onto the production install at the end of the demo cycle.

## Manual Demo Bug Bash Checklist

Use these checks at 1366px, 768px, and 375px:

1. Register and log in.
2. Complete or skip onboarding.
3. Open and close mobile navigation.
4. Add, edit, filter, export, import, and delete transactions.
5. Create, filter, copy, edit, and delete budgets.
6. Confirm dashboard filter Reset and Apply behavior.
7. Create, update, contribute to, and delete goals.
8. Generate monthly and annual reports.
9. Open the AI chat widget and close it.
10. Toggle light/dark mode.
11. Refresh protected pages and confirm auth persistence.
12. Confirm no page-level horizontal scrolling on mobile.

## Known Skips For This Polish Pass

- Team bug bash cannot be completed by code changes alone; it needs the full team to test the deployed build.
- Frontend component tests were not added because no frontend test runner is currently configured. Adding Vitest and Testing Library this late would increase dependency and setup risk.
- API response caching was not added because most responses are user-specific and change after transactions, budgets, profile edits, or goals. Incorrect caching would be worse than no caching for a finance app.
