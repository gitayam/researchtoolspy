from contextlib import contextmanager
from typing import Generator, Optional, Dict, Any
import sqlalchemy as sa
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import QueuePool
from sqlalchemy.exc import SQLAlchemyError, OperationalError
import time
from ..core.config import settings
from ..utils.logging import default_logger as logger
from .exceptions import DatabaseError, ConfigurationError

class DatabaseManager:
    """Database connection and session manager."""
    
    def __init__(self):
        self.engine = None
        self.SessionLocal = None
        self._initialize_engine()
    
    def _initialize_engine(self):
        """Initialize database engine with connection pooling."""
        try:
            self.engine = sa.create_engine(
                settings.DATABASE_URL,
                poolclass=QueuePool,
                pool_size=settings.DATABASE_POOL_SIZE,
                max_overflow=settings.DATABASE_MAX_OVERFLOW,
                pool_pre_ping=True,  # Enable connection health checks
                pool_recycle=3600,   # Recycle connections after 1 hour
                pool_timeout=30,     # Connection timeout in seconds
                echo=settings.DEBUG  # Log SQL queries in debug mode
            )
            
            self.SessionLocal = sessionmaker(
                autocommit=False,
                autoflush=False,
                bind=self.engine
            )
            
            logger.info(
                "Database engine initialized",
                pool_size=settings.DATABASE_POOL_SIZE,
                max_overflow=settings.DATABASE_MAX_OVERFLOW
            )
        except Exception as e:
            logger.error(
                "Failed to initialize database engine",
                error=e,
                details={"url": settings.DATABASE_URL}
            )
            raise ConfigurationError(
                message="Failed to create database engine",
                error_code="DB_ENGINE_CREATE_ERROR",
                details={"error": str(e)}
            )
    
    def check_connection(self) -> bool:
        """Check database connection health."""
        try:
            with self.engine.connect() as conn:
                conn.execute(sa.text("SELECT 1"))
            return True
        except Exception as e:
            logger.error("Database connection check failed", error=e)
            return False
    
    def get_pool_status(self) -> Dict[str, Any]:
        """Get connection pool status."""
        return {
            "size": self.engine.pool.size(),
            "checkedin": self.engine.pool.checkedin(),
            "checkedout": self.engine.pool.checkedout(),
            "overflow": self.engine.pool.overflow()
        }
    
    @contextmanager
    def get_session(self, retries: int = 3, retry_delay: float = 1.0) -> Generator[Session, None, None]:
        """
        Context manager for database sessions with retry logic.
        
        Args:
            retries: Number of retry attempts
            retry_delay: Delay between retries in seconds
            
        Yields:
            Session: Database session instance
            
        Raises:
            DatabaseError: If there is an error with the database session
        """
        db: Optional[Session] = None
        last_error = None
        
        for attempt in range(retries):
            try:
                db = self.SessionLocal()
                yield db
                db.commit()
                return
            except OperationalError as e:
                last_error = e
                if attempt < retries - 1:
                    logger.warning(
                        f"Database operation failed, retrying in {retry_delay} seconds",
                        error=e,
                        attempt=attempt + 1,
                        retries=retries
                    )
                    time.sleep(retry_delay)
                    continue
            except SQLAlchemyError as e:
                if db:
                    db.rollback()
                logger.error("Database error", error=e)
                raise DatabaseError(
                    message="Database operation failed",
                    error_code="DB_OPERATION_ERROR",
                    details={"error": str(e)}
                )
            except Exception as e:
                if db:
                    db.rollback()
                logger.error("Unexpected error in database operation", error=e)
                raise DatabaseError(
                    message="Unexpected database error",
                    error_code="DB_UNEXPECTED_ERROR",
                    details={"error": str(e)}
                )
            finally:
                if db:
                    db.close()
        
        if last_error:
            raise DatabaseError(
                message="Database operation failed after retries",
                error_code="DB_RETRY_ERROR",
                details={"error": str(last_error), "retries": retries}
            )
    
    def init_db(self) -> None:
        """Initialize database connection and create tables."""
        try:
            # Import models here to avoid circular imports
            from ..models import Base
            Base.metadata.create_all(bind=self.engine)
            logger.info("Database initialized successfully")
        except SQLAlchemyError as e:
            logger.error("Failed to initialize database", error=e)
            raise DatabaseError(
                message="Failed to initialize database",
                error_code="DB_INIT_ERROR",
                details={"error": str(e)}
            )
        except Exception as e:
            logger.error("Unexpected error during database initialization", error=e)
            raise DatabaseError(
                message="Unexpected error during database initialization",
                error_code="DB_INIT_UNEXPECTED_ERROR",
                details={"error": str(e)}
            )

# Create global database manager instance
db_manager = DatabaseManager()

# Export for use in other modules
__all__ = ["db_manager"] 