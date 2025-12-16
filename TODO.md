# STRATUM Development TODO - Priority Based

> **Archaeological Field Documentation Platform**
> 
> This TODO is structured based on:
> - Archaeological field documentation standards (Harris Matrix, stratigraphic recording)
> - Real-world excavation workflows (offline-first, rapid data capture)
> - Scientific rigor requirements (data integrity, traceability, standardization)
> - Field conditions (weather, remote locations, minimal connectivity)

**Priority Legend:**
- `[P0]` - Critical/Blocking - Core functionality or data integrity issues
- `[P1]` - High Priority - Essential features for archaeological workflows
- `[P2]` - Medium Priority - Quality of life improvements
- `[P3]` - Low Priority - Nice to have features
- `[P4]` - Future - Long-term vision items

**Cross-Platform Support:**
- 🌐 **Default**: All features should support both **Web** and **Native** (iOS/Android)
- 📱 **Native-only exceptions**: Features requiring specific hardware unavailable on web (GPS, camera, accelerometer, offline storage)
- 💻 **Web-only exceptions**: Features impractical on mobile due to screen size or input complexity (advanced editing, complex visualizations)
- ⚠️ **Platform-specific implementations**: Same feature, different UX patterns (hover vs press-and-hold, tooltips vs modals)

**⚠️ IMPORTANT: Always discuss with team before starting major features**

---

## ✅ Recently Completed (last few weeks)

- [x] Web PDF preview in data-preview via Chromium iframe ([`PdfPanel.web`](frontend/stratum-app/src/components/data/PdfPanel.web.tsx), [`data-preview`](frontend/stratum-app/app/data-preview.tsx))
- [x] Files UX: red-styled Download/Move and red "\root" header link ([`app/project/[id].tsx`](frontend/stratum-app/app/project/%5Bid%5D.tsx), [`FilesOverlay`](frontend/stratum-app/src/components/project/FilesOverlay.tsx))
- [x] Move safety: 409 conflict on duplicate sibling names; client alert ([`backend/app/routes/files.py`](backend/app/routes/files.py))
- [x] Gallery: PDF icon and routing to data-preview ([`FileGallery.tsx`](frontend/stratum-app/src/components/project/FileGallery.tsx))
- [x] Markdown preview upgrades (math/HTML via [`MarkdownView`](frontend/stratum-app/src/components/common/MarkdownView.tsx))
- [x] Artefact creation flow: folder, image uploads, note uploads, QR generation, artefact.json manifest ([`ArtefactsTab.tsx`](frontend/stratum-app/src/components/project/ArtefactsTab.tsx))
- [x] Data-preview panels for CSV/Excel/Text/Markdown
- [x] Fix JSX fragment bug in project screen file rows
- [x] TypeScript error fixes across frontend (UUID string IDs, type safety)
- [x] Android emulator network configuration (10.0.2.2:8000)

---

## 🚨 P0 - CRITICAL (Data Integrity & Core Functionality)

### Backend Stability & Data Safety

- [ ] **[P0] Database Migrations with Alembic**
  - Remove dangerous `create_all()` bootstrap in main.py
  - Create initial baseline migration from current schema
  - Document migration workflow for team (upgrade/downgrade)
  - Add migration tests to CI pipeline
  - **Why**: Prevents accidental data loss and schema corruption in production
  - **Files**: `backend/app/database.py`, `backend/app/main.py`, `alembic/versions/`

- [ ] **[P0] Backend Error Handling & Logging**
  - Structured logging with context (user_id, project_id, action)
  - Error tracking middleware (capture stack traces)
  - Database transaction rollback on failures
  - File upload cleanup on errors (prevent orphaned MinIO objects)
  - **Why**: Field data is irreplaceable - must ensure no silent failures
  - **Files**: `backend/app/main.py`, new `backend/app/middleware/`

- [ ] **[P0] Data Validation Layer**
  - Pydantic schemas for all inputs (strict mode)
  - SQL injection prevention audit (parametrized queries)
  - File type validation before upload (magic bytes check)
  - GPS coordinate validation (lat: -90 to 90, lon: -180 to 180)
  - **Why**: Garbage data undermines scientific credibility
  - **Files**: `backend/app/schemas.py`, `backend/app/routes/*.py`

### Offline Capability (Critical for Field Work)

- [ ] **[P0] Offline-First Architecture - Phase 1**
  - Local SQLite database for mobile app (expo-sqlite)
  - Queue system for API requests (AsyncStorage-based queue)
  - Conflict detection on sync (timestamp-based last-write-wins with warnings)
  - Network status detection (online/offline indicator)
  - **Why**: Excavation sites rarely have reliable internet
  - **Files**: New `frontend/stratum-app/src/db/`, `src/services/syncService.ts`

- [ ] **[P0] Auto-Save for All Forms**
  - Draft saving every 30 seconds (debounced)
  - Restore drafts on app crash/close (check AsyncStorage on mount)
  - Clear draft after successful submission
  - Visual indicator for "Draft Saved" status
  - **Why**: Losing field notes due to battery death is catastrophic
  - **Files**: All form screens (`create-note.tsx`, context recording forms)

---

## 📊 P1 - HIGH PRIORITY (Archaeological Core Features)

### Stratigraphic Recording (Harris Matrix Implementation)

- [ ] **[P1] Context/Unit Recording System**
  - Context number assignment (auto-increment per project, format: PRJ-001)
  - Context types: deposit, cut, fill, interface, structure, layer
  - Physical description fields:
    - Color (Munsell chart picker)
    - Texture (clay, silt, sand, gravel)
    - Composition (loam, stones, charcoal, etc.)
    - Compaction (loose, compact, very compact)
  - Relationship recording: above, below, equal to, cuts, cut by, fills, filled by
  - Finds association tracking (link to finds records)
  - **Why**: Foundation of all archaeological excavation - Harris Matrix compliance
  - **Files**: New `backend/app/models.py` (Context model), `routes/contexts.py`, frontend context recording form

