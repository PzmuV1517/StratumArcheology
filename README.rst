====================================================
STRATUM - Archaeological Site Management Platform
====================================================

.. image:: https://img.shields.io/badge/Phase-3%20Advanced-green
   :alt: Phase 3 - Advanced Features

.. image:: https://img.shields.io/badge/FLL-UNEARTHED-orange
   :alt: FLL 2025-2026

.. image:: https://img.shields.io/badge/python-3.13-blue
   :alt: Python 3.13

.. image:: https://img.shields.io/badge/react--native-0.76-blue
   :alt: React Native

.. image:: https://img.shields.io/badge/docs-Sphinx-blue
   :alt: Documentation

**STRATUM** (Latin for "layer") is a comprehensive digital platform for archaeologists to plan excavations, document findings, collaborate in real-time, and export standardized data. Built for the FLL 2025-2026 UNEARTHED Innovation Project.

📚 Documentation
================

Complete documentation is available in the ``docs/`` directory (reStructuredText format):

- `Installation Guide <docs/installation.rst>`_ - Setup instructions
- `Quick Start <docs/quickstart.rst>`_ - Get started in minutes
- `Architecture Overview <docs/architecture.rst>`_ - System design
- `API Reference <docs/api/overview.rst>`_ - Complete API documentation
- `Features Guide <docs/features.rst>`_ - Platform capabilities
- `WebSockets & Real-Time <docs/websockets-realtime.rst>`_ - Real-time features
- `Database Schema <docs/database-schema.rst>`_ - Data architecture

To build the documentation locally:

.. code-block:: bash

   cd docs
   pip install -r requirements.txt
   make html
   # Open _build/html/index.html in your browser

Quick Start
===========

.. code-block:: bash

   # Backend
   cd backend
   pip install -r requirements.txt
   alembic upgrade head  # Run migrations
   python -m uvicorn app.main:app --reload

   # Frontend
   cd frontend/stratum-app
   npm install
   npm start

See `docs/installation.rst <docs/installation.rst>`_ for complete setup instructions.

🚀 Tech Stack
=============

.. list-table::
   :widths: 25 75
   :header-rows: 1

   * - Layer
     - Technology
   * - **Backend**
     - Python 3.13, FastAPI, SQLAlchemy, PostgreSQL 14+
   * - **Storage**
     - MinIO (S3-compatible object storage)
   * - **Auth**
     - Firebase Admin SDK + JWT
   * - **Real-time**
     - Socket.IO WebSockets
   * - **Frontend**
     - React Native + Expo SDK 54
   * - **Web**
     - Expo Web with full feature parity
   * - **Native**
     - iOS/Android with platform-specific optimizations
   * - **Database**
     - PostgreSQL with Alembic migrations

✨ Key Features
===============

Core Platform
-------------

- 🔐 **Authentication**: Firebase-based auth with JWT tokens
- 📁 **Projects**: Create/manage archaeological site projects with teams
- 👥 **Collaboration**: Role-based access (Owner, Leader, Researcher, Guest)
- 📝 **Notes**: Rich text notes with photo attachments and auto-save
- 🗂️ **Files**: Hierarchical file management with versioning and privacy controls
- 🔄 **Real-time**: WebSocket updates for live collaboration
- 📊 **Activity Feed**: Complete audit trail of all project changes

Archaeological Tools
--------------------

- 📋 **Forms**: Context features, stratigraphic units, artifact registration
- 🗺️ **GPS Mapping**: Site boundaries and work area polygons
- 🏺 **Artifacts**: QR code generation and tracking
- 📸 **Gallery**: Timeline view of all project media
- 📤 **Export**: CSV, JSON, PDF, Shapefile formats

Data Visualization
------------------

- 🌐 **Harris Matrix**: Interactive stratigraphic relationship diagrams
- 🎨 **3D Models**: GLB/GLTF mesh viewing with touch controls (Web + Native)
- 📈 **Point Clouds**: PLY/PCD/LAS visualization with WebGL
- 🗺️ **GPS/Maps**: Site mapping with coordinate tracking
- 📸 **Gallery**: Grid/list views with time-based grouping

