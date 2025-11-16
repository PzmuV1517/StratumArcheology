# Architecture Overview 🏗️

Understanding STRATUM's architecture will help you navigate the codebase and build features effectively.

---

## 🎯 High-Level Architecture

STRATUM follows a **client-server architecture** with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND LAYER                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │   React Native + Expo (Cross-platform UI)       │  │
│  │   - iOS, Android, Web support                    │  │
│  │   - Expo Router for navigation                   │  │
│  │   - React Context for state                      │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                          │
                          │ HTTPS / REST API
                          │
┌─────────────────────────────────────────────────────────┐
│                    BACKEND LAYER                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │   FastAPI (Python REST API)                      │  │
│  │   - RESTful endpoints                            │  │
│  │   - JWT authentication                           │  │
│  │   - SQLAlchemy ORM                               │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
            │                      │
            │                      │
    ┌───────┴────────┐    ┌───────┴────────┐
    │   PostgreSQL    │    │     MinIO      │
    │  (Structured)   │    │ (Object Store) │
    │    Database     │    │   Files/Blobs  │
    └────────────────┘    └────────────────┘
```

### Layer Responsibilities

| Layer | Purpose | Technologies |
|-------|---------|--------------|
| **Frontend** | User interface and experience | React Native, Expo, TypeScript |
| **Backend** | Business logic and API | FastAPI, Python, SQLAlchemy |
| **Database** | Structured data storage | PostgreSQL |
| **Object Storage** | File and media storage | MinIO (S3-compatible) |
| **Authentication** | User identity management | Firebase Authentication |

---

## 🛠 Tech Stack Deep Dive

### Backend Technologies

#### FastAPI 🐍
**Why FastAPI?**
- ⚡ **High performance** - One of the fastest Python frameworks
- 📝 **Automatic API docs** - OpenAPI (Swagger) out of the box
- 🔒 **Type safety** - Pydantic models for validation
- 🚀 **Modern Python** - Async/await support
- 🎯 **Developer friendly** - Great error messages

**Key Features Used:**
- Dependency injection for auth
- Automatic request validation
- Background tasks
- CORS middleware
- Exception handlers

#### PostgreSQL 🗄️
**Why PostgreSQL?**
- 🔄 **ACID compliance** - Data integrity guaranteed
- 📊 **Complex queries** - Powerful JOIN operations
- 🔍 **Full-text search** - Built-in search capabilities
- 🏗️ **JSON support** - Flexible schema when needed
- 📈 **Scalable** - Handles large datasets

**Schema Design:**
- Users table (Firebase UID as key)
- Projects table (with ownership)
- Notes table (linked to projects)
- Project members (many-to-many with roles)
- File metadata (hierarchical structure)

#### MinIO 📦
**Why MinIO?**
- 🌐 **S3-compatible** - Industry-standard API
- 🚀 **High performance** - Written in Go
- 💰 **Cost-effective** - Self-hosted
- 🔐 **Secure** - Encryption and access control
- 🐳 **Easy deployment** - Docker-ready

**Usage in STRATUM:**
- Photo attachments for notes
- Uploaded files and documents
- Artifact images
- User-generated content

#### Firebase Authentication 🔥
**Why Firebase?**
- 🔐 **Secure by default** - Google-scale security
- 📱 **Cross-platform** - Same auth everywhere
- 👤 **User management** - Email, social, phone
- 🎫 **JWT tokens** - Standard authentication flow
- 🆓 **Free tier** - Generous for development

**Integration Pattern:**
1. Frontend authenticates with Firebase
2. Firebase returns JWT token
3. Frontend sends token with API requests
4. Backend verifies token with Firebase Admin SDK

### Frontend Technologies

#### React Native + Expo ⚛️
**Why React Native?**
- 📱 **True cross-platform** - iOS, Android, Web from one codebase
- ⚡ **Fast development** - Hot reload, component reuse
- 🎨 **Native feel** - Real native UI components
- 📚 **Huge ecosystem** - Tons of libraries
- 💼 **Industry standard** - Used by major apps

**Why Expo?**
- 🚀 **Fast setup** - No native build tools needed initially
- 📦 **Managed workflow** - Less configuration
- 🔧 **Great DX** - Excellent developer tools
- 📱 **Easy testing** - Expo Go app for quick testing
- 🔌 **Rich APIs** - Camera, location, notifications

#### Expo Router 🧭
**Why Expo Router?**
- 📁 **File-based routing** - Like Next.js for mobile
- 🔗 **Deep linking** - Built-in URL support
- 📱 **Type-safe** - TypeScript integration
- 🎯 **Simple** - Less boilerplate than React Navigation alone

**Route Structure:**
```
app/
├── (auth)/          # Authentication group
│   ├── login.tsx
│   └── register.tsx
├── (tabs)/          # Main app tabs
│   ├── index.tsx    # Projects list
│   ├── profile.tsx
│   └── _layout.tsx
├── project/         # Project screens
│   └── [id].tsx     # Dynamic route
└── _layout.tsx      # Root layout
```

#### TypeScript 📘
**Why TypeScript?**
- 🐛 **Fewer bugs** - Catch errors at compile time
- 🔧 **Better tooling** - Autocomplete and refactoring
- 📖 **Self-documenting** - Types serve as documentation
- 🚀 **Scalable** - Easier to maintain large codebases

---

## 📁 Project Structure

### Backend Structure

```
backend/
├── app/
│   ├── routes/              # API endpoint definitions
│   │   ├── auth.py          # Authentication endpoints
│   │   ├── projects.py      # Project CRUD
│   │   ├── notes.py         # Notes CRUD
│   │   ├── files.py         # File operations
│   │   └── artifacts.py     # Artifact management
│   │
│   ├── models.py            # SQLAlchemy database models
│   ├── schemas.py           # Pydantic request/response schemas
│   ├── database.py          # Database connection & session
│   ├── config.py            # Environment configuration
│   ├── firebase_config.py   # Firebase Admin SDK setup
│   ├── minio_client.py      # MinIO client configuration
│   └── main.py              # FastAPI app entry point
│
├── requirements.txt         # Python dependencies
├── .env.example            # Environment template
├── .env                    # Environment variables (git-ignored)
└── README.md               # Backend documentation
```

### Frontend Structure

```
frontend/stratum-app/
├── app/                     # Expo Router pages
│   ├── (auth)/             # Auth screens (grouped)
│   │   ├── login.tsx
│   │   └── register.tsx
│   │
│   ├── (tabs)/             # Main app tabs
│   │   ├── index.tsx       # Projects screen
│   │   ├── profile.tsx     # Profile screen
│   │   └── _layout.tsx     # Tab navigator
│   │
│   ├── project/            # Project-related screens
│   │   └── [id].tsx        # Project detail (dynamic)
│   │
│   ├── data-preview.tsx    # File preview screen
│   ├── image-preview.tsx   # Image viewer
│   └── _layout.tsx         # Root layout with auth
│
├── src/
│   ├── components/         # Reusable UI components
│   │   ├── common/         # Generic components
│   │   ├── project/        # Project-specific components
│   │   └── data/           # Data display components
│   │
│   ├── contexts/           # React Context providers
│   │   └── AuthContext.tsx # Authentication state
│   │
│   ├── services/           # API service layer
│   │   ├── api.ts          # Axios client setup
│   │   ├── authService.ts  # Auth API calls
│   │   ├── projectService.ts
│   │   ├── noteService.ts
│   │   └── fileService.ts
│   │
│   └── config/             # Configuration
│       └── firebase.ts     # Firebase client config
│
├── app.json                # Expo configuration
├── package.json            # Node dependencies
├── tsconfig.json           # TypeScript config
├── .env.example            # Environment template
└── .env                    # Environment variables (git-ignored)
```

---

## 🔄 Data Flow

### Authentication Flow

```
┌──────────┐                    ┌───────────┐                    ┌─────────┐
│  Client  │                    │  Backend  │                    │Firebase │
└────┬─────┘                    └─────┬─────┘                    └────┬────┘
     │                                │                                │
     │ 1. Login (email, password)     │                                │
     ├───────────────────────────────>│                                │
     │                                │                                │
     │                                │ 2. Verify with Firebase        │
     │                                ├───────────────────────────────>│
     │                                │                                │
     │                                │ 3. Return user info            │
     │                                │<───────────────────────────────┤
     │                                │                                │
     │ 4. Return JWT token            │                                │
     │<───────────────────────────────┤                                │
     │                                │                                │
     │ 5. Store token locally         │                                │
     │                                │                                │
     │ 6. API calls with token        │                                │
     ├───────────────────────────────>│                                │
     │                                │                                │
     │                                │ 7. Verify token                │
     │                                ├───────────────────────────────>│
     │                                │                                │
     │                                │ 8. Token valid                 │
     │                                │<───────────────────────────────┤
     │                                │                                │
     │ 9. Return data                 │                                │
     │<───────────────────────────────┤                                │
