============================
File Management
============================

Organize and manage project files with upload, navigation, filtering, privacy, and offline support.

Files Overlay Modal
-------------------

The Files Overlay is the primary file workspace inside a project.
It is opened from the project detail screen and supports both touch-first mobile workflows and web workflows.

Core Actions
------------

- Navigate folders using breadcrumb links.
- Open files and folders from the main list.
- Create folders (edit users only).
- Upload files:
   - Mobile: upload menu.
   - Web: upload action and drag-and-drop support.
- Rename, move, and delete unlocked items (edit users only).
- Download individual files.

Search and Filters
------------------

- Search runs against file/folder base names.
- Exact-match mode can be enabled for precise results.
- Extension chips and custom extension filters are supported.
- When filters are active and no results match, the overlay shows a "No matching files" state with a clear-filters action.

Multi-Select and Bulk Actions
-----------------------------

- Multi-select mode can be toggled on/off.
- Select-all respects the currently filtered result set.
- Locked items are excluded from selection and destructive actions.
- Bulk actions include:
   - Move
   - Delete
   - Download
   - Save Offline (native only)

My Folder
---------

- Each user can navigate directly to their personal project folder.
- My Folder settings allow access-sharing configuration for collaborators.

Offline Support
---------------

- Native clients can save selected files for offline access.
- Downloaded files are marked in the list.
- Offline save status is surfaced in the bulk action bar.

Permissions and Locked Items
----------------------------

- Read-only users can browse and download but cannot mutate files/folders.
- Locked items remain visible but cannot be selected for bulk edits or deleted.

Accessibility and Interaction Standards
---------------------------------------

- All primary actions must expose clear accessibility labels.
- Toggle controls should expose state (expanded/checked/disabled) where applicable.
- Empty states must explain whether the issue is "no files" or "no matches".
- Web drag overlay must be cancellable via keyboard (Escape).

.. seealso::
   **Not familiar with file systems?** See :doc:`legend <legend>` for explanations of paths, directories, versioning, and file-related terminology.

**See:** :doc:`features <features>` for file management features.
