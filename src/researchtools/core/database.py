from contextlib import contextmanager
from typing import Generator, Optional
import sqlalchemy as sa
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import QueuePool
from sqlalchemy.exc import SQLAlchemyError
from ..core.config import settings
from ..utils.logging import logger
from .exceptions import DatabaseError, ConfigurationError

# Create engine with connection pooling
try:
    engine = sa.create_engine(
        settings.DATABASE_URL,
        poolclass=QueuePool,
        pool_size=settings.DATABASE_POOL_SIZE,
        max_overflow=settings.DATABASE_MAX_OVERFLOW,
        pool_pre_ping=True,  # Enable connection health checks
        pool_recycle=3600,   # Recycle connections after 1 hour
    )
except Exception as e:
    raise ConfigurationError(
        message="Failed to create database engine",
        error_code="DB_ENGINE_CREATE_ERROR",
        details={"error": str(e)}
    )

# Create session factory
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

@contextmanager
def get_db() -> Generator[Session, None, None]:
    """
    Context manager for database sessions.
    
    Yields:
        Session: Database session instance.
        
    Raises:
        DatabaseError: If there is an error with the database session.
        
    Example:
        with get_db() as db:
            result = db.query(Model).all()
    """
    db: Optional[Session] = None
    try:
        db = SessionLocal()
        yield db
        db.commit()
    except SQLAlchemyError as e:
        if db:
            db.rollback()
        logger.error(f"Database error: {str(e)}")
        raise DatabaseError(
            message="Database operation failed",
            error_code="DB_OPERATION_ERROR",
            details={"error": str(e)}
        )
    except Exception as e:
        if db:
            db.rollback()
        logger.error(f"Unexpected error in database operation: {str(e)}")
        raise DatabaseError(
            message="Unexpected database error",
            error_code="DB_UNEXPECTED_ERROR",
            details={"error": str(e)}
        )
    finally:
        if db:
            db.close()

def init_db() -> None:
    """
    Initialize database connection and create tables.
    
    Raises:
        DatabaseError: If there is an error initializing the database.
    """
    try:
        # Import models here to avoid circular imports
        from ..models import Base
        Base.metadata.create_all(bind=engine)
        logger.info("Database initialized successfully")
    except SQLAlchemyError as e:
        logger.error(f"Failed to initialize database: {str(e)}")
        raise DatabaseError(
            message="Failed to initialize database",
            error_code="DB_INIT_ERROR",
            details={"error": str(e)}
        )
    except Exception as e:
        logger.error(f"Unexpected error during database initialization: {str(e)}")
        raise DatabaseError(
            message="Unexpected error during database initialization",
            error_code="DB_INIT_UNEXPECTED_ERROR",
            details={"error": str(e)}
        )

# Export for use in other modules
__all__ = ["get_db", "init_db", "SessionLocal"] 