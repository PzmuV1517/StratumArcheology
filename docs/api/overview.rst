============================
API Overview
============================

Complete REST API reference for STRATUM backend.

.. contents:: Table of Contents
   :local:
   :depth: 2

Base URL
========

.. code-block:: text

   Development: http://localhost:8000/api
   Production:  https://api.stratum.app/api

Authentication
==============

All authenticated endpoints require a **Bearer token** in the Authorization header:

.. code-block:: http

   GET /api/projects HTTP/1.1
   Host: localhost:8000
   Authorization: Bearer YOUR_FIREBASE_JWT_TOKEN
   Content-Type: application/json

Getting a Token
---------------

1. Authenticate with Firebase on the client
2. Get the ID token: ``await user.getIdToken()``
3. Include in requests as shown above

.. seealso::
   :doc:`authentication` for detailed auth documentation

API Endpoints by Category
==========================

Authentication
--------------

.. list-table::
   :widths: 10 30 60
   :header-rows: 1

   * - Method
     - Endpoint
     - Description
   * - ``GET``
     - ``/api/auth/me``
     - Get current user profile
   * - ``GET``
     - ``/api/auth/users/search``
     - Search users by email

Projects
--------

.. list-table::
   :widths: 10 30 60
   :header-rows: 1

   * - Method
     - Endpoint
     - Description
   * - ``POST``
     - ``/api/projects``
     - Create new project
   * - ``GET``
     - ``/api/projects``
     - List user's projects
   * - ``GET``
     - ``/api/projects/{id}``
     - Get project details
   * - ``PUT``
     - ``/api/projects/{id}``
     - Update project
   * - ``DELETE``
     - ``/api/projects/{id}``
     - Delete project
   * - ``POST``
     - ``/api/projects/{id}/members``
     - Add team member
   * - ``DELETE``
     - ``/api/projects/{id}/members/{user_id}``
     - Remove member
   * - ``PUT``
     - ``/api/projects/{id}/members/{user_id}/role``
     - Change member role
   * - ``POST``
     - ``/api/projects/{id}/transfer-ownership``
     - Transfer ownership

Notes
-----

.. list-table::
   :widths: 10 30 60
   :header-rows: 1

   * - Method
     - Endpoint
     - Description
   * - ``POST``
     - ``/api/notes``
     - Create new note
   * - ``GET``
     - ``/api/notes/project/{project_id}``
     - List project notes
   * - ``GET``
     - ``/api/notes/{id}``
     - Get note details
   * - ``PUT``
     - ``/api/notes/{id}``
     - Update note
   * - ``DELETE``
     - ``/api/notes/{id}``
     - Delete note
   * - ``POST``
     - ``/api/notes/{id}/attachments``
     - Add attachment
   * - ``DELETE``
     - ``/api/notes/{id}/attachments/{attachment_id}``
     - Delete attachment

Files
-----

.. list-table::
   :widths: 10 30 60
   :header-rows: 1

   * - Method
     - Endpoint
     - Description
   * - ``POST``
     - ``/api/files/project/{id}/upload``
     - Upload file
   * - ``GET``
     - ``/api/files/project/{id}``
     - List files (tree)
   * - ``GET``
     - ``/api/files/{id}/download``
     - Download file
   * - ``PUT``
     - ``/api/files/{id}``
     - Update file metadata
   * - ``DELETE``
     - ``/api/files/{id}``
     - Delete file/folder
   * - ``POST``
     - ``/api/files/{id}/move``
     - Move file/folder
   * - ``POST``
     - ``/api/files/{id}/copy``
     - Copy file
   * - ``POST``
     - ``/api/files/project/{id}/folder``
     - Create folder

Forms
-----

.. list-table::
   :widths: 10 30 60
   :header-rows: 1

   * - Method
     - Endpoint
     - Description
   * - ``POST``
     - ``/api/forms/project/{id}/context``
     - Create context feature
   * - ``GET``
     - ``/api/forms/project/{id}/context``
     - List context features
   * - ``POST``
     - ``/api/forms/project/{id}/stratigraphic``
     - Create stratigraphic unit
   * - ``GET``
     - ``/api/forms/project/{id}/stratigraphic``
     - List stratigraphic units
   * - ``POST``
     - ``/api/forms/project/{id}/artefact``
     - Register artifact
   * - ``GET``
     - ``/api/forms/project/{id}/artefact``
     - List artifacts

