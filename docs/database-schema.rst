============================
Database Schema
============================

Complete documentation of STRATUM's PostgreSQL database schema.

.. seealso::
   **New to databases?** The :doc:`legend <legend>` explains database terminology like tables, rows, foreign keys, and all other technical concepts.

.. contents:: Table of Contents
   :local:
   :depth: 3

Overview
========

STRATUM uses PostgreSQL for structured data and MinIO for binary storage. This document covers the relational schema.

.. important::
   Database schema is managed by **Alembic migrations**. Never modify the schema directly.

Data Architecture
=================

Storage Layers
--------------

.. list-table::
   :widths: 20 40 40
   :header-rows: 1

   * - Layer
     - Purpose
     - Technology
   * - **Relational**
     - Metadata, relationships, access control
     - PostgreSQL 14+
   * - **Object Storage**
     - File bytes, media, documents
     - MinIO (S3-compatible)
   * - **Authentication**
     - Token verification
     - Firebase Admin SDK

Schema Diagram
==============

Entity Relationship Diagram
---------------------------

.. graphviz::

   digraph schema {
      rankdir=TB;
      node [shape=record, style=rounded];
      
      users [label="{users|id: uuid\lfirebase_uid: string\lemail: string\ldisplay_name: string\l}"];
      
      projects [label="{projects|id: uuid\lname: string\ldescription: text\lowner_id: fk→users\lis_active: bool\l}"];
      
      project_members [label="{project_members|project_id: fk→projects\luser_id: fk→users\lrole: enum\ljoined_at: datetime\l}"];
      
      notes [label="{notes|id: uuid\ltitle: string\lcontent: text\lproject_id: fk→projects\lauthor_id: fk→users\l}"];
      
      file_nodes [label="{file_nodes|id: uuid\lproject_id: fk→projects\lparent_id: fk→file_nodes\lname: string\ltype: enum\lstorage_path: string\lowner_id: fk→users\lprivacy: enum\l}"];
      
      note_attachments [label="{note_attachments|id: uuid\lnote_id: fk→notes\lfilename: string\lfile_path: string (MinIO)\lfile_type: string\l}"];
      
      activities [label="{project_activities|id: uuid\lproject_id: fk→projects\luser_id: fk→users\lactivity_type: enum\ldescription: text\lextra_data: json\l}"];
      
      users -> projects [label="owns"];
      users -> project_members;
      projects -> project_members;
      projects -> notes;
      users -> notes [label="authors"];
      projects -> file_nodes;
      file_nodes -> file_nodes [label="parent"];
      notes -> note_attachments;
      projects -> activities;
      users -> activities;
   }

Core Tables
===========

users
-----

Stores user account information.

.. code-block:: sql

   CREATE TABLE users (
       id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
       firebase_uid VARCHAR UNIQUE NOT NULL,
       email VARCHAR UNIQUE NOT NULL,
       display_name VARCHAR,
       photo_url VARCHAR,
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
       updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
       last_login TIMESTAMP
   );

   CREATE UNIQUE INDEX idx_users_firebase_uid ON users(firebase_uid);
   CREATE UNIQUE INDEX idx_users_email ON users(email);

**Columns:**

.. list-table::
   :widths: 20 15 15 50
   :header-rows: 1

   * - Column
     - Type
     - Nullable
     - Description
   * - ``id``
     - VARCHAR
     - NOT NULL
     - Primary key (UUID)
   * - ``firebase_uid``
     - VARCHAR
     - NOT NULL
     - Firebase user identifier (unique)
   * - ``email``
     - VARCHAR
     - NOT NULL
     - User email address (unique)
   * - ``display_name``
     - VARCHAR
     - YES
     - User's display name
   * - ``photo_url``
     - VARCHAR
     - YES
     - Profile photo URL
   * - ``created_at``
     - TIMESTAMP
     - NOT NULL
     - Account creation timestamp
   * - ``updated_at``
     - TIMESTAMP
     - NOT NULL
     - Last update timestamp
   * - ``last_login``
     - TIMESTAMP
     - YES
     - Last successful login

**Relationships:**

- ``owns`` → :ref:`projects` (one-to-many)
- ``authors`` → :ref:`notes` (one-to-many)
- ``member_of`` → :ref:`projects` via ``project_members``

projects
--------

Archaeological site projects.

