"""
Rate Limiter Module

This module provides functionality to limit the rate of requests
to most endpoints in the application.
"""

from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from backend.app import app
from backend.app.config import Config

# Initialize the rate limiter with default settings
limiter = Limiter(
    app,
    key_func=get_remote_address,
    default_limits=[Config.RATE_LIMIT_DEFAULT],
)

# NOTE: Removed endpoint exemptions for simplicity