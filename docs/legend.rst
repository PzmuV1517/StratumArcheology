============================
Documentation Legend
============================

.. contents:: Table of Contents
   :local:
   :depth: 3

Introduction
============

Welcome to the STRATUM Documentation Legend! This guide helps you understand all the technical terms, symbols, and conventions used throughout our documentation, even if you're new to programming or archaeology software.

.. important::
   **New to software development?** Don't worry! This legend explains everything you need to know to understand the documentation. Bookmark this page and refer back to it anytime you see something unfamiliar.

Reading This Documentation
==========================

Documentation Structure
-----------------------

Our documentation uses **reStructuredText (RST)**, a special format that makes technical documentation easy to read and navigate. Here's what different elements mean:

Headers and Sections
~~~~~~~~~~~~~~~~~~~~

Headers organize content into sections. Bigger headers are main topics, smaller headers are subtopics:

.. code-block:: text

   ============================
   Main Title (Biggest)
   ============================
   
   Section Header
   ==============
   
   Subsection Header
   -----------------
   
   Sub-subsection Header
   ~~~~~~~~~~~~~~~~~~~~~

Special Boxes
~~~~~~~~~~~~~

You'll see different colored boxes throughout the documentation:

.. note::
   **Blue boxes** provide helpful information or tips

.. tip::
   **Green boxes** offer best practices or shortcuts

.. important::
   **Orange boxes** highlight critical information

.. warning::
   **Yellow boxes** warn about potential problems

.. attention::
   **Red boxes** require immediate attention

.. seealso::
   **Blue-green boxes** suggest related reading

.. danger::
   **Dark red boxes** indicate serious risks

Code and Commands
~~~~~~~~~~~~~~~~~

Code appears in special gray boxes with a monospace font:

.. code-block:: bash

   # This is a command you type in the terminal
   cd backend
   python -m uvicorn app.main:app --reload

- Lines starting with ``#`` are **comments** (explanatory text, not commands. it's ignored by the interpreter)
- Text in ``monospace`` within sentences refers to code, files, or commands
- ``$`` or ``%`` at the start means it's a terminal prompt (don't type it)

Links and References
~~~~~~~~~~~~~~~~~~~~

