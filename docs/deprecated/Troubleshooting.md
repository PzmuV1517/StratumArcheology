# Troubleshooting 🔧

Having issues? This guide covers common problems and their solutions.

---

## 🎯 Quick Diagnostics

Run these checks first to identify the problem area:

```bash
# Backend health
curl http://localhost:8000/health

# Database connection
psql -U stratum_user -d stratum_db -c "SELECT 1;"

# MinIO status
docker ps | grep minio

# Frontend build
cd frontend/stratum-app && npm run type-check
```

---

## 🐍 Backend Issues

### 1. Backend Won't Start

**Error:** `ModuleNotFoundError: No module named 'fastapi'`

**Solution:**
```bash
cd backend
source venv/bin/activate  # Make sure venv is activated!
pip install -r requirements.txt
```

---

**Error:** `connection to server at "localhost" (::1), port 5432 failed`

**Solution:**
```bash
# Check PostgreSQL is running
# macOS:
brew services list
brew services start postgresql

# Linux:
sudo systemctl status postgresql
sudo systemctl start postgresql

# Windows:
# Check Services app for postgresql service
```

---

**Error:** `firebase_admin.exceptions.InvalidArgumentError: Credential error`

**Solution:**
1. Check `.env` file has all Firebase variables
2. Ensure `FIREBASE_PRIVATE_KEY` has proper escaping:
   ```env
   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYourKey\n-----END PRIVATE KEY-----\n"
   ```
3. Verify the Firebase service account JSON is correct

---

### 2. Database Connection Errors

**Error:** `FATAL: password authentication failed`

**Solution:**
```bash
# Reset PostgreSQL password
psql -U postgres
ALTER USER stratum_user WITH PASSWORD 'newpassword';
\q

# Update DATABASE_URL in .env
DATABASE_URL=postgresql://stratum_user:newpassword@localhost:5432/stratum_db
```

---

**Error:** `database "stratum_db" does not exist`

**Solution:**
```bash
# Create the database
createdb stratum_db

# Or with specific owner:
createdb -O stratum_user stratum_db
```

---

**Error:** `relation "users" does not exist`

**Solution:**
```python
# Tables aren't created yet
# Start the backend and it will auto-create tables:
python -m uvicorn app.main:app --reload

# Or manually create with Python:
from app.database import engine, Base
from app.models import *
Base.metadata.create_all(bind=engine)
```

---

### 3. MinIO Connection Issues

**Error:** `S3 Error: Connection refused`

**Solution:**
```bash
# Check MinIO is running
docker ps | grep minio

# If not running, start it:
docker start stratum-minio

# Or create new container:
docker run -d -p 9000:9000 -p 9001:9001 \
  --name stratum-minio \
  -e "MINIO_ROOT_USER=minioadmin" \
  -e "MINIO_ROOT_PASSWORD=minioadmin" \
  minio/minio server /data --console-address ":9001"
```

---

**Error:** `The specified bucket does not exist`

**Solution:**
```bash
# The backend should auto-create the bucket
# If not, create it manually:
# 1. Visit http://localhost:9001
# 2. Login (minioadmin/minioadmin)
# 3. Create bucket named "stratum-files"
```

---

### 4. Authentication Errors

**Error:** `401 Unauthorized` or `Not authenticated`

**Solution:**
- Check Firebase token is being sent in Authorization header
- Token might be expired - refresh it:
  ```javascript
  const token = await user.getIdToken(true); // force refresh
  ```
- Verify Firebase credentials in backend `.env`

---

**Error:** `Firebase ID token has expired`

**Solution:**
```javascript
// Frontend - refresh token before API calls
const getValidToken = async () => {
  const user = auth.currentUser;
  if (!user) throw new Error('Not logged in');
  return await user.getIdToken(true); // Force refresh
};
```

---

## 📱 Frontend Issues

### 1. Frontend Won't Start

**Error:** `Cannot find module 'expo'`

**Solution:**
```bash
cd frontend/stratum-app
rm -rf node_modules package-lock.json
npm install
```

---

