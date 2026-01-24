# Features Documentation ✨

STRATUM is packed with features to make archaeological documentation easier and more efficient. Let's explore what you can do!

---

## 🔐 Authentication

### User Registration & Login

STRATUM uses **Firebase Authentication** for secure, reliable user management.

**Features:**
- ✅ Email/password registration
- ✅ Secure password requirements
- ✅ Email verification (optional)
- ✅ Password reset via email
- ✅ Cross-platform sessions (iOS/Android/Web)

**User Experience:**
1. Register with email and password
2. Receive instant verification
3. Login from any device
4. Sessions persist across app restarts

**Security:**
- 🔒 Passwords never stored plainly
- 🔒 JWT tokens for API authentication
- 🔒 Automatic token refresh
- 🔒 Secure logout clears all credentials

---

## 📁 Projects

Projects represent archaeological sites or excavation campaigns. They're the organizational hub for all your work.

### Creating Projects

**What You Can Specify:**
- 📝 **Name**: Site or expedition name
- 📄 **Description**: Detailed information about the site
- 📍 **Location**: Geographic location
- 📅 **Dates**: Auto-tracked creation and update times

**Example Use Cases:**
- "Glina 2024 Excavation"
- "Tell el-Amarna Survey Project"
- "Roman Villa - Summer 2024"

### Project Dashboard

Each project includes:
- 📊 **Overview**: Quick stats and info
- 📝 **Notes**: All documentation
- 📂 **Files**: Organized file system
- 🖼️ **Gallery**: Timeline view of media
- 🏺 **Artifacts**: QR-coded find tracking
- 👥 **Team**: Member management

### Project Permissions

As a **Project Owner**, you can:
- ✏️ Edit project details
- 🗑️ Delete the project
- 👥 Manage all members
- 📊 Access all data

---

## 👥 Collaboration

Work together seamlessly with role-based permissions.

### Team Roles

#### 🎖️ Leader
**Full Project Access**
- Create, edit, and delete any notes
- Upload and manage all files
- Add/remove team members (except owner)
- View all project data

**Best For:**
- Field directors
- Project managers
- Senior archaeologists

#### 🔬 Researcher
**Active Contributor**
- Create and edit own notes
- View all notes
- Upload files
- View and download files
- Cannot manage team

**Best For:**
- Field archaeologists
- Graduate students
- Excavation crew

#### 👁️ Guest
**Read-Only Access**
- View all notes
- Download files
- No editing capabilities
- Cannot upload content

**Best For:**
- Consultants
- Visiting researchers
- Funding agencies
- Public stakeholders

### Inviting Team Members

**Process:**
1. Click "Team" in project dashboard
2. Search by email address
3. Select role (Leader/Researcher/Guest)
4. Invite member
5. They'll see project in their project list!

**Note:** Users must have a STRATUM account to be invited.

---

## 📝 Notes & Documentation

The heart of STRATUM - digital field notes that are searchable, organized, and backed up.

### Creating Notes

**Note Structure:**
- 📌 **Title**: Short, descriptive heading
- 📄 **Content**: Detailed text (supports markdown!)
- 📸 **Attachments**: Multiple photos
- 👤 **Author**: Auto-tracked
- 📅 **Timestamps**: Creation and last edit

**Example Notes:**
- "Trench 4 - Layer 3 - Ceramic Finds"
- "Daily Log - June 15, 2024"
- "Context 025 - Post Hole Documentation"

### Markdown Support

Notes support **Markdown formatting** for rich text:

```markdown
# Main Finding
Context 25 revealed **significant pottery** including:

- Red slip ware (5 sherds)
- Cooking pot fragments (12 pieces)
- 1 complete oil lamp

## Location
GPS: 45.123, -75.456
Depth: 1.2m below surface

### Photos
See attached images IMG_001 through IMG_003
```

**Renders as formatted text with:**
- Headers of different sizes
- **Bold** and *italic* text
- Bullet and numbered lists
- Code blocks

### Photo Attachments

**Supported Formats:**
- 📷 JPEG/JPG
- 📷 PNG
- 📷 HEIC (iOS)
- 📷 WebP
- 📷 GIF

**Features:**
- 🔄 Automatic upload to secure storage
- 📏 Original resolution preserved
- 🔗 Linked to notes
- 🖼️ Gallery view
- 📥 Easy download

**Best Practices:**
- Take multiple angles
- Include scale reference
- Name files descriptively
- Upload at end of day while WiFi available

### Note Organization

**Filtering:**
- By author
- By date range
- By project
- Search by keyword

**Viewing:**
- List view (chronological)
- Grid view (visual)
- Search results

---

## 📂 File System

Hierarchical file organization with folders, just like your computer!

### File Organization

**Structure:**
```
Project Root
├── Photos/
│   ├── Trench_1/
│   ├── Trench_2/
│   └── Finds/
├── Documents/
│   ├── Reports/
│   └── Maps/
├── Data/
│   ├── GPS_Logs/
│   └── Measurements/
└── 3D_Scans/
```

