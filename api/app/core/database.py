"""
Database configuration and session management.
Uses SQLAlchemy 2.0 with async support.
"""

from typing import AsyncGenerator

from sqlalchemy import event, text
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.pool import NullPool

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

# Create async engine
if "sqlite" in str(settings.SQLALCHEMY_DATABASE_URI):
    # SQLite doesn't support these pool settings
    engine = create_async_engine(
        str(settings.SQLALCHEMY_DATABASE_URI),
        echo=settings.ENVIRONMENT == "development",
        future=True,
    )
else:
    engine = create_async_engine(
        str(settings.SQLALCHEMY_DATABASE_URI),
        echo=settings.ENVIRONMENT == "development",
        future=True,
        pool_size=settings.DB_POOL_SIZE,
        max_overflow=settings.DB_MAX_OVERFLOW,
        pool_timeout=settings.DB_POOL_TIMEOUT,
        poolclass=NullPool if settings.ENVIRONMENT == "testing" else None,
    )

# Create async session factory
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False,
)

# Create declarative base for models
Base = declarative_base()


@event.listens_for(engine.sync_engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    """
    Set SQLite pragmas for development/testing.
    This is only used if SQLite is configured instead of PostgreSQL.
    """
    if "sqlite" in str(settings.SQLALCHEMY_DATABASE_URI):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Dependency for getting database session.
    
    Yields:
        AsyncSession: Database session
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db() -> None:
    """
    Initialize database connection and test connectivity.
    Called during application startup.
    """
    try:
        async with engine.begin() as conn:
            # Test connection
            await conn.execute(text("SELECT 1"))
            logger.info("Database connection established successfully")
            
            # Create tables if they don't exist (for development)
            if settings.ENVIRONMENT == "development":
                await conn.run_sync(Base.metadata.create_all)
                logger.info("Database tables created/verified")
                
    except Exception as e:
        logger.error(f"Failed to connect to database: {e}")
        raise


async def close_db() -> None:
    """
    Close database connections.
    Called during application shutdown.
    """
    await engine.dispose()
    logger.info("Database connections closed")


class DatabaseManager:
    """
    Database manager for handling database operations.
    """
    
    def __init__(self) -> None:
        self.engine = engine
        self.session_factory = AsyncSessionLocal
    
    async def health_check(self) -> bool:
        """
        Check database health.
        
        Returns:
            bool: True if database is healthy
        """
        try:
            async with self.session_factory() as session:
                await session.execute(text("SELECT 1"))
                return True
        except Exception as e:
            logger.error(f"Database health check failed: {e}")
            return False
    
    async def get_session(self) -> AsyncSession:
        """
        Get a new database session.
        
        Returns:
            AsyncSession: Database session
        """
        return self.session_factory()


# Global database manager instance
db_manager = DatabaseManager()