```

### File Upload Flow

```
┌──────────┐      ┌─────────┐      ┌──────────┐      ┌───────┐
│  Client  │      │ Backend │      │PostgreSQL│      │ MinIO │
└────┬─────┘      └────┬────┘      └────┬─────┘      └───┬───┘
     │                 │                 │                 │
     │ 1. Select file  │                 │                 │
     │                 │                 │                 │
     │ 2. POST /files  │                 │                 │
     ├────────────────>│                 │                 │
     │                 │                 │                 │
     │                 │ 3. Save metadata│                 │
     │                 ├────────────────>│                 │
     │                 │                 │                 │
     │                 │ 4. Get file ID  │                 │
     │                 │<────────────────┤                 │
     │                 │                 │                 │
     │                 │ 5. Upload file  │                 │
     │                 ├────────────────────────────────>│
     │                 │                 │                 │
     │                 │ 6. Return URL   │                 │
     │                 │<────────────────────────────────┤
     │                 │                 │                 │
     │ 7. Return file info               │                 │
     │<────────────────┤                 │                 │
     │                 │                 │                 │
     │ 8. GET presigned URL              │                 │
     ├────────────────>│                 │                 │
     │                 │                 │                 │
     │                 │ 9. Generate URL │                 │
     │                 ├────────────────────────────────>│
     │                 │                 │                 │
     │                 │ 10. Return URL  │                 │
     │                 │<────────────────────────────────┤
     │                 │                 │                 │
     │ 11. Signed URL  │                 │                 │
     │<────────────────┤                 │                 │
     │                 │                 │                 │
     │ 12. Download file directly        │                 │
     ├──────────────────────────────────────────────────>│
