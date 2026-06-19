from fastapi import FastAPI
import os

from app.routers import budgets, items, profile, transactions
from app.auth import routes as auth_routes
from fastapi.middleware.cors import CORSMiddleware
from app.routers import status as status_router
from app.db import Base, engine
from app import models  # noqa: F401

app = FastAPI(title="MoneyMate API")

# CORS

origins = os.getenv("CORS_ALLOW_ORIGINS", "*")
if origins.strip() == "*":
    allow_origins = ["*"]
else:
    allow_origins = [o.strip() for o in origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(items.router, prefix="/items", tags=["items"])
app.include_router(auth_routes.router, prefix="/auth", tags=["auth"])
app.include_router(profile.router, prefix="/profile", tags=["profile"])
app.include_router(budgets.router, prefix="/budgets", tags=["budgets"])
app.include_router(
    transactions.router,
    prefix="/transactions",
    tags=["transactions"],
)
app.include_router(status_router.router, prefix="/status", tags=["status"])


@app.on_event("startup")
def ensure_database_schema():
    """Create any missing tables on startup.

    This keeps fresh deployment databases usable even if migrations were not
    applied yet. Existing tables are left untouched.
    """
    if os.getenv("RENDER_SERVICE_ID"):
        Base.metadata.create_all(bind=engine)


@app.get("/")
async def root():
    return {"message": "Hello, FastAPI!"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)
