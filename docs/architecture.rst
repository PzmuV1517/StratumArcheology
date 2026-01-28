============================
Architecture Overview
============================

Understanding STRATUM's architecture will help you navigate the codebase and build features effectively.

.. seealso::
   **Unfamiliar with architecture terms?** The :doc:`legend` explains all technical concepts, acronyms, and symbols used throughout this documentation.

.. contents:: Table of Contents
   :local:
   :depth: 3

High-Level Architecture
=======================

STRATUM follows a **client-server architecture** with clear separation of concerns:

.. graphviz::

   digraph architecture {
      rankdir=TB;
      node [shape=box, style=rounded];
      
      subgraph cluster_frontend {
         label="Frontend Layer";
         style=filled;
         color=lightblue;
         
         ui [label="React Native + Expo\niOS | Android | Web"];
         router [label="Expo Router\nFile-based routing"];
         state [label="React Context\nState management"];
         
         ui -> router -> state;
      }
      
      subgraph cluster_api {
         label="API Layer";
         style=filled;
         color=lightgreen;
         
         fastapi [label="FastAPI\nREST API"];
         ws [label="Socket.IO\nWebSockets"];
         auth [label="Firebase Auth\nJWT Verification"];
         
         fastapi -> ws;
         fastapi -> auth;
      }
      
      subgraph cluster_data {
         label="Data Layer";
         style=filled;
         color=lightyellow;
         
         postgres [label="PostgreSQL\nStructured Data"];
         minio [label="MinIO\nObject Storage"];
         
         postgres -> minio [style=dashed, label="references"];
      }
      
      ui -> fastapi [label="HTTPS/REST"];
      ui -> ws [label="WebSocket"];
      fastapi -> postgres;
      fastapi -> minio;
   }

Layer Responsibilities
----------------------

.. list-table::
   :widths: 20 40 40
   :header-rows: 1

   * - Layer
     - Purpose
     - Technologies
   * - **Frontend**
     - User interface and experience
     - React Native, Expo, TypeScript
   * - **API**
     - Business logic and endpoints
     - FastAPI, Python, SQLAlchemy
   * - **Database**
     - Structured data storage
     - PostgreSQL 14+
   * - **Storage**
     - File and media storage
     - MinIO (S3-compatible)
   * - **Auth**
     - User identity management
     - Firebase Authentication
   * - **Real-time**
     - Live updates and notifications
     - Socket.IO WebSockets

Technology Stack
================

Backend Stack
-------------

Python Ecosystem
~~~~~~~~~~~~~~~~

.. code-block:: python

   # Core Framework
   fastapi>=0.104.1         # Modern async web framework
   uvicorn[standard]>=0.24.0 # ASGI server
   
   # Database
   sqlalchemy>=2.0.23       # ORM
   alembic>=1.12.1          # Migrations
   psycopg[binary]>=3.2.10  # PostgreSQL driver
   
   # Authentication
   firebase-admin>=6.2.0    # Firebase Admin SDK
   python-jose[cryptography]>=3.3.0 # JWT handling
   
   # Storage
   minio>=7.2.0             # S3-compatible client
   
   # WebSockets
   python-socketio>=5.11.0  # Real-time communication
   
   # Utilities
   python-dotenv>=1.0.0     # Environment variables
   pillow>=10.1.0           # Image processing
   structlog>=25.5.0        # Structured logging

.. seealso::
   :file:`backend/requirements.txt` for complete dependencies

Frontend Stack
--------------

JavaScript/TypeScript Ecosystem
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

.. code-block:: json

   {
     "expo": "~54.0.29",
     "react": "19.1.0",
     "react-native": "0.81.5",
     "expo-router": "~6.0.13",
     "socket.io-client": "^4.8.1",
     "firebase": "^12.4.0",
     "three": "^0.181.0",
     "expo-three": "^8.0.0"
   }

.. seealso::
   :file:`frontend/stratum-app/package.json` for complete dependencies

Backend Architecture
====================

Request Flow
------------

.. graphviz::

   digraph request_flow {
      rankdir=LR;
      node [shape=box, style=rounded];
      
      client [label="Client\nRequest"];
      cors [label="CORS\nMiddleware"];
      error [label="Error\nMiddleware"];
      auth [label="Auth\nDependency"];
      endpoint [label="API\nEndpoint"];
      db [label="Database\nQuery"];
      minio [label="MinIO\nOperation"];
      response [label="JSON\nResponse"];
      
      client -> cors -> error -> auth -> endpoint;
      endpoint -> db;
      endpoint -> minio;
      db -> response;
      minio -> response;
      response -> client;
      
      error -> client [style=dashed, label="on error"];
   }

