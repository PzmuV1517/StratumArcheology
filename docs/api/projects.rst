============================
Projects API
============================

Project management endpoints for creating and managing archaeological site projects.

.. seealso::
   **Not familiar with API terminology?** See `../legend.rst <../legend.rst>`_ for explanations of endpoints, requests, responses, and HTTP methods.

.. contents:: Table of Contents
   :local:
   :depth: 2

Endpoints
=========

Create Project
--------------

``POST /api/projects``

**Request Body:**

.. code-block:: json

   {
     "name": "Tell el-Amarna 2026",
     "description": "Excavation of the North Palace area"
   }

**Response:** ``201 Created``

.. code-block:: json

   {
     "id": "project-uuid-123",
     "name": "Tell el-Amarna 2026",
     "description": "Excavation of the North Palace area",
     "owner_id": "user-uuid-456",
     "created_at": "2026-01-28T10:00:00Z",
     "updated_at": "2026-01-28T10:00:00Z",
     "is_active": true
   }

List Projects
-------------

``GET /api/projects``

Returns all projects where user is owner or member.

**Response:** ``200 OK``

.. code-block:: json

   [
     {
       "id": "project-uuid-123",
       "name": "Tell el-Amarna 2026",
       "description": "Excavation of the North Palace area",
       "owner_id": "user-uuid-456",
       "role": "leader",
       "created_at": "2026-01-28T10:00:00Z"
     }
   ]

.. seealso::
   Full API documentation: `overview.rst <overview.rst>`_
