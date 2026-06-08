from fastapi import APIRouter, HTTPException
from sqlalchemy import text
from app.db import engine

router = APIRouter()


@router.get("/db")
def db_status():
    try:
        with engine.connect() as conn:
            # simple lightweight query
            conn.execute(text("SELECT 1"))
        return {"db": "ok"}
    except Exception:
        raise HTTPException(status_code=503, detail="Database unavailable")
