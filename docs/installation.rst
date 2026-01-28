============================
Installation & Setup
============================

This guide will walk you through setting up STRATUM for development or production use.

Prerequisites
=============

Before you begin, ensure you have the following installed:

Backend Requirements
--------------------

* **Python 3.13+**
* **PostgreSQL 14+**
* **Docker & Docker Compose** (for MinIO)
* **Git**

Frontend Requirements
---------------------

* **Node.js 18+** and **npm**
* **Expo CLI**: ``npm install -g @expo/cli``
* For iOS development: **Xcode** (macOS only)
* For Android development: **Android Studio**

Quick Start
===========

.. code-block:: bash

   # Clone the repository
   git clone https://github.com/your-org/QuantumBitsFLL2025-2026.git
   cd QuantumBitsFLL2025-2026

Backend Setup
=============

1. Navigate to Backend Directory
---------------------------------

.. code-block:: bash

   cd backend

2. Set Up Python Environment
-----------------------------

.. code-block:: bash

   # Create virtual environment
   python -m venv venv
   
   # Activate virtual environment
   # On macOS/Linux:
   source venv/bin/activate
   # On Windows:
   venv\\Scripts\\activate
   
   # Install dependencies
   pip install -r requirements.txt

3. Configure Environment Variables
-----------------------------------

Create a ``.env`` file in the ``backend/`` directory:

.. code-block:: bash

   # Database
   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/stratum
   
   # MinIO (S3-compatible object storage)
   MINIO_ENDPOINT=localhost:9000
   MINIO_ACCESS_KEY=minioadmin
   MINIO_SECRET_KEY=minioadmin
   MINIO_BUCKET_NAME=stratum-files
   MINIO_USE_SSL=false
   
   # Firebase Admin SDK
   FIREBASE_PROJECT_ID=your-firebase-project-id
   FIREBASE_CREDENTIALS_PATH=/path/to/serviceAccountKey.json
   
   # App Settings
   APP_DEBUG=true
   APP_HOST=0.0.0.0
   APP_PORT=8000
   ALLOWED_ORIGINS=http://localhost:8081,http://localhost:19006
   
   # Security
   SECRET_KEY=your-secret-key-here-change-in-production
   
   # Environment
   ENVIRONMENT=development

4. Start PostgreSQL
--------------------

If you don't have PostgreSQL installed locally:

.. code-block:: bash

   # Using Docker
   docker run --name stratum-postgres \\
     -e POSTGRES_PASSWORD=postgres \\
     -e POSTGRES_DB=stratum \\
     -p 5432:5432 \\
     -d postgres:14

5. Start MinIO
--------------

.. code-block:: bash

   # Using Docker Compose (recommended)
   docker-compose up -d
   
   # Or manually with Docker
   docker run -p 9000:9000 -p 9001:9001 \\
     --name stratum-minio \\
     -e "MINIO_ROOT_USER=minioadmin" \\
     -e "MINIO_ROOT_PASSWORD=minioadmin" \\
     quay.io/minio/minio server /data --console-address ":9001"

Access MinIO Console at http://localhost:9001

6. Run Database Migrations
---------------------------

.. code-block:: bash

   # Apply all migrations
   alembic upgrade head
   
   # Check migration status
   alembic current
   
   # View migration history
   alembic history

7. Start the Backend Server
----------------------------

.. code-block:: bash

   # Development mode with auto-reload
   python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   
   # Or using Make
   make run

The API will be available at http://localhost:8000

API documentation: http://localhost:8000/docs

Frontend Setup
==============

1. Navigate to Frontend Directory
----------------------------------

.. code-block:: bash

   cd frontend/stratum-app

2. Install Dependencies
-----------------------

.. code-block:: bash

   npm install

3. Configure Environment
------------------------

Create a ``.env`` file in ``frontend/stratum-app/``:

