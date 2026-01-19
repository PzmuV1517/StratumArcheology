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

# Run development server
run:
	python -m uvicorn app.main:app --reload --port 8000
