"""
Rate limiter setup. Currently deprecated — the old Flask-based limiter
doesn't work with FastAPI, so this is commented out for now.

MIT License

Copyright (c) 2025 Banu Andrei & Mircea Levin-Constantin

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
"""
# Deprecated and won't work with FastAPI
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
"""