**Error:** `Metro bundler error: Unable to resolve module`

**Solution:**
```bash
# Clear cache and restart
npx expo start --clear

# If still failing, reinstall dependencies
rm -rf node_modules
npm install
```

---

### 2. Network/API Connection Issues

**Error:** `Network request failed` or `ERR_CONNECTION_REFUSED`

**Solution:**

**For iOS Simulator / Web:**
```env
# .env
API_BASE_URL=http://localhost:8000/api
```

**For Android Emulator:**
```env
# .env
API_BASE_URL=http://10.0.2.2:8000/api
```

**For Physical Device:**
```bash
# Find your computer's IP
# macOS/Linux:
ifconfig | grep "inet "
# Windows:
ipconfig

# Update .env with your IP
API_BASE_URL=http://192.168.1.XXX:8000/api

# IMPORTANT: Also update backend ALLOWED_ORIGINS
# backend/.env
ALLOWED_ORIGINS=http://192.168.1.XXX:19006,http://192.168.1.XXX:8081
```

---

**Error:** `CORS policy: No 'Access-Control-Allow-Origin' header`

**Solution:**
```env
# backend/.env
# Add your frontend URL to ALLOWED_ORIGINS
ALLOWED_ORIGINS=http://localhost:19006,http://localhost:8081,http://localhost:3000
```

---

### 3. Firebase Issues

**Error:** `Firebase: Error (auth/invalid-email)`

**Solution:**
- Check email format is valid
- Email should not have spaces

---

**Error:** `Firebase: Error (auth/email-already-in-use)`

**Solution:**
- User already registered with this email
- Try logging in instead
- Or use password reset

---

**Error:** `Firebase: Error (auth/wrong-password)`

**Solution:**
- Check password is correct
- Use "Forgot Password" to reset

---

**Error:** `Firebase: Error (auth/user-not-found)`

**Solution:**
- User doesn't exist
- Register first

---

**Error:** `Firebase: Error (auth/network-request-failed)`

**Solution:**
- Check internet connection
- Check Firebase config in `.env` and `app.json`
- Verify Firebase project is active in Console

---

### 4. Build/Deployment Issues

**Error:** `Unable to resolve "@expo/vector-icons"`

**Solution:**
```bash
npm install @expo/vector-icons
npx expo install @expo/vector-icons
```

---

**Error:** Android build fails with `JAVA_HOME not set`

**Solution:**
```bash
# macOS/Linux
export JAVA_HOME=$(/usr/libexec/java_home)

# Add to ~/.bashrc or ~/.zshrc to make permanent
echo 'export JAVA_HOME=$(/usr/libexec/java_home)' >> ~/.zshrc
```

---

**Error:** iOS build fails - `CocoaPods not installed`

**Solution:**
```bash
# Install CocoaPods
sudo gem install cocoapods

# Install pods for project
cd ios
pod install
cd ..
```

---

## 🗄️ Database Issues

### 1. Migration Problems

**Error:** `relation already exists`

**Solution:**
```bash
# Drop and recreate database (WARNING: deletes all data!)
dropdb stratum_db
createdb stratum_db
# Restart backend to recreate tables
```

---

### 2. Data Integrity Issues

**Error:** `foreign key constraint fails`

**Solution:**
- You're trying to delete a record that others depend on
- Delete dependent records first, or use CASCADE

---

### 3. Performance Issues

**Problem:** Queries are slow

**Solution:**
```sql
-- Add indexes to frequently queried columns
CREATE INDEX idx_projects_owner ON projects(owner_id);
CREATE INDEX idx_notes_project ON notes(project_id);
CREATE INDEX idx_file_nodes_parent ON file_nodes(parent_id);

-- Analyze query performance
EXPLAIN ANALYZE SELECT * FROM projects WHERE owner_id = 1;
```

---

## 📦 File Upload Issues

### 1. Upload Fails

**Error:** `File too large`

