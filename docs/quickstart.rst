============================
Quick Start Guide
============================

This guide will get you up and running with STRATUM in minutes.

.. seealso::
   **New to software development?** Check :doc:`legend <legend>` to understand all technical terms and commands used in this guide.

Prerequisites
=============

Ensure you have completed the :doc:`installation <installation>` process before proceeding.

Your First Project
==================

Step 1: Register an Account
----------------------------

.. image:: https://img.shields.io/badge/Step-1-blue
   :alt: Step 1

Open the STRATUM app and create an account:

1. Launch the application
2. Click **Sign Up**
3. Enter your email and password
4. Verify your email (if required)

.. note::
   Use a valid email address as it will be used for project invitations and notifications.

Step 2: Create Your First Project
----------------------------------

.. image:: https://img.shields.io/badge/Step-2-blue
   :alt: Step 2

After logging in:

1. Click the **+ New Project** button
2. Fill in project details:

   .. list-table::
      :widths: 25 75
      :header-rows: 1

      * - Field
        - Description
      * - **Project Name**
        - e.g., "Tell el-Amarna 2026"
      * - **Description**
        - Brief overview of the excavation
      * - **Location**
        - Geographic location (optional)

3. Click **Create Project**

.. tip::
   Use descriptive names that include the site and year for easy identification.

Step 3: Add Team Members
-------------------------

.. image:: https://img.shields.io/badge/Step-3-blue
   :alt: Step 3

Collaborate with your team:

**Option A: Search and Add**

1. Open your project
2. Go to **Team** tab
3. Click **Add Member**
4. Search by email address
5. Select a role:

   - **Leader**: Full access, can manage team
   - **Researcher**: Can create/edit notes and upload files
   - **Guest**: Read-only access

**Option B: Generate Invite Link**

1. Go to **Team** → **Invites**
2. Click **Create Invite**
3. Set role and expiration
4. Share the link or code

.. code-block:: text

   Invite Code: PRJ-ABC123

.. warning::
   Invite codes can be used by anyone who has them. Use expiration dates for security.

Step 4: Document Your Findings
-------------------------------

.. image:: https://img.shields.io/badge/Step-4-blue
   :alt: Step 4

Create detailed field notes:

1. Navigate to **Notes** tab
2. Click **+ New Note**
3. Enter note details:

   - **Title**: Descriptive name
   - **Content**: Detailed observations
   - **Attachments**: Add photos from field

4. Click **Save**

**Auto-Save Feature**

.. important::
   Notes auto-save every 5 seconds when you type. Look for the save indicator in the top-right corner.

**Rich Text Formatting**

You can format your notes with:

- **Bold** and *Italic* text
- Bullet points and numbered lists
- Headers and subheaders

Step 5: Upload Files
--------------------

.. image:: https://img.shields.io/badge/Step-5-blue
   :alt: Step 5

Organize project files:

1. Go to **Files** tab
2. Click **Upload** or drag files
3. Supported formats:

   .. hlist::
      :columns: 3

      * Images (JPG, PNG, HEIC)
      * PDFs
      * CSVs
      * 3D Models (GLB, GLTF)
      * Videos (MP4)
      * Audio (MP3, WAV)

4. Create folders to organize files

**File Versioning**

.. note::
   STRATUM automatically tracks file versions when you upload a file with the same name.

Step 6: Use Archaeological Forms
---------------------------------

.. image:: https://img.shields.io/badge/Step-6-blue
   :alt: Step 6

Document using standardized forms:

**Context Feature Form**

1. Go to **Forms** → **Context Features**
2. Click **+ New Context**
3. Fill in:

   - Context number
   - Type (pit, ditch, layer, etc.)
   - Description
   - Dimensions
   - Finds

**Stratigraphic Unit Form**

1. Go to **Forms** → **Stratigraphic Units**
2. Click **+ New Unit**
3. Document:

   - Unit number
   - Soil description
   - Relationships (above/below)
   - Dating evidence

**Artifact Registration**

1. Go to **Forms** → **Artifacts**
2. Click **+ New Artifact**
3. Record:

   - Artifact number
   - Material (ceramic, lithic, metal, etc.)
   - Context
   - Photos
   - QR code (auto-generated)

.. seealso::
   :doc:`forms <forms>` for detailed form documentation

Step 7: Map Your Site
---------------------

.. image:: https://img.shields.io/badge/Step-7-blue
   :alt: Step 7

Create GPS boundaries:

1. Go to **GPS** tab
2. Click **Start Mapping**
3. Walk the site boundary
4. Tap to add waypoints
5. Click **Close Polygon** when complete
6. Save your work area

**Multiple Site Areas**

You can create multiple polygons for:

- Work areas
- Excavation units
- Survey zones
- Protected areas