GPS
---

.. list-table::
   :widths: 10 30 60
   :header-rows: 1

   * - Method
     - Endpoint
     - Description
   * - ``GET``
     - ``/api/gps/project/{id}``
     - Get GPS data
   * - ``POST``
     - ``/api/gps/project/{id}``
     - Update GPS data

Invites
-------

.. list-table::
   :widths: 10 30 60
   :header-rows: 1

   * - Method
     - Endpoint
     - Description
   * - ``POST``
     - ``/api/invites/project/{id}``
     - Create invite
   * - ``GET``
     - ``/api/invites/project/{id}``
     - List invites
   * - ``DELETE``
     - ``/api/invites/{token}``
     - Revoke invite
   * - ``POST``
     - ``/api/invites/redeem``
     - Redeem invite

Activities
----------

.. list-table::
   :widths: 10 30 60
   :header-rows: 1

   * - Method
     - Endpoint
     - Description
   * - ``GET``
     - ``/api/activities/project/{id}``
     - Get activity feed

Convert
-------

.. list-table::
   :widths: 10 30 60
   :header-rows: 1

   * - Method
     - Endpoint
     - Description
   * - ``GET``
     - ``/api/convert/pointcloud``
     - List point clouds
   * - ``POST``
     - ``/api/convert/pointcloud``
     - Process point cloud

Response Formats
================

Success Response
----------------

.. code-block:: json

   {
     "id": "abc-123-def",
     "name": "Example Project",
     "created_at": "2026-01-15T10:30:00Z"
   }

Error Response
--------------

.. code-block:: json

   {
     "detail": "Project not found"
   }

.. code-block:: json

   {
     "detail": [
       {
         "loc": ["body", "email"],
         "msg": "field required",
         "type": "value_error.missing"
       }
     ]
   }

HTTP Status Codes
=================

.. list-table::
   :widths: 15 20 65
   :header-rows: 1

   * - Code
     - Status
     - Description
   * - ``200``
     - OK
     - Request successful
   * - ``201``
     - Created
     - Resource created successfully
   * - ``204``
     - No Content
     - Success, no response body
   * - ``400``
     - Bad Request
     - Invalid request data
   * - ``401``
     - Unauthorized
     - Missing or invalid token
   * - ``403``
     - Forbidden
     - Insufficient permissions
   * - ``404``
     - Not Found
     - Resource doesn't exist
   * - ``409``
     - Conflict
     - Resource already exists
   * - ``422``
     - Unprocessable Entity
     - Validation error
   * - ``500``
     - Internal Server Error
     - Server-side error

Rate Limiting
=============

.. warning::
   API endpoints are rate limited to prevent abuse.

Current Limits
--------------

.. list-table::
   :widths: 40 30 30
   :header-rows: 1

   * - Endpoint Type
     - Limit
     - Window
   * - Authentication
     - 10 requests
     - per minute
   * - Read Operations
     - 100 requests
     - per minute
   * - Write Operations
     - 50 requests
     - per minute
   * - File Uploads
     - 20 requests
     - per minute

Rate Limit Headers
------------------

.. code-block:: http

   X-RateLimit-Limit: 100
   X-RateLimit-Remaining: 95
   X-RateLimit-Reset: 1643125200

Pagination
==========

List endpoints support pagination:

Request Parameters
------------------

.. code-block:: http

   GET /api/notes/project/abc-123?limit=20&offset=40

.. list-table::
   :widths: 20 20 60
   :header-rows: 1

   * - Parameter
     - Type
     - Description
   * - ``limit``
     - integer
     - Number of items (default: 100, max: 500)
   * - ``offset``
     - integer
     - Number of items to skip (default: 0)

Response
--------

.. code-block:: json

   {
     "items": [...],
     "total": 150,
     "limit": 20,
     "offset": 40
   }

Filtering
=========

Many endpoints support filtering:

.. code-block:: http

   GET /api/files/project/abc-123?type=folder&parent_id=def-456

Common Filter Parameters
------------------------

