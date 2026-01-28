====================================================
Team Onboarding Guide - Start Here!
====================================================

.. contents:: Quick Navigation
   :local:
   :depth: 2

Welcome, Team Member! 👋
========================

This guide is designed for QuantumBits team members who need to understand the STRATUM codebase for our FLL 2025-2026 UNEARTHED competition presentation and interview.

.. important::
   **Read this guide FIRST before diving into the codebase.**
   
   This page gives you a structured learning path so you don't get overwhelmed by the technical details.

.. tip::
   **Don't understand a technical term?** 🤔
   
   Check the :doc:`legend` - it explains all programming concepts, terminology, and symbols used in this documentation in beginner-friendly language.

What is STRATUM?
----------------

**STRATUM** (Latin for "layer") is an archaeological documentation platform we built for FLL UNEARTHED. It helps archaeologists:

- Document excavation findings digitally instead of paper
- Collaborate with team members in real-time
- Store files with version control
- Export standardized data for analysis
- Track artifacts with QR codes
- Map GPS boundaries of dig sites

**Why the name?** In archaeology, a "stratum" is a layer of earth. Excavations work layer by layer, and our app helps document each one.

How Long Will This Take?
------------------------

.. list-table::
   :widths: 30 20 50
   :header-rows: 1

   * - Level
     - Time
     - What You'll Know
   * - **Quick Overview**
     - 30 mins
     - What STRATUM does, basic architecture
   * - **Presentation Ready**
     - 2-3 hours
     - Can explain features, tech stack, why we made certain decisions
   * - **Deep Understanding**
     - 4-6 hours
     - Can answer technical questions, explain code structure

----

📚 Your Learning Path
=====================

Follow this exact order. Don't skip ahead!

Phase 1: The Big Picture (30 minutes)
-------------------------------------

**Goal:** Understand what we built and why.

.. admonition:: Step 1.1 - Read This First
   :class: tip
   
   You're already here! Finish reading this page completely before moving on.

.. admonition:: Step 1.2 - Understand the Problem
   :class: note
   
   Read the "Problem We're Solving" section in :doc:`index`.
   
   **Key takeaway:** Archaeologists use paper notes that get lost, damaged, and can't be searched. We're fixing that.

.. admonition:: Step 1.3 - See All Features
   :class: note
   
   Skim :doc:`features` to see what STRATUM can do.
   
   Don't read every detail - just get a sense of the capabilities.

**After Phase 1, you should be able to answer:**

- What problem does STRATUM solve?
- Who is it for?
- What are the main features?

Phase 2: How It Works (1 hour)
------------------------------

**Goal:** Understand the technical architecture.

.. admonition:: Step 2.1 - Architecture Overview
   :class: note
   
   Read :doc:`architecture` carefully. This is the most important technical document.
   
   **Focus on:**
   
   - The client-server diagram (Frontend ↔ Backend ↔ Database)
   - What each technology does (FastAPI, React Native, PostgreSQL, MinIO)
   - How data flows through the system

.. admonition:: Step 2.2 - Database Structure
   :class: note
   
   Skim :doc:`database-schema` - just look at the diagram and table names.
   
   **Key tables to understand:**
   
   - ``users`` - User accounts
   - ``projects`` - Archaeological site projects
   - ``project_members`` - Who has access to what project
   - ``notes`` - Field documentation notes
   - ``file_nodes`` - Files and folders

.. admonition:: Step 2.3 - Real-Time Features
   :class: note
   
   Read the Overview section of :doc:`websockets-realtime`.
   
   **Key takeaway:** When one user makes a change, everyone else sees it instantly without refreshing.

**After Phase 2, you should be able to answer:**

- What technologies make up the tech stack?
- How does data flow from the user's phone to the database?
- What is the role of WebSockets?

Phase 3: The Code Structure (1 hour)
------------------------------------

**Goal:** Know where things are in the codebase.