**Features:**
- 📁 Create nested folders
- 🔄 Move files and folders
- ✏️ Rename items
- 🗑️ Delete (with confirmation)
- 📥 Download individual or bulk
- 🔒 Locked folders (read-only)

### File Upload

**Supported Formats:**

| Category | Formats |
|----------|---------|
| **Images** | JPG, PNG, GIF, WebP, HEIC |
| **Documents** | PDF, TXT, MD |
| **Data** | CSV, XLS, XLSX, JSON |
| **3D Models** | PLY, LAS, LAZ, OBJ, GLB, GLTF |
| **Videos** | MP4, WebM, MOV, OGG |
| **GIS** | SHP (shapefiles) |

**Upload Methods:**
- 📤 File picker
- 📸 Direct camera capture (photos)
- 📋 Drag & drop (web)

**Smart Features:**
- ✅ Duplicate detection
- ✅ Conflict resolution (409 errors with user prompt)
- ✅ Progress indicators
- ✅ Background upload

### File Preview

View files without downloading!

**Preview Capabilities:**

| Format | Preview Type |
|--------|--------------|
| **Images** | Full-screen viewer with zoom |
| **PDFs** | Page-by-page viewer (web) |
| **Text/Markdown** | Formatted view with syntax |
| **CSV/Excel** | Spreadsheet grid view |
| **JSON** | Collapsible tree view |
| **3D Models** | Interactive 3D viewer |

**Features:**
- 🔍 Zoom in/out
- ⬅️➡️ Navigate between files
- ✏️ Edit text files inline (TXT, MD)
- 📊 Sort and filter data (CSV)
- 🧮 Math rendering (Markdown with KaTeX)

---

## 🖼️ Gallery View

Beautiful timeline-based view of all project media.

### View Modes

#### Grid View
- 📱 Thumbnail grid
- 📅 Grouped by time period
- 🖼️ Quick visual scan

#### List View
- 📋 Detailed file info
- 📏 File sizes visible
- 📅 Exact timestamps

### Time Grouping

**Organize files by:**
- **Day**: Files from each day grouped
- **Week**: Weekly sections
- **Month**: Monthly organization

**Smart Grouping:**
- Files sorted within groups
- Empty periods hidden
- Easy time navigation

### File Type Recognition

**Smart Icons:**
- 📷 Images (JPG, PNG, etc.)
- 📄 Documents (PDF, TXT, MD)
- 📊 Data files (CSV, Excel)
- 📑 PDFs
- 🎥 Videos
- 📦 Other files

**Quick Actions:**
- 👁️ Preview
- 📥 Download
- 🔗 Open in specialized viewer
- ℹ️ View details

---

## 🏺 Artifact Tracking

QR code-based system for physical artifact management.

### Creating Artifacts

**Artifact Information:**
- 🏷️ **Artifact Number**: Unique identifier (e.g., "GLN-2024-001")
- 📝 **Name**: Descriptive name
- 📸 **Photos**: Multiple images
- 📄 **Notes**: Detailed documentation
- 🔗 **Context**: Linked to find context

### QR Code System

**Each artifact gets:**
- 🔲 Unique QR code
- 🏷️ Printable label
- 📱 Mobile-scannable

**QR Code Contains:**
- Link to artifact detail page
- All attached photos
- Associated notes
- Context information

**Physical Workflow:**
1. Document artifact digitally
2. Generate QR code
3. Print label
4. Attach to artifact bag/box
5. Anyone can scan to see full documentation!

### Artifact Manifest

**Auto-generated `artefact.json`:**
```json
{
  "number": "GLN-2024-001",
  "name": "Ceramic Bowl Fragment",
  "previewFileId": 123,
  "images": [124, 125, 126],
  "notes": [45, 46]
}
```

**Benefits:**
- 📦 Machine-readable metadata
- 🔄 Easy data export
- 📊 Database integration
- 🔗 Links all related files

---

## 📊 Data Preview & Editing

### Text Files

**Editing Features:**
- ✏️ Inline editing
- 💾 Auto-save
- 📝 Markdown rendering
- 🧮 Math support (KaTeX)
- 🔍 Syntax highlighting

**Supported:**
- `.txt` - Plain text
- `.md` - Markdown

### CSV & Excel Files

**Data View:**
- 📊 Spreadsheet-style grid
- 🔢 Column headers
- 📏 Resizable columns
- 🔍 Sortable data
- 📋 Copy cells

**Features:**
- Large file support
- Scroll through data
- Quick statistics
- Export-ready format

### PDF Documents

**Viewing:**
- 📄 Page-by-page navigation
- 🔍 Zoom controls
- 📱 Mobile-friendly
- 🖥️ Web-optimized (Chromium)