Project Structure
-----------------

.. code-block:: text

   backend/
   ├── alembic/                 # Database migrations
   │   ├── versions/            # Migration scripts
   │   │   ├── 001_baseline_initial_schema.py
   │   │   ├── 002_versioning_privacy.py
   │   │   └── 003_add_invite_used_column.py
   │   └── env.py               # Alembic configuration
   ├── app/
   │   ├── main.py              # Application entry point
   │   ├── config.py            # Settings management
   │   ├── database.py          # Database connection
   │   ├── models.py            # SQLAlchemy models
   │   ├── schemas.py           # Pydantic schemas
   │   ├── dependencies.py      # Dependency injection
   │   ├── firebase_config.py   # Firebase initialization
   │   ├── minio_client.py      # MinIO client
   │   ├── websocket.py         # Socket.IO server
   │   ├── middleware/          # Custom middleware
   │   │   ├── error_handler.py
   │   │   └── logging_config.py
   │   └── routes/              # API endpoints
   │       ├── auth.py
   │       ├── projects.py
   │       ├── notes.py
   │       ├── files.py
   │       ├── forms.py
   │       ├── gps.py
   │       ├── invites.py
   │       ├── activities.py
   │       └── convert.py
   ├── tests/                   # Test suite
   ├── requirements.txt         # Python dependencies
   ├── alembic.ini             # Alembic settings
   └── docker-compose.yml      # Docker services

Key Components
--------------

Application Factory
~~~~~~~~~~~~~~~~~~~

.. code-block:: python

   # app/main.py
   app = FastAPI(
       title="STRATUM API",
       description="Archaeological site management platform",
       version="1.0.0",
   )
   
   # Add middleware (order matters!)
   app.add_middleware(ErrorHandlingMiddleware)
   app.add_middleware(CORSMiddleware)
   
   # Register routes
   app.include_router(auth.router, prefix="/api")
   app.include_router(projects.router, prefix="/api")
   # ... more routers

Database Models
~~~~~~~~~~~~~~~

.. code-block:: python

   # app/models.py
   class Project(Base):
       __tablename__ = "projects"
       
       id = Column(String, primary_key=True, default=generate_uuid)
       name = Column(String, nullable=False)
       description = Column(Text, nullable=True)
       owner_id = Column(String, ForeignKey("users.id"))
       
       # Relationships
       owner = relationship("User", back_populates="owned_projects")
       members = relationship("User", secondary=project_members)
       notes = relationship("Note", back_populates="project")
       files = relationship("FileNode", back_populates="project")

.. seealso::
   :doc:`database-schema` for detailed schema documentation

Authentication Flow
~~~~~~~~~~~~~~~~~~~

.. graphviz::

   digraph auth_flow {
      rankdir=TB;
      node [shape=box, style=rounded];
      
      client [label="Client"];
      firebase [label="Firebase Auth"];
      backend [label="Backend API"];
      db [label="PostgreSQL"];
      
      client -> firebase [label="1. Login with\nemail/password"];
      firebase -> client [label="2. ID Token"];
      client -> backend [label="3. Request with\nBearer token"];
      backend -> firebase [label="4. Verify token"];
      firebase -> backend [label="5. User info"];
      backend -> db [label="6. Get/create\nuser record"];
      db -> backend [label="7. User data"];
      backend -> client [label="8. Response"];
   }

Middleware Pipeline
~~~~~~~~~~~~~~~~~~~

.. code-block:: python

   Request
     ↓
   CORSMiddleware (allow origins)
     ↓
   ErrorHandlingMiddleware (catch exceptions)
     ↓
   get_current_user (verify JWT)
     ↓
   check_project_permission (authorize)
     ↓
   Endpoint Handler
     ↓
   Response

Frontend Architecture
=====================

Application Structure
---------------------