.. code-block:: bash

   EXPO_PUBLIC_API_URL=http://localhost:8000/api
   EXPO_PUBLIC_WS_URL=http://localhost:8000
   
   # Firebase Configuration (from Firebase Console)
   EXPO_PUBLIC_FIREBASE_API_KEY=your-api-key
   EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   EXPO_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
   EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
   EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
   EXPO_PUBLIC_FIREBASE_APP_ID=your-app-id

4. Start the Development Server
--------------------------------

.. code-block:: bash

   # Start Expo dev server
   npm start
   
   # Or specific platforms
   npm run ios      # iOS simulator
   npm run android  # Android emulator
   npm run web      # Web browser

5. Running on Devices
---------------------

**iOS Simulator (macOS only)**

Press ``i`` in the terminal or run:

.. code-block:: bash

   npm run ios

**Android Emulator**

Press ``a`` in the terminal or run:

.. code-block:: bash

   npm run android

**Physical Device**

1. Install **Expo Go** from App Store/Google Play
2. Scan the QR code shown in the terminal
3. App will load on your device

**Web Browser**

Press ``w`` in the terminal or run:

.. code-block:: bash

   npm run web

Firebase Setup
==============

1. Create Firebase Project
---------------------------

1. Go to https://console.firebase.google.com/
2. Create a new project
3. Enable **Authentication** → **Email/Password**
4. Generate a service account key:
   
   * Project Settings → Service Accounts
   * Generate new private key
   * Download JSON file
   * Save as ``serviceAccountKey.json`` in backend directory

2. Configure Firebase in Frontend
----------------------------------

Get your Firebase config from:

* Project Settings → General → Your apps → Web app

Add the configuration values to your frontend ``.env`` file.

Database Migrations
===================

Creating New Migrations
-----------------------

After modifying models in ``backend/app/models.py``:

.. code-block:: bash

   cd backend
   alembic revision --autogenerate -m "Description of changes"
   alembic upgrade head

Migration Commands
------------------

.. code-block:: bash

   # Upgrade to latest
   alembic upgrade head
   
   # Upgrade one step
   alembic upgrade +1
   
   # Downgrade one step
   alembic downgrade -1
   
   # Downgrade to base
   alembic downgrade base
   
   # View current version
   alembic current
   
   # View history
   alembic history --verbose

Verification
============

Check Backend Status
--------------------

.. code-block:: bash

   # Test API health
   curl http://localhost:8000/api/auth/me
   
   # View API documentation
   open http://localhost:8000/docs

Check Frontend Status
---------------------

1. Open the app in your emulator/browser
2. Create an account
3. Login and create a test project
4. Verify all features are working

Troubleshooting
===============

Backend Issues
--------------

**Port Already in Use**

.. code-block:: bash

   # Find process using port 8000
   lsof -i :8000
   
   # Kill the process
   kill -9 <PID>

**Database Connection Error**

* Verify PostgreSQL is running: ``pg_isready``
* Check DATABASE_URL in ``.env``
* Ensure database exists: ``psql -l``

**MinIO Connection Error**

* Check if MinIO is running: ``docker ps``
* Access MinIO console: http://localhost:9001
* Verify credentials in ``.env``

Frontend Issues
---------------

**Module Not Found**

.. code-block:: bash

   # Clear cache and reinstall
   rm -rf node_modules package-lock.json
   npm install
   npm start -- --clear

**Expo CLI Issues**

.. code-block:: bash

   # Reinstall Expo CLI
   npm uninstall -g @expo/cli
   npm install -g @expo/cli

**Cannot Connect to Backend**

* Ensure backend is running on correct port
* Check EXPO_PUBLIC_API_URL in ``.env``
* For physical devices, use your computer's IP address instead of localhost

Next Steps
==========

* Read the :doc:`quickstart` guide
* Explore :doc:`features` documentation
* Review :doc:`api/overview` for API details
* Check out :doc:`development` for contribution guidelines
