from sqlalchemy import Column, Integer, String, Text
from sqlalchemy.orm import relationship
from app.db import Base


class Item(Base):
    __tablename__ = "items"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
