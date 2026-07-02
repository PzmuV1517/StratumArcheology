# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**STRATUM** — archaeological site management platform for the FLL 2025-2026 UNEARTHED Innovation Project by the QuantumBits Team (Banu Andrei & Mircea Levin-Constantin).

---

## Commands

All top-level `make` targets run from the repo root. Backend-specific targets are also available inside `backend/`.

### Running the stack

```bash
make backend          # FastAPI on :8000 (binds 0.0.0.0 for mobile testing)
make frontend         # Expo app (opens dev menu)
make dev              # Both (backend backgrounded)
```

Self-hosted Docker bundle (Postgres + MinIO + backend + both frontends):
```bash
python stratum_bundle.py up
python stratum_bundle.py status
python stratum_bundle.py down
```

### Linting & formatting (backend)

```bash
cd backend
make lint             # ruff check
make format           # ruff format
make fix              # ruff check --fix && ruff format (auto-fix everything)
make check            # CI-style: lint + format check (no writes)
```

Ruff targets Python 3.13, line length 85, with isort (`I`) rules included.

### Linting & formatting (frontend)

```bash
cd frontend/stratum-app
npm run lint
npm run format
```

Or from root: `make lint` / `make format` runs both.

### Tests

```bash
make test-backend     # cd backend && python -m pytest
make test-frontend    # cd frontend/stratum-app && npm test

# Single backend test file:
cd backend && python -m pytest tests/test_auth_modes.py -v

# Single test by name:
cd backend && python -m pytest -k "test_local_login" -v
```

Backend tests use SQLite in-memory via `TestClient`; they mock Firebase and password crypto where needed. No real Postgres/MinIO required.

### Database migrations

```bash
make db-upgrade                        # alembic upgrade head
make db-migrate msg="add feature x"    # alembic revision --autogenerate
make db-downgrade                      # alembic downgrade -1
```

**Never call `Base.metadata.create_all()` in application code.** All schema changes go through Alembic.

### Dashboard frontend

```bash
cd frontend/dashboard
npm run dev    # Vite dev server
npm run build  # production build → dist/
```

### Utilities

```bash
make ip        # print en0 IP (for pointing Expo at local backend)
make clean     # remove __pycache__, .pytest_cache, *.pyc
```

---

## Architecture

### Backend (`backend/`)

**Entry point:** `backend/app/main.py` — creates the FastAPI app, registers middleware, mounts all routers under `/api`, and mounts the Socket.IO ASGI app at `/ws`.

**Config:** `backend/app/config.py` — all env vars via `pydantic-settings`. The critical knob is `AUTH_MODE` (`firebase` | `local` | `hybrid`). Firebase credentials are validated only when `AUTH_MODE` includes Firebase. In `self_hosted` / `local` mode Firebase can be entirely absent.

**Auth flow:**
1. The mobile app calls `/api/auth/verify-firebase-token` (Firebase mode) or `/api/auth/login` (local/hybrid), receiving a **STRATUM JWT** (HS256, `JWT_SECRET_KEY`).
2. All protected routes use `get_current_user` from `dependencies.py`, which validates that JWT and returns a `User` ORM object.
3. A special `MAINTAINER` user (built from env credentials, never persisted to DB) bypasses normal auth for admin operations.
4. Project-level authorization is enforced by `check_project_permission()` in `dependencies.py` — roles are `leader > researcher > guest`, owner always wins.

**File storage:** `backend/app/minio_client.py` wraps the MinIO SDK. Presigned URLs are built using the incoming request's base URL (captured by `_capture_base_url` middleware) so they work from any device on the network, not just `localhost`.

**Real-time:** `backend/app/websocket.py` uses `python-socketio` in ASGI mode. Clients join project rooms (`join_project` event); the server tracks sessions in-memory (`project_rooms`, `user_sessions`, `user_sids`). Socket.IO CORS is intentionally empty — handled upstream by FastAPI's `CORSMiddleware`.

**Database models** (`backend/app/models.py`) — key entities and relationships:
- `User` → owns `Project`s, member of `Project`s via `project_members` association table (with role)
- `Project` → has `Note`s, `FileNode`s (tree), `ProjectGPS`, `Channel`s, `ProjectActivity` log, `harris_matrix_data` + `wheeler_data` JSON columns (with `DataVersion` history for Time Machine)
- `FileNode` — self-referential tree (files & folders); nodes with `type=NOTE` are backed by a `Note` via `NoteFileLink`; file updates create `FileVersion` snapshots
- `ChatMessage` — three modes: channel message (`channel_id` set), legacy project room (`project_id` only), or DM (`recipient_id` set)
- **eMonument subsystem**: `Monument` → `FisaInstance` (field form, JSON `data`, status workflow draft→completat→finalizat→in_verificare→in_aprobare→validat / reintors) → `FisaInstanceVersion` snapshots; `DeviceWhitelist` for offline collection devices

**Middleware stack** (applied in order in `main.py`):
1. `ErrorHandlingMiddleware` — catches unhandled exceptions, logs them, returns structured JSON
2. `SlowAPIMiddleware` — rate limiting (default 100/min, configurable)
3. `CORSMiddleware`
4. `_capture_base_url` HTTP middleware — sets MinIO proxy URL context var per request

### Frontend — mobile app (`frontend/stratum-app/`)

Expo Router (file-based routing). Entry is `app/_layout.tsx`.

**Key layers:**
- `app/(auth)/` — unauthenticated screens (login, register)
- `app/(tabs)/` — main tab navigation for authenticated users
- `app/project/`, `app/artefact/`, `app/voice-note/` etc. — deep screens
- `src/contexts/` — React Contexts: `AuthContext.tsx` (JWT + user state), `WebSocketContext.tsx` (Socket.IO connection), `ProjectDetailContext.tsx`, `ThemePreferenceContext.tsx`
- `src/services/` — one service file per backend resource (`noteService.ts`, `fileService.ts`, `projectService.ts`, …). Several have platform splits: `*.native.ts` / `*.web.ts` / `*.core.ts`. The base Axios client in `src/services/api.ts` auto-attaches JWT from AsyncStorage and emits `auth:session_expired` on 401s.
- `src/components/` — organized by feature (`chat/`, `files/`, `map/`, `matrix/`, `project/`, `ui/`, etc.)

**Offline support:** `src/services/offlineQueueService.ts` + `offlineService.ts` + `syncService.ts` — queues mutations when offline and replays them on reconnect.

### Frontend — dashboard (`frontend/dashboard/`)

React + Vite + TypeScript admin panel for eMonument / maintainer operations. Built separately from the mobile app.

### eMonument subsystem

A second major product in the same codebase — a digital heritage monument inspection system for Romanian LMI (Lista Monumentelor Istorice). Inspectors fill `FisaInstance` forms on whitelisted devices; forms go through a multi-step approval workflow. Routes: `emonument_dashboard`, `emonument_instances`, `emonument_backups`. The form schema is defined in `backend/app/emonument_form_schema.py` and validated in `emonument_validation.py`.

### Commit conventions

Prefix commits with `[BACKEND]` or `[FRONTEND]`. Branch from `staging`; `main` is the production branch.
