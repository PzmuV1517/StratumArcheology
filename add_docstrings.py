"""
Script to add file-level docstrings with MIT License to all source files.
Handles both Python (.py) and TypeScript/TSX (.ts, .tsx) files.
"""

import os
import re
import ast
from pathlib import Path

ROOT = Path(__file__).parent

LICENSE_TEXT = """MIT License

Copyright (c) 2025 Banu Andrei & Mircea Levin-Constantin

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE."""

# ── File description lookup ──────────────────────────────────────────────────

PYTHON_DESCRIPTIONS = {
    # app/
    "backend/app/__init__.py": "STRATUM backend application package initializer.",
    "backend/app/config.py": "Application configuration using Pydantic settings.\n\nLoads environment variables for Firebase, PostgreSQL, MinIO, JWT,\nand other service configurations with sensible defaults.",
    "backend/app/database.py": "SQLAlchemy database engine and session configuration.\n\nProvides the database engine, session factory, declarative base,\nand a dependency function for obtaining database sessions.",
    "backend/app/dependencies.py": "FastAPI dependency injection functions for authentication and authorization.\n\nProvides dependencies for extracting the current user from JWT tokens\nand checking project-level permissions based on role hierarchy.",
    "backend/app/firebase_config.py": "Firebase Admin SDK initialization and token verification.\n\nConfigures Firebase using service account credentials from environment\nvariables and provides helper functions for verifying Firebase ID tokens.",
    "backend/app/main.py": "STRATUM API — Archaeological Site Management Platform.\n\nMain FastAPI application entry point with error handling middleware,\nstructured logging, CORS configuration, and route registration.\n\nIMPORTANT: Database migrations are handled by Alembic, NOT create_all().\nRun migrations with: alembic upgrade head",
    "backend/app/minio_client.py": "MinIO object storage client for file management.\n\nProvides an async-friendly wrapper around the MinIO Python SDK\nfor uploading, downloading, deleting files, and generating\npresigned URLs for direct client access.",
    "backend/app/models.py": "SQLAlchemy ORM models for the STRATUM database.\n\nDefines all database tables including User, Project, Note, FileNode,\nFileVersion, NoteAttachment, ProjectGPS, ProjectInvite, ProjectActivity,\nQRCode, and their relationships.",
    "backend/app/rate_limiter.py": "Rate limiter module (deprecated).\n\nOriginally provided Flask-based rate limiting. Currently inactive\nas the application has migrated to FastAPI.",
    "backend/app/schemas.py": "Pydantic schemas for request validation and response serialization.\n\nDefines data transfer objects for authentication, users, projects,\nnotes, files, invites, and other API resources.",
    "backend/app/validation.py": "Enhanced data validation for STRATUM.\n\nProvides comprehensive input validation including GPS coordinate\nvalidation, file type validation with magic bytes, string sanitization\nto prevent injection attacks, and Pydantic models with custom validators.",
    "backend/app/websocket.py": "WebSocket manager for real-time project updates.\n\nHandles Socket.IO connections, project room management, and broadcasts\nfor member kicks, role changes, content updates, and activity logging.",
    # middleware/
    "backend/app/middleware/__init__.py": "STRATUM backend middleware package.\n\nExports error handling middleware, structured logging configuration,\nand logging context utilities.",
    "backend/app/middleware/error_handler.py": "Centralized error handling middleware for STRATUM.\n\nProvides structured error logging, database transaction rollback on errors,\nMinIO file cleanup on upload errors, request timing, and user-friendly\nerror responses with request ID tracking.",
    "backend/app/middleware/logging_config.py": "Structured logging configuration for STRATUM.\n\nProvides structured logging with contextual information (user_id,\nproject_id, action, request_id) using structlog for JSON-formatted,\ncontextual logging suitable for production monitoring systems.",
    # routes/
    "backend/app/routes/__init__.py": "STRATUM API routes package initializer.",
    "backend/app/routes/auth.py": "Authentication and user management API routes.\n\nHandles user registration, login (Firebase Auth + JWT), token verification,\nprofile management, onboarding status, and user search.",
    "backend/app/routes/projects.py": "Project management API routes.\n\nHandles CRUD operations for archaeological site projects, member management\n(add, remove, role changes), ownership transfer, and Harris Matrix data.",
    "backend/app/routes/notes.py": "Note management API routes.\n\nHandles CRUD operations for project notes, note-to-file synchronization,\nnote attachments (photos, audio), and content streaming with HTTP Range\nsupport for mobile clients.",
    "backend/app/routes/files.py": "File management API routes.\n\nHandles file uploads, downloads, folder creation, file versioning (Time Machine),\nprivacy controls, profile pictures, personal folders, and streaming with\nHTTP Range support.",
    "backend/app/routes/gps.py": "GPS coordinate management API routes.\n\nHandles reading and updating GPS coordinates (work areas and excavation\nsite polygons) for archaeological projects.",
    "backend/app/routes/forms.py": "Archaeological form management API routes.\n\nHandles appending structured records (context features, stratigraphic units,\nartefacts) to locked CSV files within project Forms folders.",
    "backend/app/routes/invites.py": "Project invite management API routes.\n\nHandles creating invite tokens with short codes, accepting invites via\ntoken or short code, and managing single-use and multi-use invitations.",
    "backend/app/routes/convert.py": "Data conversion API routes for point clouds and large data formats.\n\nHandles server-side conversion of LAS/LAZ point cloud files to PLY format\nfor browser-based 3D visualization.",
    "backend/app/routes/qrcodes.py": "Unified QR code registry API routes.\n\nHandles creating and resolving QR codes that map unique identifiers\n(e.g. STR-X7K9M2P4) to application resources like artefacts and invites.",
    "backend/app/routes/activities.py": "Project activity timeline API routes.\n\nHandles retrieving project activities in reverse chronological order\nand personal activity feeds across all user projects.",
    # tests/
    "backend/tests/__init__.py": "STRATUM backend test suite package initializer.",
    "backend/tests/test_middleware.py": "Tests for STRATUM backend middleware.\n\nTests the error handling and logging middleware including request ID\ngeneration, error response formatting, and upload cleanup tracking.\n\nRun with: pytest backend/tests/test_middleware.py -v",
    "backend/tests/test_validation.py": "Tests for STRATUM backend validation layer.\n\nTests the validation module including GPS coordinate validation,\nfile type validation with magic bytes, string sanitization, and\nSQL injection prevention.\n\nRun with: pytest backend/tests/test_validation.py -v",
    # alembic
    "backend/alembic/env.py": "Alembic migration environment configuration.\n\nConfigures the Alembic migration runner for both offline (SQL generation)\nand online (direct database) migration modes using SQLAlchemy.",
}

