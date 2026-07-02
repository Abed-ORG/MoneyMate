# MoneyMate Testing Guide

## Overview

This document describes the testing setup for the MoneyMate application, including how to run tests and interpret coverage reports.

## Test Structure

### Backend Tests (Python/pytest)
Located in the `tests/` directory:

- **test_auth_unit.py** - Authentication unit tests (register, login, logout, refresh, password reset)
- **test_transactions_unit.py** - Transaction CRUD operations and validation
- **test_budgets_unit.py** - Budget CRUD operations and calculations
- **test_integration.py** - End-to-end user workflows (register → login → create transaction → create budget)
- **test_auth_flows.py** - Existing auth flow tests
- **test_budgets.py** - Existing budget tests
- **test_chat.py** - Existing chat tests
- **test_analytics.py** - Existing analytics tests
- **test_smoke.py** - Smoke tests
- **test_transactions_ai.py** - Existing AI categorization tests

### Frontend Tests (Vitest/React Testing Library)
Located in `client/src/__tests__/`:

- **LoginForm.test.tsx** - Login form rendering, validation, and submission
- **RegisterForm.test.tsx** - Registration form validation and submission
- **Button.test.tsx** - Button component variants and interactions
- **Modal.test.tsx** - Modal dialog rendering and behavior

## Running Tests

### Backend Tests

Run all backend tests:
```bash
cd /c/Users/micho/MoneyMate
source .venv/Scripts/activate
python -m pytest tests/ -v
```

Run specific test files:
```bash
python -m pytest tests/test_auth_unit.py -v
python -m pytest tests/test_transactions_unit.py -v
python -m pytest tests/test_budgets_unit.py -v
python -m pytest tests/test_integration.py -v
```

Run with coverage:
```bash
python -m pytest tests/ --cov=app --cov-report=html --cov-report=term
```

### Frontend Tests

Run all frontend tests:
```bash
cd /c/Users/micho/MoneyMate/client
npm test
```

Run frontend tests with coverage:
```bash
npm run test:coverage
```

Watch mode for development:
```bash
npm run test:watch
```

## Test Coverage

### Backend Coverage

To generate a coverage report:
```bash
cd /c/Users/micho/MoneyMate
source .venv/Scripts/activate
python -m pytest tests/ --cov=app --cov-report=html
```

This creates an `htmlcov/` directory. Open `htmlcov/index.html` in a browser to view the report.

### Frontend Coverage

```bash
cd /c/Users/micho/MoneyMate/client
npm run test:coverage
```

This creates a `coverage/` directory with HTML reports.

## Coverage Thresholds

Recommended minimum coverage:
- **Backend**: 80% overall
- **Critical paths** (auth, transactions, budgets): 90%+
- **Frontend components**: 70%+

## Test Writing Guidelines

### Backend Tests
- Use `TestClient` from FastAPI for HTTP endpoint testing
- Use in-memory SQLite databases for isolation
- Mock external services (email, AI providers)
- Test both success and failure cases
- Verify status codes and response bodies

### Frontend Tests
- Use `@testing-library/react` for component rendering
- Use `user-event` for user interactions
- Mock API calls with `vi.fn()`
- Test accessibility with proper ARIA attributes
- Verify loading, error, and success states

## Continuous Integration

Tests should be run in CI/CD pipelines:
```bash
# Backend
python -m pytest tests/ -v --tb=short

# Frontend
npm test
```

## Troubleshooting

### Backend Tests Fail with "No module named pytest"
```bash
source .venv/Scripts/activate
pip install pytest pytest-cov
```

### Frontend Tests Fail with Module Not Found
```bash
cd client
npm install
```

### Port Already in Use
Ensure no development servers are running on ports 8000 (backend) or 5173 (frontend).