.. code-block:: sql

   CREATE TABLE projects (
       id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
       name VARCHAR NOT NULL,
       description TEXT,
       owner_id VARCHAR NOT NULL REFERENCES users(id),
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
       updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
       is_active BOOLEAN DEFAULT TRUE
   );

   CREATE INDEX idx_projects_owner ON projects(owner_id);
   CREATE INDEX idx_projects_active ON projects(is_active);

**Columns:**

.. list-table::
   :widths: 20 15 15 50
   :header-rows: 1

   * - Column
     - Type
     - Nullable
     - Description
   * - ``id``
     - VARCHAR
     - NOT NULL
     - Primary key (UUID)
   * - ``name``
     - VARCHAR
     - NOT NULL
     - Project/site name
   * - ``description``
     - TEXT
     - YES
     - Detailed description
   * - ``owner_id``
     - VARCHAR
     - NOT NULL
     - Foreign key to ``users.id``
   * - ``created_at``
     - TIMESTAMP
     - NOT NULL
     - Project creation time
   * - ``updated_at``
     - TIMESTAMP
     - NOT NULL
     - Last modification time
   * - ``is_active``
     - BOOLEAN
     - NOT NULL
     - Soft delete flag

**Relationships:**

- ``owner`` → :ref:`users` (many-to-one)
- ``members`` → :ref:`users` via ``project_members`` (many-to-many)
- ``has_notes`` → :ref:`notes` (one-to-many)
- ``has_files`` → :ref:`file_nodes` (one-to-many)

project_members
---------------

Project team membership and roles.

.. code-block:: sql

   CREATE TABLE project_members (
       project_id VARCHAR NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
       user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
       role VARCHAR NOT NULL DEFAULT 'guest',
       joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
       PRIMARY KEY (project_id, user_id)
   );

   CREATE INDEX idx_project_members_user ON project_members(user_id);

**Columns:**

.. list-table::
   :widths: 20 15 15 50
   :header-rows: 1

   * - Column
     - Type
     - Nullable
     - Description
   * - ``project_id``
     - VARCHAR
     - NOT NULL
     - Foreign key to ``projects.id``
   * - ``user_id``
     - VARCHAR
     - NOT NULL
     - Foreign key to ``users.id``
   * - ``role``
     - ENUM
     - NOT NULL
     - ``leader``, ``researcher``, or ``guest``
   * - ``joined_at``
     - TIMESTAMP
     - NOT NULL
     - When user joined project

**Role Hierarchy:**

.. code-block:: text

   leader > researcher > guest > (no access)

.. seealso::
   :doc:`collaboration <collaboration>` for detailed role permissions

notes
-----

Field notes and documentation.

.. code-block:: sql

   CREATE TABLE notes (
       id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
       title VARCHAR NOT NULL,
       content TEXT,
       project_id VARCHAR NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
       author_id VARCHAR NOT NULL REFERENCES users(id),
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
       updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
       last_synced TIMESTAMP
   );

   CREATE INDEX idx_notes_project ON notes(project_id);
   CREATE INDEX idx_notes_author ON notes(author_id);
   CREATE INDEX idx_notes_updated ON notes(updated_at DESC);

**Columns:**

.. list-table::
   :widths: 20 15 15 50
   :header-rows: 1

   * - Column
     - Type
     - Nullable
     - Description
   * - ``id``
     - VARCHAR
     - NOT NULL
     - Primary key (UUID)
   * - ``title``
     - VARCHAR
     - NOT NULL
     - Note title
   * - ``content``
     - TEXT
     - YES
     - Markdown/plain text content
   * - ``project_id``
     - VARCHAR
     - NOT NULL
     - Foreign key to ``projects.id``
   * - ``author_id``
     - VARCHAR
     - NOT NULL
     - Foreign key to ``users.id``
   * - ``created_at``
     - TIMESTAMP
     - NOT NULL
     - Creation timestamp
   * - ``updated_at``
     - TIMESTAMP
     - NOT NULL
     - Last edit timestamp
   * - ``last_synced``
     - TIMESTAMP
     - YES
     - Last cloud sync time

file_nodes
----------

Hierarchical file system tree.