TS_DESCRIPTIONS = {
    # services
    "src/services/api.ts": "Axios HTTP client configuration with authentication interceptors.\n\nProvides a pre-configured API client that automatically attaches\nJWT tokens and handles token refresh for all backend requests.",
    "src/services/authService.ts": "Firebase authentication service.\n\nHandles user registration, login, token verification, and session\nmanagement using Firebase Auth with JWT token integration.",
    "src/services/authService.types.ts": "TypeScript type definitions for the authentication service.\n\nDefines interfaces for auth requests, responses, user data,\nand token payloads.",
    "src/services/projectService.ts": "Project management service.\n\nProvides functions for creating, reading, updating, and deleting\narchaeological site projects, managing members, and handling\nproject-level operations via the backend API.",
    "src/services/projectService.types.ts": "TypeScript type definitions for the project service.\n\nDefines interfaces for projects, project members, roles,\nand API request/response shapes.",
    "src/services/noteService.ts": "Note management service (platform-agnostic entry point).\n\nRe-exports platform-specific note service implementations\nfor web and native platforms.",
    "src/services/noteService.core.ts": "Core note management business logic.\n\nProvides shared functions for creating, reading, updating, and deleting\nproject notes via the backend API.",
    "src/services/noteService.web.ts": "Web-specific note service implementation.\n\nExtends core note functionality with web-specific features.",
    "src/services/noteService.native.ts": "Native (React Native) note service implementation.\n\nExtends core note functionality with native platform features.",
    "src/services/fileService.ts": "File management service (platform-agnostic entry point).\n\nRe-exports platform-specific file service implementations\nfor web and native platforms.",
    "src/services/fileService.core.ts": "Core file management business logic.\n\nProvides shared functions for uploading, downloading, listing, and\ndeleting project files via the backend API and MinIO storage.",
    "src/services/fileService.web.ts": "Web-specific file service implementation.\n\nExtends core file functionality with browser-specific download\nand upload features.",
    "src/services/fileService.native.ts": "Native (React Native) file service implementation.\n\nExtends core file functionality with native file system access\nand sharing capabilities.",
    "src/services/formsService.ts": "Archaeological forms service.\n\nProvides functions for submitting context features, stratigraphic units,\nand artefact records to the backend API.",
    "src/services/formsService.types.ts": "TypeScript type definitions for the forms service.\n\nDefines interfaces for context features, stratigraphic units,\nartefact records, and form submission payloads.",
    "src/services/socketService.ts": "Socket.IO client service for real-time communication.\n\nManages WebSocket connections to the backend for receiving\nreal-time project updates, member changes, and content notifications.",
    "src/services/syncService.ts": "Data synchronization service.\n\nHandles syncing local data with the backend, managing conflicts,\nand maintaining data consistency across sessions.",
    "src/services/offlineService.ts": "Offline data management service.\n\nProvides offline-first capabilities by caching data locally\nand syncing when network connectivity is restored.",
    "src/services/offlineQueueService.ts": "Offline operation queue service.\n\nQueues API operations performed while offline and replays\nthem in order when connectivity is restored.",
    "src/services/networkService.ts": "Network connectivity monitoring service.\n\nDetects and tracks network status changes to coordinate\nonline/offline behavior across the application.",
    "src/services/qrService.ts": "QR code scanning and resolution service.\n\nProvides functions for scanning QR codes and resolving them\nto application resources via the backend API.",
    "src/services/qrcode.ts": "QR code generation utilities.\n\nProvides functions for generating QR code images from\nresource identifiers.",
    "src/services/activityService.ts": "Project activity timeline service.\n\nProvides functions for fetching project timeline activities\nand personal activity feeds from the backend API.",
    "src/services/activityService.types.ts": "TypeScript type definitions for the activity service.\n\nDefines interfaces for activity types, timeline entries,\nand activity feed responses.",
    "src/services/index.ts": "Service layer barrel export.\n\nRe-exports all service modules for convenient importing\nthroughout the application.",
    # hooks
    "src/hooks/useAuth.ts": "Authentication hook.\n\nProvides authentication state and actions (login, register,\nlogout) to React components via the AuthContext.",
    "src/hooks/useProject.ts": "Project management hook.\n\nProvides project data, loading states, and CRUD actions\nfor the currently selected archaeological project.",
    "src/hooks/useNotes.ts": "Note management hook.\n\nProvides note data, loading states, and CRUD actions\nfor project notes.",
    "src/hooks/useFiles.ts": "File management hook.\n\nProvides file listing, upload, download, and deletion\nfunctionality for project files.",
    "src/hooks/useAutoSave.ts": "Auto-save hook.\n\nAutomatically saves content changes after a debounce\nperiod to prevent data loss.",
    "src/hooks/useDelayedLoading.ts": "Delayed loading indicator hook.\n\nShows a loading indicator only after a brief delay to\navoid flickering for fast operations.",
    "src/hooks/useActivity.ts": "Activity timeline hook.\n\nProvides project activity timeline data and refresh\ncapabilities for the activity feed.",
    "src/hooks/use-theme-color.ts": "Theme color hook.\n\nReturns the appropriate color value from the current theme\nfor use in component styling.",
    "src/hooks/use-color-scheme.ts": "Color scheme detection hook.\n\nDetects and returns the current system color scheme\n(light or dark) for theme adaptation.",
    "src/hooks/use-color-scheme.web.ts": "Web-specific color scheme detection hook.\n\nUses CSS media queries to detect browser color scheme\npreferences.",
    "src/hooks/index.ts": "Hooks barrel export.\n\nRe-exports all custom hooks for convenient importing.",
    # contexts
    "src/contexts/AuthContext.tsx": "Authentication context provider.\n\nProvides authentication state (user, token, loading) and actions\n(login, register, logout) to all child components via React Context.",
    "src/contexts/WebSocketContext.tsx": "WebSocket context provider.\n\nManages Socket.IO connection lifecycle and provides real-time\nevent subscription capabilities to child components.",
    "src/contexts/ProjectDetailContext.tsx": "Project detail context provider.\n\nProvides project-specific state (members, files, notes) and actions\nto all components within a project detail view.",
    "src/contexts/OnboardingContext.tsx": "Onboarding context provider.\n\nManages onboarding flow state and tracks user tutorial\ncompletion status.",
    # db
    "src/db/index.ts": "Local database barrel export.\n\nRe-exports database initialization and schema modules.",
    "src/db/database.ts": "Local SQLite database initialization and management.\n\nConfigures the local database for offline-first data persistence\nusing Expo SQLite or a web-compatible alternative.",
    "src/db/schema.ts": "Local database schema definitions.\n\nDefines table schemas for local offline data storage.",
    # config
    "src/config/config.ts": "Application configuration constants.\n\nDefines API base URLs, feature flags, and environment-specific\nsettings for the STRATUM mobile and web application.",
    "src/config/theme.ts": "Theme configuration.\n\nDefines color palettes, typography, spacing, and other design\ntokens for consistent styling across the application.",
    # utils
    "src/utils/artefactManifest.ts": "Artefact manifest utility.\n\nProvides functions for building and parsing artefact\nmetadata manifests.",
    "src/utils/alert.tsx": "Cross-platform alert utility.\n\nProvides a unified alert dialog API that works across\nweb and native platforms.",
    "src/utils/storage.ts": "Cross-platform storage utility.\n\nProvides a unified key-value storage API using AsyncStorage\nor localStorage depending on the platform.",
    # components
    "src/components/common/Button.tsx": "Reusable button component.\n\nA themed button with loading state, icon support, and\nmultiple visual variants.",
    "src/components/common/Card.tsx": "Reusable card component.\n\nA themed container with shadow, border radius, and\nconsistent padding.",
    "src/components/common/Loading.tsx": "Loading indicator component.\n\nDisplays a centered activity indicator with optional\nloading message text.",
    "src/components/common/TextInput.tsx": "Themed text input component.\n\nA styled text input with label, error state, and\nplatform-appropriate behavior.",
    "src/components/common/Skeleton.tsx": "Skeleton loading placeholder component.\n\nDisplays animated placeholder shapes while content\nis loading.",
    "src/components/common/MarkdownView.tsx": "Markdown rendering component.\n\nRenders Markdown content with proper styling for\nboth web and native platforms.",
    "src/components/common/QRCodeView.tsx": "QR code display component.\n\nRenders a QR code image from a string value with\ncustomizable size and colors.",
    "src/components/common/NetworkStatusIndicator.tsx": "Network status indicator component.\n\nDisplays the current online/offline connectivity status\nwith appropriate visual feedback.",
    "src/components/common/OfflineBanner.tsx": "Offline banner component.\n\nDisplays a persistent banner when the device is offline\nto inform users of limited functionality.",
    "src/components/common/DraftStatusIndicator.tsx": "Draft status indicator component.\n\nShows auto-save status (saving, saved, error) for\ncontent being edited.",
    "src/components/common/AndroidAlertOverride.tsx": "Android alert override component.\n\nProvides custom alert dialogs for Android that match\nthe application's design language.",
    "src/components/common/index.ts": "Common components barrel export.\n\nRe-exports all shared UI components.",
    "src/components/ui/collapsible.tsx": "Collapsible section component.\n\nAn expandable/collapsible container with animated\nheight transitions.",
    "src/components/ui/icon-symbol.tsx": "Platform-agnostic icon component.\n\nRenders SF Symbols on iOS and Material Icons on other\nplatforms.",
    "src/components/ui/icon-symbol.ios.tsx": "iOS-specific icon symbol component.\n\nRenders native SF Symbol icons on iOS devices.",
    "src/components/ui/haptic-tab.tsx": "Haptic feedback tab component.\n\nA tab bar button that provides haptic feedback on press\nfor supported devices.",
    "src/components/ui/themed-text.tsx": "Themed text component.\n\nA text component that automatically applies the current\ntheme's typography styles.",
    "src/components/ui/themed-view.tsx": "Themed view component.\n\nA view component that automatically applies the current\ntheme's background color.",
    "src/components/ui/liquid-glass.ts": "Liquid Glass design system utilities.\n\nProvides shared styles and helpers for the Liquid Glass\nvisual design language.",
    "src/components/ui/LiquidGlassCard.tsx": "Liquid Glass card component.\n\nA card with frosted glass visual effect following Apple's\nLiquid Glass design language.",
    "src/components/ui/LiquidGlassToolbar.tsx": "Liquid Glass toolbar component.\n\nA toolbar with frosted glass visual effect.",
    "src/components/ui/LiquidGlassActionSheet.tsx": "Liquid Glass action sheet component.\n\nA bottom action sheet with frosted glass visual effect.",
    "src/components/ui/LiquidGlassSwitch.tsx": "Liquid Glass toggle switch component.\n\nA toggle switch styled with the Liquid Glass design language.",
    "src/components/ui/LiquidGlassTextField.tsx": "Liquid Glass text field component.\n\nA text input styled with the Liquid Glass design language.",
    "src/components/ui/LiquidPillTabBar.tsx": "Liquid pill tab bar component.\n\nA segmented tab bar with pill-shaped active indicator\nand smooth animation.",
    "src/components/ui/LiquidGlassButton.tsx": "Liquid Glass button component.\n\nA button styled with the Liquid Glass design language.",
    "src/components/ui/LiquidGlassSlider.tsx": "Liquid Glass slider component.\n\nA range slider styled with the Liquid Glass design language.",
    "src/components/ui/LiquidGlassSearchBar.tsx": "Liquid Glass search bar component.\n\nA search input with frosted glass visual effect.",
    "src/components/ui/LiquidGlassNavBar.tsx": "Liquid Glass navigation bar component.\n\nA navigation bar with frosted glass visual effect.",
    "src/components/ui/LiquidGlassStepper.tsx": "Liquid Glass stepper component.\n\nAn increment/decrement stepper styled with Liquid Glass.",
    "src/components/ui/LiquidGlassSheet.tsx": "Liquid Glass bottom sheet component.\n\nA draggable bottom sheet with frosted glass visual effect.",
    "src/components/ui/LiquidGlassSegmentedControl.tsx": "Liquid Glass segmented control component.\n\nA segmented control styled with the Liquid Glass design language.",
    # matrix
    "src/components/matrix/index.ts": "Harris Matrix components barrel export.",
    "src/components/matrix/HarrisMatrixHTML.ts": "Harris Matrix HTML template generator.\n\nGenerates the HTML/JavaScript for rendering an interactive\nHarris Matrix visualization using D3.js.",
    "src/components/matrix/HarrisMatrix.native.tsx": "Harris Matrix component for React Native.\n\nRenders the Harris Matrix visualization in a WebView\non native platforms.",
    "src/components/matrix/HarrisMatrix.web.tsx": "Harris Matrix component for web.\n\nRenders the Harris Matrix visualization directly in\nthe DOM using an iframe.",
    "src/components/matrix/registryModels.ts": "Harris Matrix registry data models.\n\nDefines TypeScript interfaces for stratigraphic units,\nrelationships, and matrix node data.",
    # timeline
    "src/components/timeline/index.ts": "Timeline components barrel export.",
    "src/components/timeline/Timeline.tsx": "Project activity timeline component.\n\nDisplays a chronological list of project activities\nwith user attribution and activity type icons.",
    # data panels
    "src/components/data/PhotoPanel.tsx": "Photo viewer panel component.\n\nDisplays image files with zoom, pan, and metadata\ninspection capabilities.",
    "src/components/data/VideoPanel.tsx": "Video player panel component (platform-agnostic entry point).",
    "src/components/data/VideoPanel.native.tsx": "Video player panel for React Native.\n\nPlays video files using the native video player.",
    "src/components/data/VideoPanel.web.tsx": "Video player panel for web.\n\nPlays video files using the HTML5 video element.",
    "src/components/data/AudioPanel.tsx": "Audio player panel component (platform-agnostic entry point).",
    "src/components/data/AudioPanel.native.tsx": "Audio player panel for React Native.\n\nPlays audio files using the native audio player.",
    "src/components/data/AudioPanel.web.tsx": "Audio player panel for web.\n\nPlays audio files using the HTML5 audio element.",
    "src/components/data/PdfPanel.tsx": "PDF viewer panel component (platform-agnostic entry point).",
    "src/components/data/PdfPanel.native.tsx": "PDF viewer panel for React Native.\n\nRenders PDF documents using a native PDF viewer.",
    "src/components/data/PdfPanel.web.tsx": "PDF viewer panel for web.\n\nRenders PDF documents using an embedded viewer.",
    "src/components/data/TextFilePanel.tsx": "Text file viewer panel component.\n\nDisplays plain text and markdown file contents with\nsyntax-aware formatting.",
    "src/components/data/CsvPanel.tsx": "CSV file viewer panel component.\n\nParses and displays CSV data in a tabular format\nwith sorting and filtering.",
    "src/components/data/ExcelPanel.tsx": "Excel file viewer panel component.\n\nParses and displays Excel spreadsheet data in a\ntabular format.",
    "src/components/data/GridPanel.tsx": "Data grid panel component.\n\nDisplays tabular data in a scrollable grid with\ncolumn headers and row indices.",
    "src/components/data/MeshPanel.tsx": "3D mesh viewer panel component (platform-agnostic entry point).",
    "src/components/data/MeshPanel.native.tsx": "3D mesh viewer panel for React Native.\n\nRenders 3D model files using a WebView-based viewer.",
    "src/components/data/MeshPanel.web.tsx": "3D mesh viewer panel for web.\n\nRenders 3D model files using Three.js.",
    "src/components/data/PointCloudPanel.tsx": "Point cloud viewer panel component (platform-agnostic entry point).",
    "src/components/data/PointCloudPanel.native.tsx": "Point cloud viewer panel for React Native.\n\nRenders point cloud data using a WebView-based viewer.",
    "src/components/data/PointCloudPanel.web.tsx": "Point cloud viewer panel for web.\n\nRenders point cloud data using Three.js.",
    "src/components/data/las.ts": "LAS/LAZ point cloud file parser.\n\nParses LAS format point cloud files and extracts position\nand color data for 3D visualization.",
    # sync
    "src/components/sync/ConflictResolutionModal.tsx": "Sync conflict resolution modal component.\n\nDisplays conflicting changes and lets users choose\nwhich version to keep.",
    # files
    "src/components/files/FileUploadMenu.tsx": "File upload menu component.\n\nProvides options for uploading files from camera, gallery,\ndocuments, or other sources.",
    "src/components/files/SharedFilesView.tsx": "Shared files view component.\n\nDisplays files shared with or by the current user\nacross projects.",
    # map
    "src/components/map/MapEditor.tsx": "Map editor component (platform-agnostic entry point).",
    "src/components/map/MapEditor.native.tsx": "Map editor component for React Native.\n\nInteractive map with drawing tools for marking GPS\ncoordinates and polygons on archaeological sites.",
    "src/components/map/MapEditor.web.tsx": "Map editor component for web.\n\nInteractive map using Leaflet for marking GPS coordinates\nand polygons on archaeological sites.",
    # onboarding
    "src/components/onboarding/OnboardingPrompt.tsx": "Onboarding prompt component.\n\nDisplays a contextual help tooltip during the user's\nfirst-time experience.",
    "src/components/onboarding/OnboardingScreen.tsx": "Onboarding screen component.\n\nFull-screen onboarding tutorial page with illustrations\nand descriptive text.",
    "src/components/onboarding/OnboardingOverlay.tsx": "Onboarding overlay component.\n\nTransparent overlay that highlights UI elements during\nthe onboarding tutorial.",
    # project components
    "src/components/project/ProjectTabsScreens.tsx": "Project detail tab screens container.\n\nOrganizes project detail content into tab views for\nnotes, files, tools, and timeline.",
    "src/components/project/NotesSection.tsx": "Project notes section component.\n\nDisplays a searchable, sortable list of project notes\nwith create and edit actions.",
    "src/components/project/ArtefactsTab.tsx": "Project artefacts tab component.\n\nDisplays a list of archaeological artefacts with QR codes\nand metadata.",
    "src/components/project/ToolsTab.tsx": "Project tools tab component.\n\nProvides access to project tools like forms, GPS mapping,\nand Harris Matrix visualization.",
    "src/components/project/TimeMachineTab.tsx": "Time Machine file versioning tab component.\n\nDisplays file version history grouped by category for\nreviewing and restoring previous versions.",
    "src/components/project/FilesOverlay.tsx": "Project files overlay component.\n\nFull-screen overlay for browsing and managing project\nfiles and folders.",
    "src/components/project/FileGallery.tsx": "Project file gallery component.\n\nDisplays project files in a grid or list layout with\nthumbnails and metadata.",
    "src/components/project/ProjectHeader.tsx": "Project detail header component.\n\nDisplays project name, description, member count,\nand action buttons.",
    "src/components/project/MembersModal.tsx": "Project members management modal.\n\nDisplays project members with their roles and provides\noptions to add, remove, or change member roles.",
    "src/components/project/MyFolderSettingsModal.tsx": "Personal folder settings modal.\n\nAllows users to configure privacy and sharing settings\nfor their personal project folder.",
    "src/components/project/MoveBanner.tsx": "File move operation banner component.\n\nDisplays a banner during file move operations to indicate\nthe target destination.",
    "src/components/project/ProjectOverlays.tsx": "Project detail overlay container.\n\nManages visibility of overlapping panels (files, forms, etc.)\nwithin the project detail view.",
    "src/components/project/MoreToolsSheet.tsx": "Additional tools bottom sheet component.\n\nDisplays secondary project tools in a draggable bottom sheet.",
    "src/components/project/ProjectDetailStyles.ts": "Project detail screen styles.\n\nStyleSheet definitions for the project detail view\nand its sub-components.",
    "src/components/project/modals/ProjectMenuModal.tsx": "Project menu modal component.\n\nDisplays project-level actions (edit, invite, delete)\nin a modal menu.",
    "src/components/project/modals/RenameModal.tsx": "Rename modal component.\n\nModal dialog for renaming files, folders, or other\nproject resources.",
    "src/components/project/modals/ProjectActionModal.tsx": "Project action confirmation modal.\n\nGeneric confirmation dialog for project-level actions.",
    "src/components/project/modals/DeleteConfirmModal.tsx": "Delete confirmation modal component.\n\nConfirmation dialog for destructive delete operations\nwith clear warning text.",
    "src/components/project/modals/NewFolderModal.tsx": "New folder creation modal component.\n\nModal dialog for creating new folders within the\nproject file hierarchy.",
    # liquid-react module
    "src/modules/liquid-react/src/index.ts": "Liquid React module entry point.\n\nExports Liquid Glass components and utilities.",
    "src/modules/liquid-react/src/components.tsx": "Liquid React component implementations.\n\nProvides React components that implement the Liquid Glass\nvisual design language.",
    "src/modules/liquid-react/src/types.ts": "Liquid React type definitions.\n\nTypeScript interfaces for Liquid Glass component props.",
    "src/modules/liquid-react/src/nativeComponents.ts": "Liquid React native component implementations.\n\nNative platform bindings for Liquid Glass components.",
    # app screens / layouts
    "app/_layout.tsx": "Root application layout.\n\nConfigures the navigation stack, theme provider, font loading,\nand global context providers.",
    "app/_layout.web.tsx": "Web-specific root layout.\n\nConfigures web-specific navigation and layout behavior.",
    "app/index.tsx": "Application entry screen.\n\nRedirects to the main tabs or authentication flow based\non the user's login state.",
    "app/AuthRedirector.tsx": "Authentication redirect component.\n\nAutomatically redirects users to the appropriate screen\nbased on their authentication status.",
    "app/modal.tsx": "Generic modal screen.\n\nA full-screen modal wrapper for presenting content\nover the current navigation stack.",
    "app/create-note.tsx": "Note creation screen.\n\nProvides a form for creating new text or voice notes\nwithin an archaeological project.",
    "app/edit-note.tsx": "Note editing screen.\n\nAllows editing of existing project note content and title.",
    "app/note-detail.tsx": "Note detail screen.\n\nDisplays full note content with attachments and\nprovides edit and delete actions.",
    "app/edit-project.tsx": "Project editing screen.\n\nAllows editing of project name, description, and\nRAN-LMI identification.",
    "app/create-artefact.tsx": "Artefact creation screen.\n\nProvides a multi-step form for recording archaeological\nartefact data with QR code generation.",
    "app/image-preview.tsx": "Image preview screen.\n\nFull-screen image viewer with zoom and pan capabilities.",
    "app/data-preview.tsx": "Data file preview screen.\n\nRoutes data files to the appropriate viewer panel based\non MIME type (photo, video, audio, PDF, etc.).",
    "app/scan-qr.tsx": "QR code scanner screen.\n\nProvides camera-based QR code scanning and resolves\nscanned codes to application resources.",
    "app/invite.tsx": "Invite acceptance screen.\n\nHandles accepting project invitations via deep link\nor token URL.",
    "app/join-project.tsx": "Join project screen.\n\nAllows users to join projects via invite code entry.",
    "app/settings.tsx": "Application settings screen.\n\nProvides user preferences, theme settings, and\naccount management options.",
    "app/voice-note/[id].tsx": "Voice note playback screen.\n\nPlays back recorded voice notes with waveform visualization\nand playback controls.",
    "app/artefact/[id].tsx": "Artefact detail screen.\n\nDisplays detailed artefact information with QR code\nand associated media.",
    "app/ColorBends.tsx": "Color gradient background component.\n\nRenders animated color gradient bends for visual decoration.",
    "app/ColorBends.web.tsx": "Web-specific color gradient background component.",
    "app/(auth)/_layout.tsx": "Authentication flow layout.\n\nNavigation layout for the login and registration screens.",
    "app/(auth)/login.tsx": "Login screen.\n\nUser authentication form with email/password fields\nand sign-in action.",
    "app/(auth)/register.tsx": "Registration screen.\n\nNew user registration form with email, password, and\ndisplay name fields.",
    "app/(tabs)/_layout.tsx": "Main tab bar layout.\n\nConfigures the bottom tab navigation with icons and labels\nfor the main application sections.",
    "app/(tabs)/_layout.web.tsx": "Web-specific tab bar layout.\n\nConfigures tab navigation optimized for web browsers.",
    "app/(tabs)/_layout.ios.tsx": "iOS-specific tab bar layout.\n\nConfigures tab navigation with iOS-native styling.",
    "app/(tabs)/_layout.android.tsx": "Android-specific tab bar layout.\n\nConfigures tab navigation with Material Design styling.",
    "app/(tabs)/index.tsx": "Home tab screen.\n\nDisplays the user's project dashboard with recent\nprojects and quick actions.",
    "app/(tabs)/overview.tsx": "Overview tab screen.\n\nDisplays a high-level overview of all projects\nand recent activity.",
    "app/(tabs)/explore.tsx": "Explore tab screen.\n\nAllows browsing and discovering archaeological projects.",
    "app/(tabs)/gps.tsx": "GPS tab screen.\n\nDisplays the GPS mapping interface for marking\narchaeological site coordinates.",
    "app/(tabs)/profile.tsx": "Profile tab screen.\n\nDisplays and allows editing of the user's profile\ninformation.",
    "app/(tabs)/settings.tsx": "Settings tab screen.\n\nProvides application settings and account management.",
    "app/project/[id]/_layout.tsx": "Project detail layout.\n\nConfigures the navigation structure for individual\nproject detail views.",
    "app/project/[id]/(tabs)/index.tsx": "Project detail home tab.\n\nDefault tab displaying project overview with notes\nand quick actions.",
    "app/project/[id]/(tabs)/matrix.tsx": "Project Harris Matrix tab.\n\nDisplays the Harris Matrix stratigraphic visualization\nfor the project.",
    "app/project/[id]/(tabs)/_layout.tsx": "Project detail tabs layout.\n\nConfigures the tab navigation within individual\nproject detail views.",
    # root level components
    "components/themed-text.tsx": "Themed text component (root level).\n\nLegacy themed text wrapper component.",
    "components/themed-view.tsx": "Themed view component (root level).\n\nLegacy themed view wrapper component.",
    "components/parallax-scroll-view.tsx": "Parallax scroll view component.\n\nA scroll view with parallax header image effect.",
    "components/hello-wave.tsx": "Hello wave animated component.\n\nAn animated waving hand emoji for the welcome screen.",
    "components/NativeTerminalBg.tsx": "Native terminal background component.\n\nRenders a terminal-style animated background effect.",
    "components/external-link.tsx": "External link component.\n\nA link that opens URLs in the device's default browser.",
    "components/haptic-tab.tsx": "Haptic feedback tab component (root level).\n\nLegacy haptic tab button wrapper.",
    "components/ui/collapsible.tsx": "Collapsible section component (root level).\n\nLegacy collapsible container component.",
    "components/ui/icon-symbol.tsx": "Icon symbol component (root level).\n\nLegacy icon rendering component.",
    "components/ui/icon-symbol.ios.tsx": "iOS icon symbol component (root level).\n\nLegacy iOS-specific icon component.",
    # tests
    "__tests__/autoSaveLogic.test.ts": "Auto-save logic unit tests.\n\nTests for the auto-save debounce and save behavior.",
    "__tests__/syncLogic.test.ts": "Sync logic unit tests.\n\nTests for the data synchronization and conflict\nresolution logic.",
    # constants
    "constants/theme.ts": "Theme constants.\n\nDefines color values, spacing, and typography constants\nfor the application theme.",
    # declarations
    "src/declarations/react-dom-server.d.ts": "TypeScript declaration for react-dom/server.\n\nProvides type definitions for server-side rendering utilities.",
}


