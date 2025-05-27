from datetime import datetime
from typing import Any, Dict, Optional
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy import Column, Integer, DateTime, String
from sqlalchemy.orm import Session

Base = declarative_base()

class BaseModel(Base):
    """Base model class with common functionality."""
    
    __abstract__ = True
    
    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    created_by = Column(String, nullable=True)
    updated_by = Column(String, nullable=True)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert model instance to dictionary."""
        return {
            column.name: getattr(self, column.name)
            for column in self.__table__.columns
        }
    
    @classmethod
    def get_by_id(cls, db: Session, id: int) -> Optional["BaseModel"]:
        """Get model instance by ID."""
        return db.query(cls).filter(cls.id == id).first()
    
    @classmethod
    def get_all(cls, db: Session, skip: int = 0, limit: int = 100) -> list["BaseModel"]:
        """Get all model instances with pagination."""
        return db.query(cls).offset(skip).limit(limit).all()
    
    def save(self, db: Session) -> "BaseModel":
        """Save model instance to database."""
        db.add(self)
        db.commit()
        db.refresh(self)
        return self
    
    def delete(self, db: Session) -> None:
        """Delete model instance from database."""
        db.delete(self)
        db.commit()
    
    def update(self, db: Session, **kwargs: Any) -> "BaseModel":
        """Update model instance with given attributes."""
        for key, value in kwargs.items():
            if hasattr(self, key):
                setattr(self, key, value)
        return self.save(db)

# Export for use in other modules
__all__ = ["Base", "BaseModel"] 