- [ ] **[P1] Harris Matrix Visualization**
  - Auto-generate matrix from context relationships (topological sort)
  - Interactive diagram (zoom, pan, highlight path)
  - Validation: detect loops and temporal contradictions
  - Export to SVG/PDF for reports
  - Phasing overlay (color-code contexts by period)
  - **Why**: Required for publication and interpretation
  - **Libraries**: D3.js or dagre for layout, react-svg-pan-zoom for interaction
  - **Files**: New `frontend/components/harris-matrix/`

- [ ] **[P1] Stratigraphic Phasing**
  - Group contexts into periods/phases (Early Medieval, Roman, etc.)
  - Phase dating (absolute dates, relative sequence)
  - Period color-coding on matrix and forms
  - Phase summary statistics (context count, date range)
  - **Why**: Tells the story of site formation over time
  - **Files**: New `models.py` (Phase model), phase management UI

### Field Recording Forms

- [ ] **[P1] Digital Context Recording Sheet**
  - Template based on Museum of London Archaeological Site Manual
  - Required fields: context number, type, description, dimensions
  - Photos linked to context (orientation markers, scale visible)
  - GPS coordinates per context (auto-populate from device)
  - Soil sample tracking (sample numbers, purpose)
  - Excavator name and date (auto-populated)
  - **Why**: Standardized data collection ensures quality and comparability
  - **Files**: New `app/context-recording.tsx`, backend context model extensions

- [ ] **[P1] Small Finds Recording**
  - Find number assignment (auto-increment: SF-001, SF-002...)
  - Material type classification (pottery, metal, bone, glass, stone, etc.)
  - Provenance (context number, GPS coordinates, depth below datum)
  - Photo documentation (required for all finds)
  - Conservation notes (fragile, waterlogged, requires treatment)
  - Specialist assignment (who will analyze this find)
  - **Why**: Artifacts are primary evidence - must be traceable to exact context
  - **Files**: New `models.py` (Find model), finds recording form

- [ ] **[P1] Sample Recording (Environmental)**
  - Sample types: soil, charcoal, bone, pollen, macrobotanical, etc.
  - Sample number and context association
  - Volume/weight recorded
  - Chain of custody tracking (collected by, processed by, sent to lab)
  - Lab submission status (pending, submitted, results received)
  - Results linking (attach lab reports)
  - **Why**: Scientific analysis requires meticulous provenance
  - **Files**: New Sample model, sample management UI

### GPS & Spatial Data

- [ ] **[P1] Survey Grid Management**
  - Define site grid origin and orientation (lat/lon + bearing)
  - Convert between GPS (WGS84) and local grid coordinates
  - Grid square naming convention (e.g., "5N 3E" from origin)
  - Grid overlay on map view
  - **Why**: All spatial data must reference consistent coordinate system
  - **Files**: New `utils/gridProjection.ts`, grid setup UI in project settings

- [ ] **[P1] Spatial Feature Mapping**
  - Draw polygons for contexts/features on map
  - Point markers for individual finds
  - Measure distances and areas (great-circle distance)
  - Label features on map
  - Export to GeoJSON/KML for GIS import (QGIS, ArcGIS)
  - **Why**: Archaeological context is fundamentally spatial
  - **Files**: Enhance existing GPS system, add drawing tools to map

- [ ] **[P1] Elevation/Depth Recording**
  - Benchmark/datum point management (name, elevation, GPS)
  - Depth below surface/datum calculations
  - Elevation of context top and bottom boundaries
  - Section line recording (start/end points, bearing)
  - Auto-calculate depths from GPS elevation
  - **Why**: Vertical stratigraphy is as important as horizontal
  - **Files**: Add elevation fields to Context model, elevation recording UI

### Planning & Survey Tools

- [ ] **[P1] Site Planning View**
  - Scale drawing grid overlay on satellite map
  - Feature/wall vectorization (draw lines for walls, etc.)
  - North arrow and scale bar (auto-calculate from zoom)
  - Layer management (toggle periods, feature types)
  - Export to CAD formats (DXF for AutoCAD)
  - **Why**: Plans are core archaeological deliverables
  - **Libraries**: Leaflet.draw or MapBox GL Draw
  - **Files**: New planning mode in map view

- [ ] **[P1] Section Drawing Tool**
  - Draw stratigraphic sections (vertical profiles)
  - Label contexts and interfaces on section
  - Scale and orientation metadata (1:10, 1:20, bearing)
  - Photo overlay for tracing (upload field photo, trace over it)
  - Export to vector formats (SVG, PDF)
  - **Why**: Sections show temporal relationships visually
  - **Files**: New section drawing component, canvas-based editor

### Data Export & Reporting

- [ ] **[P1] Context Catalog Export**
  - CSV export with all context data (one row per context)
  - Archive-ready format (ADS/tDAR compliant column names)
  - Linked media manifest (list of photo filenames per context)
  - Metadata header (project name, site code, export date)
  - **Why**: Required for data archiving and publication
  - **Files**: New export route in backend, download UI in frontend

- [ ] **[P1] Finds Catalog Export**
  - Standardized finds database format
  - Image filenames linked to find records
  - Material type statistics (count per type, period)
  - Specialist notes included
  - **Why**: Post-excavation analysis depends on structured data
  - **Files**: Finds export route, CSV generation

- [ ] **[P1] Site Report Generation**
  - PDF report template (customizable sections)
  - Auto-include Harris Matrix diagram
  - Auto-include site plans and section drawings
  - Context descriptions (summary of each context)
  - Finds summary tables (counts by type/period)
  - Photo plates (selected photos with captions)
  - **Why**: Regulatory compliance often requires formal reports
  - **Libraries**: PDFKit or Puppeteer for PDF generation
  - **Files**: New report generation service

### Team Collaboration (Field-Specific)

- [ ] **[P1] Daily Log System**
  - Weather conditions (temp, precipitation, wind - manual or API)
  - Team members present (auto from logged-in users + manual add)
  - Areas worked (grid squares, trenches)
  - Significant discoveries (daily highlights)
  - Issues/decisions log (problems encountered, solutions)
  - **Why**: Professional standard for excavation documentation
  - **Files**: New DailyLog model, daily log entry form