.. code-block:: sql

   CREATE TABLE file_nodes (
       id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
       project_id VARCHAR NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
       parent_id VARCHAR REFERENCES file_nodes(id) ON DELETE CASCADE,
       name VARCHAR NOT NULL,
       type VARCHAR NOT NULL,  -- 'folder' | 'file' | 'note'
       mime_type VARCHAR,
       size VARCHAR,
       storage_path VARCHAR,  -- MinIO object key
       is_locked BOOLEAN DEFAULT FALSE,
       version INTEGER DEFAULT 1,
       checksum VARCHAR,
       owner_id VARCHAR REFERENCES users(id),
       privacy VARCHAR NOT NULL DEFAULT 'project',
       shared_with JSON,
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
       updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
       CONSTRAINT uq_file_nodes_sibling_name 
           UNIQUE (project_id, parent_id, name)
   );

   CREATE INDEX idx_file_nodes_project_parent 
       ON file_nodes(project_id, parent_id);
   CREATE INDEX idx_file_nodes_owner ON file_nodes(owner_id);

**Key Features:**

- **Hierarchical**: ``parent_id`` creates folder tree
- **Unique Names**: Same sibling names not allowed
- **Versioning**: ``version`` increments on updates
- **Privacy Control**: Per-file access control
- **Locked Nodes**: System folders can't be deleted

**File Types:**

.. code-block:: python

   class FileNodeType(enum.Enum):
       FOLDER = "folder"  # Directory
       FILE = "file"      # Uploaded file
       NOTE = "note"      # Note backing file

**Privacy Levels:**

.. code-block:: python

   class PrivacyLevel(enum.Enum):
       PRIVATE = "private"  # Owner only
       SHARED = "shared"    # Specific users (shared_with JSON)
       PROJECT = "project"  # All members (default)
       PUBLIC = "public"    # Anyone with link

note_attachments
----------------

Photos and files attached to notes.

.. code-block:: sql

   CREATE TABLE note_attachments (
       id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
       note_id VARCHAR NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
       filename VARCHAR NOT NULL,
       file_path VARCHAR NOT NULL,  -- MinIO path
       file_type VARCHAR NOT NULL,   -- MIME type
       file_size VARCHAR,
       uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   );

   CREATE INDEX idx_note_attachments_note ON note_attachments(note_id);

**Storage Pattern:**

.. code-block:: text

   MinIO Path: notes/{note_id}/{uuid}.{ext}
   
   Example: notes/abc-123-def/456-789-ghi.jpg

project_activities
------------------

Activity feed and audit log.

.. code-block:: sql

   CREATE TABLE project_activities (
       id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
       project_id VARCHAR NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
       user_id VARCHAR REFERENCES users(id) ON DELETE SET NULL,
       activity_type VARCHAR NOT NULL,
       description TEXT NOT NULL,
       extra_data TEXT,  -- JSON blob
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   );

   CREATE INDEX idx_project_activities_project_created 
       ON project_activities(project_id, created_at DESC);

**Activity Types:**

.. code-block:: python

   class ActivityType(enum.Enum):
       # Project
       PROJECT_CREATED = "project_created"
       PROJECT_UPDATED = "project_updated"
       
       # Members
       MEMBER_JOINED = "member_joined"
       MEMBER_LEFT = "member_left"
       MEMBER_ROLE_CHANGED = "member_role_changed"
       
       # Notes
       NOTE_CREATED = "note_created"
       NOTE_UPDATED = "note_updated"
       NOTE_DELETED = "note_deleted"
       
       # Files
       FILE_UPLOADED = "file_uploaded"
       FILE_DELETED = "file_deleted"
       FOLDER_CREATED = "folder_created"
       
       # Forms
       CONTEXT_FEATURE_ADDED = "context_feature_added"
       STRATIGRAPHIC_UNIT_ADDED = "stratigraphic_unit_added"
       ARTEFACT_ADDED = "artefact_added"

Auxiliary Tables
================

project_gps
-----------

GPS boundary data for projects.

.. code-block:: sql

   CREATE TABLE project_gps (
       project_id VARCHAR PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
       data TEXT NOT NULL DEFAULT '{}',  -- JSON
       updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   );

**JSON Structure:**

.. code-block:: json

   {
     "work": {
       "points": [
         {"lat": 45.4215, "lng": -75.6972},
         {"lat": 45.4220, "lng": -75.6980}
       ],
       "closed": true
     },
     "sites": [
       {
         "name": "Excavation Unit 1",
         "points": [...],
         "closed": true
       }
     ]
   }

project_invites
---------------

Invite links and codes for joining projects.