File Previews
-------------

.. list-table::
   :widths: 30 35 35
   :header-rows: 1

   * - Type
     - Web
     - Native
   * - Images
     - ✅ Full preview
     - ✅ Full preview
   * - PDF
     - ✅ Embedded
     - ✅ WebView + Google Docs
   * - CSV/Excel
     - ✅ Editable grid
     - ✅ Editable grid
   * - Text/Markdown
     - ✅ With KaTeX
     - ✅ With KaTeX math
   * - 3D Models (GLB)
     - ✅ Three.js
     - ✅ WebView + model-viewer
   * - Point Clouds
     - ✅ Three.js
     - ✅ expo-gl + THREE
   * - Video/Audio
     - ✅ Native player
     - ✅ expo-av

Advanced Features
-----------------

- **Offline Support**: Queue operations when offline, sync on reconnect
- **Real-time Sync**: WebSocket-based live collaboration
- **Time Machine**: Version history and rollback
- **Artifacts**: QR code generation and manifest tracking
- **Tools Tab**: Native camera, file sharing, device info

Project Structure
=================

.. code-block:: text

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
   │   │   │   ├── data/       # Preview panels
   │   │   │   ├── project/    # Project-specific UI
   │   │   │   └── matrix/     # Harris Matrix
   │   │   ├── services/       # API clients
   │   │   └── contexts/       # React contexts
   │   └── assets/             # Images, fonts
   │
   ├── docs/                   # Sphinx documentation (RST)
   └── resources/              # Design assets

Development
===========

Linting & Formatting
--------------------

.. code-block:: bash

   # Backend (Python)
   cd backend
   ruff check . --fix          # Lint
   ruff format .               # Format

   # Frontend (TypeScript)
   cd frontend/stratum-app
   npx eslint . --fix          # Lint
   npx prettier --write .      # Format

Running Tests
-------------

.. code-block:: bash

   # Backend
   cd backend && pytest

   # Frontend
   cd frontend/stratum-app && npm test

Development Phases
==================

Phase 1: Foundation ✅
----------------------

- Authentication system with Firebase
- Project creation and management
- Team collaboration with roles
- Basic notes with attachments
- File upload/download

Phase 2: Data & Visualization ✅
--------------------------------

- Harris Matrix stratigraphic diagrams
- GPS mapping and coordinates
- File gallery with grouping
- CSV/Excel editing
- PDF preview

Phase 3: Native & Advanced ✅ (Current)
---------------------------------------

- Native iOS/Android support
- 3D model viewing (GLB/GLTF)
- Point cloud visualization
- Video/audio playback
- Offline queue system
- Real-time WebSocket sync
- Time Machine versioning

Phase 4: Polish & Launch (Planned)
-----------------------------------

- AI-assisted documentation
- Advanced export formats
- Cloud deployment
- Performance optimization

API Documentation
=================

Interactive docs available at ``http://localhost:8000/docs`` when running backend.

Key endpoints:

- ``POST /auth/register`` - Create account
- ``GET /projects`` - List user's projects
- ``POST /projects/{id}/files`` - Upload files
- ``GET /files/{id}/download`` - Download file
- ``WS /ws/project/{id}`` - Real-time updates

See `docs/api/overview.rst <docs/api/overview.rst>`_ for complete API reference.

Contributing
============

See ``.github/CONTRIBUTING.md`` for guidelines.

License
=======

See `LICENSE <LICENSE>`_ file for details.

Team
====

Developed by **QuantumBits Team** for FLL 2025-2026 UNEARTHED Innovation Project.

----

*Built with ❤️ by QuantumBits FLL Team 2025-2026*

**STRATUM** - *Revolutionizing archaeological documentation, one layer at a time.* 🏺