def get_py_description(rel_path: str) -> str:
    """Get a description for a Python file based on its relative path."""
    return PYTHON_DESCRIPTIONS.get(rel_path, f"Module for {Path(rel_path).stem} functionality.")


def get_ts_description(rel_path: str) -> str:
    """Get a description for a TS/TSX file based on its relative path."""
    # Try exact match first
    if rel_path in TS_DESCRIPTIONS:
        return TS_DESCRIPTIONS[rel_path]
    # Try just the filename
    fname = os.path.basename(rel_path)
    for key, desc in TS_DESCRIPTIONS.items():
        if key.endswith(fname):
            return desc
    return f"Module for {Path(rel_path).stem} functionality."


def make_py_docstring(description: str) -> str:
    """Create a Python module-level docstring with description and license."""
    return f'"""\n{description}\n\n{LICENSE_TEXT}\n"""\n'


def make_ts_jsdoc(description: str) -> str:
    """Create a TypeScript file-level JSDoc comment with description and license."""
    license_lines = LICENSE_TEXT.split('\n')
    formatted = '\n'.join(f' * {line}' if line.strip() else ' *' for line in license_lines)
    desc_lines = description.split('\n')
    formatted_desc = '\n'.join(f' * {line}' if line.strip() else ' *' for line in desc_lines)
    return f'/**\n * @file\n{formatted_desc}\n *\n{formatted}\n */\n'