- **Blue underlined text** is a clickable link
- Text in `angle brackets <#>`_ links to other sections
- :doc:`document-name` links to another documentation page
- References like [#]_ link to footnotes at the bottom

Programming Concepts
====================

Basic Terminology
-----------------

.. glossary::

   API (Application Programming Interface)
      A way for different software programs to talk to each other. Like a restaurant menu - it shows what you can order (request) and what you'll get back (response).

   Backend
      The "behind the scenes" part of the software that runs on a server. It handles data storage, business logic, and processing. Users don't see it directly.

   Frontend
      The part of the software users interact with - the screens, buttons, and forms you see on your phone or computer.

   Database
      Organized storage for data, like a digital filing cabinet. STRATUM uses PostgreSQL to store user accounts, projects, notes, etc.

   Server
      A computer that runs software and responds to requests from other computers (clients). STRATUM's backend runs on a server.

   Client
      The software running on a user's device (phone, tablet, computer) that connects to the server.

   Repository (Repo)
      A storage location for code, managed by Git. Think of it like a shared folder with version history.

   Terminal / Command Line
      A text-based interface for giving commands to your computer. The black or white window where you type commands.

   IDE (Integrated Development Environment)
      Software for writing code, like VS Code or PyCharm.

Code Terms
----------

.. glossary::

   Function
      A reusable piece of code that performs a specific task. Like a recipe - you can follow the same recipe many times.

   Variable
      A named container that stores data. Like a labeled box where you put information.

   String
      Text data enclosed in quotes, like ``"Hello World"`` or ``'archaeologist@example.com'``

   Integer
      A whole number like ``42`` or ``-17`` (no decimals)

   Boolean
      A value that's either ``True`` or ``False``

   Array / List
      A collection of items in order, like ``[1, 2, 3]`` or ``["note1", "note2"]``

   Object / Dictionary
      A collection of key-value pairs, like a real dictionary where words (keys) have definitions (values)

   JSON (JavaScript Object Notation)
      A format for storing and exchanging data that looks like: ``{"name": "Project 1", "id": "abc-123"}``

   Class
      A blueprint for creating objects. Like an architect's plan for building houses.

   Method
      A function that belongs to a class or object

   Parameter / Argument
      Information you pass into a function, like ingredients you give to a recipe

   Return Value
      What a function gives back after it runs, like the finished dish from a recipe

Understanding How Software Works
================================

This section explains the fundamental concepts of how software applications work, using plain language and real-world analogies.

How Client-Server Applications Work
-----------------------------------

STRATUM is a **client-server application**. Here's what that means:

**The Restaurant Analogy:**

Imagine STRATUM as a restaurant:

1. **You (the user)** are a customer who wants food
2. **The app on your phone (client/frontend)** is like a waiter who takes your order
3. **The kitchen (server/backend)** prepares the food based on your order
4. **The pantry (database)** stores all the ingredients
5. **The menu (API)** lists what you can order and what format to use

When you tap "Create Project" in STRATUM:

1. Your phone (client) sends your request to the server
2. The server receives it, checks if you're logged in
3. The server stores the new project in the database
4. The server sends back a confirmation
5. Your phone shows you the new project

This all happens in milliseconds, but understanding this flow helps you debug problems and understand error messages.

What is Code?
-------------

Code is a set of instructions written in a programming language that tells a computer what to do. Think of it like a recipe:

**Recipe (Human):**

.. code-block:: text

   1. Preheat oven to 350°F
   2. Mix flour, sugar, and eggs
   3. Pour into pan
   4. Bake for 30 minutes

**Code (Computer):**

.. code-block:: python

   def bake_cake(temperature, time):
       oven.preheat(temperature)
       batter = mix(flour, sugar, eggs)
       pan.pour(batter)
       oven.bake(time)

Both give step-by-step instructions. The difference is that code uses precise syntax that computers can understand.

Why Are There So Many Languages?
--------------------------------

Different programming languages are good at different things:

- **Python** (STRATUM backend): Easy to read, great for data and servers
- **TypeScript/JavaScript** (STRATUM frontend): Runs in browsers and mobile apps
- **SQL**: Specifically for database queries
- **HTML/CSS**: For web page structure and styling

It's like how a screwdriver, hammer, and wrench are all tools - each is best for certain jobs.

What is an Environment?
-----------------------

An "environment" is the complete setup needed to run code:

- **Operating System**: Windows, macOS, Linux
- **Programming Language**: Python 3.13, Node.js 18
- **Dependencies**: Other code libraries your app needs
- **Configuration**: Settings like database passwords

When documentation says "set up your environment," it means installing and configuring all these pieces.

Understanding Data Flow
-----------------------

Here's how data moves through STRATUM when you view your projects:

.. code-block:: text

   ┌─────────────┐      ┌─────────────┐      ┌─────────────┐
   │   Your      │──────│   STRATUM   │──────│  PostgreSQL │
   │   Phone     │      │   Server    │      │  Database   │
   │  (Client)   │      │  (Backend)  │      │             │
   └─────────────┘      └─────────────┘      └─────────────┘
         │                    │                    │
         │  1. "Get my        │                    │
         │     projects"      │                    │
         │ ──────────────────>│                    │
         │                    │  2. Query DB       │
         │                    │ ──────────────────>│
         │                    │                    │
         │                    │  3. Return data    │
         │                    │ <──────────────────│
         │                    │                    │
         │  4. Send JSON      │                    │
         │     response       │                    │
         │ <──────────────────│                    │
         │                    │                    │
         │  5. Display        │                    │
         │     on screen      │                    │
         └────────────────────┴────────────────────┘

What Are Dependencies?
----------------------

Dependencies are external code that your project needs to work. Instead of writing everything from scratch, developers use pre-built code libraries.

**Example:** STRATUM uses these dependencies:

- **FastAPI**: For handling web requests (instead of writing HTTP handling from scratch)
- **SQLAlchemy**: For database operations (instead of writing raw SQL)
- **Firebase**: For user authentication (instead of building login systems)

Dependencies are listed in:

- ``requirements.txt`` (Python/backend)
- ``package.json`` (JavaScript/frontend)

When you run ``pip install -r requirements.txt`` or ``npm install``, you're downloading all these dependencies.

Understanding Error Messages
============================

Error messages can seem scary, but they're actually trying to help you. Here's how to read them:

Anatomy of an Error Message
---------------------------

.. code-block:: text

   ERROR: Connection refused at localhost:5432
   └────┘ └───────────────────────────────────┘
     │              │
     │              └── What went wrong (details)
     └── Severity level (ERROR, WARNING, INFO)

Common Error Types
------------------

**Connection Errors:**

.. code-block:: text

   Connection refused / Cannot connect to...

**Meaning:** The server you're trying to reach isn't running or isn't accepting connections.

**Fix:** Start the required service (database, backend server, etc.)

----

**Authentication Errors:**

.. code-block:: text

   401 Unauthorized / Invalid token / Authentication failed

**Meaning:** You're not logged in, or your login session expired.

**Fix:** Log in again or refresh your authentication token.

----

**Permission Errors:**

.. code-block:: text

   403 Forbidden / Permission denied / Access denied

**Meaning:** You're logged in but don't have permission for this action.

**Fix:** Check if you have the right role (owner, leader, etc.)

----

**Not Found Errors:**

.. code-block:: text

   404 Not Found / Resource not found / No such file

**Meaning:** The thing you're looking for doesn't exist.

**Fix:** Check the URL, file path, or ID is correct.

----

**Syntax Errors:**

.. code-block:: text

   SyntaxError / Unexpected token / Invalid JSON

**Meaning:** The code or data is malformed.

**Fix:** Check for typos, missing brackets, or incorrect formatting.

----

**Import/Module Errors:**

.. code-block:: text

   ModuleNotFoundError / Cannot find module

**Meaning:** A required dependency isn't installed.

**Fix:** Run ``pip install <module>`` or ``npm install <module>``

Reading Stack Traces
--------------------

When code crashes, you get a "stack trace" - a list of function calls that led to the error:

.. code-block:: python

   Traceback (most recent call last):
     File "app/main.py", line 45, in create_project
       project = Project(name=data.name)
     File "app/models.py", line 23, in __init__
       self.validate_name(name)
     File "app/models.py", line 30, in validate_name
       raise ValueError("Name cannot be empty")
   ValueError: Name cannot be empty

**How to read it:**

1. Start at the bottom - that's the actual error ("Name cannot be empty")
2. Read upward to see where it happened (line 30 in models.py)
3. Continue up to trace back to your original code (line 45 in main.py)

The last few lines are usually the most important.

Development Workflow Explained
==============================

This section explains how developers typically work on projects.

The Development Cycle
---------------------

1. **Write Code**: Create or modify files
2. **Test Locally**: Run the app on your computer
3. **Fix Bugs**: Find and fix problems
4. **Commit**: Save a snapshot of your changes with Git
5. **Push**: Upload your changes to GitHub
6. **Review**: Others check your code
7. **Deploy**: Put the code on a live server

What is Git?
------------

Git is a version control system - it tracks every change made to code files. Think of it like:

- Google Docs' version history (see who changed what, when)
- Ctrl+Z on steroids (go back to any previous version)
- A time machine for your code

**Key Git concepts:**

- **Repository (repo)**: A project folder tracked by Git
- **Commit**: A saved snapshot of changes with a description
- **Branch**: A parallel version of the code (for experimenting)
- **Pull/Push**: Download/upload changes from/to a remote server
- **Merge**: Combine changes from different branches

What Happens When You Run Commands
----------------------------------

**``cd backend``**

``cd`` means "change directory" - you're moving into the backend folder. Like opening a folder in Finder/Explorer.

**``pip install -r requirements.txt``**

``pip`` is Python's package installer. This command reads the requirements.txt file and downloads all listed packages from the internet.

**``python -m uvicorn app.main:app --reload``**

- ``python -m``: Run a Python module
- ``uvicorn``: A web server that serves your app
- ``app.main:app``: Location of your application (app folder → main.py → app variable)
- ``--reload``: Restart automatically when code changes

**``npm install``**

``npm`` is Node.js's package manager. This reads package.json and downloads all JavaScript dependencies.

**``expo start``**

Starts the Expo development server for the mobile app. Opens a page where you can run the app in simulators or on your phone.


STRATUM-Specific Terms
======================

Application Structure
---------------------

.. glossary::

   Project
      A container for all documentation and files related to one archaeological site or excavation

   Note
      A text document with optional photo attachments, used for field observations

   File Node
      An entry in the file system - either a folder or a file

   Context Feature
      An archaeological feature like a pit, ditch, or layer

   Stratigraphic Unit
      A layer of soil or deposit with specific characteristics

   Artifact
      A physical object found during excavation (pottery, tools, etc.)

   Role
      A user's permission level in a project:
      
      - **Owner**: Full control, created the project
      - **Leader**: Can manage team and all content
      - **Researcher**: Can create/edit own content
      - **Guest**: Read-only access

   Activity Feed
      A chronological log of all actions in a project (like a timeline)

   WebSocket
      A technology for real-time updates - changes appear instantly without refreshing

   MinIO
      Storage system for files (like Dropbox or Google Drive for STRATUM)

   Firebase
      Service that handles user login and authentication

Technical Concepts
==================

Web Development
---------------

.. glossary::

   HTTP / HTTPS
      The protocol (language) web browsers use to communicate with servers. HTTPS is the secure version.

   REST API
      A standard way to request and send data over the internet using URLs

   Endpoint
      A specific URL that does one thing, like ``/api/projects`` to get all projects

   Request
      When a client asks the server for something

   Response
      What the server sends back after a request

   GET
      Request type for retrieving data (like viewing a page)

   POST
      Request type for creating new data (like submitting a form)

   PUT
      Request type for updating existing data

   DELETE
      Request type for removing data

   Status Code
      A number indicating if a request succeeded:
      
      - **200**: Success
      - **201**: Created successfully
      - **400**: Bad request (client error)
      - **401**: Unauthorized (need to login)
      - **403**: Forbidden (don't have permission)
      - **404**: Not found
      - **500**: Server error

   URL (Uniform Resource Locator)
      A web address like ``https://example.com/page``

   Query Parameter
      Extra information added to a URL after ``?``, like ``?search=pottery&limit=10``

Database Concepts
-----------------

.. glossary::

   Table
      Organized data in rows and columns, like a spreadsheet

   Row / Record
      One entry in a table, like one user or one project

   Column / Field
      A property that all rows have, like "email" or "created_at"

   Primary Key
      A unique identifier for each row (like a serial number)

   Foreign Key
      A reference to another table's primary key (creates relationships)

   Migration
      A script that changes the database structure (adds/removes tables or columns)

   SQL (Structured Query Language)
      The language used to read/write data in databases

   PostgreSQL
      The specific database software STRATUM uses

   Schema
      The structure/blueprint of the database (what tables and columns exist)

File System Terms
-----------------

.. glossary::

   Directory / Folder
      A container for files and other folders

   Path
      The location of a file or folder, like ``/Users/name/Documents/file.txt``

   Absolute Path
      Full path from the root: ``/Users/levin/project/backend/app/main.py``

   Relative Path
      Path from current location: ``../backend/app/main.py``

   Root Directory
      The top-most folder (``/`` on Mac/Linux, ``C:\`` on Windows)

   Parent Directory
      The folder containing the current folder

   Child Directory
      A folder inside the current folder

   Extension
      The part after the dot in a filename: ``.txt``, ``.jpg``, ``.py``

Common Symbols & Conventions
=============================

File Path Symbols
-----------------

.. code-block:: text

   /              Root directory or path separator
   .              Current directory
   ..             Parent directory (one level up)
   ~              Home directory (/Users/yourname)
   *              Wildcard (matches any characters)
   **             Matches any nested directories

Example: ``../../docs/*.rst`` means "go up two folders, into docs, and match all .rst files"

Command Line Symbols
--------------------

.. code-block:: bash

   $              Standard terminal prompt (don't type this)
   #              Comment (explanatory text, not a command)
   &&             Run commands in sequence (second only if first succeeds)
   |              Pipe (send output of one command to another)
   >              Redirect output to a file (overwrites)
   >>             Append output to a file
   --flag         Command option (like --help or --verbose)
   -f             Short option (often same as --flag)

Code Symbols
------------

.. code-block:: python

   # Python/Bash comment
   """ Multi-line comment or docstring """
   = Assignment (store value)
   == Equality check (are these equal?)
   != Not equal
   < Less than
   > Greater than
   <= Less than or equal
   >= Greater than or equal
   + Addition / concatenation
   - Subtraction
   * Multiplication
   / Division
   () Function call or grouping
   [] List or array
   {} Dictionary or code block
   . Dot notation (access property)
   , Separator
   : Defines block or key-value pair
   ; Statement separator

HTTP Symbols
------------

.. code-block:: http

   GET             Retrieve data
   POST            Create data
   PUT             Update data
   DELETE          Remove data
   
   /               Path separator in URLs
   ?               Start of query parameters
   &               Separate multiple parameters
   =               Assign parameter value
   
   200 OK          Request succeeded
   404 Not Found   Resource doesn't exist
   500 Error       Server problem

RST Formatting Symbols
----------------------

.. code-block:: rst

   ===========     Overline/underline for titles
   -----------     Underline for sections
   ~~~~~~~~~~~     Underline for subsections
   
   **bold**        Bold text
   *italic*        Italic text
   ``code``        Inline code or literal
   
   .. directive::  Special RST command
   :role:`text`    Inline role/formatting
   
   - Bullet        Unordered list item
   1. Number       Ordered list item
   
   |text|          Substitution reference
   [#]_            Footnote reference
   _`target`       Reference target

Common Abbreviations
====================

Technology Acronyms
-------------------

.. list-table::
   :widths: 20 30 50
   :header-rows: 1

   * - Acronym
     - Full Name
     - Meaning
   * - API
     - Application Programming Interface
     - Way for programs to communicate
   * - CRUD
     - Create, Read, Update, Delete
     - Basic data operations
   * - CSV
     - Comma-Separated Values
     - Spreadsheet file format
   * - DB
     - Database
     - Data storage system
   * - HTML
     - HyperText Markup Language
     - Web page structure language
   * - HTTP(S)
     - HyperText Transfer Protocol (Secure)
     - Web communication protocol
   * - IDE
     - Integrated Development Environment
     - Software for writing code
   * - JSON
     - JavaScript Object Notation
     - Data exchange format
   * - JWT
     - JSON Web Token
     - Security token format
   * - OS
     - Operating System
     - Computer's main software (Windows, Mac, Linux)
   * - ORM
     - Object-Relational Mapping
     - Translates between code objects and database
   * - PDF
     - Portable Document Format
     - Universal document format
   * - REST
     - Representational State Transfer
     - API design style
   * - RST
     - reStructuredText
     - Documentation format
   * - SDK
     - Software Development Kit
     - Tools for building software
   * - SQL
     - Structured Query Language
     - Database query language
   * - SSH
     - Secure Shell
     - Secure remote access protocol
   * - SSL/TLS
     - Secure Sockets Layer / Transport Layer Security
     - Encryption protocols
   * - UI
     - User Interface
     - What users see and interact with
   * - URI/URL
     - Universal Resource Identifier/Locator
     - Web address
   * - UX
     - User Experience
     - How users feel using the software
   * - UUID
     - Universally Unique Identifier
     - Random unique ID like "abc-123-def-456"
   * - WS
     - WebSocket
     - Real-time communication protocol

STRATUM-Specific Acronyms
-------------------------

.. list-table::
   :widths: 30 70
   :header-rows: 1

   * - Acronym
     - Meaning
   * - FLL
     - FIRST LEGO League
   * - GLB/GLTF
     - 3D model file formats
   * - GPS
     - Global Positioning System (location tracking)
   * - QR
     - Quick Response (2D barcode)

File Types & Extensions
=======================

Code Files
----------

.. glossary::

   .py
      Python source code file

   .ts / .tsx
      TypeScript source code files (tsx includes React components)

   .js / .jsx
      JavaScript source code files

   .json
      JSON data file (configuration or data)

   .sql
      SQL database script

   .sh
      Shell script (terminal commands)

   .env
      Environment variables (configuration secrets)

   .ini
      Configuration file

   .toml
      Configuration file format

Documentation Files
-------------------

.. glossary::

   .rst
      reStructuredText documentation file

   .md
      Markdown documentation file

   .txt
      Plain text file

   .pdf
      Portable Document Format

Data Files
----------

.. glossary::

   .csv
      Comma-Separated Values (spreadsheet data)

   .xlsx
      Microsoft Excel spreadsheet

   .json
      JSON data file

Media Files
-----------

.. glossary::

   .jpg / .jpeg / .png / .heic
      Image file formats

   .mp4 / .mov
      Video file formats

   .mp3 / .wav
      Audio file formats

   .glb / .gltf
      3D model file formats

   .ply / .pcd / .las
      Point cloud file formats

   .shp
      Shapefile (GIS geographic data)

Understanding File Structure
=============================

Project Organization
--------------------

STRATUM is organized like this:

.. code-block:: text

   QuantumBitsFLL2025-2026/        ← Root folder (main directory)
   ├── backend/                    ← Server-side code
   │   ├── app/                    ← Main application code
   │   │   ├── routes/            ← API endpoints (URLs)
   │   │   ├── models.py          ← Database structure definitions
   │   │   └── main.py            ← Application entry point
   │   ├── alembic/               ← Database migration scripts
   │   ├── tests/                 ← Automated tests
   │   └── requirements.txt       ← List of Python dependencies
   │
   ├── frontend/                   ← Client-side code (user interface)
   │   └── stratum-app/           ← React Native app
   │       ├── app/               ← Screen components
   │       ├── src/               ← Reusable code
   │       └── package.json       ← List of JavaScript dependencies
   │
   ├── docs/                       ← Documentation you're reading now
   │   ├── index.rst              ← Documentation home page
   │   ├── legend.rst             ← This file!
   │   └── api/                   ← API documentation
   │
   └── README.rst                  ← Project overview

Symbols Explained:

- ``/`` at the end means it's a folder
- ``├──`` means "contained in" (like a branch on a tree)
- ``└──`` means "last item in this folder"
- ``←`` points to an explanation

Common Workflows
================

Reading Code Examples
---------------------

When you see code examples, here's how to read them:

**Python Example:**

.. code-block:: python
   :linenos:

   # Get all projects for current user
   def get_user_projects(user_id):
       projects = db.query(Project).filter(
           Project.owner_id == user_id
       ).all()
       return projects

Line by line:

1. ``#`` Comment explaining what the code does
2. ``def`` defines a function named ``get_user_projects``
3. ``user_id`` is the input parameter
4. Query the database for projects
5. Filter to only projects owned by this user
6. ``.all()`` gets all matching results
7. ``return`` sends the results back

**API Request Example:**

.. code-block:: http

   GET /api/projects HTTP/1.1
   Host: localhost:8000
   Authorization: Bearer abc123token
   Content-Type: application/json

Meaning:

- ``GET`` = Request type (retrieving data)
- ``/api/projects`` = URL path (endpoint)
- ``Host:`` = Server address
- ``Authorization:`` = Login credentials
- ``Content-Type:`` = Data format

Following Instructions
----------------------

When documentation says to run commands:

.. code-block:: bash

   cd backend
   pip install -r requirements.txt
   python -m uvicorn app.main:app --reload

Do this:

1. Open terminal/command prompt
2. Type ``cd backend`` and press Enter (changes to backend folder)
3. Type ``pip install -r requirements.txt`` and press Enter (installs dependencies)
4. Type ``python -m uvicorn app.main:app --reload`` and press Enter (starts server)

Don't type:

- The ``$`` or ``%`` prompt symbol
- Any ``#`` comments
- The ``>`` or ``>>>`` symbols

Understanding Diagrams
======================

Graphviz Diagrams
-----------------

You'll see flow diagrams showing how parts connect:

.. graphviz::

   digraph example {
       rankdir=LR;
       node [shape=box];
       
       User -> Frontend [label="clicks button"];
       Frontend -> Backend [label="sends request"];
       Backend -> Database [label="queries data"];
       Database -> Backend [label="returns data"];
       Backend -> Frontend [label="sends response"];
       Frontend -> User [label="shows result"];
   }

Read these left-to-right or top-to-bottom:

- Boxes = Components/parts
- Arrows = Flow/direction
- Labels = What's happening
- Colors = Different types (usually)

Tables
------

Tables organize information in rows and columns:

.. list-table::
   :widths: 30 70
   :header-rows: 1

   * - Column 1 (Header)
     - Column 2 (Header)
   * - Row 1, Cell 1
     - Row 1, Cell 2
   * - Row 2, Cell 1
     - Row 2, Cell 2

The first row (darker) is the header explaining what each column contains.

Version Control (Git)
=====================

Git Terms
---------

.. glossary::

   Git
      Software that tracks changes to code over time

   Repository (Repo)
      A project stored in Git

   Commit
      A saved snapshot of changes with a message

   Branch
      A parallel version of the code (like a timeline split)

   Main / Master
      The primary branch (official version)

   Pull
      Download changes from remote repository

   Push
      Upload your changes to remote repository

   Merge
      Combine two branches together

   Conflict
      When two changes clash and need manual resolution

   Clone
      Make a local copy of a repository

   Fork
      Make your own copy of someone else's repository

Common Git Commands
-------------------

.. code-block:: bash

   git status              # See what's changed
   git add .               # Stage all changes
   git commit -m "message" # Save changes with message
   git push                # Upload to remote
   git pull                # Download from remote
   git branch              # List branches
   git checkout branch     # Switch to a branch
   git merge branch        # Merge branch into current

Getting Help
============

Using Documentation
-------------------

**Table of Contents**: Click section names to jump there

**Search**: Use Ctrl+F (Windows/Linux) or Cmd+F (Mac) to find words on page

**Links**: Blue underlined text is clickable

**Cross-References**: :doc:`filename` links go to other documentation pages

Where to Find Information
-------------------------

.. list-table::
   :widths: 40 60
   :header-rows: 1

   * - To Learn About...
     - Read This Documentation
   * - Setting up STRATUM
     - :doc:`installation`
   * - Getting started quickly
     - :doc:`quickstart`
   * - How STRATUM works
     - :doc:`architecture`
   * - All features
     - :doc:`features`
   * - API endpoints
     - :doc:`api/overview`
   * - Database structure
     - :doc:`database-schema`
   * - Real-time features
     - :doc:`websockets-realtime`
   * - Common problems
     - :doc:`troubleshooting`
   * - Frequently asked questions
     - :doc:`faq`

Common Patterns
===============

Authentication Flow
-------------------

**Simple explanation:** How the app knows who you are

1. You enter email and password
2. Firebase checks if they're correct
3. Firebase gives you a token (like a temporary ID card)
4. You send this token with every request
5. Server checks token before doing anything
6. Server sends back your data

API Request Flow
----------------

**Simple explanation:** How the app gets data from the server

1. **You:** Click a button (like "Load Projects")
2. **Frontend:** Sends request to server at specific URL
3. **Server:** Receives request, checks if you're logged in
4. **Server:** Gets data from database
5. **Server:** Sends data back as JSON
6. **Frontend:** Receives data and shows it on screen

File Upload Flow
----------------

**Simple explanation:** How files are saved

1. **You:** Select file on your device
2. **Frontend:** Converts file to binary data
3. **Frontend:** Sends file to server
4. **Server:** Saves file to MinIO (file storage)
5. **Server:** Creates database record with file info
6. **Server:** Sends back file ID
7. **Frontend:** Shows success message

Tips for Beginners
==================

.. tip::
   **Don't Panic!**
   
   - You don't need to understand everything at once
   - Start with :doc:`quickstart` and come back here when confused
   - It's okay to ask for help
   - Most developers look things up constantly

.. tip::
   **Learning Strategy:**
   
   1. Start with high-level overview (:doc:`architecture`)
   2. Follow step-by-step guides (:doc:`quickstart`)
   3. Reference detailed docs when needed
   4. Come back to this legend when you see unfamiliar terms

.. tip::
   **Good Practices:**
   
   - Keep this legend open in another tab
   - Use Ctrl+F to search for terms
   - Read error messages carefully
   - Check :doc:`troubleshooting` for common issues

Additional Resources
====================

Learning Programming
--------------------

If you want to learn more about programming:

- **Python**: python.org/about/gettingstarted
- **JavaScript**: developer.mozilla.org/en-US/docs/Learn
- **Git**: git-scm.com/doc
- **Web Development**: developer.mozilla.org

Understanding Archaeology + Tech
---------------------------------

STRATUM bridges archaeology and technology:

- **Digital Archaeology**: Resources on digitizing archaeological work
- **GIS (Geographic Information Systems)**: Mapping and spatial analysis
- **Database Design**: How to structure archaeological data
- **3D Modeling**: Digital representation of artifacts

Glossary
========

Quick Reference
---------------

Use Ctrl+F to search this alphabetical list:

.. glossary::
   :sorted:

   404
      HTTP status code meaning "not found" - the requested resource doesn't exist

   API Key
      Secret code used to authenticate with external services

   Async / Asynchronous
      Operations that don't block - other things can happen while waiting

   Authentication
      Verifying who someone is (login)

   Authorization
      Verifying what someone is allowed to do (permissions)

   Bug
      An error or defect in software

   Cache
      Temporary storage to speed up repeated requests

   CLI (Command Line Interface)
      Text-based interface for commands (terminal)

   Crash
      When software stops working unexpectedly

   Debug
      Finding and fixing errors in code

   Dependency
      External code that your project needs to work

   Deploy
      Make software available for users (put it on a server)

   Environment Variables
      Configuration settings stored outside code (like passwords)

   Framework
      Pre-built code structure that you build upon

   GUI (Graphical User Interface)
      Visual interface with buttons and windows

   Hash
      Convert data into a fixed-size string (often for passwords)

   Library
      Collection of pre-written code you can use

   Log
      Record of events or errors for debugging

   Localhost
      Your own computer when used as a server (127.0.0.1)

   Module
      A file containing related code

   Namespace
      Container that prevents name conflicts

   Package
      Collection of related modules

   Port
      Virtual door on a computer (like 8000 or 3000)

   Production
      The live version users interact with

   Query
      Request for data from database

   Refactor
      Improve code without changing what it does

   Render
      Generate visual output from data

   Runtime
      When the program is actively running

   Seed
      Fill database with test data

   Sync / Synchronous
      Operations that block - must finish before continuing

   Token
      Digital credential for authentication

   Validate
      Check if data meets requirements

   Version
      Specific release of software (like 1.0.0)

Practical Examples
==================

This section walks through real scenarios you might encounter.

Example 1: Setting Up for the First Time
----------------------------------------

You want to run STRATUM on your computer. Here's what each step means:

**Step 1: Clone the repository**

.. code-block:: bash

   git clone https://github.com/QuantumBits/QuantumBitsFLL2025-2026.git

This downloads a copy of all the code from GitHub to your computer.

**Step 2: Navigate to the backend**

.. code-block:: bash

   cd QuantumBitsFLL2025-2026/backend

``cd`` = "change directory". You're moving into the backend folder, like double-clicking a folder.

**Step 3: Create a virtual environment**

.. code-block:: bash

   python -m venv venv

This creates an isolated space for Python packages so they don't interfere with other projects.

**Step 4: Activate it**

.. code-block:: bash

   source venv/bin/activate

Now any Python packages you install only apply to this project.

**Step 5: Install dependencies**

.. code-block:: bash

   pip install -r requirements.txt

This reads the requirements.txt file and downloads all necessary Python packages.

**Step 6: Run the server**

.. code-block:: bash

   python -m uvicorn app.main:app --reload

Starts the backend server. ``--reload`` means it restarts when you change code.

Example 2: Understanding an API Response
----------------------------------------

You call ``GET /api/projects`` and receive:

.. code-block:: json

   {
     "id": "550e8400-e29b-41d4-a716-446655440000",
     "name": "Pompeii Excavation 2026",
     "description": "Archaeological site documentation",
     "owner_id": "user-123-abc",
     "created_at": "2026-01-15T10:30:00Z",
     "is_active": true
   }

Breaking this down:

- ``id``: Unique identifier (UUID format - random letters/numbers)
- ``name``: Human-readable project name
- ``description``: Optional longer text
- ``owner_id``: Which user created this (links to users table)
- ``created_at``: Timestamp in ISO 8601 format (Year-Month-Day T Hour:Minute:Second Z=UTC)
- ``is_active``: Boolean (true/false) - whether project is active

Example 3: Reading a Database Error
-----------------------------------

You see this error:

.. code-block:: text

   sqlalchemy.exc.IntegrityError: (psycopg.errors.ForeignKeyViolation) 
   insert or update on table "notes" violates foreign key constraint 
   "notes_project_id_fkey"
   DETAIL: Key (project_id)=(nonexistent-id) is not present in table "projects".

What it means:

1. ``IntegrityError``: Data integrity was violated
2. ``ForeignKeyViolation``: A reference to another table is broken
3. ``notes_project_id_fkey``: The constraint that was violated
4. ``Key (project_id)=(nonexistent-id)``: You tried to use a project ID that doesn't exist

**Fix:** Make sure the project exists before creating notes in it.

Example 4: Understanding WebSocket Events
-----------------------------------------

In the console you see:

.. code-block:: text

   [Socket.IO] Received: content_update
   {
     "type": "note_updated",
     "project_id": "proj-123",
     "data": {"note_id": "note-456", "title": "New Title"}
   }

What happened:

1. Someone else updated a note in a project you're viewing
2. The server pushed this update to all connected users
3. Your app received it and can update the display without refreshing

This is how real-time collaboration works.

Example 5: Environment Variables
--------------------------------

In ``.env`` file:

.. code-block:: bash

   DATABASE_URL=postgresql://postgres:password@localhost:5432/stratum
   MINIO_ACCESS_KEY=minioadmin
   FIREBASE_PROJECT_ID=my-project-123

Why environment variables?

1. **Security**: Passwords aren't in code (which is shared on GitHub)
2. **Flexibility**: Different settings for development vs production
3. **Convenience**: Change settings without modifying code

Never commit ``.env`` files to Git - they contain secrets!

Quick Reference Cards
=====================

Terminal Commands Quick Reference
---------------------------------

.. list-table::
   :widths: 30 70
   :header-rows: 1

   * - Command
     - What it does
   * - ``cd folder``
     - Go into folder
   * - ``cd ..``
     - Go up one folder
   * - ``ls`` (Mac/Linux) / ``dir`` (Windows)
     - List files in current folder
   * - ``pwd``
     - Show current location
   * - ``cat file.txt``
     - Display file contents
   * - ``mkdir folder``
     - Create new folder
   * - ``rm file``
     - Delete file (careful!)
   * - ``cp source dest``
     - Copy file
   * - ``mv source dest``
     - Move or rename file
   * - ``ctrl+c``
     - Stop running command
   * - ``clear``
     - Clear terminal screen

Git Commands Quick Reference
----------------------------

.. list-table::
   :widths: 30 70
   :header-rows: 1

   * - Command
     - What it does
   * - ``git status``
     - See what's changed
   * - ``git add .``
     - Stage all changes
   * - ``git add file``
     - Stage specific file
   * - ``git commit -m "message"``
     - Save staged changes
   * - ``git push``
     - Upload to GitHub
   * - ``git pull``
     - Download from GitHub
   * - ``git log --oneline``
     - View commit history
   * - ``git branch``
     - List branches
   * - ``git checkout branch``
     - Switch branch
   * - ``git checkout -b new``
     - Create and switch to new branch

Python Commands Quick Reference
-------------------------------

.. list-table::
   :widths: 40 60
   :header-rows: 1

   * - Command
     - What it does
   * - ``python --version``
     - Check Python version
   * - ``python script.py``
     - Run a Python script
   * - ``python -m venv venv``
     - Create virtual environment
   * - ``source venv/bin/activate``
     - Activate venv (Mac/Linux)
   * - ``venv\Scripts\activate``
     - Activate venv (Windows)
   * - ``pip install package``
     - Install a package
   * - ``pip install -r requirements.txt``
     - Install from requirements file
   * - ``pip list``
     - List installed packages
   * - ``pip freeze``
     - List packages with versions
   * - ``deactivate``
     - Exit virtual environment

npm/Node Commands Quick Reference
---------------------------------

.. list-table::
   :widths: 40 60
   :header-rows: 1

   * - Command
     - What it does
   * - ``node --version``
     - Check Node.js version
   * - ``npm --version``
     - Check npm version
   * - ``npm install``
     - Install all dependencies
   * - ``npm install package``
     - Install specific package
   * - ``npm run start``
     - Run start script
   * - ``npm run build``
     - Build for production
   * - ``npm test``
     - Run tests
   * - ``npx expo start``
     - Start Expo dev server

HTTP Status Codes Quick Reference
---------------------------------

.. list-table::
   :widths: 15 25 60
   :header-rows: 1

   * - Code
     - Name
     - What it means
   * - 200
     - OK
     - Request succeeded
   * - 201
     - Created
     - New resource created
   * - 204
     - No Content
     - Success, nothing to return
   * - 400
     - Bad Request
     - Your request was malformed
   * - 401
     - Unauthorized
     - Not logged in
   * - 403
     - Forbidden
     - Logged in but no permission
   * - 404
     - Not Found
     - Resource doesn't exist
   * - 409
     - Conflict
     - Conflicts with existing data
   * - 422
     - Unprocessable
     - Validation failed
   * - 500
     - Server Error
     - Something broke on the server
   * - 502
     - Bad Gateway
     - Server couldn't reach upstream
   * - 503
     - Unavailable
     - Server overloaded/down

Still Confused?
===============

.. note::
   If you're still unsure about something:
   
   1. Check if it's in this legend (use Ctrl+F to search)
   2. Look in the relevant documentation section
   3. Check :doc:`faq` for frequently asked questions
   4. See :doc:`troubleshooting` for common issues
   5. Ask for help - everyone starts as a beginner!

.. important::
   **Remember:** This legend is here to help you. Don't feel like you need to memorize everything. Just come back when you need to look something up!

----

*Last updated: January 2026*

*Have suggestions for this legend? Let us know what terms or concepts we should add!*
