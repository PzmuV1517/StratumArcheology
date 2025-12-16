"""
Alembic Environment Configuration for STRATUM Database Migrations

This file configures Alembic to work with our SQLAlchemy models and environment.
It handles both online (direct database connection) and offline (SQL script generation) migrations.
"""
from logging.config import fileConfig
import os
import sys
from pathlib import Path

from sqlalchemy import engine_from_config
from sqlalchemy import pool

from alembic import context

# Add the parent directory to Python path so we can import app modules
sys.path.insert(0, str(Path(__file__).parents[1]))

# Import our models and database configuration
from app.database import Base
from app.config import settings
# Import all models to ensure they are registered with Base.metadata
from app import models  # noqa: F401

# Alembic Config object - provides access to values within alembic.ini
config = context.config

# Set the SQLAlchemy URL from our app settings (overrides alembic.ini)
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)

# Interpret the config file for Python logging if present
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Target metadata for autogenerate support
# This is our SQLAlchemy Base.metadata which contains all table definitions
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """
    Run migrations in 'offline' mode.
    
    This generates SQL scripts without requiring a database connection.
    Useful for reviewing migrations before applying them.
    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        # Compare types to detect column type changes
        compare_type=True,
        # Compare server defaults to detect default value changes
        compare_server_default=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """
    Run migrations in 'online' mode.
    
    Creates an actual database connection and applies migrations directly.
    This is the normal mode used during development and deployment.
    """
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,  # Disable connection pooling for migrations
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            # Compare types to detect column type changes
            compare_type=True,
            # Compare server defaults to detect default value changes
            compare_server_default=True,
        )

        with context.begin_transaction():
            context.run_migrations()


# Determine which mode to run in based on context
if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