def has_module_docstring(content: str) -> bool:
    """Check if a Python file already has a module-level docstring."""
    try:
        tree = ast.parse(content)
        if tree.body and isinstance(tree.body[0], ast.Expr) and isinstance(tree.body[0].value, ast.Constant):
            return True
    except SyntaxError:
        pass
    return False


def has_license_in_docstring(content: str) -> bool:
    """Check if the LICENSE text is already in the file."""
    return "Copyright (c) 2025 Banu Andrei & Mircea Levin-Constantin" in content


def process_python_file(filepath: Path, rel_path: str):
    """Process a single Python file to add/update module docstring with license."""
    content = filepath.read_text(encoding='utf-8')
    
    if not content.strip():
        # Empty file - just add docstring
        description = get_py_description(rel_path)
        filepath.write_text(make_py_docstring(description), encoding='utf-8')
        print(f"  [ADDED] {rel_path}")
        return
    
    if has_license_in_docstring(content):
        print(f"  [SKIP]  {rel_path} (already has license)")
        return
    
    if has_module_docstring(content):
        # Has docstring but no license - add license to existing docstring
        # Find the closing triple-quote of the first docstring
        # Try both """ and '''
        for quote in ['"""', "'''"]:
            # Find the first docstring
            first_quote = content.find(quote)
            if first_quote != -1:
                second_quote = content.find(quote, first_quote + 3)
                if second_quote != -1:
                    # Extract existing docstring content
                    existing = content[first_quote + 3:second_quote]
                    # Add license before closing quote
                    new_docstring = f'{quote}{existing}\n\n{LICENSE_TEXT}\n{quote}'
                    new_content = content[:first_quote] + new_docstring + content[second_quote + 3:]
                    filepath.write_text(new_content, encoding='utf-8')
                    print(f"  [UPDATED] {rel_path} (added license to existing docstring)")
                    return
    
    # No docstring at all - add one at the top
    description = get_py_description(rel_path)
    docstring = make_py_docstring(description)
    
    # Preserve shebang line if present
    if content.startswith('#!'):
        first_newline = content.index('\n') + 1
        new_content = content[:first_newline] + docstring + content[first_newline:]
    # Preserve encoding declaration if present
    elif content.startswith('# -*-') or content.startswith('# coding'):
        first_newline = content.index('\n') + 1
        new_content = content[:first_newline] + docstring + content[first_newline:]
    # Handle comment-only files (like "# Empty file...")
    elif content.strip().startswith('#') and not any(kw in content for kw in ['import ', 'from ', 'class ', 'def ', '=']):
        # Replace the comment-only content with proper docstring
        new_content = docstring
    else:
        new_content = docstring + content
    
    filepath.write_text(new_content, encoding='utf-8')
    print(f"  [ADDED] {rel_path}")