- [ ] **[P1] Context Assignment to Users**
  - Assign contexts to excavators (who excavated this context)
  - Track who recorded each context (auto-populate from logged-in user)
  - Supervisor review workflow (mark as "needs review", "approved")
  - Quality control comments thread
  - **Why**: Accountability and quality control
  - **Files**: Add assignee fields to Context model, assignment UI

- [ ] **[P1] Real-Time Activity Feed**
  - Show recent activity: "New context CTX-045 added by Alice"
  - "Find SF-023 recorded in CTX-045 by Bob"
  - "5 photos uploaded to CTX-045"
  - Changes made (audit log of edits)
  - Filter by user, date, activity type
  - **Why**: Team coordination during active excavation
  - **Files**: Activity logging system, WebSocket updates, activity feed UI
  - **Notice**: Technically already exists in the dashboard of the project, the "timeline" feature. But it needs heavy reworks, such as the ones mentioned above, and also dynamic scrolling.
---

## 🎨 P2 - MEDIUM PRIORITY (UX & Productivity)

### User Experience Enhancements

- [ ] **[P2] Offline Data Sync - Phase 2**
  - Automatic sync when connection restored (background service)
  - Progress indicator for sync queue (X items pending)
  - Manual sync trigger button
  - Conflict resolution UI (show both versions, choose or merge)
  - Sync history log (what synced when)
  - **Why**: Seamless offline/online transition
  - **Files**: Enhanced syncService, conflict resolution modal

- [ ] **[P2] Voice-to-Text for Field Notes**
  - Dictation mode for context descriptions (press-and-hold to record)
  - Edit after transcription (review before saving)
  - Works offline (device speech recognition API)
  - Language selection (English, Spanish, etc.)
  - **Why**: Faster note-taking when hands are dirty/gloved
  - **Libraries**: expo-speech-recognition or Web Speech API
  - **Files**: Voice input component, integrate into text fields

- [ ] **[P2] Photo Annotation Tools**
  - Draw on photos to indicate features (arrows, circles, text)
  - Add measurement scale overlay (1m, 50cm scale bar)
  - Crop and rotate
  - North arrow stamp (auto-oriented if phone has compass)
  - Save annotations as separate layer (preserve original)
  - **Why**: Annotated photos have more research value
  - **Libraries**: react-native-sketch-canvas or Konva.js
  - **Files**: Photo annotation screen

- [ ] **[P2] Barcode/QR Scanner Integration**
  - Scan find tags to auto-link photos (QR code = find number)
  - QR codes for context markers (scan to open context form)
  - Quick lookup of existing records by scan
  - Generate printable QR labels (PDF sheet of labels)
  - **Why**: Reduces manual data entry errors, speeds workflow
  - **Libraries**: expo-barcode-scanner
  - **Files**: Scanner component, QR label generator

- [ ] **[P2] Search & Filter System**
  - Full-text search across all notes/contexts/finds
  - Filter by type (context type, material type)
  - Filter by date range, user, phase/period
  - Saved search presets ("All pottery finds", "Unreviewed contexts")
  - Search suggestions/autocomplete
  - **Why**: Find information quickly in large projects (100s of contexts)
  - **Files**: Search service (backend ElasticSearch or pg full-text), search UI

- [ ] **[P2] Batch Operations**
  - Bulk photo upload (select 20 photos, assign to context)
  - Multi-select contexts for phase assignment
  - Batch export (select contexts, export as one CSV)
  - Batch delete (with confirmation)
  - **Why**: Efficiency when managing hundreds of records
  - **Files**: Multi-select UI patterns, batch action buttons

- [ ] **[P2] Toast Notifications**
  - Success messages ("Context CTX-045 saved!")
  - Error messages ("Upload failed - retry?")
  - Info messages ("Sync in progress...")
  - Non-blocking, auto-dismiss after 3-5 seconds
  - Action buttons ("Undo", "Retry", "View")
  - **Why**: User feedback without modal interruption
  - **Libraries**: Custom toast component or react-native-toast-message
  - **Files**: Toast context/hook, integrate into all actions

- [ ] **[P2] Skeleton Loaders**
  - Project list skeleton (card shapes)
  - Notes list skeleton (text lines)
  - Files gallery skeleton (grid of squares)
  - Match STRATUM dark theme
  - **Why**: Better perceived performance
  - **Files**: Skeleton components, use while loading

- [ ] **[P2] Theme Switch**
  - Dark/light mode toggle (default dark)
  - System theme detection ("Auto")
  - Persist user preference (AsyncStorage)
  - High-contrast mode option (accessibility)
  - **Why**: User comfort, accessibility
  - **Files**: Theme context, theme toggle in settings

### Data Visualization

- [ ] **[P2] Dashboard & Statistics**
  - Contexts recorded per day (line chart)
  - Finds count by material/period (bar chart)
  - Team productivity metrics (contexts per user)
  - Photo storage usage (pie chart, GB used)
  - Export statistics as CSV
  - **Why**: Project management and progress tracking
  - **Libraries**: Victory Native or Recharts
  - **Files**: Dashboard screen, stats API endpoints

- [ ] **[P2] Timeline View**
  - Chronological display of contexts (earliest to latest)
  - Period/phase color coding
  - Interactive timeline with filtering (zoom to period)
  - Click context to view details
  - **Why**: Alternative way to understand site sequence
  - **Files**: Timeline component, chronological sort logic

- [ ] **[P2] 3D Context Visualization (Experimental)**
  - Stack contexts in 3D based on stratigraphic relationships
  - Rotate and explore spatial relationships (orbit controls)
  - Color by phase/type
  - Export to 3D formats (OBJ, GLTF for Blender)
  - **Why**: Aids interpretation of complex stratigraphy
  - **Libraries**: Three.js or React Three Fiber
  - **Files**: 3D viewer component (web-only initially)

### File Management Improvements