.. admonition:: Step 3.1 - Project Layout
   :class: note
   
   Open the repository and familiarize yourself with the folder structure:
   
   .. code-block:: text
   
      QuantumBitsFLL2025-2026/
      ├── backend/                 # Python/FastAPI server
      │   ├── app/
      │   │   ├── main.py         # Server entry point
      │   │   ├── models.py       # Database tables
      │   │   ├── schemas.py      # API data shapes
      │   │   ├── routes/         # API endpoints
      │   │   └── websocket.py    # Real-time events
      │   ├── alembic/            # Database migrations
      │   └── requirements.txt    # Python dependencies
      │
      ├── frontend/
      │   └── stratum-app/        # React Native mobile app
      │       ├── app/            # Screen components
      │       ├── src/
      │       │   ├── services/   # API calls
      │       │   ├── contexts/   # State management
      │       │   └── components/ # UI components
      │       └── package.json    # JS dependencies
      │
      ├── docs/                   # This documentation
      └── README.rst              # Project overview

.. admonition:: Step 3.2 - Backend Routes
   :class: note
   
   Look at the files in ``backend/app/routes/``:
   
   - ``auth.py`` - Login, register, user management
   - ``projects.py`` - Create/manage projects, team members
   - ``notes.py`` - Field notes CRUD
   - ``files.py`` - File upload/download/versioning
   - ``forms.py`` - Archaeological data forms
   - ``gps.py`` - GPS boundary management
   - ``invites.py`` - Project invitation system
   - ``activities.py`` - Activity feed/audit log
   
   Each file handles one part of the app.

.. admonition:: Step 3.3 - API Reference
   :class: note
   
   Skim :doc:`api/overview` to see all the API endpoints.
   
   Don't memorize them - just know they exist and follow REST conventions.

**After Phase 3, you should be able to answer:**

- Where is the backend code?
- Where is the frontend code?
- What does each route file handle?

Phase 4: Key Features Deep Dive (1 hour)
----------------------------------------

**Goal:** Understand how specific features work.

Pick 2-3 features that interest you most and read their documentation:

.. list-table::
   :widths: 30 70
   :header-rows: 1

   * - Feature
     - Documentation
   * - Team collaboration & roles
     - :doc:`collaboration`
   * - File management & versioning
     - :doc:`files-management`
   * - Archaeological forms
     - :doc:`forms`
   * - GPS mapping
     - :doc:`gps-mapping`
   * - Real-time updates
     - :doc:`websockets-realtime`

**For each feature, understand:**

- What problem does it solve?
- How does the user interact with it?
- What happens behind the scenes?

Phase 5: Interview Preparation (30 mins)
----------------------------------------

**Goal:** Be ready to explain and defend our decisions.

.. admonition:: Review Common Questions
   :class: tip
   
   Read :doc:`faq` - it answers questions judges might ask.

.. admonition:: Know Our Challenges
   :class: tip
   
   Read :doc:`troubleshooting` - it shows problems we encountered and how we solved them.

.. admonition:: Know Future Plans
   :class: tip
   
   Skim :doc:`roadmap` - shows we have a vision beyond the competition.

----

🎯 Quick Reference for Interviews
=================================

Technology Stack Summary
------------------------

**Frontend (What users see):**

- **React Native** - Write once, run on iOS, Android, and Web
- **Expo** - Development tools and easy deployment
- **TypeScript** - Type-safe JavaScript
- **Socket.IO Client** - Real-time updates

**Backend (Server):**

- **FastAPI** - Modern Python web framework
- **SQLAlchemy** - Database ORM (translates Python to SQL)
- **Socket.IO** - WebSocket server for real-time events
- **Alembic** - Database migration management

**Data Storage:**

- **PostgreSQL** - Main database for structured data
- **MinIO** - S3-compatible storage for files (images, PDFs, 3D models)
- **Firebase** - User authentication

Key Design Decisions
--------------------

**Why FastAPI instead of Django/Flask?**

- Modern async support (handles many users at once)
- Automatic API documentation
- Built-in data validation
- Type hints for better code

**Why React Native instead of native iOS/Android?**

- One codebase for three platforms (iOS, Android, Web)
- Faster development
- Team already knew JavaScript
- Large ecosystem of libraries

**Why PostgreSQL instead of MongoDB?**

- Relational data (projects have members, notes have attachments)
- Strong data integrity
- Powerful queries with joins
- Industry standard for structured data

**Why MinIO instead of direct file storage?**

- S3-compatible API (industry standard)
- Can scale to millions of files
- Versioning support built-in
- Can migrate to AWS S3 easily

**Why WebSockets for real-time?**

- Instant updates without refreshing
- Lower latency than polling
- Bi-directional communication
- Essential for collaboration

User Roles Explained
--------------------

