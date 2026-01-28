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

.. contents:: Table of Contents
   :local:
   :depth: 2
**Core Documentation:**

:doc:`Installation Guide <docs/installation>`
   Complete setup instructions for development and production

:doc:`Quick Start <docs/quickstart>`
   Get started in minutes with step-by-step guide

:doc:`Architecture Overview <docs/architecture>`
   System design with Graphviz diagrams and data flow

:doc:`API Reference <docs/api/overview>`
   Complete REST API documentation with examples

:doc:`Features Guide <docs/features>`
   Comprehensive platform capabilities

:doc:`WebSockets & Real-Time <docs/websockets-realtime>`
**Build Documentation:**

.. code-block:: bash

   cd docs
   pip install -r requirements.txt
   make html
   # Open _build/html/index.html in your browser

.. tip::
   The documentation includes interactive Graphviz diagrams, code syntax highlighting, and cross-referenced API documentation. Build it locally for the best experience!

Quick Start
===========

.. note::
   This is a quick start guide. For detailed setup instructions, see :doc:`docs/installation`.ts & Real-Time <docs/websockets-realtime.rst>`_ - Real-time features
- `Database Schema <docs/database-schema.rst>`_ - Data architecture

To build the documentation locally:

.. code-block:: bash

   cd docs
   pip install -r requirements.txt
.. seealso::
   :doc:`docs/installation` for complete setup instructions including Firebase configuration, MinIO setup, and database migrations.

🚀 Tech Stack
=============

Architecture Overview
---------------------

.. graphviz::

   digraph tech_stack {
      rankdir=TB;
      node [shape=box, style=rounded];
      
      subgraph cluster_frontend {
         label="Frontend";
         style=filled;
         color=lightblue;
         
         expo [label="Expo + React Native\niOS | Android | Web"];
      }
      
      subgraph cluster_backend {
         label="Backend";
         style=filled;
         color=lightgreen;
         
         fastapi [label="FastAPI + Python 3.13"];
         socketio [label="Socket.IO\nWebSockets"];
      }
      
      subgraph cluster_data {
         label="Data Layer";
         style=filled;
         color=lightyellow;
         
         postgres [label="PostgreSQL 14+"];
         minio [label="MinIO S3"];
      }
      
      subgraph cluster_auth {
         label="Authentication";
         style=filled;
.. attention::
   STRATUM combines modern web technologies with archaeological best practices to create a powerful field documentation platform.

   * 🔐 **Authentication**: Firebase-based auth with JWT tokens
   * 📁 **Projects**: Create/manage archaeological site projects with teams
   * 👥 **Collaboration**: Role-based access (Owner, Leader, Researcher, Guest)
   * 📝 **Notes**: Rich text notes with photo attachments and auto-save
   * 🗂️ **Files**: Hierarchical file management with versioning and privacy controls
   * 🔄 **Real-time**: WebSocket updates for live collaboration
   * 📊 **Activity Feed**: Complete audit trail of all project changes

Archaeological Tools
--------------------

.. sidebar:: Archaeological Forms
   
   STRATUM provides three standardized forms that automatically export to CSV:
   
   - Context Features
   - Stratigraphic Units  
   - Artifact Registration

.. hlist::
   :columns: 2

   * 📋 **Forms**: Context features, stratigraphic units, artifact registration
   * 🗺️ **GPS Mapping**: Site boundaries and work area polygons
   * 🏺 **Artifacts**: QR code generation and tracking
   * 📸 **Gallery**: Timeline view of all project media
   *echnology Stack
----------------
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
.. glossary::

   Offline Support
      Queue operations when offline, automatic sync on reconnect

   Real-time Sync
      WebSocket-based live collaboration with instant updates

   Time Machine
      Complete version history with rollback capabilities

   Artifact Tracking
      QR code generation and manifest tracking system

   Cross-Platform
      Native iOS/Android apps with full web parity

.. seealso::
   :doc:`docs/features` for complete feature documentation with examples

Project Structure
=================

.. code-block:: text
   :caption: STRATUM Project Organization**
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
.. warning::
   Always run migrations after pulling updates: ``alembic upgrade head``

Prerequisites
-------------

.. list-table::
   :widths: 30 70
   :header-rows: 1

   * - Requirement
     - Version
   * - Python
     - 3.13+
   * - Node.js
     - 18+
   * - PostgreSQL
     - 14+
   * - Docker
     - Latest

- 🏺 **Artifacts**: QR code generation and tracking
- 📸 **Gallery**: Timeline view of all project media
- 📤 **Export**: CSV, JSON, PDF, Shapefile formats

Data Visualization
.. tip::
   Use ``pytest -v`` for verbose test output and ``pytest --cov`` for coverage reports.

Development Phases
==================

Progress Tracking
-----------------
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
.. note::
   Interactive API documentation is available at ``http://localhost:8000/docs`` when running the backend server.

**Swagger UI:** http://localhost:8000/docs (Try endpoints directly)

**ReDoc:** http://localhost:8000/redoc (Clean documentation view)

Key Endpoints
-------------

.. list-table::
   :widths: 15 35 50
   :header-rows: 1

   * - Method
     - Endpoint
     - Description
   * - ``POST``
     - ``/auth/register``
     - Create account
   * - ``GET``
     - ``/projects``
     - List user's projects
   * - ``POST``
     - ``/projects/{id}/files``
     - Upload files
   * - ``GET``
     - ``/files/{id}/download``
     - Download file
   * - ``WS``
     - ``/ws/project/{id}``
     - Real-time updates

.. seealso::
   :doc:`docs/api/overview` for complete API reference with request/response examples

Contributing
============

.. important::
   We welcome contributions! Please read our guidelines before submitting pull requests.

**Steps:**

1. Fork the repository
2. Create a feature branch
3. Make your changes with tests
4. Submit a pull request

See ``.github/CONTRIBUTING.md`` for detailed

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
.. centered:: See `LICENSE <LICENSE>`_ file for details.

Team
====

.. pull-quote::
   Developed by **QuantumBits Team** for FLL 2025-2026 UNEARTHED Innovation Project.

Support & Resources
===================

.. hlist::
   :columns: 3

   * Documentation: :doc:`docs/index`
   * Issues: GitHub Issues
   * Email: support@stratum.app

.. rubric:: Footnotes

.. [*] *Built with ❤️ by QuantumBits FLL Team 2025-2026*

----

.. centered:: **STRATUM** - *Revolutionizing archaeological documentation, one layer at a time.* 🏺

.. |date| date::
.. |time| date:: %H:%M

Last updated: |date| at |time|
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
