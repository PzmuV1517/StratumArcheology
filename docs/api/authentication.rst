============================
Authentication API
============================

User authentication and management endpoints.

.. seealso::
   **Unfamiliar with authentication terms?** Check :doc:`../legend <../legend>` for explanations of JWT, tokens, Firebase, and authentication concepts.

.. contents:: Table of Contents
   :local:
   :depth: 2

Overview
========

STRATUM uses **Firebase Authentication** for user identity management. The backend verifies JWT tokens and manages user records in PostgreSQL.

Authentication Flow
===================

.. graphviz::

   digraph auth {
      rankdir=LR;
      node [shape=box, style=rounded];
      
      client [label="Client App"];
      firebase [label="Firebase Auth"];
      api [label="STRATUM API"];
      db [label="PostgreSQL"];
      
      client -> firebase [label="1. Login"];
      firebase -> client [label="2. JWT Token"];
      client -> api [label="3. API Request\n+ Bearer Token"];
      api -> firebase [label="4. Verify Token"];
      firebase -> api [label="5. User Info"];
      api -> db [label="6. Get/Create User"];
      db -> api [label="7. User Record"];
      api -> client [label="8. Response"];
   }

Endpoints
=========

Get Current User
----------------

``GET /api/auth/me``

Returns the authenticated user's profile.

**Request:**

.. code-block:: http

   GET /api/auth/me HTTP/1.1
   Authorization: Bearer <firebase-jwt-token>

**Response:** ``200 OK``

.. code-block:: json

   {
     "id": "user-uuid-123",
     "firebase_uid": "firebase-abc-def",
     "email": "archaeologist@example.com",
     "display_name": "Dr. Jane Smith",
     "photo_url": "https://example.com/photo.jpg",
     "created_at": "2026-01-15T10:30:00Z",
     "updated_at": "2026-01-20T14:22:00Z",
     "last_login": "2026-01-28T09:15:00Z"
   }

**Errors:**

.. list-table::
   :widths: 15 85
   :header-rows: 1

   * - Code
     - Description
   * - ``401``
     - Invalid or missing token

Search Users
------------

``GET /api/auth/users/search``

Search for users by email (for project invitations).

**Query Parameters:**

.. list-table::
   :widths: 20 15 65
   :header-rows: 1

   * - Parameter
     - Type
     - Description
   * - ``email``
     - string
     - Email address or partial match (required)

**Request:**

.. code-block:: http

   GET /api/auth/users/search?email=smith HTTP/1.1
   Authorization: Bearer <token>

**Response:** ``200 OK``

.. code-block:: json

   [
     {
       "id": "user-uuid-456",
       "email": "dr.smith@university.edu",
       "display_name": "Dr. John Smith"
     },
     {
       "id": "user-uuid-789",
       "email": "sarah.smith@institute.org",
       "display_name": "Sarah Smith"
     }
   ]

.. seealso::
   :doc:`../architecture <../architecture>` for authentication architecture details