- [ ] **[P2] File Metadata Info Icon**
  - Add "i" info icon next to each file in FilesOverlay
  - Hover/press shows tooltip: "Uploaded by [User Name] on [Date/Time]"
  - Replaces current "uploaded X time ago" text display
  - Cleaner UI with metadata on-demand
  - **Platform Support**: Web (hover), Native (press-and-hold or tap)
  - **Why**: Better UX - information available without cluttering interface
  - **Files**: `FilesOverlay.tsx`, `FileGallery.tsx`, add Tooltip component
  - **Notes**: Use react-native-tooltip or custom tooltip for cross-platform

- [ ] **[P2] File Organization by Context**
  - Auto-organize photos by context number (folder per context)
  - Folder structure export (zip with organized folders)
  - Batch rename based on metadata (CTX-045_001.jpg, CTX-045_002.jpg)
  - **Platform Support**: Web & Native
  - **Why**: Post-excavation file management is time-consuming
  - **Files**: File organization service, batch rename UI

- [ ] **[P2] Image Metadata Extraction**
  - EXIF data extraction (GPS, timestamp, camera model)
  - Auto-populate location from EXIF GPS
  - Detect and warn about missing metadata (no GPS, no timestamp)
  - Display camera settings (ISO, aperture, shutter for quality check)
  - **Why**: Photo metadata is valuable for analysis and verification
  - **Libraries**: exif-js or piexifjs
  - **Files**: EXIF extraction utility, metadata display in file detail

- [ ] **[P2] Duplicate Detection**
  - Hash-based duplicate file detection (MD5 or SHA256)
  - Visual similarity detection for photos (perceptual hash)
  - Merge or delete duplicates UI (show side-by-side, choose)
  - **Why**: Saves storage and reduces clutter
  - **Files**: Duplicate detection service, deduplication UI

### Quality Control

