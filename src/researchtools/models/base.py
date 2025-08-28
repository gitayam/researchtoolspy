from datetime import datetime
from typing import Any, Dict, Optional, List, Type, TypeVar
from sqlalchemy.orm import declarative_base, Session
from sqlalchemy import Column, Integer, DateTime, String, inspect
from sqlalchemy.exc import SQLAlchemyError
from ..core.exceptions import DatabaseError, ResourceNotFoundError, ValidationError
from ..utils.logging import default_logger as logger
from ..core.database import db_manager

Base = declarative_base()

T = TypeVar('T', bound='BaseModel')

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
    
    def validate(self) -> None:
        """Validate model instance."""
        # Get all columns that are not nullable
        required_columns = [
            column.name for column in self.__table__.columns
            if not column.nullable and column.name != 'id'
        ]
        
        # Check if all required fields are set
        missing_fields = [
            field for field in required_columns
            if getattr(self, field) is None
        ]
        
        if missing_fields:
            raise ValidationError(
                message="Missing required fields",
                error_code="VALIDATION_ERROR",
                details={"missing_fields": missing_fields}
            )
    
    @classmethod
    def get_by_id(cls: Type[T], db: Session, id: int) -> Optional[T]:
        """
        Get model instance by ID.
        
        Args:
            db: Database session
            id: Model ID
            
        Returns:
            Optional[T]: Model instance if found, None otherwise
            
        Raises:
            DatabaseError: If there is a database error
        """
        try:
            return db.query(cls).filter(cls.id == id).first()
        except SQLAlchemyError as e:
            logger.error("Database error in get_by_id", error=e, model=cls.__name__, id=id)
            raise DatabaseError(
                message="Failed to retrieve model by ID",
                error_code="DB_GET_BY_ID_ERROR",
                details={"error": str(e), "id": id, "model": cls.__name__}
            )
    
    @classmethod
    def get_all(
        cls: Type[T],
        db: Session,
        skip: int = 0,
        limit: int = 100,
        filters: Optional[Dict[str, Any]] = None
    ) -> List[T]:
        """
        Get all model instances with pagination and filtering.
        
        Args:
            db: Database session
            skip: Number of records to skip
            limit: Maximum number of records to return
            filters: Optional dictionary of filters to apply
            
        Returns:
            List[T]: List of model instances
            
        Raises:
            DatabaseError: If there is a database error
        """
        try:
            query = db.query(cls)
            
            # Apply filters if provided
            if filters:
                for field, value in filters.items():
                    if hasattr(cls, field):
                        query = query.filter(getattr(cls, field) == value)
            
            return query.offset(skip).limit(limit).all()
        except SQLAlchemyError as e:
            logger.error(
                "Database error in get_all",
                error=e,
                model=cls.__name__,
                skip=skip,
                limit=limit,
                filters=filters
            )
            raise DatabaseError(
                message="Failed to retrieve models",
                error_code="DB_GET_ALL_ERROR",
                details={
                    "error": str(e),
                    "skip": skip,
                    "limit": limit,
                    "filters": filters,
                    "model": cls.__name__
                }
            )
    
    def save(self, db: Session) -> T:
        """
        Save model instance to database.
        
        Args:
            db: Database session
            
        Returns:
            T: Saved model instance
            
        Raises:
            DatabaseError: If there is a database error
            ValidationError: If model validation fails
        """
        try:
            # Validate model before saving
            self.validate()
            
            # Set timestamps
            now = datetime.utcnow()
            if not self.id:
                self.created_at = now
            self.updated_at = now
            
            db.add(self)
            db.commit()
            db.refresh(self)
            
            logger.info(
                "Model saved successfully",
                model=self.__class__.__name__,
                id=self.id
            )
            return self
        except ValidationError:
            raise
        except SQLAlchemyError as e:
            db.rollback()
            logger.error("Database error in save", error=e, model=self.__class__.__name__)
            raise DatabaseError(
                message="Failed to save model",
                error_code="DB_SAVE_ERROR",
                details={"error": str(e), "model": self.__class__.__name__}
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
            
            logger.info(
                "Model deleted successfully",
                model=self.__class__.__name__,
                id=self.id
            )
        except SQLAlchemyError as e:
            db.rollback()
            logger.error("Database error in delete", error=e, model=self.__class__.__name__)
            raise DatabaseError(
                message="Failed to delete model",
                error_code="DB_DELETE_ERROR",
                details={"error": str(e), "model": self.__class__.__name__}
            )
    
    def update(self, db: Session, **kwargs: Any) -> T:
        """
        Update model instance with given attributes.
        
        Args:
            db: Database session
            **kwargs: Attributes to update
            
        Returns:
            T: Updated model instance
            
        Raises:
            DatabaseError: If there is a database error
            ResourceNotFoundError: If the model instance doesn't exist
            ValidationError: If model validation fails after update
        """
        try:
            if not self.id:
                raise ResourceNotFoundError(
                    message="Cannot update unsaved model",
                    error_code="MODEL_NOT_FOUND",
                    details={"model": self.__class__.__name__}
                )
            
            # Update only valid attributes
            for key, value in kwargs.items():
                if hasattr(self, key):
                    setattr(self, key, value)
            
            # Set updated timestamp
            self.updated_at = datetime.utcnow()
            
            return self.save(db)
        except (ResourceNotFoundError, ValidationError):
            raise
        except SQLAlchemyError as e:
            logger.error("Database error in update", error=e, model=self.__class__.__name__)
            raise DatabaseError(
                message="Failed to update model",
                error_code="DB_UPDATE_ERROR",
                details={"error": str(e), "model": self.__class__.__name__}
            )

# Export for use in other modules
__all__ = ["Base", "BaseModel"] 