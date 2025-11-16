# STRATUM - Technical Preview

**A modern archaeological documentation platform solving field data fragmentation**

---

## 🎯 The Problem

Archaeologists still rely on paper-based note-taking, leading to:
- No standardization between teams and regions
- Data fragmentation across tools and databases
- Difficult collaboration and data sharing
- Lost or damaged field records

## 💡 Our Solution

**STRATUM** is an all-in-one digital platform that works seamlessly across mobile, tablet, laptop, and web - like Google Workspace for archaeology.

---

## 🏗️ Architecture

### Backend (Python FastAPI)
```
┌─────────────────────────────────────────────┐
│  FastAPI REST API                           │
├─────────────────────────────────────────────┤
│  PostgreSQL          │  MinIO Object Store  │
│  (Structured Data)   │  (Files & Media)     │
├─────────────────────────────────────────────┤
│  Firebase Auth       │  SQLAlchemy ORM      │
└─────────────────────────────────────────────┘
```

**PostgreSQL** stores:
- User accounts & authentication
- Projects with team membership
- Notes with metadata & timestamps
- File hierarchies & folder structures
- GPS coordinates & site boundaries
- Role-based permissions (Leader/Researcher/Guest)

**MinIO (S3-compatible)** handles:
- Point clouds (.ply, .las, .laz, .e57)
- 3D models (.obj, .stl, .fbx)
- Photos, videos, and PDFs
- Spreadsheets and CSV data
- Document files

### Frontend (React Native + Expo)

```
┌─────────────────────────────────────────────┐
│  React Native (iOS, Android, Web)           │
├─────────────────────────────────────────────┤
│  Expo Router  │  TypeScript  │  Axios       │
├─────────────────────────────────────────────┤
│  D3.js        │  React Maps  │  AsyncStorage│
└─────────────────────────────────────────────┘
```

**Cross-platform**: Single codebase runs on:
- iOS and Android (native apps)
- Web browsers (PWA)
- Tablets (optimized layouts)

---

## ✨ Core Features

### 1. **Project Management**
- Create archaeological site projects
- Team collaboration with granular roles
- Invite members via email
- Track project metadata and timelines

### 2. **Digital Note-Taking**
- Rich text markdown editor
- Photo attachments from camera or gallery
- Searchable and organized by project
- Automatic sync and version control

### 3. **GPS Site Planning**
- Interactive map for site boundaries
- Mark work areas and excavation zones
- GPS coordinate tracking
- Export site maps

### 4. **File Management**
- Hierarchical folder structure
- Support for 20+ file types
- In-app viewers for:
  - Point clouds (interactive 3D)
  - 3D meshes (rotate/zoom)
  - PDFs, images, videos
  - CSV/Excel tables
  - Markdown documents

### 5. **Format Conversion**
- Point cloud format conversion (E57 ↔ PLY ↔ LAS ↔ LAZ)
- Server-side processing
- No data leaves your infrastructure

### 6. **Harris Matrix Visualization**
- Stratigraphic relationship diagrams
- Context feature recording
- Artifact registry integration
- Visual conflict detection
- Export/import capabilities

### 7. **Artifact Cataloging**
- Photo documentation
- QR code generation
- Metadata tracking (type, material, period)
- Link artifacts to stratigraphic contexts
- Registry management (ceramics, fauna, lithics, etc.)

### 8. **Offline Support**
- Work without internet connectivity
- Local data caching
- Automatic sync when online
- Conflict resolution

---

## 🔒 Security & Authentication

- **Firebase Authentication**: Industry-standard user management
- **JWT Tokens**: Secure API access
- **Role-Based Access Control**: Three permission levels per project
- **Presigned URLs**: Secure temporary file access
- **CORS Protection**: Configured for web security

---

## 🚀 Data Export & Interoperability

**Current:**
- JSON API for all endpoints
- Direct file download

**Planned:**
- CSV export for tabular data
- Linked Open Data (JSON-LD)
- Authority file integration (Getty AAT, PeriodO)
- OpenRefine compatibility

---

## 📊 Tech Stack Summary

| Layer | Technologies |
|-------|-------------|
| **Frontend** | React Native, Expo, TypeScript, D3.js |
| **Backend** | Python, FastAPI, SQLAlchemy |
| **Database** | PostgreSQL (relational) |
| **Storage** | MinIO (S3-compatible) |
| **Auth** | Firebase Admin SDK |
| **Maps** | React Native Maps |
| **3D Graphics** | Three.js, Potree-core |
| **Deployment** | Docker, Docker Compose |

---

## 🎮 User Experience

### Mobile & Tablet
- Native performance
- Camera integration
- GPS functionality
- Offline-first architecture
- Touch-optimized UI

### Web
- Full feature parity
- Desktop-class interactions
- Keyboard shortcuts
- Drag-and-drop file upload
- Progressive Web App (PWA)

---

## 🌟 What Makes STRATUM Different

1. **Unified Platform**: One app for planning, documentation, collaboration, and export
2. **Cross-Platform**: Native mobile + web from a single codebase
3. **Specialized Tools**: Point cloud viewers, Harris Matrix, GPS mapping built-in
4. **Offline-First**: Work in remote locations without connectivity
5. **Open Standards**: JSON APIs, standard file formats, planned LOD support
6. **Modern Stack**: Built with current best practices and frameworks

---

## 📈 Development Status

**Phase 1 (Complete)**: ✅
- Authentication & user management
- Project creation & collaboration
- Note-taking with attachments
- File storage & management
- Basic GPS integration

**Phase 2 (In Progress)**: 🚧
- Harris Matrix visualization
- Advanced artifact cataloging
- Enhanced 3D visualization
- Export functionality

**Phase 3 (Planned)**: 📋
- Real-time collaboration
- Advanced data analysis
- Integration with eInk tablets
- Linked Open Data support

---

## 🔧 Deployment

```bash
# Start entire stack with one command
docker-compose up

# Backend: http://localhost:8000
# MinIO: http://localhost:9001
# PostgreSQL: localhost:5432
```

**Requirements:**
- Docker & Docker Compose
- Firebase project (for auth)
- Node.js 18+ (for frontend dev)
- Python 3.11+ (for backend dev)

---

## 🎓 Built By

**QuantumBits FLL Team**  
International Computer High School of Bucharest  
FLL 2025-2026 UNEARTHED Season

---

## 📞 Contact

For questions, collaboration, or demo requests:
- **Email**: child1.andy@gmail.com
- **GitHub**: PzmuV1517/QuantumBitsFLL2025-2026

---

*Last Updated: November 10, 2025*
