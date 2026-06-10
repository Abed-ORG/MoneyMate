from fastapi import FastAPI

from app.routers import items
from app.auth import routes as auth_routes
from fastapi.middleware.cors import CORSMiddleware
from app.routers import status as status_router

app = FastAPI(title="FastAPI Scaffold")

# CORS
import os

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
app.include_router(status_router.router, prefix="/status", tags=["status"])


@app.get("/")
async def root():
    return {"message": "Hello, FastAPI!"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)