- [ ] **[P2] Data Validation Rules**
  - Required fields per record type (context must have description, etc.)
  - Warning for unusual values (depth > 10m, negative elevation)
  - Photo requirements per context (minimum 2 photos)
  - Relationship validation (context can't be above and below same context)
  - **Why**: Catch incomplete records before they become problems
  - **Files**: Validation rules in schemas, warning UI

- [ ] **[P2] Supervisor Review Workflow**
  - Mark contexts as "Needs Review", "In Review", "Approved"
  - Comment thread on records (supervisor leaves feedback)
  - Approve/Request Changes actions
  - Email notification for review requests
  - **Why**: Quality assurance is essential for credible archaeology
  - **Files**: Review status field, comments system, notification service

---

## 🔧 P2 - TECHNICAL IMPROVEMENTS

### Performance & Scalability

- [ ] **[P2] Backend Optimization**
  - Database query optimization (add indexes on foreign keys, context_number)
  - N+1 query prevention (use joinedload, selectinload)
  - Pagination for large lists (cursor-based for contexts, offset for files)
  - **Why**: Scale to projects with 1000s of contexts
  - **Files**: Query review in all routes, add indexes in migrations

- [ ] **[P2] Image Optimization Pipeline**
  - Auto-generate thumbnails on upload (200px, 800px, original)
  - Compress images without quality loss (JPEG quality 85, PNG compression)
  - Progressive loading for galleries (thumbnail → full image)
  - Lazy loading (only load images in viewport)
  - **Why**: Mobile data is expensive; storage costs matter
  - **Libraries**: Sharp (backend), react-native-fast-image (frontend)
  - **Files**: Image processing service, gallery components

- [ ] **[P2] WebSocket for Real-Time Updates**
  - WebSocket connection per project (subscribe to project updates)
  - Real-time updates for new contexts, finds, photos
  - Live presence indicators (who's online now)
  - Instant notification of changes (reduce polling)
  - **Why**: Better collaboration experience
  - **Files**: WebSocket server setup, socket event handlers

### Developer Experience

- [ ] **[P2] CI/CD Pipeline**
  - GitHub Actions workflow
  - Backend tests: pytest (models, routes, services)
  - Frontend tests: Jest (components, hooks)
  - Linting: Black, Flake8 (Python), ESLint, Prettier (TypeScript)
  - Automated deployment to staging on merge to main
  - **Why**: Maintain code quality as team grows
  - **Files**: `.github/workflows/ci.yml`, test files

- [ ] **[P2] Testing Coverage**
  - Backend unit tests (SQLAlchemy models, Pydantic schemas)
  - Route tests (test each API endpoint with fixtures)
  - Frontend component tests (React Testing Library)
  - Integration tests (file upload → storage → download flow)
  - E2E tests (Playwright: login → create project → add context)
  - Target 70%+ coverage
  - **Why**: Prevent regressions, safe refactoring
  - **Files**: `backend/tests/`, `frontend/__tests__/`

- [ ] **[P2] API Documentation**
  - Interactive Swagger/OpenAPI docs (auto-generated from FastAPI)
  - Add descriptions to all endpoints
  - Request/response examples
  - Authentication flow documentation
  - **Why**: Easier onboarding and third-party integrations
  - **Files**: Add docstrings to routes, OpenAPI customization

### Security Hardening

- [ ] **[P2] Security Audit**
  - Dependency vulnerability scanning (pip-audit, npm audit)
  - SQL injection testing (sqlmap on dev environment)
  - File upload security review (magic bytes check, extension whitelist)
  - Rate limiting on endpoints (10 requests/min for auth, 100/min for API)
  - CORS policy review
  - **Why**: Protect sensitive research data
  - **Files**: Security middleware, dependency updates

- [ ] **[P2] Token Refresh Flow**
  - Short-lived access tokens (15 min expiry)
  - Refresh token rotation (new refresh token on each use)
  - Secure token storage on mobile (Expo SecureStore)
  - Auto-refresh before expiry
  - **Why**: Reduce risk of token theft and replay attacks
  - **Files**: Auth service updates, token refresh endpoint

- [ ] **[P2] Role-Based Access Control Refinement**
  - Granular permissions per feature (edit context, delete find, export data)
  - Project-level permissions (owner, admin, editor, viewer)
  - Record-level permissions (only creator can delete their notes)
  - Audit log of permission changes
  - **Why**: Complex projects need fine-grained control
  - **Files**: Permission system, middleware

---

## 🌟 P3 - NICE TO HAVE (Enhanced Functionality)

### Advanced Archaeological Features

- [ ] **[P3] Specialist Recording Forms**
  - Pottery recording (fabric code, vessel form, rim diameter, decoration type)
  - Bone recording (species, skeletal element, measurements, butchery marks)
  - Building materials (stone type, dimensions, mortar composition)
  - Custom form builder (create project-specific recording forms)
  - **Why**: Different specialists have different data requirements
  - **Files**: Form template system, specialist form components

- [ ] **[P3] Multi-Language Support**
  - Internationalization (i18n) framework
  - Translations for: English, Spanish, Italian, Greek, Arabic, French
  - RTL (right-to-left) language support for Arabic
  - User language preference (per-user setting)
  - **Why**: Archaeology is international - teams are multilingual
  - **Libraries**: i18next or react-intl
  - **Files**: Translation files, language switcher

- [ ] **[P3] Field Manual / Help System**
  - In-app recording guides ("How to record a context")
  - Video tutorials (short clips showing workflows)
  - Glossary of archaeological terms
  - Context-sensitive help (help button on each form)
  - Downloadable PDF manual (for offline reference)
  - **Why**: Train new team members faster, reduce errors
  - **Files**: Help content markdown files, help viewer component

- [ ] **[P3] Weather Integration**
  - Auto-log weather conditions from API (OpenWeatherMap)
  - Manual override for weather (if API unavailable)
  - Impact assessment (rain delays, heat stress warnings)
  - Historical weather data (correlate with productivity)
  - **Why**: Weather affects excavation decisions and team safety
  - **Files**: Weather service, weather API integration

### Integration & Interoperability

- [ ] **[P3] GIS Software Integration**
  - Export to QGIS/ArcGIS formats (Shapefile, GeoPackage)
  - Import shapefiles/KML (load survey data)
  - Coordinate system transformation (convert between projections)
  - Attribute table export for GIS
  - **Why**: GIS is standard tool in archaeology for spatial analysis
  - **Libraries**: proj4js for coordinate transformation
  - **Files**: GIS export service, coordinate transformation utils

- [ ] **[P3] Data Repository Integration**
  - Direct upload to ADS (Archaeology Data Service) UK
  - tDAR (The Digital Archaeological Record) integration
  - Zenodo DOI minting (get permanent identifier for dataset)
  - ORCID integration (link researchers to data)
  - **Why**: Long-term data preservation and open science
  - **Files**: Repository upload service, metadata mapping

- [ ] **[P3] Bibliography Management**
  - Link references to contexts/reports (cite sources in descriptions)
  - Export to BibTeX/EndNote formats
  - Citation formatting (APA, Chicago, etc.)
  - Import from Zotero/Mendeley
  - **Why**: Academic publication requirements
  - **Files**: Bibliography model, citation formatter

### Specialized Tools

- [ ] **[P3] Photogrammetry Support**
  - Photo set organization for 3D modeling (group photos for SfM)
  - Scale bar detection (auto-detect scale in photos)
  - Export to Metashape/RealityCapture/Meshroom project format
  - Camera position tracking (GPS per photo for georeferencing)
  - **Why**: Structure-from-Motion 3D recording is becoming standard
  - **Files**: Photo set manager, photogrammetry export

- [ ] **[P3] Geophysical Survey Integration**
  - Import GPR (ground-penetrating radar) results
  - Import magnetometry data
  - Overlay on site map (display anomalies)
  - Trench placement planning (target high-probability areas)
  - **Why**: Non-invasive survey informs excavation strategy
  - **Files**: Geophysical data importers, overlay rendering

- [ ] **[P3] Dating Evidence Tracker**
  - C14 (radiocarbon) samples management
  - OSL/TL (optically/thermally stimulated luminescence) samples
  - Lab results integration (upload lab reports, link to contexts)
  - Date calibration tools (calibrate C14 dates to calendar years)
  - Bayesian chronological modeling integration (link to OxCal)
  - **Why**: Dating is fundamental to chronological interpretation
  - **Files**: Dating sample model, calibration utility

### User Customization

- [ ] **[P3] Custom Fields System**
  - User-defined fields per project (add extra fields to contexts/finds)
  - Field templates (save field sets, reuse across projects)
  - Validation rules for custom fields (required, number range, etc.)
  - Custom field export (include in CSV exports)
  - **Why**: Different sites/regions have different recording needs
  - **Files**: Custom field configuration, dynamic form generator

- [ ] **[P3] Advanced Theme Customization**
  - Color scheme picker (customize primary/accent colors)
  - Font size scaling (accessibility - large text mode)
  - Contrast themes (high-contrast for bright sunlight)
  - Colorblind-friendly palettes
  - **Why**: Long hours in field require comfortable, accessible UI
  - **Files**: Theme customization UI, theme engine

---

## 🔮 P4 - FUTURE VISION (Long-Term Innovation)

### AI-Assisted Tools

- [ ] **[P4] AI Photo Analysis**
  - Artifact type recognition (pottery sherd, bone, metal detected from photo)
  - Pottery sherd classification (predict ware type from image)
  - Soil color/texture identification (suggest Munsell code)
  - Automatic image cropping/enhancement
  - **Why**: Speed up initial sorting and cataloging
  - **Technology**: TensorFlow or PyTorch models, pre-trained on archaeological datasets
  - **Files**: AI service, model hosting

- [ ] **[P4] Automated Harris Matrix Generation**
  - AI suggestions for context relationships (based on description patterns)
  - Anomaly detection in stratigraphy (flag impossible relationships)
  - Smart phase assignment (suggest periods based on finds/descriptions)
  - Auto-complete descriptions (suggest text based on similar contexts)
  - **Why**: Reduce manual errors in complex stratigraphic sequences
  - **Technology**: NLP models, graph algorithms
  - **Files**: Harris Matrix AI service

- [ ] **[P4] Natural Language Search**
  - Semantic search ("find all post-medieval rubbish pits")
  - Question answering over excavation data ("When was the Roman wall built?")
  - Conversational interface ("Show me contexts with charcoal")
  - **Why**: Make data more accessible to non-technical researchers
  - **Technology**: Embedding models, vector search
  - **Files**: Semantic search API

### Advanced Collaboration

- [ ] **[P4] Virtual Excavation Tours**
  - 360° photo tours of site (panoramic photos from key locations)
  - Annotated walk-throughs (audio guide explaining features)
  - Remote team participation (VR headset support for remote viewing)
  - Live streaming from excavation (share progress with public)
  - **Why**: Public outreach, remote collaboration, stakeholder engagement
  - **Technology**: Three.js panorama viewer, WebRTC streaming
  - **Files**: Tour builder, 360 viewer

- [ ] **[P4] Cross-Project Analysis**
  - Compare contexts across multiple sites (find similar deposits)
  - Regional pottery databases (shared typology across projects)
  - Shared find type reference collections
  - Comparative statistics (compare site productivity)
  - **Why**: Archaeology is fundamentally comparative
  - **Files**: Multi-project query service, comparative analysis tools

### Platform Evolution

- [ ] **[P4] Plugin System**
  - Third-party extensions (community-built recording forms, tools)
  - Custom recording form plugins
  - Integration marketplace (connect to other archaeological tools)
  - API for plugin developers
  - **Why**: Community-driven innovation, specialized needs
  - **Files**: Plugin architecture, plugin API, marketplace

- [ ] **[P4] Desktop Application**
  - Electron-based desktop app (full-featured desktop version)
  - Advanced editing tools (powerful context/finds editor)
  - Offline processing power (run analysis locally)
  - Sync with mobile data (import field data for post-excavation work)
  - **Why**: Post-excavation analysis needs desktop computing power
  - **Technology**: Electron, share code with web version
  - **Files**: Desktop app wrapper, desktop-specific features

- [ ] **[P4] Public Data Portal**
  - Share published datasets (make excavation data publicly accessible)
  - Interactive data exploration (web-based data browser)
  - Citizen science integration (public can help transcribe/classify)
  - Open data licensing (CC-BY, CC0)
  - **Why**: Open science, public engagement, research impact
  - **Files**: Public portal frontend, data publishing workflow

---

## 📱 CURRENT IMPLEMENTATION STATUS

### ✅ Completed Core Features

**Backend Infrastructure:**
- [x] FastAPI framework with async support
- [x] PostgreSQL database with SQLAlchemy ORM
- [x] MinIO object storage for files/photos
- [x] Firebase authentication
- [x] RESTful API with Pydantic schemas

**User & Project Management:**
- [x] User registration and authentication
- [x] Project CRUD operations
- [x] Team collaboration with roles (Leader, Researcher, Guest)
- [x] Invitation system for team members

**Data Collection:**
- [x] Rich text notes system
- [x] Photo/file attachment to notes
- [x] Custom forms system (dynamic forms)
- [x] File management with folder structure
- [x] GPS point and polygon recording
- [x] Voice note recording
- [x] Artefact tracking with QR code generation

**Frontend Applications:**
- [x] Expo React Native app (iOS, Android, Web)
- [x] Expo Router navigation
- [x] Cross-platform components
- [x] Real-time GPS tracking
- [x] File gallery with grouping/filtering

**Data Visualization:**
- [x] Multi-format file preview (PDF, CSV, Excel, images, markdown, text)
- [x] Markdown rendering with math support
- [x] CSV/Excel table viewer
- [x] Map view for GPS data

**Activity Tracking:**
- [x] Activity logging system
- [x] Real-time updates via WebSocket

### 🔄 In Progress / Recently Fixed

- [x] TypeScript error fixes (UUID string IDs, type safety improvements)
- [x] Android emulator networking (platform-specific API URLs)
- [ ] Native app feature parity testing (awaiting user validation)

### 🚧 Known Gaps / Not Yet Implemented

**Critical Missing Features:**
- [ ] Offline support (no local database, no sync queue)
- [ ] Stratigraphic recording (no contexts, no Harris Matrix)
- [ ] Structured data export (no archive-ready formats)
- [ ] Database migrations (using dangerous create_all)

**Archaeological Workflows:**
- [ ] Context recording (the foundation of excavation documentation)
- [ ] Small finds cataloging
- [ ] Sample tracking
- [ ] Harris Matrix visualization
- [ ] Stratigraphic phasing
- [ ] Section drawing tools
- [ ] Daily logs

**Quality & Reliability:**
- [ ] Auto-save (risk of data loss)
- [ ] Comprehensive error handling
- [ ] Data validation rules
- [ ] Testing coverage
- [ ] CI/CD pipeline

---

## 🎯 RECOMMENDED SPRINT PRIORITIES

> **Based on archaeological best practices and critical gaps**

### Sprint 1 (Weeks 1-2): **Data Safety & Foundations**
**Goal**: Prevent data loss, establish stable foundation

1. [P0] Database migrations with Alembic
   - Remove `create_all()`, establish migration workflow
   - **Est. effort**: 2-3 days
   
2. [P0] Auto-save for all forms
   - Draft saving, crash recovery
   - **Est. effort**: 2-3 days
   
3. [P0] Backend error handling & logging
   - Structured logging, transaction rollback
   - **Est. effort**: 2-3 days
   
4. [P0] Data validation layer
   - Input validation, SQL injection prevention
   - **Est. effort**: 2 days

### Sprint 2 (Weeks 3-4): **Core Archaeological Recording**
**Goal**: Enable basic stratigraphic recording

1. [P1] Context recording system
   - Context model, basic recording form
   - **Est. effort**: 5 days
   
2. [P1] Context relationships
   - Above/below/cuts/fills tracking
   - **Est. effort**: 3 days
   
3. [P1] Small finds recording
   - Find model, recording form
   - **Est. effort**: 3 days
   
4. [P1] Context catalog export
   - CSV export with all context data
   - **Est. effort**: 2 days

### Sprint 3 (Weeks 5-6): **Stratigraphy Visualization**
**Goal**: Harris Matrix compliance

1. [P1] Harris Matrix data structure
   - Relationship validation, graph algorithms
   - **Est. effort**: 4 days
   
2. [P1] Harris Matrix visualization
   - Interactive diagram, SVG export
   - **Est. effort**: 5 days
   
3. [P1] Stratigraphic phasing
   - Period grouping, color coding
   - **Est. effort**: 3 days

### Sprint 4 (Weeks 7-8): **Offline Capability**
**Goal**: Field-ready offline support

1. [P0] Offline database (SQLite)
   - Local storage, entity sync
   - **Est. effort**: 5 days
   
2. [P0] Sync queue system
   - Request queuing, retry logic
   - **Est. effort**: 4 days
   
3. [P2] Conflict resolution
   - Detect conflicts, resolution UI
   - **Est. effort**: 3 days

### Sprint 5 (Weeks 9-10): **Spatial & Survey Tools**
**Goal**: GPS and planning capabilities

1. [P1] Survey grid management
   - Grid origin, coordinate conversion
   - **Est. effort**: 3 days
   
2. [P1] Spatial feature mapping
   - Draw polygons/points, measure tools
   - **Est. effort**: 4 days
   
3. [P1] Elevation/depth recording
   - Datum management, depth calculations
   - **Est. effort**: 3 days

### Sprint 6 (Weeks 11-12): **Polish & Quality**
**Goal**: Production readiness

1. [P2] Testing coverage
   - Unit tests, integration tests
   - **Est. effort**: 5 days
   
2. [P2] CI/CD pipeline
   - GitHub Actions, automated deployment
   - **Est. effort**: 2 days
   
3. [P2] Performance optimization
   - Database indexes, query optimization
   - **Est. effort**: 3 days
   
4. [P2] Security audit
   - Vulnerability scan, rate limiting
   - **Est. effort**: 2 days

---

## 🏆 FLL COMPETITION SPRINT (3-4 Weeks to Competition-Ready)

> **Reality Check**: Competition in ~6 weeks. Last 2-3 weeks = presentation prep & polish only.
> **Development window**: 3-4 weeks maximum for new features.
> **Goal**: Impressive demo + user validation, not production-ready software.

### Week 1: **Polish Core Features + One Wow Factor**
**Goal**: Make existing features flawless, add ONE impressive archaeological feature

#### Days 1-2: Bug Fixes & Polish
- [ ] Fix any remaining Android emulator issues (test login, upload, GPS)
- [ ] Test all existing features on web + native (make checklist)
- [ ] Fix any crashes or broken workflows
- [ ] Improve error messages (user-friendly, not technical)
- [ ] Add file metadata info icon (easy win, looks professional)

#### Days 3-5: ONE Wow Feature (Pick ONE)
**Option A: Basic Context Recording** (RECOMMENDED - core archaeological need)
- [ ] Simple context recording form (number, type, description, photos)
- [ ] Context list view (show all contexts for project)
- [ ] Link contexts to GPS location
- [ ] Export contexts to CSV
- **Why**: Shows you understand archaeological workflow
- **Demo line**: "Archaeologists can now record stratigraphic contexts digitally instead of paper forms"

**Option B: Harris Matrix Visualization** (IMPRESSIVE - if you're confident)
- [ ] Simple relationship recording (context A above context B)
- [ ] Auto-generate basic matrix diagram (can use simple tree layout)
- [ ] Export to image
- **Why**: Visually impressive, shows research depth
- **Demo line**: "Automatic Harris Matrix generation - industry standard for stratigraphy"

**Option C: Offline Mode Demo** (PRACTICAL - judges love offline)
- [ ] Queue failed requests when offline
- [ ] Auto-retry when back online
- [ ] Offline indicator in UI
- **Why**: Addresses real field constraint
- **Demo line**: "Works without internet - crucial for remote excavation sites"

### Week 2: **User Testing + Feedback Documentation**
**Goal**: Prove real people want this

#### Days 6-8: Find Real Users
- [ ] Contact 2-3 archaeology professors/students (email local university)
- [ ] Schedule 30-min demo sessions (Zoom is fine)
- [ ] Prepare demo script (show 3-4 key features in 10 minutes)
- [ ] Record their feedback (video if possible, notes minimum)

#### Days 9-10: Document Impact
- [ ] Create "User Feedback" document:
  - Problem quotes: "We currently use paper and it's a disaster..."
  - Feature reactions: "This would save us hours every day..."
  - Testimonials for presentation
- [ ] Calculate impact metrics:
  - "Saves X hours per excavation"
  - "Prevents Y% data loss vs paper"
  - "Used by Z archaeologists in testing"
- [ ] Take screenshots/videos of user testing sessions

### Week 3: **Presentation Materials**
**Goal**: Judges see a polished, well-researched innovation

#### Days 11-13: Presentation Deck
- [ ] **Slide 1**: Problem (show paper forms, messy notes, lost data)
- [ ] **Slide 2**: Research (Harris Matrix standards, archaeologist interviews)
- [ ] **Slide 3**: Solution overview (STRATUM features)
- [ ] **Slide 4-6**: Demo flow (3 key features with screenshots)
- [ ] **Slide 7**: User feedback (quotes + testimonials)
- [ ] **Slide 8**: Impact (metrics, scalability, future)
- [ ] **Slide 9**: Technical innovation (cross-platform, offline, GPS)

#### Days 14-15: Demo Video
- [ ] 2-3 minute video showing:
  - Problem scenario (archaeologist frustrated with paper)
  - App walkthrough (create project → record data → export)
  - User testimonial (if you got video)
- [ ] Polish with captions, music, smooth transitions
- [ ] Upload to YouTube (unlisted) for easy sharing

### Week 4: **Rehearsal + Final Polish**
**Goal**: Perfect your pitch

#### Days 16-18: Practice
- [ ] Rehearse presentation 5+ times
- [ ] Get feedback from teachers/teammates
- [ ] Refine based on feedback
- [ ] Prepare for judge questions:
  - "How is this different from existing apps?"
  - "What was your biggest challenge?"
  - "How did you validate this solves a real problem?"
  - "What's next for this project?"

#### Days 19-21: Buffer for Disasters
- [ ] Fix any bugs found during rehearsal
- [ ] Backup plan if demo fails (video ready)
- [ ] Print presentation materials
- [ ] Test on competition devices (if you have access)

### Last 2-3 Weeks Before Competition: **PRESENTATION ONLY**
- [ ] No new features (too risky!)
- [ ] Only critical bug fixes
- [ ] Focus on delivery, storytelling, team coordination
- [ ] Mock competitions with other teams
- [ ] Refine based on feedback

---

## 📋 COMPETITION DAY CHECKLIST

### Technical Prep
- [ ] App works on 2+ devices (backup if one fails)
- [ ] Internet connection NOT required for demo
- [ ] Demo data pre-loaded (don't create live, too risky)
- [ ] Screenshots/video backup if app crashes
- [ ] Charged devices + chargers

### Presentation Prep
- [ ] Presentation slides on USB + cloud (Google Slides)
- [ ] Printed handouts (optional but impressive)
- [ ] User testimonial quotes printed
- [ ] Team knows who says what
- [ ] Timer practiced (stay within time limit)

### Judge Questions Prep
- [ ] Everyone knows the problem deeply
- [ ] Can explain Harris Matrix in simple terms
- [ ] User research documented and memorized
- [ ] Technical challenges + solutions prepared
- [ ] Next steps / future vision clear

---

## 🎯 WHAT JUDGES ACTUALLY SCORE

### Innovation Project Rubric (FLL):

**1. Identify (25%)** - Did you clearly define the problem?
- ✅ You have this: Unorganized archaeological documentation
- 🎯 Strengthen: Show specific examples of lost data, wasted time

**2. Design (25%)** - Is your solution innovative and well-researched?
- ✅ You have this: Harris Matrix compliance, professional standards
- 🎯 Strengthen: Show you talked to real archaeologists

**3. Create (25%)** - Did you build a functional prototype?
- ✅ You have this: Working app with multiple features
- 🎯 Strengthen: One impressive archaeological-specific feature

**4. Iterate (25%)** - Did you test and improve based on feedback?
- ⚠️ CRITICAL GAP: Need user testing documentation
- 🎯 Action: Week 2 sprint focuses on this

### What Wins Competitions:
1. **Clear problem** (not just "apps are cool")
2. **Real user validation** (quotes from archaeologists)
3. **Working demo** (doesn't have to be perfect)
4. **Team passion** (you clearly care about this)
5. **Professional research** (Harris Matrix, standards)

### What Doesn't Matter:
- ❌ Production-ready code
- ❌ Every feature implemented
- ❌ Perfect UI design
- ❌ Scalability to millions of users
- ❌ Advanced AI/ML features

---

## 🚀 AI-ASSISTED DEVELOPMENT TIPS

### Effective Prompts for Claude:
```
Context: Building archaeological field documentation app (STRATUM).
Stack: FastAPI + PostgreSQL + React Native (Expo) + MinIO.
Current: [describe what exists]
Need: [specific feature from TODO]
Requirements:
- Cross-platform (web + native iOS/Android)
- Follow existing patterns in [file path]
- Include error handling
- Type-safe (TypeScript/Pydantic)

Generate: [specific deliverable]
```

### What to Have Claude Build:
- ✅ Data models (Context, Find, Sample)
- ✅ API routes (CRUD operations)
- ✅ Form components (recording sheets)
- ✅ Export functions (CSV generation)
- ✅ Validation schemas

### What to Build Yourself (or carefully review):
- ⚠️ Graph algorithms (Harris Matrix)
- ⚠️ Offline sync logic
- ⚠️ Cross-platform compatibility fixes
- ⚠️ GPS coordinate transformations
- ⚠️ File upload edge cases

### Iteration Pattern:
1. Get Claude to generate initial code
2. Test immediately (don't build 5 features first)
3. Document what breaks
4. Feed errors back to Claude
5. Repeat until working

---

## 📚 ARCHAEOLOGICAL STANDARDS REFERENCES

This TODO is informed by professional archaeological standards:

**Documentation Standards:**
- **Harris, E.C. (1979)** - *Principles of Archaeological Stratigraphy*
- **Museum of London Archaeological Site Manual (MoLAS, 1994)** - Field recording standards
- **Society for American Archaeology** - SAA Field Methods guidelines

**Data Archiving:**
- **Archaeology Data Service (ADS)** - UK digital archaeology repository
- **The Digital Archaeological Record (tDAR)** - US/international repository
- **MIDAS Heritage** - UK monument inventory standards

**GIS & Spatial Analysis:**
- **Open Geospatial Consortium (OGC)** - GeoJSON, KML standards
- **ESRI Shapefile** - Standard GIS vector format

**Stratigraphy:**
- **Harris Matrix** - Stratigraphic relationship visualization
- **Single Context Recording** - Context-based excavation methodology

---

## 🔄 MAINTENANCE & REVIEW

**Document Review Schedule:**
- **Weekly**: Update "Recently Completed" section
- **Bi-weekly**: Re-prioritize tasks based on field testing feedback
- **Monthly**: Review sprint priorities and adjust roadmap

**Stakeholder Input:**
- **Archaeological advisors**: Validate feature relevance and standards compliance
- **Field testers**: Report usability issues and workflow gaps
- **Development team**: Technical feasibility and effort estimates

**Version History:**
- **2025-12-16**: Complete restructure based on archaeological best practices
- Previous versions tracked in git history

---

**Last Updated**: 2025-12-16  
**Maintained By**: Development Team  
**Next Review**: 2025-12-30  

---

*This is a living document. Priorities may shift based on user feedback, field testing results, and team capacity. Always discuss major features with team before implementation. For questions about archaeological requirements, consult with archaeological advisors.*