.. code-block:: text

   frontend/stratum-app/
   ├── app/                     # Expo Router pages
   │   ├── (auth)/              # Auth-only routes
   │   │   ├── login.tsx
   │   │   └── register.tsx
   │   ├── (tabs)/              # Main app tabs
   │   │   ├── _layout.tsx
   │   │   ├── index.tsx        # Projects list
   │   │   ├── profile.tsx
   │   │   └── settings.tsx
   │   ├── project/             # Project routes
   │   │   ├── [id]/            # Dynamic project ID
   │   │   │   ├── _layout.tsx
   │   │   │   ├── notes.tsx
   │   │   │   ├── files.tsx
   │   │   │   ├── forms.tsx
   │   │   │   ├── gps.tsx
   │   │   │   └── team.tsx
   │   │   └── create.tsx
   │   ├── _layout.tsx          # Root layout
   │   └── +not-found.tsx
   ├── components/              # Reusable components
   │   ├── ui/                  # UI primitives
   │   ├── projects/            # Project components
   │   ├── notes/               # Note components
   │   └── files/               # File components
   ├── src/
   │   ├── api/                 # API client
   │   ├── contexts/            # React contexts
   │   ├── hooks/               # Custom hooks
   │   ├── types/               # TypeScript types
   │   └── utils/               # Utility functions
   ├── assets/                  # Static assets
   └── constants/               # App constants

State Management
----------------

.. graphviz::

   digraph state {
      rankdir=TB;
      node [shape=box, style=rounded];
      
      subgraph cluster_contexts {
         label="React Contexts";
         style=filled;
         color=lightblue;
         
         auth [label="AuthContext\nUser, login, logout"];
         project [label="ProjectContext\nCurrent project"];
         ws [label="WebSocketContext\nReal-time updates"];
      }
      
      subgraph cluster_hooks {
         label="Custom Hooks";
         style=filled;
         color=lightgreen;
         
         api [label="useAPI\nAPI calls"];
         sync [label="useSync\nOffline sync"];
         storage [label="useStorage\nLocal storage"];
      }
      
      subgraph cluster_components {
         label="Components";
         
         comp [label="React Components"];
      }
      
      comp -> auth;
      comp -> project;
      comp -> ws;
      comp -> api;
      comp -> sync;
      comp -> storage;
   }

Navigation Flow
---------------

.. code-block:: typescript

   // Expo Router file-based routing
   
   /_layout.tsx                  → Root layout
     ├── (auth)/_layout.tsx      → Auth layout (no tabs)
     │   ├── login.tsx           → Login screen
     │   └── register.tsx        → Register screen
     └── (tabs)/_layout.tsx      → Main app (with tabs)
         ├── index.tsx           → Projects list
         ├── project/[id]/
         │   ├── notes.tsx       → Project notes
         │   ├── files.tsx       → Project files
         │   └── ...
         └── profile.tsx         → User profile

Data Flow Patterns
==================

CRUD Operations
---------------

.. graphviz::

   digraph crud {
      rankdir=LR;
      node [shape=box, style=rounded];
      
      ui [label="UI Component"];
      hook [label="useAPI Hook"];
      api [label="API Client"];
      backend [label="Backend"];
      db [label="Database"];
      
      ui -> hook [label="action"];
      hook -> api [label="request"];
      api -> backend [label="HTTP"];
      backend -> db [label="SQL"];
      db -> backend [label="data"];
      backend -> api [label="JSON"];
      api -> hook [label="response"];
      hook -> ui [label="update state"];
   }

Real-Time Updates
-----------------

.. graphviz::

   digraph realtime {
      rankdir=TB;
      node [shape=box, style=rounded];
      
      user1 [label="User 1"];
      user2 [label="User 2"];
      ws [label="WebSocket Server"];
      room [label="Project Room"];
      
      user1 -> ws [label="1. emit event"];
      ws -> room [label="2. broadcast"];
      room -> user2 [label="3. receive event"];
      user2 -> user2 [label="4. update UI"];
   }

Example: Member Kick Flow

.. code-block:: python

   # Backend: routes/projects.py
   @router.delete("/{project_id}/members/{user_id}")
   async def remove_member(project_id: str, user_id: str, ...):
       # 1. Remove from database
       db.delete(membership)
       db.commit()
       
       # 2. Emit WebSocket event
       await emit_member_kicked(project_id, user_id)
       
       return {"message": "Member removed"}

.. code-block:: typescript

   // Frontend: WebSocket listener
   socket.on('member_kicked', (data) => {
     if (data.user_id === currentUser.id) {
       // You were kicked!
       navigation.navigate('projects');
       showNotification('Removed from project');
     }
   });

File Upload Flow
----------------

.. graphviz::

   digraph upload {
      rankdir=TB;
      node [shape=box, style=rounded];
      
      client [label="Client"];
      backend [label="Backend"];
      minio [label="MinIO"];
      db [label="PostgreSQL"];
      
      client -> backend [label="1. POST /files/upload\nmultipart/form-data"];
      backend -> minio [label="2. Store bytes\nfiles/{project}/{uuid}"];
      minio -> backend [label="3. Object URL"];
      backend -> db [label="4. Create FileNode\nwith storage_path"];
      db -> backend [label="5. File metadata"];
      backend -> client [label="6. File info JSON"];
   }