**Note:** PDF editing not available - view-only mode.

### Images

**Viewer Features:**
- 🔍 Pinch to zoom
- 📱 Swipe between images
- 🔄 Rotate
- 📱 Full-screen mode
- 💾 Download original

---

## 🔍 Search & Filtering

Find anything quickly across your project.

### Search Capabilities

**Search Locations:**
- 📝 Note titles and content
- 📂 File names
- 👥 User names
- 📁 Folder names

**Search Features:**
- ⚡ Real-time results
- 🔤 Case-insensitive
- 🎯 Partial matching
- 🔍 Keyword highlighting

### Filtering Options

**Filter By:**
- 📅 Date range
- 👤 Author
- 🏷️ File type
- 📁 Folder location
- 🎯 Role (team view)

---

## 🔄 Sync & Offline (Coming Soon)

**Planned Features:**
- 💾 Local data caching
- 🔄 Automatic sync
- ✈️ Offline mode
- 🔁 Conflict resolution
- 📊 Sync status indicator

**Current Status:**
- ☁️ Cloud storage active
- 🔄 Real-time updates
- 📡 Online-only mode

---

## 📤 Export & Integration

### Current Export Options

**Via API:**
- 📊 JSON data export
- 📥 File downloads
- 🔌 REST API access

### Planned Export Features

- 📄 PDF reports
- 📊 CSV data dumps
- 🗺️ GIS exports
- 📈 Analysis-ready formats

---

## 🎨 User Interface

### STRATUM Theme

**Design Philosophy:**
- 🌑 Dark mode by default
- 🔴 Red accent color (#FF2A2A)
- ⬛ Minimal, clean interface
- 📱 Touch-friendly controls

**Inspired By:**
- Nothing phone aesthetic
- Archaeological precision
- Modern minimalism

### Cross-Platform UI

**Consistent Across:**
- 📱 iOS
- 🤖 Android
- 🖥️ Web

**Platform Adaptations:**
- Native navigation patterns
- Platform-specific controls
- Optimized performance

---

## 🔔 Notifications (Planned)

**Upcoming Features:**
- 📬 New member joined
- 📝 Note was edited
- 📤 File uploaded
- 👥 You were invited to project
- 💬 Comment mentions

---

## 📈 Activity & Analytics

### Project Stats

**Track:**
- 📊 Total notes
- 📂 Total files
- 💾 Storage used
- 👥 Team members
- 📅 Last activity

### Personal Stats

**Your Activity:**
- ✏️ Notes created
- 📸 Photos uploaded
- 👥 Projects joined
- 🕒 Last login

---

## 🎯 Advanced Features

### Harris Matrix Support

**For Stratigraphic Recording:**
- 📋 Context forms
- 🗺️ Layer relationships
- 📊 Matrix visualization (coming)

**Current Support:**
- Template forms included
- Data structure compatible
- Visualization in development

### 3D Model Viewing

**Supported Formats:**
- PLY (Point clouds)
- LAS/LAZ (LiDAR)
- OBJ (Mesh models)
- GLB/GLTF (3D models)

**Features:**
- 🔄 Rotate and pan
- 🔍 Zoom
- 🎨 Rendering options
- 📏 Measurements (coming)

---

## 🚀 Performance Features

**Optimizations:**
- ⚡ Lazy loading
- 🖼️ Image compression
- 📦 Efficient pagination
- 🔄 Smart caching
- 📡 Background uploads

**Result:**
- Fast load times
- Smooth scrolling
- Responsive UI
- Battery efficient

---

## 💡 Pro Tips

### Efficient Note-Taking
1. Use consistent naming: "Location - Context - Type"
2. Take photos as you document
3. Write notes end-of-day while fresh
4. Use markdown for structure

### File Organization
1. Create folder structure early
2. Use descriptive folder names
3. Group by context/feature/date
4. Keep related files together

### Team Collaboration
1. Assign clear roles
2. Use descriptive note titles
3. Upload files promptly
4. Review team's work regularly

### Artifact Management
1. Number systematically
2. Generate QR codes immediately
3. Print labels in batches
4. Keep digital-physical sync

---

## 🆕 Recently Added

**Latest Features:**
- ✅ PDF preview (web)
- ✅ Gallery view improvements
- ✅ File move with conflict detection
- ✅ Markdown math support (KaTeX)
- ✅ Artifact QR generation
- ✅ Excel file preview

**Coming Next:** See [Roadmap](Roadmap-&-Future-Plans)!

---

## 📚 Related Documentation

- [Getting Started](Getting-Started) - Learn the basics
- [API Reference](API-Reference) - Developer documentation
- [Troubleshooting](Troubleshooting) - Common issues
- [Roadmap](Roadmap-&-Future-Plans) - What's coming next

---

<div align="center">

**Ready to explore more?**

[← Architecture Overview](Architecture-Overview) | [API Reference →](API-Reference)

</div>
