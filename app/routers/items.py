from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.schemas.item import Item, ItemCreate
from app.services.item_service import get_item, get_items, create_item
from app.dependencies import get_db

router = APIRouter()


# use shared `get_db` from `app.dependencies`


@router.post("/", response_model=Item)
def create_item_endpoint(item: ItemCreate, db: Session = Depends(get_db)):
    return create_item(db, item)


@router.get("/", response_model=List[Item])
def read_items(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    return get_items(db, skip, limit)


@router.get("/{item_id}", response_model=Item)
def read_item_endpoint(item_id: int, db: Session = Depends(get_db)):
    db_item = get_item(db, item_id)
    if not db_item:
        raise HTTPException(status_code=404, detail="Item not found")
    return db_item