Database Schema
===============

Core Tables
-----------

.. image:: https://mermaid.ink/img/pako:eNqVVMFugzAM_RUr50pQqKBJm7SrdttJh0o9cIkHXiHQQFA3Vf33OYSW0m7aJhASfn72e7YzQqEFQglYX7rWGN_B1noT8B7sGmyNs9Y3sAX7Bhv4gDfYwCvswL6D9R7sJ9gfsIE3-AS7A_sJG_iEd7A-wBqswb6D9QG-wBrs?type=png
   :alt: Database Schema
   :align: center

.. seealso::
   :doc:`database-schema` for complete schema documentation

Relationships
-------------

.. code-block:: text

   users ──┬─────> projects (owner)
           │
           └─────> project_members ←───── projects
                        ↓
                      notes ←───── users (author)
                        ↓
                   attachments
                        
   projects ──┬─────> file_nodes (tree)
              ├─────> gps_data
              ├─────> invites
              └─────> activities

Scalability Considerations
===========================

Horizontal Scaling
------------------

.. list-table::
   :widths: 30 70
   :header-rows: 1

   * - Component
     - Scaling Strategy
   * - **FastAPI**
     - Multiple workers with Gunicorn/Uvicorn
   * - **PostgreSQL**
     - Read replicas, connection pooling
   * - **MinIO**
     - Distributed mode with erasure coding
   * - **WebSockets**
     - Redis adapter for multi-instance Socket.IO

Performance Optimizations
--------------------------

.. code-block:: python

   # Database query optimization
   query = (
       db.query(Note)
       .options(
           joinedload(Note.author),      # Eager load
           joinedload(Note.attachments)   # Avoid N+1
       )
       .filter(Note.project_id == project_id)
       .limit(100)
   )

   # Response caching
   @cache(expire=300)
   async def get_project_stats(project_id: str):
       return compute_stats(project_id)

Security Architecture
=====================

Authentication Layers
---------------------

.. code-block:: text

   Layer 1: Firebase Authentication
     ↓ (verifies credentials)
   Layer 2: JWT Token Validation
     ↓ (verifies token signature)
   Layer 3: User Lookup
     ↓ (maps firebase_uid to user)
   Layer 4: Permission Check
     ↓ (verifies project access)
   Layer 5: Resource Access

.. important::
   Every API request goes through all 5 layers.

Data Privacy
------------

.. list-table::
   :widths: 30 70
   :header-rows: 1

   * - Privacy Level
     - Access Control
   * - **Private**
     - Only file owner
   * - **Shared**
     - Owner + specified user IDs
   * - **Project**
     - All project members (default)
   * - **Public**
     - Anyone with project link

Security Best Practices
-----------------------

.. warning::
   Always follow these security practices:

   * Never commit API keys or secrets
   * Use environment variables for configuration
   * Validate all user inputs
   * Sanitize file uploads
   * Rate limit API endpoints
   * Use HTTPS in production
   * Implement CORS properly
   * Log security events

Deployment Architecture
=======================

Production Stack
----------------

.. graphviz::

   digraph deployment {
      rankdir=TB;
      node [shape=box, style=rounded];
      
      subgraph cluster_load {
         label="Load Balancer";
         lb [label="NGINX\nSSL Termination"];
      }
      
      subgraph cluster_app {
         label="Application Servers";
         style=filled;
         color=lightblue;
         
         app1 [label="FastAPI\nInstance 1"];
         app2 [label="FastAPI\nInstance 2"];
      }
      
      subgraph cluster_data {
         label="Data Tier";
         style=filled;
         color=lightgreen;
         
         pgprimary [label="PostgreSQL\nPrimary"];
         pgreplica [label="PostgreSQL\nReplica"];
         minio [label="MinIO\nCluster"];
      }
      
      lb -> app1;
      lb -> app2;
      app1 -> pgprimary;
      app2 -> pgprimary;
      app1 -> pgreplica [style=dashed];
      app2 -> pgreplica [style=dashed];
      pgprimary -> pgreplica [label="replication"];
      app1 -> minio;
      app2 -> minio;
   }

.. seealso::
   :doc:`deployment` for deployment guide

Next Steps
==========

- Explore :doc:`database-schema` for detailed schema
- Read :doc:`websockets-realtime` for real-time features
- Check :doc:`development` for contribution guidelines
- Review :doc:`api/overview` for API documentation
