from datetime import datetime
from typing import Any, Dict, Optional
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy import Column, Integer, DateTime, String
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from ..core.exceptions import DatabaseError, ResourceNotFoundError
from ..utils.logging import logger

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
        """
        Get model instance by ID.
        
        Args:
            db: Database session
            id: Model ID
            
        Returns:
            Optional[BaseModel]: Model instance if found, None otherwise
            
        Raises:
            DatabaseError: If there is a database error
        """
        try:
            return db.query(cls).filter(cls.id == id).first()
        except SQLAlchemyError as e:
            logger.error(f"Database error in get_by_id: {str(e)}")
            raise DatabaseError(
                message="Failed to retrieve model by ID",
                error_code="DB_GET_BY_ID_ERROR",
                details={"error": str(e), "id": id}
            )
    
    @classmethod
    def get_all(cls, db: Session, skip: int = 0, limit: int = 100) -> list["BaseModel"]:
        """
        Get all model instances with pagination.
        
        Args:
            db: Database session
            skip: Number of records to skip
            limit: Maximum number of records to return
            
        Returns:
            list[BaseModel]: List of model instances
            
        Raises:
            DatabaseError: If there is a database error
        """
        try:
            return db.query(cls).offset(skip).limit(limit).all()
        except SQLAlchemyError as e:
            logger.error(f"Database error in get_all: {str(e)}")
            raise DatabaseError(
                message="Failed to retrieve models",
                error_code="DB_GET_ALL_ERROR",
                details={"error": str(e), "skip": skip, "limit": limit}
            )
    
    def save(self, db: Session) -> "BaseModel":
        """
        Save model instance to database.
        
        Args:
            db: Database session
            
        Returns:
            BaseModel: Saved model instance
            
        Raises:
            DatabaseError: If there is a database error
        """
        try:
            db.add(self)
            db.commit()
            db.refresh(self)
            return self
        except SQLAlchemyError as e:
            db.rollback()
            logger.error(f"Database error in save: {str(e)}")
            raise DatabaseError(
                message="Failed to save model",
                error_code="DB_SAVE_ERROR",
                details={"error": str(e)}
            )
    
    def delete(self, db: Session) -> None:
        """
        Delete model instance from database.
        
        Args:
            db: Database session
            
        Raises:
            DatabaseError: If there is a database error
            ResourceNotFoundError: If the model instance doesn't exist
        """
        try:
            if not self.id:
                raise ResourceNotFoundError(
                    message="Cannot delete unsaved model",
                    error_code="MODEL_NOT_FOUND",
                    details={"model": self.__class__.__name__}
                )
            db.delete(self)
            db.commit()
        except SQLAlchemyError as e:
            db.rollback()
            logger.error(f"Database error in delete: {str(e)}")
            raise DatabaseError(
                message="Failed to delete model",
                error_code="DB_DELETE_ERROR",
                details={"error": str(e)}
            )
    
    def update(self, db: Session, **kwargs: Any) -> "BaseModel":
        """
        Update model instance with given attributes.
        
        Args:
            db: Database session
            **kwargs: Attributes to update
            
        Returns:
            BaseModel: Updated model instance
            
        Raises:
            DatabaseError: If there is a database error
            ResourceNotFoundError: If the model instance doesn't exist
        """
        try:
            if not self.id:
                raise ResourceNotFoundError(
                    message="Cannot update unsaved model",
                    error_code="MODEL_NOT_FOUND",
                    details={"model": self.__class__.__name__}
                )
            for key, value in kwargs.items():
                if hasattr(self, key):
                    setattr(self, key, value)
            return self.save(db)
        except SQLAlchemyError as e:
            logger.error(f"Database error in update: {str(e)}")
            raise DatabaseError(
                message="Failed to update model",
                error_code="DB_UPDATE_ERROR",
                details={"error": str(e)}
            )

# Export for use in other modules
__all__ = ["Base", "BaseModel"] 