.. code-block:: sql

   CREATE TABLE project_invites (
       token VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
       code VARCHAR UNIQUE,  -- Short code like "PRJ-ABC123"
       project_id VARCHAR NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
       role VARCHAR NOT NULL DEFAULT 'guest',
       created_by VARCHAR REFERENCES users(id),
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
       expires_at TIMESTAMP,
       redeemed_by VARCHAR REFERENCES users(id),
       redeemed_at TIMESTAMP,
       used BOOLEAN DEFAULT FALSE,
       max_uses INTEGER,     -- NULL = unlimited
       use_count INTEGER DEFAULT 0
   );

   CREATE INDEX idx_project_invites_code ON project_invites(code);
   CREATE INDEX idx_project_invites_project ON project_invites(project_id);

**Multi-Use Invites:**

- ``max_uses = NULL``: Unlimited redemptions
- ``max_uses = 1``: Single-use invite
- ``max_uses = 10``: Up to 10 people can use

file_versions
-------------

File version history.

.. code-block:: sql

   CREATE TABLE file_versions (
       id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
       file_node_id VARCHAR NOT NULL REFERENCES file_nodes(id) ON DELETE CASCADE,
       version INTEGER NOT NULL,
       storage_path VARCHAR NOT NULL,  -- MinIO path for this version
       size VARCHAR,
       checksum VARCHAR,
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
       created_by VARCHAR REFERENCES users(id),
       CONSTRAINT uq_file_version UNIQUE (file_node_id, version)
   );

   CREATE INDEX idx_file_versions_file_node ON file_versions(file_node_id);

note_file_links
---------------

Links notes to their backing `.txt` files in the file system.

.. code-block:: sql

   CREATE TABLE note_file_links (
       note_id VARCHAR PRIMARY KEY REFERENCES notes(id) ON DELETE CASCADE,
       file_node_id VARCHAR UNIQUE NOT NULL REFERENCES file_nodes(id) ON DELETE CASCADE
   );

**Purpose:**

Creates 1:1 mapping between:

- Logical ``Note`` (in ``notes`` table)
- Physical ``.txt`` file (in ``file_nodes`` tree)

This allows notes to appear in both:

1. Notes tab (from ``notes`` table)
2. Files tab (from ``file_nodes`` tree)

MinIO Storage
=============

Object Storage Patterns
-----------------------

.. code-block:: text

   Bucket: stratum-files
   
   ├── files/{project_id}/{uuid}           # General uploads
   │   └── Example: files/abc-123/def-456.jpg
   │
   ├── notes/{project_id}/{note_id}.txt    # Note backing files
   │   └── Example: notes/abc-123/note-789.txt
   │
   ├── notes/{note_id}/{uuid}.{ext}        # Note attachments
   │   └── Example: notes/note-789/img-001.jpg
   │
   └── versions/{file_id}/v{N}/{uuid}      # File versions
       └── Example: versions/file-123/v2/def-456.pdf

**Path Mapping:**

.. list-table::
   :widths: 40 60
   :header-rows: 1

   * - Database Field
     - MinIO Path
   * - ``file_nodes.storage_path``
     - ``files/{project_id}/{uuid}``
   * - ``note_file_links.file_node.storage_path``
     - ``notes/{project_id}/{note_id}.txt``
   * - ``note_attachments.file_path``
     - ``notes/{note_id}/{uuid}.{ext}``
   * - ``file_versions.storage_path``
     - ``versions/{file_id}/v{N}/{uuid}``

Migrations
==========

Migration Files
---------------

Location: :file:`backend/alembic/versions/`

.. code-block:: text

   001_baseline_initial_schema.py   # Initial schema
   002_versioning_privacy.py        # File versioning + privacy
   003_add_invite_used_column.py    # Multi-use invites

Creating Migrations
-------------------

.. code-block:: bash

   # Auto-generate from model changes
   alembic revision --autogenerate -m "Add new field"
   
   # Create empty migration
   alembic revision -m "Custom migration"
   
   # Apply migrations
   alembic upgrade head
   
   # Rollback one step
   alembic downgrade -1

**Example Migration:**

.. code-block:: python

   """Add privacy field to file_nodes

   Revision ID: 002
   Revises: 001
   """
   from alembic import op
   import sqlalchemy as sa

   def upgrade():
       op.add_column(
           'file_nodes',
           sa.Column('privacy', sa.String(), nullable=False, server_default='project')
       )
       op.add_column(
           'file_nodes',
           sa.Column('shared_with', sa.JSON(), nullable=True)
       )

   def downgrade():
       op.drop_column('file_nodes', 'shared_with')
       op.drop_column('file_nodes', 'privacy')

Query Examples
==============

Common Queries
--------------

**Get user's projects:**

