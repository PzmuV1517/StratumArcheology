============================
Features Documentation
============================

Complete guide to STRATUM's features and capabilities.

.. seealso::
   **Not sure what a term means?** Check :doc:`legend` for clear explanations of all technical terminology.

.. contents:: Table of Contents
   :local:
   :depth: 2

Core Features
=============

Authentication & User Management
---------------------------------

✅ Email/password registration

✅ Secure Firebase Authentication

✅ JWT token-based API access

✅ Cross-platform sessions (iOS/Android/Web)

✅ User profile management

Project Management
------------------

✅ Create unlimited projects

✅ Rich text descriptions

✅ Project ownership

✅ Role-based team collaboration

✅ Project transfer

✅ Soft delete with recovery

Real-Time Collaboration
-----------------------

✅ WebSocket-based updates

✅ Live activity feed

✅ Member presence indicators

✅ Instant notifications

✅ Real-time role changes

✅ Live content updates

.. seealso::
   :doc:`websockets-realtime` for WebSocket details

Documentation
=============

Field Notes
-----------

Create detailed field notes with:

- **Rich text** formatting
- **Photo attachments** from camera
- **Auto-save** every 5 seconds
- **Offline support** with sync
- **Version history**
- **Search** and filtering

Archaeological Forms
--------------------

Standardized data collection:

**Context Features**

- Context number
- Feature type (pit, ditch, layer, etc.)
- Dimensions and description
- Associated finds
- CSV export

**Stratigraphic Units**

- Unit number
- Soil composition
- Color (Munsell notation)
- Relationships (above/below)
- Dating evidence
- CSV export

**Artifact Registration**

- Artifact number
- Material type
- Context association
- Measurements
- QR code generation
- Photo documentation

.. seealso::
   :doc:`forms` for detailed form documentation

File Management
===============

Hierarchical Organization
-------------------------

- **Folder tree** structure
- **Drag-and-drop** organization
- **Breadcrumb navigation**
- **Search** across files
- **Bulk operations**

Supported Formats
-----------------

.. hlist::
   :columns: 3

   * Images (JPG, PNG, HEIC)
   * PDFs
   * CSVs
   * 3D Models (GLB, GLTF)
   * Videos (MP4)
   * Audio (MP3, WAV)
   * Documents (TXT, MD)
   * Archives (ZIP)

File Versioning
---------------

- **Automatic versioning** on update
- **Version history** tracking
- **Restore previous versions**
- **Compare versions**
- **Version metadata**

Privacy Controls
----------------

.. list-table::
   :widths: 25 75
   :header-rows: 1

   * - Level
     - Access
   * - **Private**
     - Only file owner
   * - **Shared**
     - Owner + specified users
   * - **Project**
     - All project members (default)
   * - **Public**
     - Anyone with link

GPS & Mapping
=============

Site Boundaries
---------------

- Create **work area polygons**
- Add **multiple site areas**
- **GPS waypoint** tracking
- **Real-time mapping**
- **Distance calculations**
- **Area measurements**

Coordinate Systems
------------------

- WGS84 (lat/lng)
- UTM coordinates
- Custom projections

.. seealso::
   :doc:`gps-mapping` for GPS documentation

Data Visualization
==================

3D Model Viewer
---------------

- **GLB/GLTF** mesh rendering
- **Touch controls** (rotate, zoom, pan)
- **Web + Native** support
- **Lighting** controls
- **Screenshot** capture

Harris Matrix
-------------

- Interactive stratigraphic diagrams
- Node relationships
- Auto-layout algorithms
- Export to SVG/PNG

Gallery View
------------

- **Timeline** of all media
- **Filter by date** or type
- **Lightbox** viewer
- **Batch download**

Data Export
===========

Export Formats
--------------

.. list-table::
   :widths: 25 75
   :header-rows: 1

   * - Format
     - Contents
   * - **CSV**
     - Tabular data for Excel/R/Python
   * - **JSON**
     - Complete data dump with relationships
   * - **PDF**
     - Formatted reports with images
   * - **Shapefile**
     - GIS data with coordinates
   * - **ZIP**
     - All files and metadata

Export Options
--------------

Customize what to include:

- ☑ Notes content
- ☑ File metadata
- ☑ Form submissions
- ☑ GPS coordinates
- ☑ Activity logs
- ☑ Team roster
- ☑ Media files

Advanced Features
=================

Invite System
-------------

Multiple invitation methods:

**Search and Add**

- Search by email
- Select role
- Instant access

**Invite Links**

- Generate shareable links
- Short codes (PRJ-ABC123)
- Expiration dates
- Usage limits
- Revokable

**Multi-Use Invites**

- Unlimited redemptions
- Limited redemptions (e.g., 10 uses)
- Track who redeemed

Activity Feed
-------------

Comprehensive audit trail:

- All project changes
- Member actions
- Timestamped entries
- User attribution
- Filterable history
- Searchable logs

Offline Support
---------------

- **Offline-first** architecture
- **Local caching** of data
- **Auto-sync** when online
- **Conflict resolution**
- **Queue management**

Security Features
=================

Authentication
--------------

- 🔒 Secure password hashing
- 🔒 Email verification
- 🔒 Password reset flow
- 🔒 Session management
- 🔒 Token expiration

Authorization
-------------

- 🔒 Role-based access control
- 🔒 Per-file permissions
- 🔒 Project-level security
- 🔒 Owner-only operations

Data Protection
---------------

- 🔒 Encrypted connections (HTTPS)
- 🔒 Secure file storage
- 🔒 Regular backups
- 🔒 Audit logging
- 🔒 GDPR compliance ready

Platform Support
================

Web Application
---------------

- Modern browsers (Chrome, Firefox, Safari, Edge)
- Responsive design
- PWA support
- Full feature parity

iOS Application
---------------

- iOS 14+ support
- Native performance
- Camera integration
- GPS tracking
- Offline mode

Android Application
-------------------

- Android 8+ support
- Native performance
- Camera integration
- GPS tracking
- Offline mode

Cross-Platform
--------------

- Shared codebase (React Native)
- Consistent UI/UX
- Real-time sync
- Cloud backup

Performance
===========

Optimization Features
---------------------

- **Lazy loading** of images
- **Pagination** for large lists
- **Caching** strategy
- **Compression** of uploads
- **CDN** integration ready

Scalability
-----------

- **Horizontal scaling** support
- **Load balancing** ready
- **Database** replication
- **Object storage** distribution

Next Steps
==========

- Read :doc:`quickstart` to get started
- Explore :doc:`api/overview` for API integration
- Check :doc:`collaboration` for team features
- See :doc:`forms` for archaeological forms