.. list-table::
   :widths: 25 75
   :header-rows: 1

   * - Parameter
     - Description
   * - ``type``
     - Filter by resource type
   * - ``parent_id``
     - Filter by parent (for hierarchical data)
   * - ``created_after``
     - Filter by creation date
   * - ``updated_after``
     - Filter by update date
   * - ``author_id``
     - Filter by author

Sorting
=======

Control result ordering:

.. code-block:: http

   GET /api/notes/project/abc-123?sort_by=updated_at&order=desc

.. list-table::
   :widths: 25 75
   :header-rows: 1

   * - Parameter
     - Description
   * - ``sort_by``
     - Field to sort by (created_at, updated_at, name)
   * - ``order``
     - Sort direction (asc, desc)

CORS
====

The API supports CORS for browser-based clients.

Allowed Origins
---------------

Configure in ``.env``:

.. code-block:: bash

   ALLOWED_ORIGINS=http://localhost:8081,http://localhost:19006,https://app.stratum.com

Preflight Requests
------------------

.. code-block:: http

   OPTIONS /api/projects HTTP/1.1
   Origin: http://localhost:8081
   Access-Control-Request-Method: POST
   Access-Control-Request-Headers: authorization,content-type

Response:

.. code-block:: http

   HTTP/1.1 200 OK
   Access-Control-Allow-Origin: http://localhost:8081
   Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
   Access-Control-Allow-Headers: authorization,content-type
   Access-Control-Max-Age: 86400

API Versioning
==============

Current version: **v1** (implicit in all endpoints)

Future versions will use URL versioning:

.. code-block:: text

   /api/v2/projects

Breaking Changes
----------------

Breaking changes require a new API version. Non-breaking changes (additions) use the current version.

.. important::
   Always check the API version in production deployments.

Interactive Documentation
=========================

Swagger UI
----------

Available at: http://localhost:8000/docs

.. image:: https://img.shields.io/badge/Swagger-OpenAPI-green
   :alt: Swagger

Features:

- Try API calls directly from browser
- See request/response schemas
- Authentication testing
- Example values

ReDoc
-----

Available at: http://localhost:8000/redoc

Alternative documentation interface with:

- Clean, organized layout
- Code samples in multiple languages
- Searchable endpoints
- Download OpenAPI spec

OpenAPI Spec
------------

Download the machine-readable spec:

.. code-block:: bash

   curl http://localhost:8000/openapi.json > openapi.json

Client Libraries
================

Python
------

.. code-block:: python

   import requests

   API_URL = "http://localhost:8000/api"
   TOKEN = "your-firebase-token"

   headers = {
       "Authorization": f"Bearer {TOKEN}",
       "Content-Type": "application/json"
   }

   # Get projects
   response = requests.get(f"{API_URL}/projects", headers=headers)
   projects = response.json()

JavaScript/TypeScript
---------------------

.. code-block:: typescript

   const API_URL = "http://localhost:8000/api";
   const token = "your-firebase-token";

   const headers = {
     Authorization: `Bearer ${token}`,
     "Content-Type": "application/json",
   };

   // Get projects
   const response = await fetch(`${API_URL}/projects`, { headers });
   const projects = await response.json();

cURL
----

.. code-block:: bash

   curl -X GET "http://localhost:8000/api/projects" \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json"

Best Practices
==============

.. tip::
   Follow these best practices for optimal API usage:

1. **Authentication**

   - Refresh tokens before they expire
   - Store tokens securely
   - Never commit tokens to version control

2. **Error Handling**

   - Always check HTTP status codes
   - Parse error response details
   - Implement retry logic for transient errors

3. **Performance**

   - Use pagination for large datasets
   - Cache responses when appropriate
   - Minimize unnecessary requests

4. **Security**

   - Use HTTPS in production
   - Validate all user inputs
   - Never expose sensitive data in URLs

Next Steps
==========

Explore specific API documentation:

- :doc:`authentication` - User authentication
- :doc:`projects` - Project management
- :doc:`notes` - Note operations
- :doc:`files` - File management
- :doc:`forms` - Archaeological forms
- :doc:`websockets` - Real-time updates

.. seealso::
   - :doc:`../architecture` for system design
   - :doc:`../database-schema` for data models
   - :doc:`../development` for contributing