STRATUM has four permission levels:

.. list-table::
   :widths: 20 80
   :header-rows: 1

   * - Role
     - Permissions
   * - **Owner**
     - Created the project. Full control. Can delete project, transfer ownership.
   * - **Leader**
     - Can manage team members, edit all content, change roles.
   * - **Researcher**
     - Can create and edit their own notes/files. Can view others' content.
   * - **Guest**
     - Read-only access. Can view but not modify.

----

🔍 Don't Understand Something?
==============================

Check the Legend
----------------

The :doc:`legend` explains all technical terms used in this documentation:

- Programming concepts (API, database, server, client)
- STRATUM-specific terms (project, note, file node)
- Symbols and conventions (code blocks, terminal commands)
- Common error messages and what they mean

If you see a term you don't understand, it's probably explained there.

Ask These Questions
-------------------

When reading documentation or code, ask yourself:

1. **What problem is this solving?**
2. **Who uses this feature?**
3. **What data does it need?**
4. **What happens when it fails?**

If you can answer these four questions about any feature, you understand it well enough for the interview.

----

📋 Documentation Map
====================

Here's every documentation file and what it covers:

Getting Started
---------------

.. list-table::
   :widths: 25 75
   :header-rows: 1

   * - Document
     - Purpose
   * - :doc:`legend`
     - Explains all technical terms and symbols
   * - :doc:`installation`
     - How to set up the development environment
   * - :doc:`quickstart`
     - Quick walkthrough of basic usage
   * - :doc:`architecture`
     - System design and technology choices

User Guide
----------

.. list-table::
   :widths: 25 75
   :header-rows: 1

   * - Document
     - Purpose
   * - :doc:`features`
     - Complete list of STRATUM capabilities
   * - :doc:`collaboration`
     - Team roles, permissions, invitations
   * - :doc:`files-management`
     - File uploads, versioning, privacy
   * - :doc:`forms`
     - Archaeological data entry forms
   * - :doc:`gps-mapping`
     - GPS boundaries and mapping features

API Documentation
-----------------

.. list-table::
   :widths: 25 75
   :header-rows: 1

   * - Document
     - Purpose
   * - :doc:`api/overview`
     - All API endpoints at a glance
   * - :doc:`api/authentication`
     - Login/register endpoints
   * - :doc:`api/projects`
     - Project management endpoints
   * - :doc:`api/notes`
     - Note CRUD endpoints
   * - :doc:`api/files`
     - File management endpoints
   * - :doc:`api/forms`
     - Archaeological form endpoints
   * - :doc:`api/websockets`
     - Real-time event documentation

Developer Guide
---------------

.. list-table::
   :widths: 25 75
   :header-rows: 1

   * - Document
     - Purpose
   * - :doc:`development`
     - Contributing guidelines, code style
   * - :doc:`database-schema`
     - Database tables and relationships
   * - :doc:`websockets-realtime`
     - WebSocket implementation details
   * - :doc:`deployment`
     - Production deployment guide

Reference
---------

.. list-table::
   :widths: 25 75
   :header-rows: 1

   * - Document
     - Purpose
   * - :doc:`faq`
     - Frequently asked questions
   * - :doc:`troubleshooting`
     - Common problems and solutions
   * - :doc:`roadmap`
     - Future features and plans
   * - :doc:`changelog`
     - Version history

----

✅ Ready for the Interview?
===========================

Before the presentation, make sure you can:

.. admonition:: Checklist
   :class: important
   
   ☐ Explain what STRATUM does in one sentence
   
   ☐ Name the main technologies (FastAPI, React Native, PostgreSQL, MinIO)
   
   ☐ Explain why we chose each technology
   
   ☐ Describe how data flows from user to database
   
   ☐ Explain how real-time collaboration works
   
   ☐ Name at least 3 key features
   
   ☐ Explain the user role system
   
   ☐ Know where to find code for different features
   
   ☐ Describe at least one challenge we faced and how we solved it
   
   ☐ Know what's on our roadmap for the future

**One-Sentence Pitch:**

   "STRATUM is a digital platform that replaces paper-based archaeological documentation with a cloud-synced, collaborative mobile app that supports offline work, standardized data export, and real-time team collaboration."

Good luck! 🏆

----

*Last updated: January 2026*

*Questions? Ask @levinismynameirl or @Pzmuv1517*