def has_jsdoc_header(content: str) -> bool:
    """Check if a TS/TSX file already has a file-level JSDoc comment."""
    stripped = content.lstrip()
    return stripped.startswith('/**') or stripped.startswith("// @ts-") or "* @file" in content[:500]


def process_ts_file(filepath: Path, rel_path: str):
    """Process a single TS/TSX file to add file-level JSDoc with license."""
    content = filepath.read_text(encoding='utf-8')
    
    if not content.strip():
        description = get_ts_description(rel_path)
        filepath.write_text(make_ts_jsdoc(description) + '\n', encoding='utf-8')
        print(f"  [ADDED] {rel_path}")
        return
    
    if has_license_in_docstring(content):
        print(f"  [SKIP]  {rel_path} (already has license)")
        return
    
    description = get_ts_description(rel_path)
    jsdoc = make_ts_jsdoc(description)
    
    # If file already has a JSDoc comment at top, replace it
    if has_jsdoc_header(content):
        # Find end of existing JSDoc
        stripped = content.lstrip()
        whitespace_prefix = content[:len(content) - len(stripped)]
        if stripped.startswith('/**'):
            end_idx = stripped.find('*/') 
            if end_idx != -1:
                # Replace existing JSDoc
                remaining = stripped[end_idx + 2:].lstrip('\n')
                new_content = jsdoc + remaining
                filepath.write_text(new_content, encoding='utf-8')
                print(f"  [UPDATED] {rel_path}")
                return
    
    # No JSDoc - add at top
    new_content = jsdoc + content
    filepath.write_text(new_content, encoding='utf-8')
    print(f"  [ADDED] {rel_path}")