.. code-block:: python

   # Projects where user is owner or member
   projects = (
       db.query(Project)
       .outerjoin(project_members)
       .filter(
           or_(
               Project.owner_id == user_id,
               project_members.c.user_id == user_id
           )
       )
       .all()
   )

**Get project with members:**

.. code-block:: python

   project = (
       db.query(Project)
       .options(joinedload(Project.members))
       .filter(Project.id == project_id)
       .first()
   )

**Get file tree:**

.. code-block:: python

   # Root level files
   root_files = (
       db.query(FileNode)
       .filter(
           FileNode.project_id == project_id,
           FileNode.parent_id == None
       )
       .order_by(FileNode.type, FileNode.name)
       .all()
   )

**Get recent activity:**

.. code-block:: python

   activities = (
       db.query(ProjectActivity)
       .filter(ProjectActivity.project_id == project_id)
       .order_by(ProjectActivity.created_at.desc())
       .limit(50)
       .all()
   )

Performance Tips
----------------

.. tip::
   **Optimization strategies:**
   
   - Use ``joinedload`` for eager loading
   - Add indexes on foreign keys
   - Limit query results
   - Use pagination for large datasets
   - Cache frequently accessed data

**Example with eager loading:**

.. code-block:: python

   notes = (
       db.query(Note)
       .options(
           joinedload(Note.author),        # Avoid N+1
           joinedload(Note.attachments)    # Eager load
       )
       .filter(Note.project_id == project_id)
       .all()
   )

Backup & Restore
================

Database Backup
---------------

.. code-block:: bash

   # Backup
   pg_dump -h localhost -U postgres stratum > backup.sql
   
   # Backup with compression
   pg_dump -h localhost -U postgres stratum | gzip > backup.sql.gz
   
   # Backup specific tables
   pg_dump -h localhost -U postgres -t users -t projects stratum > partial.sql

Restore
-------

.. code-block:: bash

   # Restore
   psql -h localhost -U postgres stratum < backup.sql
   
   # Restore compressed
   gunzip -c backup.sql.gz | psql -h localhost -U postgres stratum

MinIO Backup
------------

.. code-block:: bash

   # Mirror bucket
   mc mirror local/stratum-files backup/stratum-files
   
   # Sync with S3
   mc mirror local/stratum-files s3/backup-bucket

Schema Validation
=================

Check Constraints
-----------------

.. code-block:: sql

   -- Ensure valid roles
   ALTER TABLE project_members 
   ADD CONSTRAINT chk_valid_role 
   CHECK (role IN ('leader', 'researcher', 'guest'));
   
   -- Ensure valid file types
   ALTER TABLE file_nodes 
   ADD CONSTRAINT chk_valid_type 
   CHECK (type IN ('folder', 'file', 'note'));
   
   -- Ensure positive version numbers
   ALTER TABLE file_nodes 
   ADD CONSTRAINT chk_positive_version 
   CHECK (version > 0);

Referential Integrity
---------------------

.. code-block:: sql

   -- Cascade delete for project cleanup
   ALTER TABLE notes 
   ADD CONSTRAINT fk_notes_project 
   FOREIGN KEY (project_id) 
   REFERENCES projects(id) 
   ON DELETE CASCADE;
   
   -- Nullify on user delete
   ALTER TABLE project_activities 
   ADD CONSTRAINT fk_activities_user 
   FOREIGN KEY (user_id) 
   REFERENCES users(id) 
   ON DELETE SET NULL;

Monitoring
==========

Query Performance
-----------------

.. code-block:: sql

   -- Enable query timing
   \timing on
   
   -- Analyze query plan
   EXPLAIN ANALYZE
   SELECT * FROM notes WHERE project_id = 'abc-123';
   
   -- Find slow queries
   SELECT query, mean_exec_time, calls
   FROM pg_stat_statements
   ORDER BY mean_exec_time DESC
   LIMIT 10;

Database Statistics
-------------------

.. code-block:: sql

   -- Table sizes
   SELECT 
       tablename,
       pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
   FROM pg_tables
   WHERE schemaname = 'public'
   ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
   
   -- Row counts
   SELECT 
       schemaname,
       relname,
       n_live_tup AS row_count
   FROM pg_stat_user_tables
   ORDER BY n_live_tup DESC;

Next Steps
==========

- Review :doc:`architecture <architecture>` for system design
- Check :doc:`api/overview <api/overview>` for API endpoints
- Read :doc:`development <development>` for model changes
- See :doc:`websockets-realtime <websockets-realtime>` for real-time features