**Solution:**
```python
# backend/app/main.py
# Increase max file size (default 1MB)
from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# Add this:
app.add_middleware(
    CORSMiddleware,
    max_age=3600,
)

# In route:
@router.post("/upload")
async def upload_file(file: UploadFile = File(..., max_length=100_000_000)):  # 100MB
    pass
```

---

**Error:** Upload times out

**Solution:**
```typescript
// Frontend - increase timeout
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 300000, // 5 minutes instead of default 30 seconds
});
```

---

### 2. File Preview Issues

**Error:** PDF won't preview on mobile

**Solution:**
- PDF preview only works on web (Chromium)
- On mobile, download and open externally:
  ```typescript
  import * as FileSystem from 'expo-file-system';
  import * as Sharing from 'expo-sharing';
  
  const downloadAndOpen = async (url: string) => {
    const fileUri = FileSystem.documentDirectory + 'file.pdf';
    await FileSystem.downloadAsync(url, fileUri);
    await Sharing.shareAsync(fileUri);
  };
  ```

---

**Error:** Image preview shows broken image

**Solution:**
- Check presigned URL hasn't expired (1 hour lifetime)
- Refresh URL by calling download endpoint again
- Check MinIO is running and accessible

---

## 🔐 Authentication Issues

### 1. Token Expired

**Symptom:** API calls work initially, then fail with 401

**Solution:**
```typescript
// Implement automatic token refresh
api.interceptors.response.use(
  response => response,
  async error => {
    if (error.response?.status === 401) {
      const newToken = await auth.currentUser?.getIdToken(true);
      if (newToken) {
        error.config.headers.Authorization = `Bearer ${newToken}`;
        return api.request(error.config);
      }
    }
    return Promise.reject(error);
  }
);
```

---

### 2. Can't Login

**Check these:**
1. Firebase Authentication enabled in Console
2. Email/Password sign-in method enabled
3. Firebase config correct in frontend `.env` and `app.json`
4. Backend Firebase service account configured
5. Internet connection working

---

## 🎨 UI/UX Issues

### 1. Styling Issues

**Problem:** Styles don't apply

**Solution:**
```typescript
// Make sure StyleSheet is imported
import { StyleSheet } from 'react-native';

// Use styles object
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111111',
  }
});
```

---

**Problem:** Dark mode not showing

**Solution:**
```typescript
// Check app.json
{
  "expo": {
    "userInterfaceStyle": "dark"
  }
}
```

---

### 2. Navigation Issues

**Error:** `useNavigation must be used within NavigationContainer`

**Solution:**
```typescript
// Make sure your component is inside a screen
// that's part of the navigation tree

// If needed, use router instead:
import { useRouter } from 'expo-router';

const MyComponent = () => {
  const router = useRouter();
  router.push('/path');
};
```

---

## 🔧 Development Environment

### 1. VS Code Issues

**Problem:** Python imports not resolving

**Solution:**
```bash
# Select correct Python interpreter
# Cmd/Ctrl + Shift + P
# "Python: Select Interpreter"
# Choose the one in your venv folder
```

---

**Problem:** ESLint not working

**Solution:**
```bash
cd frontend/stratum-app
npm install --save-dev eslint
npx eslint --init
```

---

### 2. Port Already in Use

**Error:** `Address already in use: 8000`

**Solution:**
```bash
# Find process using port
# macOS/Linux:
lsof -ti:8000 | xargs kill -9

# Windows:
netstat -ano | findstr :8000
taskkill /PID <PID> /F

# Or use different port:
uvicorn app.main:app --port 8001
```

---

## 🐳 Docker Issues

### 1. MinIO Container Won't Start

**Solution:**
```bash
# Check logs
docker logs stratum-minio

# Remove and recreate
docker rm -f stratum-minio
docker run -d -p 9000:9000 -p 9001:9001 \
  --name stratum-minio \
  -e "MINIO_ROOT_USER=minioadmin" \
  -e "MINIO_ROOT_PASSWORD=minioadmin" \
  minio/minio server /data --console-address ":9001"
```

---

### 2. Permission Denied

**Solution:**
```bash
# Add user to docker group (Linux)
sudo usermod -aG docker $USER
# Logout and login again

# macOS - restart Docker Desktop
```

