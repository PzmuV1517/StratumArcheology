# STRATUM - Archaeological Site Management Platform

[![Phase 3 - Advanced Features](https://img.shields.io/badge/Phase-3%20Advanced-green)](https://stratumapp.readthedocs.io)
[![FLL 2025-2026](https://img.shields.io/badge/FLL-UNEARTHED-orange)](https://firstlegoleague.org)
[![Python 3.13](https://img.shields.io/badge/python-3.13-blue)](https://python.org)
[![React Native](https://img.shields.io/badge/react--native-0.81-blue)](https://reactnative.dev)
[![Documentation Status](https://readthedocs.org/projects/stratum/badge/?version=latest)](https://stratumapp.readthedocs.io/en/latest/?badge=latest)

**STRATUM** (Latin for "layer") is a comprehensive digital platform for archaeologists to plan excavations, document findings, collaborate in real-time, and export standardized data.

Built for the **FLL 2025-2026 UNEARTHED** Innovation Project by the **QuantumBits Team**.

---

## 📖 Documentation

**Full documentation:** [**stratumapp.readthedocs.io**](https://stratumapp.readthedocs.io)

> 📁 Documentation source is in the [`docs/`](docs/) folder (can be used as a standalone repo).

### Quick Links

| Document | Description |
|----------|-------------|
| [Team Onboarding Guide](https://stratumapp.readthedocs.io/en/latest/help.html) | Start here! Structured learning path for team members |
| [Legend](https://stratumapp.readthedocs.io/en/latest/legend.html) | All technical terms explained |
| [Installation](https://stratumapp.readthedocs.io/en/latest/installation.html) | Setup instructions |
| [Quick Start](https://stratumapp.readthedocs.io/en/latest/quickstart.html) | Get started in minutes |
| [Architecture](https://stratumapp.readthedocs.io/en/latest/architecture.html) | System design with diagrams |
| [API Reference](https://stratumapp.readthedocs.io/en/latest/api/overview.html) | Complete REST API docs |
| [Features](https://stratumapp.readthedocs.io/en/latest/features.html) | All platform capabilities |

---

## 🚀 Quick Start

### Prerequisites

- Python 3.13+
- Node.js 18+
- PostgreSQL 14+
- Docker (for MinIO)

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
alembic upgrade head
python -m uvicorn app.main:app --reload
```

### Frontend

```bash
cd frontend/stratum-app
npm install
npx expo start
```

See the [Installation Guide](https://stratumapp.readthedocs.io/en/latest/installation.html) for complete setup instructions.

## Self-Hosted Bundle (Early Implementation)

This repository now includes an initial self-host launcher that boots:

- PostgreSQL (persistent Docker volume)
- MinIO (persistent Docker volume)
- FastAPI backend
- STRATUM web frontend build
- Dashboard web build

### Requirements

- Docker + Docker Compose
- Python 3.10+

### Start

```bash
python stratum_bundle.py install
python stratum_bundle.py up
```

### Runtime controls

```bash
python stratum_bundle.py status
python stratum_bundle.py logs --follow backend
python stratum_bundle.py down
```

Equivalent Make targets are available:

```bash
make selfhost-install
make selfhost-up
make selfhost-status
make selfhost-down
```

On first run, the launcher auto-creates `backend/.env` with local self-host defaults (`AUTH_MODE=local`, Firebase disabled). You can edit this file to customize credentials and ports.

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React Native 0.81, Expo SDK 54, TypeScript |
| **Backend** | Python 3.13, FastAPI, SQLAlchemy |
| **Database** | PostgreSQL 14+ |
| **Storage** | MinIO (S3-compatible) |
| **Auth** | Firebase Admin SDK |
| **Real-time** | Socket.IO |

---

## ✨ Key Features

- 🔐 **Authentication** - Firebase-based auth with JWT tokens
- 📁 **Projects** - Create/manage archaeological site projects
- 👥 **Collaboration** - Role-based access (Owner, Leader, Researcher, Guest)
- 📝 **Notes** - Rich field notes with attachments
- 📂 **Files** - Version-controlled file storage with privacy controls
- 📋 **Forms** - Standardized archaeological data entry
- 🗺️ **GPS Mapping** - Site boundary management
- ⚡ **Real-time** - WebSocket-based live collaboration
- 📱 **Cross-platform** - iOS, Android, and Web

---

## 📁 Project Structure

```
QuantumBitsFLL2025-2026/
├── backend/               # FastAPI server
│   ├── app/              # Application code
│   │   ├── routes/       # API endpoints
│   │   ├── models.py     # SQLAlchemy models
│   │   └── schemas.py    # Pydantic schemas
│   └── alembic/          # Database migrations
├── frontend/
│   └── stratum-app/      # React Native app
│       ├── app/          # Expo Router pages
│       └── src/          # Components & services
├── docs/                 # Sphinx documentation
└── README.md             # This file
```

---

## 🤝 Contributing

See [CONTRIBUTING.md](.github/CONTRIBUTING.md) for guidelines.

---

## 📄 License

See [LICENSE](LICENSE) file for details.

---

## 👥 Team

Developed by **QuantumBits Team** for FLL 2025-2026 UNEARTHED Innovation Project.

---

<p align="center">
  <strong>STRATUM</strong> - <em>Revolutionizing archaeological documentation, one layer at a time.</em> 🏺
</p>
