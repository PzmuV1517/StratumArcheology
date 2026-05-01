"""
Database engine and session setup. Creates the SQLAlchemy engine,
session factory, and declarative base that the rest of the app uses.

STRATUM - Proprietary and Confidential
Copyright (c) 2026 Andrei Banu, Mircea Levin-Constantin, Ferritworks S.R.L., and its licensees.
All rights reserved.
No license is granted. Unauthorized copying, modification, distribution, or use is prohibited.
Use is permitted only for the owners above and parties explicitly licensed in writing by Ferritworks S.R.L.
"""

from sqlalchemy import create_engine, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

from app.config import settings

engine = create_engine(
    settings.DATABASE_URL, pool_pre_ping=True, echo=settings.APP_DEBUG
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """Provide a transactional database session for FastAPI dependencies.

    Yields:
        Session: A SQLAlchemy session that is automatically closed
            when the request completes.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def is_database_available() -> bool:
    """Return True when the DB responds to a lightweight ping query."""
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception:
        return False
