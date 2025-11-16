# Getting Started with STRATUM 🚀

Welcome to STRATUM! This guide will help you get up and running in about **15 minutes**. ⏱️

---

## 📋 Prerequisites Checklist

Before diving in, make sure you have these installed:

- [ ] **Python 3.9+** ([Download](https://www.python.org/downloads/))
- [ ] **Node.js 18+** and npm ([Download](https://nodejs.org/))
- [ ] **PostgreSQL 14+** ([Download](https://www.postgresql.org/download/))
- [ ] **Docker** ([Download](https://www.docker.com/get-started))
- [ ] **Git** ([Download](https://git-scm.com/downloads))
- [ ] **Firebase Account** ([Sign up](https://firebase.google.com/))

> 💡 **Tip**: If you're on macOS, we recommend using [Homebrew](https://brew.sh/) to install these tools!

---

## 🎯 Quick Setup (TL;DR)

For those who just want to dive in:

```bash
# Clone the repo
git clone https://github.com/PzmuV1517/QuantumBitsFLL2025-2026.git
cd QuantumBitsFLL2025-2026

# Backend setup
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
createdb stratum_db
cp .env.example .env
# Edit .env with your credentials
python -m uvicorn app.main:app --reload

# Frontend setup (new terminal)
cd frontend/stratum-app
npm install
cp .env.example .env
# Edit .env with your credentials
npm start
```

For detailed instructions, continue reading! 📖

---

## 📦 Step 1: Clone the Repository

First, let's get the code:

```bash
git clone https://github.com/PzmuV1517/QuantumBitsFLL2025-2026.git
cd QuantumBitsFLL2025-2026
```

Take a moment to explore the structure:
```
QuantumBitsFLL2025-2026/
├── backend/          # FastAPI server
├── frontend/         # React Native app
├── resources/        # Documentation assets
└── wiki/            # This documentation!
```

---

## 🔥 Step 2: Firebase Setup

Firebase handles our authentication. Let's set it up first since both backend and frontend need it.

### 2.1 Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **"Add project"**
3. Name it something like "STRATUM-Dev"
4. Follow the prompts (you can disable Google Analytics for dev)

### 2.2 Enable Email Authentication

1. In your Firebase project, go to **Authentication**
2. Click **"Get started"**
3. Go to **"Sign-in method"** tab
4. Enable **"Email/Password"**
5. Click **"Save"**

### 2.3 Get Backend Credentials (Service Account)

1. Click the ⚙️ gear icon → **"Project settings"**
2. Go to **"Service Accounts"** tab
3. Click **"Generate new private key"**
4. Download the JSON file
5. **Keep this file safe!** We'll use it in Step 3.

### 2.4 Get Frontend Credentials (Web App)

1. Still in **"Project settings"**, go to **"General"** tab
2. Scroll to **"Your apps"** section
3. Click the **"</>  Web"** icon
4. Register app with nickname "STRATUM Web"
5. **Copy the config** - we'll use it in Step 4!

---

## 🐍 Step 3: Backend Setup

Time to get the API server running!

### 3.1 Set Up Python Environment

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
```

You should see `(venv)` in your terminal prompt.

### 3.2 Install Dependencies

```bash
pip install -r requirements.txt
```

☕ This might take a minute or two.

### 3.3 Set Up PostgreSQL Database

Create the database:
```bash
createdb stratum_db
```

If you need a user/password:
```bash
createuser stratum_user -P  # Will prompt for password
createdb -O stratum_user stratum_db
```

### 3.4 Set Up MinIO (Docker)

MinIO stores files (photos, documents, etc.):

```bash
docker run -d -p 9000:9000 -p 9001:9001 \
  --name stratum-minio \
  -e "MINIO_ROOT_USER=minioadmin" \
  -e "MINIO_ROOT_PASSWORD=minioadmin" \
  minio/minio server /data --console-address ":9001"
```

Check it's running: visit [http://localhost:9001](http://localhost:9001)
- Username: `minioadmin`
- Password: `minioadmin`

### 3.5 Configure Environment Variables

```bash
cp .env.example .env
nano .env  # or use your favorite editor
```

Fill in these critical values using the Firebase JSON from Step 2.3:

```env
# From Firebase service account JSON
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_CLIENT_ID=123456789012345678901

# Database (adjust if you used different credentials)
DATABASE_URL=postgresql://stratum_user:yourpassword@localhost:5432/stratum_db

# MinIO
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET_NAME=stratum-files

# App secret (generate a random one!)
APP_SECRET_KEY=your-super-secret-random-key-here

# CORS (add more as needed)
ALLOWED_ORIGINS=http://localhost:19006,http://localhost:8081
```

> 🔐 **Security Note**: For `APP_SECRET_KEY`, generate a secure random string:
> ```bash
> python -c "import secrets; print(secrets.token_urlsafe(32))"
> ```

### 3.6 Start the Backend

```bash
python -m uvicorn app.main:app --reload
```

You should see:
```
INFO:     Uvicorn running on http://127.0.0.1:8000
INFO:     Application startup complete.
```

🎉 **Success!** Visit [http://localhost:8000/docs](http://localhost:8000/docs) to see the API documentation.

---

## ⚛️ Step 4: Frontend Setup

Open a **new terminal** (keep the backend running!) and let's set up the mobile app.

### 4.1 Install Dependencies

```bash
cd frontend/stratum-app
npm install
```

☕ This will take a few minutes. Great time for a coffee break!

### 4.2 Configure Environment Variables

```bash
cp .env.example .env
nano .env
```

Fill in using the Firebase web config from Step 2.4:

```env
# API
API_BASE_URL=http://localhost:8000/api

# Firebase (from web app config)
FIREBASE_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_STORAGE_BUCKET=your-project.appspot.com
FIREBASE_MESSAGING_SENDER_ID=123456789012
FIREBASE_APP_ID=1:123456789012:web:abcdef0123456789abcdef
```

### 4.3 Update app.json

Edit `app.json` and update the `extra` section with the same Firebase values:

```json
{
  "expo": {
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

### 4.4 Start the Frontend

```bash
npm start
```

You'll see a QR code and some options:

```
› Press w │ open web
› Press a │ open Android
› Press i │ open iOS
```

#### For Web Development
Press `w` and your browser will open with the app!

#### For iOS (Mac only)
Press `i` and the iOS Simulator will launch.

#### For Android
Press `a` and the Android Emulator will launch.

#### For Physical Device
Install **Expo Go** app on your phone and scan the QR code!

---

## 🎮 Step 5: Your First Project

Now let's test everything works!

### 5.1 Create an Account

1. On the login screen, tap **"Don't have an account? Sign up"**
2. Enter your email and password
3. Tap **"Register"**

### 5.2 Create a Project

1. You'll see the Projects screen (currently empty)
2. Tap the **"+"** button
3. Fill in project details:
   - **Name**: "Test Excavation Site"
   - **Description**: "My first STRATUM project!"
   - **Location**: "Testing grounds"
4. Tap **"Create"**

🎉 **Congratulations!** You've created your first archaeological project!

### 5.3 Explore the Features

Try these out:
- ✏️ Create a note in your project
- 📸 Add a photo to a note
- 📂 Upload a file through the Files tab
- 🖼️ View files in the Gallery
- 👥 Invite a team member (use another email)

---

## 🔍 Verify Everything Works

Quick checklist to make sure everything is running:

### Backend Health Check
```bash
curl http://localhost:8000/health
```
Should return: `{"status":"healthy"}`

### Database Check
```bash
psql stratum_db -c "SELECT * FROM users LIMIT 1;"
```
Should show your user account!

### MinIO Check
Visit [http://localhost:9001](http://localhost:9001) and check for the `stratum-files` bucket.

### Frontend Check
- [ ] Can register a new account
- [ ] Can login
- [ ] Can see projects screen
- [ ] Can create a project

---

## 🐛 Something Not Working?

Don't worry! Check our [Troubleshooting Guide](Troubleshooting) for common issues:

- [Backend won't start](Troubleshooting#backend-issues)
- [Frontend can't connect to API](Troubleshooting#frontend-issues)
- [Firebase authentication errors](Troubleshooting#firebase-issues)
- [Database connection errors](Troubleshooting#database-issues)

---

## 📚 What's Next?

Now that you're set up, explore more:

- 📖 [Understanding STRATUM's Architecture](Architecture-Overview)
- ✨ [Learn about all Features](Features-Documentation)
- 👨‍💻 [Start Contributing](Development-Guide)
- 🔌 [Explore the API](API-Reference)

---

## 💡 Pro Tips

### For Development
- Use `--reload` flag on backend for auto-reload on code changes
- Use `npx expo start --clear` if you get caching issues
- Keep both terminals open side-by-side

### For Physical Device Testing
Replace `localhost` in `API_BASE_URL` with your computer's local IP:
```env
# Find your IP: ifconfig (Mac/Linux) or ipconfig (Windows)
API_BASE_URL=http://192.168.1.100:8000/api
```

### Quick Restart Commands
```bash
# Backend
cd backend && source venv/bin/activate && python -m uvicorn app.main:app --reload

# Frontend
cd frontend/stratum-app && npm start
```

---

<div align="center">

**You're all set! Time to revolutionize archaeology! 🏺✨**

[Back to Home](Home) | [View Features →](Features-Documentation)

</div>
