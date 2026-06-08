from sqlalchemy import Column, Integer, String, Text
from app.db import Base


class Item(Base):
    __tablename__ = "items"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(100), index=True, nullable=False)
    description = Column(Text, nullable=True)