```

### Project Collaboration Flow

```
User A (Leader)           Backend              User B (Researcher)
     │                      │                          │
     │ 1. Create project    │                          │
     ├─────────────────────>│                          │
     │                      │                          │
     │ 2. Project created   │                          │
     │<─────────────────────┤                          │
     │                      │                          │
     │ 3. Invite User B     │                          │
     ├─────────────────────>│                          │
     │                      │                          │
     │                      │ 4. Add member (Researcher)
     │                      │                          │
     │ 4. Member added      │                          │
     │<─────────────────────┤                          │
     │                      │                          │
     │                      │ 5. GET /projects         │
     │                      │<─────────────────────────┤
     │                      │                          │
     │                      │ 6. Projects (including new)
     │                      ├─────────────────────────>│
     │                      │                          │
     │ 7. Create note       │                          │
     ├─────────────────────>│                          │
     │                      │                          │
     │                      │ 8. GET /notes            │
     │                      │<─────────────────────────┤
     │                      │                          │
     │                      │ 9. Notes (can view)      │
     │                      ├─────────────────────────>│
     │                      │                          │
     │                      │ 10. Create note (allowed)│
     │                      │<─────────────────────────┤
```

---

## 🔐 Security Architecture

### Authentication & Authorization

**Multi-Layer Security:**

1. **Client Layer**
   - Firebase authentication
   - Token stored in secure storage (AsyncStorage/LocalStorage)
   - Token included in all API requests

2. **API Layer**
   - JWT token verification
   - Firebase Admin SDK validation
   - CORS restrictions

3. **Database Layer**
   - Row-level security via ownership checks
   - Role-based access control (RBAC)
   - SQL injection prevention (SQLAlchemy)

**Role Hierarchy:**

```
┌─────────────────────────────────────────┐
│  Project Owner (implicit Leader role)   │
│  - Full control over project            │
│  - Manage all members                   │
│  - Delete project                       │
└─────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────┐
│  Leader                                  │
│  - Create/edit/delete all notes         │
│  - Upload/delete files                  │
│  - Manage members (except owner)        │
└─────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────┐
│  Researcher                              │
│  - Create/edit own notes                │
│  - View all notes                       │
│  - Upload files                         │
│  - View all files                       │
└─────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────┐
│  Guest                                   │
│  - View-only access                     │
│  - Read notes                           │
│  - Download files                       │
└─────────────────────────────────────────┘
```

### Data Protection

**Encryption:**
- 🔒 **In-transit**: HTTPS/TLS for all communication
- 🔒 **At-rest**: MinIO encryption for stored files
- 🔒 **Credentials**: Environment variables, never hardcoded

**Access Control:**
- 🔑 **Presigned URLs**: Time-limited file access
- 🔑 **Token expiration**: JWT tokens expire
- 🔑 **CORS policy**: Restrict API access to known origins

---

## 📊 Database Schema

### Core Tables

**users**
```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    firebase_uid VARCHAR(128) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    display_name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**projects**
```sql
CREATE TABLE projects (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    location VARCHAR(255),
    owner_id INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**notes**
```sql
CREATE TABLE notes (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    author_id INTEGER REFERENCES users(id),
    title VARCHAR(255) NOT NULL,
    content TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**project_members**
```sql
CREATE TABLE project_members (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL,  -- 'leader', 'researcher', 'guest'
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(project_id, user_id)
);
```

**file_nodes**
```sql
CREATE TABLE file_nodes (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    parent_id INTEGER REFERENCES file_nodes(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    is_folder BOOLEAN DEFAULT FALSE,
    minio_key VARCHAR(255),  -- NULL for folders
    size BIGINT,
    mime_type VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Relationships

```
users ─┬─ owns ──> projects
       │
       └─ authors ──> notes

projects ─┬─ contains ──> notes
          │
          ├─ has ──> project_members
          │
          └─ contains ──> file_nodes

file_nodes ──> parent (self-referential for hierarchy)
```

---

## 🚀 Scalability Considerations

### Current Architecture (Phase 1)
- ✅ Single server deployment
- ✅ Suitable for 100s of users
- ✅ Local MinIO instance
- ✅ Single PostgreSQL database

### Future Scaling (Phase 3-4)
- 📈 **Load balancing**: Multiple backend instances
- 📈 **Database**: Read replicas, connection pooling
- 📈 **Storage**: Cloud storage (S3, Google Cloud Storage)
- 📈 **CDN**: Static asset delivery
- 📈 **Caching**: Redis for session and frequently accessed data
- 📈 **Search**: Elasticsearch for full-text search

---

## 🔧 Development Workflow

### Local Development

```
Developer Machine
├── Frontend Dev Server (port 19000-19006)
│   └── Expo Metro Bundler
│
├── Backend Dev Server (port 8000)
│   └── Uvicorn with --reload
│
├── PostgreSQL (port 5432)
│   └── Development database
│
└── MinIO (ports 9000, 9001)
    └── Local object storage
```

### API Development Cycle

1. **Define schema** (Pydantic models in `schemas.py`)
2. **Create database model** (SQLAlchemy in `models.py`)
3. **Implement endpoint** (FastAPI route)
4. **Test with Swagger UI** (`/docs`)
5. **Create frontend service** (TypeScript service)
6. **Implement UI** (React Native component)
7. **Test end-to-end**

---

## 📚 Learn More

- [Features Documentation](Features-Documentation) - What STRATUM can do
- [API Reference](API-Reference) - Detailed endpoint documentation
- [Development Guide](Development-Guide) - Contributing to STRATUM

---

<div align="center">

[← Installation & Setup](Installation-&-Setup) | [Features Documentation →](Features-Documentation)

</div>
