from contextlib import contextmanager
from typing import Generator, Optional
import sqlalchemy as sa
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import QueuePool
from ..core.config import settings
from ..utils.logging import logger

# Create engine with connection pooling
engine = sa.create_engine(
    settings.DATABASE_URL,
    poolclass=QueuePool,
    pool_size=settings.DATABASE_POOL_SIZE,
    max_overflow=settings.DATABASE_MAX_OVERFLOW,
    pool_pre_ping=True,  # Enable connection health checks
    pool_recycle=3600,   # Recycle connections after 1 hour
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
        
    Example:
        with get_db() as db:
            result = db.query(Model).all()
    """
    db: Optional[Session] = None
    try:
        db = SessionLocal()
        yield db
        db.commit()
    except Exception as e:
        if db:
            db.rollback()
        logger.error(f"Database error: {str(e)}")
        raise
    finally:
        if db:
            db.close()

def init_db() -> None:
    """Initialize database connection and create tables."""
    try:
        # Import models here to avoid circular imports
        from ..models import Base
        Base.metadata.create_all(bind=engine)
        logger.info("Database initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize database: {str(e)}")
        raise

# Export for use in other modules
__all__ = ["get_db", "init_db", "SessionLocal"] 