---

## 📊 Performance Issues

### 1. Slow API Response

**Diagnosis:**
```python
import time

@router.get("/projects")
async def list_projects():
    start = time.time()
    projects = db.query(Project).all()
    print(f"Query took {time.time() - start}s")
    return projects
```

**Solutions:**
- Add database indexes
- Use pagination
- Enable query caching
- Optimize queries (use joins, not N+1)

---

### 2. Slow Frontend

**Solutions:**
```typescript
// Use React.memo for expensive components
export const ProjectCard = React.memo(({ project }) => {
  return <View>{/* ... */}</View>;
});

// Use useMemo for expensive calculations
const sortedProjects = useMemo(() => {
  return projects.sort(...);
}, [projects]);

// Lazy load images
<Image 
  source={{ uri: imageUrl }}
  resizeMode="cover"
  // Placeholder while loading
  defaultSource={require('./placeholder.png')}
/>
```

---

## 🔄 State Management Issues

### 1. State Not Updating

**Problem:** UI doesn't reflect changes

**Solution:**
```typescript
// Make sure you're updating state immutably
// Bad:
projects.push(newProject);
setProjects(projects);

// Good:
setProjects([...projects, newProject]);

// Or for updates:
setProjects(projects.map(p => 
  p.id === id ? { ...p, name: newName } : p
));
```

---

### 2. Context Not Updating

**Solution:**
```typescript
// Make sure Context value changes trigger re-renders
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  
  // Wrap value in useMemo to prevent unnecessary re-renders
  const value = useMemo(() => ({
    user,
    setUser,
  }), [user]); // Dependencies!
  
  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
```

---

## 📱 Platform-Specific Issues

### iOS

**Problem:** White screen on start

**Solution:**
```bash
# Clear build
cd ios
rm -rf build/
pod install
cd ..
npx expo run:ios --clear
```

---

### Android

**Problem:** App crashes on startup

**Solution:**
```bash
# Clear cache
cd android
./gradlew clean
cd ..
npx expo run:android --clear

# Check logs
adb logcat | grep ReactNativeJS
```

---

### Web

**Problem:** Service worker issues

**Solution:**
```bash
# Disable service worker in development
# package.json scripts:
"web": "EXPO_NO_SERVICE_WORKER=1 expo start --web"
```

---

## 🆘 Getting More Help

### Debugging Tools

**Backend:**
```python
# Enable debug logging
import logging
logging.basicConfig(level=logging.DEBUG)
```

**Frontend:**
```bash
# Enable React DevTools
npm install -g react-devtools
react-devtools
```

### Log Files

**Check these locations:**
- Backend: Terminal output where uvicorn is running
- Frontend: Metro bundler terminal
- Database: PostgreSQL logs (`/var/log/postgresql/`)
- MinIO: `docker logs stratum-minio`

### Community Help

- 💬 [GitHub Discussions](https://github.com/PzmuV1517/QuantumBitsFLL2025-2026/discussions)
- 🐛 [GitHub Issues](https://github.com/PzmuV1517/QuantumBitsFLL2025-2026/issues)
- 📖 [Check FAQ](FAQ)

### Creating a Bug Report

Include:
1. **Environment:** OS, Python version, Node version
2. **Steps to reproduce**
3. **Expected behavior**
4. **Actual behavior**
5. **Error messages** (full stack trace)
6. **Screenshots** (if UI issue)
7. **Logs** (relevant portions)

---

## 🎯 Still Stuck?

If none of these solutions work:

1. ✅ Check [FAQ](FAQ) for common questions
2. ✅ Search [existing GitHub issues](https://github.com/PzmuV1517/QuantumBitsFLL2025-2026/issues)
3. ✅ Create a [new issue](https://github.com/PzmuV1517/QuantumBitsFLL2025-2026/issues/new) with details
4. ✅ Join team discussions

---

<div align="center">

**Found a solution not listed here? Consider contributing to this guide!**

[← Development Guide](Development-Guide) | [FAQ →](FAQ)

</div>
