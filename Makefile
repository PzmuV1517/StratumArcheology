# STRATUM Development Commands
# macOS / Linux

.PHONY: help backend frontend dev install lint format fix clean db-migrate db-upgrade

# Default target - show help
help:
	@echo "STRATUM Development Commands"
	@echo ""
	@echo "  make backend      - Run backend server (port 8000)"
	@echo "  make frontend     - Run frontend Expo app"
	@echo "  make dev          - Run both backend and frontend"
	@echo ""
	@echo "  make install      - Install all dependencies"
	@echo "  make install-backend  - Install backend dependencies"
	@echo "  make install-frontend - Install frontend dependencies"
	@echo ""
	@echo "  make lint         - Run linters on both backend and frontend"
	@echo "  make format       - Format code in both backend and frontend"
	@echo "  make fix          - Auto-fix lint issues and format code"
	@echo ""
	@echo "  make db-migrate   - Create new database migration"
	@echo "  make db-upgrade   - Apply database migrations"
	@echo ""
	@echo "  make clean        - Clean build artifacts and caches"

# Run backend server
backend:
	cd backend && python -m uvicorn app.main:app --reload --port 8000

# Run frontend Expo app
frontend:
	cd frontend/stratum-app && npx expo start

# Run both (requires two terminals, this runs backend in background)
dev:
	@echo "Starting backend in background..."
	cd backend && python -m uvicorn app.main:app --reload --port 8000 &
	@echo "Starting frontend..."
	cd frontend/stratum-app && npx expo start

# Install all dependencies
install: install-backend install-frontend
	@echo "All dependencies installed!"

install-backend:
	cd backend && pip install -r requirements.txt

install-frontend:
	cd frontend/stratum-app && npm install

# Linting
lint:
	cd backend && ruff check .
	cd frontend/stratum-app && npm run lint

# Formatting
format:
	cd backend && ruff format .
	cd frontend/stratum-app && npm run format

# Fix all lint and format issues
fix:
	cd backend && ruff check . --fix && ruff format .
	cd frontend/stratum-app && npm run lint -- --fix && npm run format

# Database migrations
db-migrate:
	cd backend && alembic revision --autogenerate -m "$(msg)"

db-upgrade:
	cd backend && alembic upgrade head

db-downgrade:
	cd backend && alembic downgrade -1

# Clean build artifacts
clean:
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name ".pytest_cache" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name "node_modules" -prune -exec echo "Skipping {}" \; || true
	find . -type f -name "*.pyc" -delete 2>/dev/null || true
	@echo "Cleaned build artifacts!"

# Run tests
test-backend:
	cd backend && python -m pytest

test-frontend:
	cd frontend/stratum-app && npm test

test: test-backend test-frontend

# get en0 address
ip:
	ipconfig getifaddr en0