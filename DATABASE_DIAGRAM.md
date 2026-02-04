# STRATUM Database Schema - Interactive Diagram

> **Note:** GitHub automatically renders Mermaid diagrams. View this file on GitHub to see the interactive schema.

---

## Complete Entity Relationship Diagram

```mermaid
erDiagram
    USERS {
        string id PK "UUID"
        string firebase_uid UK "Firebase Auth UID"
        string email UK "User email"
        string display_name "Optional name"
        string photo_url "Profile photo"
        datetime created_at "Account created"
        datetime updated_at "Last modified"
        datetime last_login "Last login time"
    }

    PROJECTS {
        string id PK "UUID"
        string name "Project name"
        text description "Description"
        string ran_lmi_id "Romanian Registry ID"
        string owner_id FK "Owner user"
        datetime created_at "Created"
        datetime updated_at "Modified"
        bool is_active "Active status"
    }

    PROJECT_MEMBERS {
        string project_id FK "Project ref"
        string user_id FK "User ref"
        enum role "leader|researcher|guest"
        datetime joined_at "Join date"
    }

    NOTES {
        string id PK "UUID"
        string title "Note title"
        text content "Note content"
        string project_id FK "Parent project"
        string author_id FK "Author user"
        datetime created_at "Created"
        datetime updated_at "Modified"
        datetime last_synced "MinIO sync time"
        int version "Version number"
        enum privacy "private|shared|project|public"
        json shared_with "User IDs list"
    }

    FILE_NODES {
        string id PK "UUID"
        string project_id FK "Parent project"
        string parent_id FK "Parent folder"
        string name "File/folder name"
        enum type "folder|file|note"
        string mime_type "MIME type"
        string size "File size"
        string storage_path "MinIO path"
        bool is_locked "Prevent delete"
        int version "Version number"
        string checksum "File hash"
        string owner_id FK "Owner user"
        enum privacy "private|shared|project|public"
        json shared_with "User IDs list"
        datetime created_at "Created"
        datetime updated_at "Modified"
    }

    FILE_VERSIONS {
        string id PK "UUID"
        string file_node_id FK "Parent file"
        int version "Version number"
        string storage_path "MinIO path"
        string size "File size"
        string checksum "File hash"
        datetime created_at "Created"
        string created_by FK "Creator user"
    }

    NOTE_FILE_LINKS {
        string note_id PK_FK "Note ref"
        string file_node_id UK_FK "FileNode ref"
    }

    NOTE_ATTACHMENTS {
        string id PK "UUID"
        string note_id FK "Parent note"
        string filename "Original name"
        string file_path "MinIO path"
        string file_type "MIME type"
        string file_size "Size"
        datetime uploaded_at "Upload time"
    }

    PROJECT_GPS {
        string project_id PK_FK "Project ref"
        text data "JSON GPS data"
        datetime updated_at "Modified"
    }

    PROJECT_INVITES {
        string token PK "UUID token"
        string code UK "Short code"
        string project_id FK "Project ref"
        enum role "Assigned role"
        string created_by FK "Creator"
        datetime created_at "Created"
        datetime expires_at "Expiration"
        string redeemed_by FK "Redeemer"
        datetime redeemed_at "Redeemed time"
        bool used "Is used"
        int max_uses "Max redemptions"
        int use_count "Current uses"
    }

    PROJECT_ACTIVITIES {
        string id PK "UUID"
        string project_id FK "Project ref"
        string user_id FK "Acting user"
        enum activity_type "Activity type"
        text description "Description"
        text extra_data "JSON data"
        datetime created_at "Timestamp"
    }

    %% Relationships
    USERS ||--o{ PROJECTS : "owns"
    USERS ||--o{ PROJECT_MEMBERS : "joins"
    USERS ||--o{ NOTES : "authors"
    USERS ||--o{ FILE_NODES : "owns"
    USERS ||--o{ FILE_VERSIONS : "creates"
    USERS ||--o{ PROJECT_ACTIVITIES : "performs"
    USERS ||--o{ PROJECT_INVITES : "creates"
    USERS ||--o{ PROJECT_INVITES : "redeems"

    PROJECTS ||--o{ PROJECT_MEMBERS : "has"
    PROJECTS ||--o{ NOTES : "contains"
    PROJECTS ||--o{ FILE_NODES : "contains"
    PROJECTS ||--|| PROJECT_GPS : "has"
    PROJECTS ||--o{ PROJECT_INVITES : "has"
    PROJECTS ||--o{ PROJECT_ACTIVITIES : "logs"

    NOTES ||--o{ NOTE_ATTACHMENTS : "has"
    NOTES ||--|| NOTE_FILE_LINKS : "links"

    FILE_NODES ||--o{ FILE_NODES : "contains"
    FILE_NODES ||--|| NOTE_FILE_LINKS : "backs"
    FILE_NODES ||--o{ FILE_VERSIONS : "versions"
```

---

## Core Tables Diagram

```mermaid
erDiagram
    USERS ||--o{ PROJECTS : "owns"
    USERS }o--o{ PROJECTS : "member via PROJECT_MEMBERS"
    PROJECTS ||--o{ NOTES : "contains"
    PROJECTS ||--o{ FILE_NODES : "contains"
    NOTES ||--|| NOTE_FILE_LINKS : "has backing file"
    FILE_NODES ||--|| NOTE_FILE_LINKS : "stores note"
    FILE_NODES ||--o{ FILE_NODES : "parent-child"
```

