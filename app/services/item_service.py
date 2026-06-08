from sqlalchemy.orm import Session
from app.models.item import Item as ItemModel
from app.schemas.item import ItemCreate


def get_item(db: Session, item_id: int):
    return db.query(ItemModel).filter(ItemModel.id == item_id).first()


def get_items(db: Session, skip: int = 0, limit: int = 100):
    return db.query(ItemModel).offset(skip).limit(limit).all()


def create_item(db: Session, item: ItemCreate):
    db_item = ItemModel(title=item.title, description=item.description)
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item
