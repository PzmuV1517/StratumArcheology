# STRATUM - Archaeological Site Management Platform

![Phase 3 - Advanced Features](https://img.shields.io/badge/Phase-3%20Advanced-green)
![FLL 2025-2026](https://img.shields.io/badge/FLL-UNEARTHED-orange)

**STRATUM** is a comprehensive digital platform for archaeologists to plan excavations, document findings, collaborate in real-time, and export standardized data. Built for the FLL 2025-2026 UNEARTHED Innovation Project.

## Quick Start

```bash
# Backend
cd backend && pip install -r requirements.txt
python -m uvicorn app.main:app --reload

# Frontend
cd frontend/stratum-app && npm install
npm start
```

See [docs/Installation-&-Setup.md](docs/Installation-&-Setup.md) for full setup instructions.

---

## Tech Stack

| Layer         | Technology                                      |
| ------------- | ----------------------------------------------- |
| **Backend**   | Python 3.13, FastAPI, SQLAlchemy, PostgreSQL    |
| **Storage**   | MinIO (S3-compatible object storage)            |
| **Auth**      | Firebase Admin SDK                              |
| **Frontend**  | React Native + Expo SDK 54                      |
| **Web**       | Expo Web with full feature parity               |
| **Native**    | iOS/Android with platform-specific optimizations|

---

## Features

### Core Platform

- **Authentication**: Firebase-based auth with JWT tokens
- **Projects**: Create/manage archaeological site projects
- **Collaboration**: Role-based access (Leader, Researcher, Guest)
- **Notes**: Rich text notes with photo attachments
- **Files**: Full file management with folders, breadcrumbs, upload/download

### Data Visualization

- **Harris Matrix**: Interactive stratigraphic relationship diagrams
- **3D Models**: GLB/GLTF mesh viewing with touch controls (Web + Native)
- **Point Clouds**: PLY/PCD/LAS visualization with WebGL
- **GPS/Maps**: Site mapping with coordinate tracking
- **Gallery**: Grid/list views with time-based grouping

### File Previews

| Type              | Web              | Native                      |
| ----------------- | ---------------- | --------------------------- |
| Images            | ✅ Full preview  | ✅ Full preview             |
| PDF               | ✅ Embedded      | ✅ WebView + Google Docs    |
| CSV/Excel         | ✅ Editable grid | ✅ Editable grid            |
| Text/Markdown     | ✅ With KaTeX    | ✅ With KaTeX math          |
| 3D Models (GLB)   | ✅ Three.js      | ✅ WebView + model-viewer   |
| Point Clouds      | ✅ Three.js      | ✅ expo-gl + THREE          |
| Video/Audio       | ✅ Native player | ✅ expo-av                  |

### Advanced Features

- **Offline Support**: Queue operations when offline, sync on reconnect
- **Real-time Sync**: WebSocket-based live collaboration
- **Time Machine**: Version history and rollback
- **Artefacts**: QR code generation and manifest tracking
- **Tools Tab**: Native camera, file sharing, device info

---

## Project Structure

```text
├── backend/                 # FastAPI server
│   ├── app/
│   │   ├── routes/         # API endpoints
│   │   ├── middleware/     # Logging, error handling
│   │   ├── models.py       # SQLAlchemy models
│   │   └── schemas.py      # Pydantic schemas
│   ├── alembic/            # Database migrations
│   └── tests/              # Backend tests
│
├── frontend/stratum-app/   # Expo app
│   ├── app/                # Expo Router pages
│   │   ├── (auth)/         # Login/register
│   │   ├── (tabs)/         # Main navigation
│   │   └── project/        # Project screens
│   ├── src/
│   │   ├── components/     # Reusable components
│   │   │   ├── data/       # Preview panels (*.web.tsx, *.native.tsx)
│   │   │   ├── project/    # Project-specific UI
│   │   │   └── matrix/     # Harris Matrix
│   │   ├── services/       # API clients
│   │   └── contexts/       # React contexts
│   └── assets/             # Images, fonts
│
├── docs/                   # Documentation
└── resources/              # Design assets
```

---

## Development

### Linting & Formatting

```bash
# Backend (Python)
cd backend
ruff check . --fix          # Lint
ruff format .               # Format

# Frontend (TypeScript)
cd frontend/stratum-app
npx eslint . --fix          # Lint
npx prettier --write .      # Format
```

### Running Tests

```bash
# Backend
cd backend && pytest

# Frontend
cd frontend/stratum-app && npm test
```

---

## Development Phases

### Phase 1: Foundation ✅

- Authentication system with Firebase
- Project creation and management
- Team collaboration with roles
- Basic notes with attachments
- File upload/download

### Phase 2: Data & Visualization ✅

- Harris Matrix stratigraphic diagrams
- GPS mapping and coordinates
- File gallery with grouping
- CSV/Excel editing
- PDF preview

### Phase 3: Native & Advanced ✅ (Current)

- Native iOS/Android support
- 3D model viewing (GLB/GLTF)
- Point cloud visualization
- Video/audio playback
- Offline queue system
- Real-time WebSocket sync
- Time Machine versioning

### Phase 4: Polish & Launch (Planned)

- AI-assisted documentation
- Advanced export formats
- Cloud deployment
- Performance optimization

---

## API Documentation

Interactive docs available at `http://localhost:8000/docs` when running backend.

Key endpoints:

- `POST /auth/register` - Create account
- `GET /projects` - List user's projects
- `POST /projects/{id}/files` - Upload files
- `GET /files/{id}/download` - Download file
- `WS /ws/project/{id}` - Real-time updates

---

## Contributing

See [.github/CONTRIBUTING.md](.github/CONTRIBUTING.md) for guidelines.

---

Built with ❤️ by QuantumBits FLL Team 2025-2026
