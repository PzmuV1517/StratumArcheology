# STRATUM Frontend Project Structure

This document describes the organization of the Stratum mobile/web application codebase.

## Overview

```
frontend/stratum-app/
├── app/                    # Expo Router pages (file-based routing)
├── src/                    # Application source code
│   ├── components/         # React components organized by feature
│   ├── config/             # Configuration files
│   ├── contexts/           # React Context providers
│   ├── db/                 # Local database (SQLite/Expo SQLite)
│   ├── declarations/       # TypeScript declaration files
│   ├── hooks/              # Custom React hooks
│   ├── services/           # API and business logic services
│   └── utils/              # Utility functions
├── assets/                 # Static assets (images, fonts)
├── __tests__/              # Test files
└── [config files]          # Project configuration
```

---

## Directory Details

### `/app` - Expo Router Pages

File-based routing using [Expo Router](https://docs.expo.dev/router/introduction/). Each file becomes a route.

```
app/
├── _layout.tsx             # Root layout (auth provider, websocket, etc.)
├── _layout.web.tsx         # Web-specific root layout
├── index.tsx               # Landing page (/)
├── (auth)/                 # Authentication routes (grouped)
│   ├── _layout.tsx         # Auth layout
│   ├── login.tsx           # /login
│   └── register.tsx        # /register
├── (tabs)/                 # Main tabbed navigation (authenticated)
│   ├── _layout.tsx         # Tab bar layout
│   ├── index.tsx           # Home tab
│   ├── explore.tsx         # Explore/search tab
│   ├── overview.tsx        # Projects overview
│   ├── gps.tsx             # GPS/Map tab
│   ├── profile.tsx         # User profile
│   └── settings.tsx        # Settings (tab-level)
├── project/
│   └── [id].tsx            # Project detail page /project/:id
├── artefact/
│   └── [id].tsx            # Artefact detail page /artefact/:id
├── voice-note/
│   └── [id].tsx            # Voice note playback /voice-note/:id
├── create-note.tsx         # Create new note
├── edit-note.tsx           # Edit existing note
├── note-detail.tsx         # View note details
├── edit-project.tsx        # Edit project settings
├── data-preview.tsx        # File/data preview
├── image-preview.tsx       # Image viewer
├── invite.tsx              # Accept invitation
├── join-project.tsx        # Join project via code
├── modal.tsx               # Create project modal
├── settings.tsx            # Global settings
├── ColorBends.tsx          # Deprecated route (compatibility)
└── AuthRedirector.tsx      # Authentication redirect logic
```

### `/src/components` - React Components

Components are organized by feature/domain:

```
src/components/
├── common/                 # Shared, reusable components
│   ├── Button.tsx          # Styled button
│   ├── Card.tsx            # Card container
│   ├── DraftStatusIndicator.tsx  # Auto-save status indicator
│   ├── Loading.tsx         # Loading spinners
│   ├── MarkdownView.tsx    # Markdown renderer
│   ├── NetworkStatusIndicator.tsx  # Online/offline badge
│   ├── OfflineBanner.tsx   # Offline notification banner
│   ├── QRCodeView.tsx      # QR code display
│   ├── TextInput.tsx       # Styled text input
│   └── index.ts            # Barrel export
│
├── data/                   # Data visualization panels
│   ├── AudioPanel.tsx      # Audio player (+ .native.tsx, .web.tsx)
│   ├── CsvPanel.tsx        # CSV data table
│   ├── ExcelPanel.tsx      # Excel file viewer
│   ├── GridPanel.tsx       # Generic grid display
│   ├── MeshPanel.tsx       # 3D mesh viewer (+ .native.tsx, .web.tsx)
│   ├── PdfPanel.tsx        # PDF document viewer
│   ├── PhotoPanel.tsx      # Image gallery
│   ├── PointCloudPanel.tsx # Point cloud viewer
│   ├── TextFilePanel.tsx   # Text file viewer
│   ├── VideoPanel.tsx      # Video player
│   └── las.ts              # LAS file parser
│
├── effects/                # Visual effect components (web-only)
│   ├── CardSwap.jsx        # Card carousel effect
│   ├── ColorBends.jsx      # Animated color gradients
│   ├── DotGrid.jsx         # Interactive dot grid
│   ├── FaultyTerminal.jsx  # Terminal typing effect
│   ├── GradualBlur.jsx     # Blur transition effect
│   ├── StarBorder.jsx      # Animated star border
│   └── *.css               # Associated CSS files
│
├── files/                  # File management components
│   ├── FileUploadMenu.tsx  # File upload interface
│   └── SharedFilesView.tsx # Shared files browser
│
├── map/                    # Map/GIS components
│   ├── MapEditor.tsx       # Main map editor (+ .native.tsx, .web.tsx)
│   └── ...
│
├── matrix/                 # Harris Matrix visualization
│   ├── HarrisMatrix.web.tsx    # Web implementation
│   ├── HarrisMatrix.native.tsx # Native implementation
│   ├── HarrisMatrixHTML.ts     # HTML generation
│   ├── registryModels.ts       # Data models
│   └── index.ts
│
├── project/                # Project-specific components
│   ├── ArtefactsTab.tsx    # Artefacts list tab
│   ├── FileGallery.tsx     # Project file gallery
│   ├── FilesOverlay.tsx    # Files sidebar/overlay
│   ├── MembersModal.tsx    # Team members management
│   ├── MoveBanner.tsx      # File move operation banner
│   ├── MyFolderSettingsModal.tsx  # Folder settings
│   ├── NotesSection.tsx    # Project notes section
│   ├── ProjectHeader.tsx   # Project header/title
│   ├── TimeMachineTab.tsx  # Version history tab
│   ├── ToolsTab.tsx        # GPS/Compass tools tab
│   └── modals/             # Modal dialogs
│       ├── DeleteConfirmModal.tsx
│       ├── NewFolderModal.tsx
│       ├── ProjectActionModal.tsx
│       ├── ProjectMenuModal.tsx
│       └── RenameModal.tsx
│
├── sync/                   # Sync-related components
│   └── ConflictResolutionModal.tsx  # Merge conflict resolver
│
├── timeline/               # Activity timeline
│   ├── Timeline.tsx        # Timeline component
│   └── index.ts
│
└── ui/                     # Base UI primitives
    ├── collapsible.tsx     # Collapsible section
    ├── haptic-tab.tsx      # Tab with haptic feedback
    ├── icon-symbol.tsx     # Platform icon symbols
    ├── icon-symbol.ios.tsx # iOS-specific icons
    ├── themed-text.tsx     # Themed text component
    └── themed-view.tsx     # Themed view container
```

### `/src/config` - Configuration

```
src/config/
├── config.ts               # Main app configuration (API URLs, Firebase)
└── theme.ts                # Color theme definitions
```

**Configuration priority (config.ts):**
1. `EXPO_PUBLIC_API_URL` environment variable
2. `app.json` extra.apiBaseUrl
3. Platform-specific defaults (localhost, 10.0.2.2, etc.)

### `/src/contexts` - React Contexts

```
src/contexts/
├── AuthContext.tsx         # Authentication state & methods
└── WebSocketContext.tsx    # Real-time WebSocket connection
```

### `/src/db` - Local Database

```
src/db/
├── database.ts             # Database initialization
├── schema.ts               # Table schemas
└── index.ts                # Exports
```

Uses Expo SQLite for offline data storage.

### `/src/hooks` - Custom Hooks

```
src/hooks/
├── index.ts                # Barrel export
├── useActivity.ts          # Activity/timeline hook
├── useAuth.ts              # Authentication hook
├── useAutoSave.ts          # Auto-save with draft support
├── useFiles.ts             # File operations hook
├── useNotes.ts             # Notes CRUD hook
├── useProject.ts           # Project data hook
├── use-color-scheme.ts     # System color scheme detection
├── use-color-scheme.web.ts # Web-specific color scheme
└── use-theme-color.ts      # Theme color utilities
```

### `/src/services` - API & Business Logic

```
src/services/
├── index.ts                # Service exports
│
├── api.ts                  # Base API client (Axios with auth)
├── authService.ts          # Authentication (login, register, tokens)
├── authService.types.ts    # Auth type definitions
│
├── projectService.ts       # Project CRUD, invites, members
├── projectService.types.ts # Project type definitions
│
├── fileService.ts          # File platform switcher
├── fileService.core.ts     # Shared file logic
├── fileService.native.ts   # Native file operations
├── fileService.web.ts      # Web file operations
│
├── noteService.ts          # Notes platform switcher
├── noteService.core.ts     # Shared notes logic
├── noteService.native.ts   # Native notes (offline support)
├── noteService.web.ts      # Web notes
│
├── formsService.ts         # Form submissions (artefacts, etc.)
├── formsService.types.ts   # Form type definitions
│
├── activityService.ts      # Activity feed/timeline
├── activityService.types.ts
│
├── socketService.ts        # WebSocket client
├── networkService.ts       # Network status detection
│
├── offlineService.ts       # Offline data management
├── offlineQueueService.ts  # Offline operation queue
└── syncService.ts          # Data synchronization
```

### `/src/utils` - Utilities

```
src/utils/
├── artefactManifest.ts     # Artefact file manifest utilities
└── storage.ts              # Async storage wrapper
```

### `/src/declarations` - TypeScript Declarations

```
src/declarations/
└── react-dom-server.d.ts   # Type declarations for SSR
```

---

## Platform-Specific Files

Files with platform suffixes are auto-resolved by Metro bundler:

- `.native.tsx` - Used on iOS and Android
- `.web.tsx` - Used on web
- `.ios.tsx` - iOS only
- `.android.tsx` - Android only

Example: `MapEditor.tsx` (base) → `MapEditor.native.tsx` / `MapEditor.web.tsx`

---

## Import Aliases

The `@/` alias points to the `src/` directory:

```typescript
// Instead of:
import { projectService } from "../../src/services/projectService";

// Use:
import { projectService } from "@/services/projectService";
```

Configured in `tsconfig.json`:
```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

---

## Key Files

| File | Purpose |
|------|---------|
| `app.json` | Expo configuration, Firebase keys |
| `tsconfig.json` | TypeScript configuration |
| `package.json` | Dependencies and scripts |
| `tailwind.config.js` | Tailwind CSS (web) |
| `eas.json` | EAS Build configuration |
| `.env.example` | Environment variable template |

---

## Assets

```
assets/
├── fonts/                  # Custom fonts
└── images/                 # App icons, splash screens
    ├── icon.png            # App icon
    ├── splash-icon.png     # Splash screen
    ├── android-*.png       # Android adaptive icons
    └── favicon.png         # Web favicon
```