.. seealso::
   :doc:`gps-mapping <gps-mapping>` for advanced GPS features

Step 8: Real-Time Collaboration
--------------------------------

.. image:: https://img.shields.io/badge/Step-8-blue
   :alt: Step 8

See updates in real-time:

- Team members joining/leaving
- New notes created
- Files uploaded
- Role changes
- Activity feed updates

**Activity Feed**

The activity feed shows:

.. code-block:: text

   [10:45] Dr. Smith uploaded "trench-1-north.jpg"
   [10:42] Field Team created note "Context 042"
   [10:38] Dr. Jones joined the project
   [10:35] You created "Stratigraphic Unit 015"

Step 9: Export Data
-------------------

.. image:: https://img.shields.io/badge/Step-9-blue
   :alt: Step 9

Export for analysis:

1. Go to **Settings** → **Export**
2. Choose export format:

   - **CSV**: Tabular data for Excel/R
   - **JSON**: Complete data dump
   - **PDF**: Formatted report
   - **Shapefile**: GIS data

3. Select what to include:

   - Notes
   - Files metadata
   - Forms data
   - GPS coordinates
   - Activity log

4. Click **Export**

Common Workflows
================

Daily Field Documentation
-------------------------

.. code-block:: text

   Morning:
   1. Open project on tablet
   2. Review yesterday's notes
   3. Check team assignments
   
   During excavation:
   4. Create notes for each context
   5. Take photos and attach to notes
   6. Fill out context forms
   7. Register artifacts with QR codes
   
   End of day:
   8. Review all documentation
   9. Sync data to cloud
   10. Share updates with team

Survey Workflow
---------------

.. graphviz::

   digraph survey {
      rankdir=LR;
      node [shape=box, style=rounded];
      
      start [label="Start Survey"];
      map [label="Map Boundaries"];
      photo [label="Photo Documentation"];
      notes [label="Create Notes"];
      forms [label="Fill Forms"];
      export [label="Export Data"];
      
      start -> map -> photo -> notes -> forms -> export;
   }

Artifact Processing
-------------------

1. **Field Collection**

   - Photograph in situ
   - Record GPS location
   - Assign artifact number
   - Generate QR code

2. **Lab Processing**

   - Scan QR code
   - Add measurements
   - Take studio photos
   - Update description

3. **Analysis**

   - Export artifact data
   - Import to analysis software
   - Add analysis results
   - Link to publications

Keyboard Shortcuts
==================

.. list-table::
   :widths: 30 70
   :header-rows: 1

   * - Shortcut (Web)
     - Action
   * - ``Ctrl/Cmd + N``
     - New note
   * - ``Ctrl/Cmd + S``
     - Save note
   * - ``Ctrl/Cmd + K``
     - Search projects
   * - ``Ctrl/Cmd + U``
     - Upload file
   * - ``Ctrl/Cmd + /``
     - Show shortcuts
   * - ``Esc``
     - Close modal/dialog

Best Practices
==============

.. attention::
   Follow these best practices for optimal results:

Documentation
-------------

- Create notes immediately after observations
- Use clear, descriptive titles
- Add photos while context is fresh
- Tag related notes and files
- Review and update regularly

File Organization
-----------------

- Create folders by date or context
- Use consistent naming conventions
- Keep originals separate from processed files
- Regular backups to external storage

Team Collaboration
------------------

- Assign clear roles and responsibilities
- Use activity feed for communication
- Review team member contributions
- Set up regular sync meetings

Data Quality
------------

- Double-check context numbers
- Verify GPS coordinates
- Consistent terminology
- Complete all form fields
- Regular data validation

Troubleshooting Quick Tips
===========================

.. error::
   **App won't sync?**
   
   - Check internet connection
   - Force close and reopen app
   - Check storage space
   - Verify backend is running

.. error::
   **Can't upload files?**
   
   - Check file size (max 100MB)
   - Verify file format is supported
   - Check storage quota
   - Try compressing large files

.. error::
   **Notes not saving?**
   
   - Check auto-save indicator
   - Verify project permissions
   - Check internet connection
   - Try manual save (Ctrl/Cmd + S)

Next Steps
==========

Now that you're familiar with the basics:

- Explore :doc:`features <features>` for advanced capabilities
- Review :doc:`api/overview <api/overview>` for API integration
- Check :doc:`forms <forms>` for archaeological form details
- Read :doc:`gps-mapping <gps-mapping>` for GPS features
- See :doc:`troubleshooting <troubleshooting>` for common issues

Need Help?
==========

- Read the :doc:`faq <faq>`
- Check :doc:`troubleshooting <troubleshooting>`
- GitHub Issues: https://github.com/QuantumBits/QuantumBitsFLL2025-2026/issues
