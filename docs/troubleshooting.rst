============================
Troubleshooting
============================

Common issues and solutions.

.. seealso::
   **Need help understanding error messages?** The :doc:`legend <legend>` explains technical terms and error codes.

.. contents:: Table of Contents
   :local:
   :depth: 2

Backend Issues
==============

Database Connection Error
--------------------------

**Symptom:** ``FATAL: database "stratum" does not exist``

**Solution:**

.. code-block:: bash

   # Create database
   createdb stratum
   
   # Run migrations
   alembic upgrade head

Port Already in Use
-------------------

**Symptom:** ``Error: Address already in use: 8000``

**Solution:**

.. code-block:: bash

   # Find process
   lsof -i :8000
   
   # Kill process
   kill -9 <PID>

Frontend Issues
===============

Module Not Found
----------------

**Solution:**

.. code-block:: bash

   rm -rf node_modules package-lock.json
   npm install

Cannot Connect to Backend
--------------------------

**Check:**

1. Backend is running: ``curl http://localhost:8000``
2. Correct API URL in ``.env``
3. CORS origins configured
4. Firewall not blocking

.. seealso::
   :doc:`installation <installation>` for setup instructions
