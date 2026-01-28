# Installation & Setup Guide 🔧

This comprehensive guide covers installation and configuration in detail. For a quicker start, check out the [Getting Started](Getting-Started) guide.

---

## 📋 System Requirements

### Minimum Requirements
- **OS**: Windows 10+, macOS 10.15+, or Linux (Ubuntu 20.04+)
- **RAM**: 8GB
- **Storage**: 5GB free space
- **Network**: Stable internet connection for initial setup

### Recommended Requirements
- **RAM**: 16GB
- **Storage**: 10GB+ free space
- **CPU**: 4+ cores for faster builds

---

## 🛠 Installing Prerequisites

### macOS

Using [Homebrew](https://brew.sh/) (recommended):

```bash
# Install Homebrew first
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install prerequisites
brew install python@3.11 node postgresql git
brew install --cask docker

# Verify installations
python3 --version  # Should be 3.9+
node --version     # Should be 18+
psql --version     # Should be 14+
```

### Windows

1. **Python**: Download from [python.org](https://www.python.org/downloads/)
   - ✅ Check "Add Python to PATH" during installation

2. **Node.js**: Download from [nodejs.org](https://nodejs.org/)
   - Choose the LTS version

3. **PostgreSQL**: Download from [postgresql.org](https://www.postgresql.org/download/windows/)
   - Use the installer wizard
   - Remember the password you set!

4. **Docker Desktop**: Download from [docker.com](https://www.docker.com/products/docker-desktop)

5. **Git**: Download from [git-scm.com](https://git-scm.com/download/win)

### Linux (Ubuntu/Debian)

```bash
# Update package list
sudo apt update

# Install prerequisites
sudo apt install -y python3 python3-pip python3-venv nodejs npm postgresql postgresql-contrib git

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER  # Add yourself to docker group

# Install Node.js 18+ (if repository version is too old)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installations
python3 --version
node --version
psql --version
```

---

## 🔥 Firebase Configuration

Firebase provides authentication for STRATUM. Here's the complete setup process.

### Step 1: Create Firebase Project

1. Visit [Firebase Console](https://console.firebase.google.com/)
2. Click **"Add project"** or **"Create a project"**
3. Enter project name: `stratum-dev` (or your preferred name)
4. Click **"Continue"**
5. Disable Google Analytics (optional for development)
6. Click **"Create project"**
7. Wait for setup to complete, then click **"Continue"**

### Step 2: Enable Email/Password Authentication

1. In Firebase Console, click **"Authentication"** in sidebar
2. Click **"Get started"** button
3. Navigate to **"Sign-in method"** tab
4. Find **"Email/Password"** in the list
5. Click on it to expand
6. Toggle **"Enable"** switch
7. Click **"Save"**

> 📧 **Note**: You can also enable "Email link (passwordless sign-in)" if desired, but it's not required.

### Step 3: Backend Credentials (Service Account)

The backend needs admin access to verify user tokens:

1. Click the ⚙️ **gear icon** → **"Project settings"**
2. Navigate to **"Service Accounts"** tab
3. Make sure **"Firebase Admin SDK"** is selected
4. Click **"Generate new private key"** button
5. Confirm by clicking **"Generate key"**
6. A JSON file will download - **save it securely!**

The JSON file contains:
```json
{
  "type": "service_account",
  "project_id": "your-project-id",
  "private_key_id": "abc123...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com",
  "client_id": "123456789012345678901",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/..."
}
```

### Step 4: Frontend Credentials (Web App)

The frontend needs web credentials for client-side authentication:

1. Still in **"Project settings"**, go to **"General"** tab
2. Scroll down to **"Your apps"** section
3. If no web app exists, click **"Add app"** → choose **"Web"** icon **</>**
4. Enter nickname: `STRATUM Web`
5. **Do NOT** check "Also set up Firebase Hosting"
6. Click **"Register app"**
7. Copy the config object that appears:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef0123456789abcdef"
};
```

8. Click **"Continue to console"**

### Verify Firebase Setup

✅ Authentication should now show:
- Email/Password: **Enabled**
- Users: 0 (we'll add some soon!)

---

## 🗄 Database Setup

### PostgreSQL Installation Verification

Check PostgreSQL is running:

```bash
# macOS
brew services list | grep postgresql

# Linux
sudo systemctl status postgresql

# Windows
# Check Services app for "postgresql"
```

### Create Database and User

#### Method 1: Using psql (Recommended)

```bash
# Connect to PostgreSQL
psql -U postgres  # Windows/Linux might need: sudo -u postgres psql

# In psql prompt:
CREATE USER stratum_user WITH PASSWORD 'your_secure_password_here';
CREATE DATABASE stratum_db OWNER stratum_user;
GRANT ALL PRIVILEGES ON DATABASE stratum_db TO stratum_user;

# Verify
\l  # List databases (should show stratum_db)
\q  # Quit
```

#### Method 2: Command Line

```bash
# Create user
createuser -U postgres -P stratum_user  # Will prompt for password

# Create database
createdb -U postgres -O stratum_user stratum_db

# Verify
psql -U stratum_user -d stratum_db -c "SELECT version();"
```

### Database Connection String

Your `DATABASE_URL` will look like:
```
postgresql://stratum_user:your_password@localhost:5432/stratum_db
```

Components:
- `postgresql://` - Protocol
- `stratum_user` - Username
- `your_password` - Password
- `localhost` - Host (use `127.0.0.1` if localhost doesn't work)
- `5432` - Port (PostgreSQL default)
- `stratum_db` - Database name

---

## 📦 MinIO Object Storage Setup

MinIO stores files (photos, documents, uploads). We'll use Docker for easy setup.

### Start MinIO Container

```bash
docker run -d \
  --name stratum-minio \
  -p 9000:9000 \
  -p 9001:9001 \
  -e "MINIO_ROOT_USER=minioadmin" \
  -e "MINIO_ROOT_PASSWORD=minioadmin" \
  -v minio-data:/data \
  minio/minio server /data --console-address ":9001"
```

**What this does:**
- `-d` - Run in background
- `--name stratum-minio` - Container name
- `-p 9000:9000` - API port
- `-p 9001:9001` - Web console port
- `-e` - Environment variables for credentials
- `-v` - Persistent volume for data
- `--console-address ":9001"` - Web UI port

### Verify MinIO is Running

```bash
docker ps | grep minio
```

Should show the running container.

### Access MinIO Console

1. Open browser: [http://localhost:9001](http://localhost:9001)
2. Login with:
   - **Username**: `minioadmin`
   - **Password**: `minioadmin`

### Create Bucket (Optional - Backend does this automatically)

The backend will create the `stratum-files` bucket on first run, but you can create it manually:

1. In MinIO Console, click **"Buckets"**
2. Click **"Create Bucket"**
3. Name: `stratum-files`
4. Click **"Create Bucket"**

---

## 🐍 Backend Setup

### Clone Repository

```bash
git clone https://github.com/PzmuV1517/QuantumBitsFLL2025-2026.git
cd QuantumBitsFLL2025-2026/backend
```

### Create Virtual Environment

```bash
# Create venv
python3 -m venv venv

# Activate it
# macOS/Linux:
source venv/bin/activate
# Windows:
venv\Scripts\activate
```

You should see `(venv)` in your prompt.

### Install Python Dependencies

```bash
pip install --upgrade pip  # Update pip first
pip install -r requirements.txt
```

Dependencies include:
- FastAPI - Web framework
- SQLAlchemy - Database ORM
- Psycopg2 - PostgreSQL adapter
- Minio - Object storage client
- Firebase-admin - Authentication
- Pydantic - Data validation
- Uvicorn - ASGI server

### Environment Setup

```bash
cp .env.example .env
```

Edit `.env` with your favorite editor:

```bash
nano .env
# or
code .env  # VS Code
# or
vim .env
```

**Complete .env configuration:**

```env
# ===== FIREBASE CONFIGURATION =====
# Copy from service account JSON file
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY_ID=abc123def456...
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYourKeyHere\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_CLIENT_ID=123456789012345678901
FIREBASE_AUTH_URI=https://accounts.google.com/o/oauth2/auth
FIREBASE_TOKEN_URI=https://oauth2.googleapis.com/token
FIREBASE_AUTH_PROVIDER_CERT_URL=https://www.googleapis.com/oauth2/v1/certs
FIREBASE_CLIENT_CERT_URL=https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-xxxxx%40your-project.iam.gserviceaccount.com

# ===== DATABASE CONFIGURATION =====
POSTGRES_USER=stratum_user
POSTGRES_PASSWORD=your_secure_password_here
POSTGRES_DB=stratum_db
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
DATABASE_URL=postgresql://stratum_user:your_secure_password_here@localhost:5432/stratum_db

# ===== MINIO CONFIGURATION =====
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET_NAME=stratum-files
MINIO_USE_SSL=false

# ===== APPLICATION CONFIGURATION =====
# Generate with: python -c "import secrets; print(secrets.token_urlsafe(32))"
APP_SECRET_KEY=REPLACE_WITH_RANDOM_SECRET

APP_DEBUG=True
APP_HOST=0.0.0.0
APP_PORT=8000

# Frontend URLs (add your development URLs)
ALLOWED_ORIGINS=http://localhost:19006,http://localhost:8081,http://localhost:3000

# Environment
ENVIRONMENT=development
```

### Generate Secret Key

```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

Copy the output into `APP_SECRET_KEY`.

### Initialize Database

The backend automatically creates tables on first run. Start the server:

```bash
python -m uvicorn app.main:app --reload
```

You should see:
```
INFO:     Will watch for changes in these directories: ['/path/to/backend']
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
INFO:     Started reloader process [12345] using StatReload
INFO:     Started server process [12346]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
```

### Test Backend

Visit these URLs:
- [http://localhost:8000/](http://localhost:8000/) - Should show `{"message": "STRATUM API"}`
- [http://localhost:8000/docs](http://localhost:8000/docs) - Interactive API documentation
- [http://localhost:8000/health](http://localhost:8000/health) - Health check

---

## ⚛️ Frontend Setup

Open a **new terminal** window (keep backend running).

### Navigate to Frontend

```bash
cd frontend/stratum-app
```

### Install Dependencies

```bash
npm install
```

This installs:
- Expo SDK
- React Native
- React Navigation
- Axios (API client)
- Firebase SDK
- UI components

### Environment Configuration

```bash
cp .env.example .env
```

Edit `.env`:

```env
# ===== API CONFIGURATION =====
# Use localhost for iOS Simulator and web
API_BASE_URL=http://localhost:8000/api

# For Android Emulator, use:
# API_BASE_URL=http://10.0.2.2:8000/api

# For physical device, use your computer's IP:
# API_BASE_URL=http://192.168.1.100:8000/api

# ===== FIREBASE WEB CONFIGURATION =====
# Copy from Firebase Console → Project Settings → General → Your apps → Web
FIREBASE_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_STORAGE_BUCKET=your-project.appspot.com
FIREBASE_MESSAGING_SENDER_ID=123456789012
FIREBASE_APP_ID=1:123456789012:web:abcdef0123456789abcdef

# ===== APP CONFIGURATION =====
APP_NAME=STRATUM
APP_VERSION=1.0.0
```

### Update app.json

Edit `app.json` and update the `extra` section:

```json
{
  "expo": {
    "name": "STRATUM",
    "slug": "stratum-app",
    "version": "1.0.0",
    "extra": {
      "apiBaseUrl": "http://localhost:8000/api",
      "firebaseApiKey": "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
      "firebaseAuthDomain": "your-project.firebaseapp.com",
      "firebaseProjectId": "your-project-id",
      "firebaseStorageBucket": "your-project.appspot.com",
      "firebaseMessagingSenderId": "123456789012",
      "firebaseAppId": "1:123456789012:web:abcdef0123456789abcdef"
    }
  }
}
```

### Start Development Server

```bash
npm start
```

Or for specific platforms:

```bash
# Web only
npm run web

# iOS (Mac only)
npm run ios

# Android
npm run android
```

### First Time Setup Notes

On first run, Expo will:
1. Check for updates
2. Start Metro bundler
3. Open Expo Dev Tools in browser
4. Generate QR code for mobile testing

---

## 📱 Platform-Specific Setup

### iOS Development (Mac Only)

**Prerequisites:**
```bash
# Install Xcode from App Store
# Install Xcode Command Line Tools
xcode-select --install

# Install CocoaPods
sudo gem install cocoapods
```

**Run on Simulator:**
```bash
npm run ios
```

### Android Development

**Prerequisites:**
1. Install [Android Studio](https://developer.android.com/studio)
2. Install Android SDK (via Android Studio)
3. Create an emulator (AVD Manager in Android Studio)

**Environment Setup:**
```bash
# Add to ~/.bashrc or ~/.zshrc
export ANDROID_HOME=$HOME/Android/Sdk
export PATH=$PATH:$ANDROID_HOME/emulator
export PATH=$PATH:$ANDROID_HOME/platform-tools
```

**Run on Emulator:**
```bash
npm run android
```

### Physical Device Testing

**Install Expo Go:**
- [iOS App Store](https://apps.apple.com/app/expo-go/id982107779)
- [Google Play Store](https://play.google.com/store/apps/details?id=host.exp.exponent)

**Connect Device:**
1. Ensure device and computer on same WiFi
2. Open Expo Go app
3. Scan QR code from terminal
4. App will load!

**Troubleshooting Device Connection:**
- Update `API_BASE_URL` to your computer's local IP
- Check firewall isn't blocking ports 8000, 8081, 19000-19006

---

## ✅ Verification Checklist

### Backend Verification

```bash
# Health check
curl http://localhost:8000/health
# Expected: {"status":"healthy"}

# API docs
open http://localhost:8000/docs

# Database connection
psql -U stratum_user -d stratum_db -c "SELECT COUNT(*) FROM users;"

# MinIO access
open http://localhost:9001
```

### Frontend Verification

- [ ] Can open app (web/simulator/device)
- [ ] Can see login screen
- [ ] No console errors in terminal
- [ ] API_BASE_URL is correct for platform

### Integration Verification

- [ ] Can register new user (tests Firebase + Backend)
- [ ] User appears in Firebase Console → Authentication
- [ ] User appears in database: `SELECT * FROM users;`
- [ ] Can login after registering
- [ ] Can create a project
- [ ] Project appears in database: `SELECT * FROM projects;`

---

## 🎯 Next Steps

✅ **Setup Complete!** You're ready to:

- 📖 [Explore Features](Features-Documentation)
- 🏗️ [Learn the Architecture](Architecture-Overview)
- 👨‍💻 [Start Developing](Development-Guide)
- 🔌 [Use the API](API-Reference)

---

## 🆘 Need Help?

- [Troubleshooting Guide](Troubleshooting)
- [FAQ](FAQ)
- [GitHub Issues](https://github.com/PzmuV1517/QuantumBitsFLL2025-2026/issues)

---

<div align="center">

[← Back to Getting Started](Getting-Started) | [Continue to Architecture Overview →](Architecture-Overview)

</div>
