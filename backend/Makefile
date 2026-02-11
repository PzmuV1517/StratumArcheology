# Backend development commands

.PHONY: lint format fix check run

# Run linter
lint:
	ruff check .

# Auto-fix lint issues
lint-fix:
	ruff check . --fix

# Format code
format:
	ruff format .

# Check formatting (no changes)
format-check:
	ruff format --check .

# Fix everything (lint + format)
fix:
	ruff check . --fix
	ruff format .

# Check everything (for CI)
check:
	ruff check .
	ruff format --check .

# Run development server (binds to 0.0.0.0 for local network/mobile testing)
run:
	python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