---

## File System Hierarchy

```mermaid
flowchart TD
    subgraph Project["📁 Project Root"]
        subgraph Folders["Folders"]
            F1["📁 Excavation Photos"]
            F2["📁 Field Notes"]
            F3["📁 Reports"]
        end
        
        subgraph Files["Files"]
            FILE1["📄 site_map.pdf"]
            FILE2["📄 artifacts.xlsx"]
        end
        
        subgraph NotesFolder["📁 Notes (locked)"]
            N1["📝 Note 1.txt"]
            N2["📝 Note 2.txt"]
        end
    end
    
    F1 --> F1_1["🖼️ photo_001.jpg"]
    F1 --> F1_2["🖼️ photo_002.jpg"]
    F2 --> F2_1["📄 day1_notes.docx"]
```

---

## MinIO Storage Structure

```mermaid
flowchart LR
    subgraph Bucket["🪣 MinIO Bucket"]
        subgraph FilesPath["files/"]
            FP["files/{project_id}/{uuid}"]
        end
        
        subgraph NotesPath["notes/"]
            NP1["notes/{project_id}/{note_id}.txt"]
            NP2["notes/{note_id}/{uuid}.{ext}"]
        end
        
        subgraph VersionsPath["versions/"]
            VP["versions/{file_node_id}/v{n}_{uuid}"]
        end
    end
    
    FN["FILE_NODES.storage_path"] --> FP
    NFL["NOTE_FILE_LINKS"] --> NP1
    NA["NOTE_ATTACHMENTS.file_path"] --> NP2
    FV["FILE_VERSIONS.storage_path"] --> VP
```

---

## Data Flow Architecture

```mermaid
flowchart TB
    Client["📱 Mobile App / Web Client"]
    
    subgraph Auth["🔐 Authentication"]
        Firebase["Firebase Auth"]
    end
    
    subgraph Backend["⚙️ FastAPI Backend"]
        API["REST API"]
        WS["WebSocket Server"]
    end
    
    subgraph Storage["💾 Data Storage"]
        PG["🐘 PostgreSQL<br/>Metadata & Relations"]
        Minio["📦 MinIO<br/>File Storage"]
    end
    
    Client --> Firebase
    Firebase --> API
    Client --> WS
    API --> PG
    API --> Minio
    WS --> PG
```

---

## User Roles & Permissions

```mermaid
flowchart TD
    subgraph Roles["User Roles"]
        Leader["👑 Leader<br/>Full Access"]
        Researcher["🔬 Researcher<br/>Read/Write"]
        Guest["👤 Guest<br/>Read Only"]
    end
    
    subgraph Permissions["Permissions"]
        P1["Create/Delete Project"]
        P2["Manage Members"]
        P3["Create/Edit Notes"]
        P4["Upload Files"]
        P5["View Content"]
    end
    
    Leader --> P1
    Leader --> P2
    Leader --> P3
    Leader --> P4
    Leader --> P5
    
    Researcher --> P3
    Researcher --> P4
    Researcher --> P5
    
    Guest --> P5
```

---

## Privacy Levels

```mermaid
flowchart LR
    subgraph Privacy["Privacy Levels for Notes & Files"]
        Private["🔒 PRIVATE<br/>Owner only"]
        Shared["👥 SHARED<br/>Specific users"]
        Project["📂 PROJECT<br/>All members"]
        Public["🌐 PUBLIC<br/>Anyone with access"]
    end
    
    Private --> |"Most restrictive"| Shared
    Shared --> Project
    Project --> |"Least restrictive"| Public
```

---

## Activity Types

```mermaid
mindmap
    root((Activity Types))
        Project
            project_created
            project_updated
        Members
            member_joined
            member_left
            member_role_changed
        Notes
            note_created
            note_updated
            note_deleted
            note_attachment_added
            note_attachment_deleted
        Files
            file_uploaded
            file_updated
            file_deleted
            folder_created
            folder_deleted
            file_moved
            file_renamed
        Forms
            context_feature_added
            stratigraphic_unit_added
            artefact_added
        GPS
            gps_updated
```

---

## Invite System Flow

```mermaid
sequenceDiagram
    participant Leader
    participant API
    participant DB as PostgreSQL
    participant NewUser

    Leader->>API: Create Invite
    API->>DB: Insert PROJECT_INVITES
    DB-->>API: Return token/code
    API-->>Leader: Invite link/code
    
    Leader->>NewUser: Share invite
    
    NewUser->>API: Redeem invite
    API->>DB: Validate invite
    DB-->>API: Invite valid
    API->>DB: Add to PROJECT_MEMBERS
    API->>DB: Update invite (used, redeemed_by)
    API-->>NewUser: Success, joined project
```

---

## Note Sync Flow

```mermaid
sequenceDiagram
    participant App
    participant API
    participant PG as PostgreSQL
    participant Minio as MinIO

    App->>API: Create/Update Note
    API->>PG: Upsert NOTES record
    API->>Minio: Upload note.txt
    API->>PG: Create/Update FILE_NODES
    API->>PG: Create NOTE_FILE_LINKS
    API->>PG: Log to PROJECT_ACTIVITIES
    API-->>App: Success response
```

---

*View this file on GitHub to see all diagrams rendered interactively.*