def main():
    # ── Backend Python files ─────────────────────────────────────────────
    print("\n=== Processing Backend Python Files ===\n")
    
    backend_dir = ROOT / "backend"
    py_files = []
    
    for dirpath, dirnames, filenames in os.walk(backend_dir):
        # Skip __pycache__ and .git
        dirnames[:] = [d for d in dirnames if d not in ('__pycache__', '.git', '.venv', 'node_modules')]
        for f in filenames:
            if f.endswith('.py'):
                full = Path(dirpath) / f
                rel = str(full.relative_to(ROOT))
                py_files.append((full, rel))
    
    for full, rel in sorted(py_files):
        process_python_file(full, rel)
    
    # ── Frontend TS/TSX files ────────────────────────────────────────────
    print("\n=== Processing Frontend TS/TSX Files ===\n")
    
    frontend_dir = ROOT / "frontend" / "stratum-app"
    ts_files = []
    
    skip_dirs = {'node_modules', '.git', '.expo', 'dist', 'build', '__pycache__', '.next', 'android', 'ios'}
    
    for dirpath, dirnames, filenames in os.walk(frontend_dir):
        dirnames[:] = [d for d in dirnames if d not in skip_dirs]
        for f in filenames:
            if f.endswith(('.ts', '.tsx')) and not f.endswith('.d.ts'):
                full = Path(dirpath) / f
                rel = str(full.relative_to(frontend_dir))
                ts_files.append((full, rel))
    
    # Also include .d.ts declaration files that are source files
    for dirpath, dirnames, filenames in os.walk(frontend_dir):
        dirnames[:] = [d for d in dirnames if d not in skip_dirs]
        for f in filenames:
            if f.endswith('.d.ts') and 'node_modules' not in dirpath and 'dist' not in dirpath:
                full = Path(dirpath) / f
                rel = str(full.relative_to(frontend_dir))
                # Only include source declarations, not generated ones
                if 'src/declarations' in str(full) or full.name in ('global.d.ts', 'liquid-react.d.ts', 'expo-env.d.ts'):
                    ts_files.append((full, rel))
    
    for full, rel in sorted(ts_files):
        process_ts_file(full, rel)
    
    print(f"\n=== Done! Processed {len(py_files)} Python files and {len(ts_files)} TS/TSX files ===\n")


if __name__ == "__main__":
    main()
