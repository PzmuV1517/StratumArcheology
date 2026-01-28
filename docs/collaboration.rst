============================
Team Collaboration
============================

Work together seamlessly with role-based permissions and real-time updates.

.. seealso::
   **Not familiar with technical terms?** Check `legend.rst <legend.rst>`_ for explanations of roles, permissions, and collaboration concepts.

.. contents:: Table of Contents
   :local:
   :depth: 2

Team Roles
==========

STRATUM has a hierarchical role system:

.. code-block:: text

   Owner > Leader > Researcher > Guest > (No Access)

Role Comparison
---------------

.. list-table::
   :widths: 25 15 15 15 15
   :header-rows: 1

   * - Permission
     - Owner
     - Leader
     - Researcher
     - Guest
   * - View project
     - ✅
     - ✅
     - ✅
     - ✅
   * - Create notes
     - ✅
     - ✅
     - ✅
     - ❌
   * - Edit own notes
     - ✅
     - ✅
     - ✅
     - ❌
   * - Edit all notes
     - ✅
     - ✅
     - ❌
     - ❌
   * - Delete notes
     - ✅
     - ✅
     - Owner only
     - ❌
   * - Upload files
     - ✅
     - ✅
     - ✅
     - ❌
   * - Delete files
     - ✅
     - ✅
     - Owner only
     - ❌
   * - Submit forms
     - ✅
     - ✅
     - ✅
     - ❌
   * - Manage team
     - ✅
     - ✅
     - ❌
     - ❌
   * - Delete project
     - ✅
     - ❌
     - ❌
     - ❌
   * - Transfer ownership
     - ✅
     - ❌
     - ❌
     - ❌

.. seealso::
   `api/projects.rst <api/projects.rst>`_ for role management API
