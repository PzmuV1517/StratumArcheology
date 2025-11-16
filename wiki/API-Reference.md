# API Reference 🔌

Complete reference for the STRATUM REST API. All endpoints require authentication unless specified otherwise.

---

## 🌐 Base URL

```
http://localhost:8000/api
```

For production, replace with your deployed API URL.

---

## 🔐 Authentication

All authenticated endpoints require a **Bearer token** in the Authorization header:

```http
Authorization: Bearer YOUR_FIREBASE_JWT_TOKEN
```

### Getting a Token

1. Authenticate with Firebase on the client
2. Get the ID token: `await user.getIdToken()`
3. Include in requests as shown above

---

## 📚 API Endpoints

### Authentication Endpoints

#### Get Current User

```http
GET /api/auth/me
```

**Description:** Get authenticated user's profile information.

**Headers:**
```http
Authorization: Bearer <token>
```

**Response:** `200 OK`
```json
{
  "id": 1,
  "firebase_uid": "abc123def456",
  "email": "archaeologist@example.com",
  "display_name": "Dr. Jones",
  "created_at": "2024-01-15T10:30:00Z"
}
```

**Errors:**
- `401` - Unauthorized (invalid or missing token)

---

#### Search Users

```http
GET /api/auth/users/search?email=<query>
```

**Description:** Search for users by email (for inviting to projects).

**Headers:**
```http
Authorization: Bearer <token>
```

**Query Parameters:**
- `email` (string, required) - Email address or partial match

**Response:** `200 OK`
```json
[
  {
    "id": 2,
    "email": "colleague@example.com",
    "display_name": "Dr. Smith"
  }
]
```

**Example:**
```bash
curl -X GET "http://localhost:8000/api/auth/users/search?email=smith" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

### Project Endpoints

#### Create Project

```http
POST /api/projects
```

**Description:** Create a new archaeological project/site.

**Headers:**
```http
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "Glina 2024 Excavation",
  "description": "Summer excavation of Neolithic site",
  "location": "Glina, Romania"
}
```

**Response:** `201 Created`
```json
{
  "id": 1,
  "name": "Glina 2024 Excavation",
  "description": "Summer excavation of Neolithic site",
  "location": "Glina, Romania",
  "owner_id": 1,
  "created_at": "2024-06-01T08:00:00Z",
  "updated_at": "2024-06-01T08:00:00Z"
}
```

**Errors:**
- `400` - Bad request (validation error)
- `401` - Unauthorized

---

#### List Projects

```http
GET /api/projects
```

**Description:** Get all projects accessible to the authenticated user (owned or member).

**Headers:**
```http
Authorization: Bearer <token>
```

**Response:** `200 OK`
```json
[
  {
    "id": 1,
    "name": "Glina 2024 Excavation",
    "description": "Summer excavation of Neolithic site",
    "location": "Glina, Romania",
    "owner_id": 1,
    "created_at": "2024-06-01T08:00:00Z",
    "updated_at": "2024-06-01T08:00:00Z",
    "role": "owner"
  },
  {
    "id": 2,
    "name": "Tell el-Amarna Survey",
    "description": "Surface survey project",
    "location": "Egypt",
    "owner_id": 5,
    "created_at": "2024-05-15T10:00:00Z",
    "updated_at": "2024-05-20T14:30:00Z",
    "role": "researcher"
  }
]
```

---

#### Get Project Details

```http
GET /api/projects/{id}
```

**Description:** Get detailed information about a specific project.

**Headers:**
```http
Authorization: Bearer <token>
```

**Path Parameters:**
- `id` (integer) - Project ID

**Response:** `200 OK`
```json
{
  "id": 1,
  "name": "Glina 2024 Excavation",
  "description": "Summer excavation of Neolithic site",
  "location": "Glina, Romania",
  "owner_id": 1,
  "created_at": "2024-06-01T08:00:00Z",
  "updated_at": "2024-06-01T08:00:00Z",
  "members": [
    {
      "user_id": 1,
      "email": "director@example.com",
      "display_name": "Dr. Jones",
      "role": "owner",
      "joined_at": "2024-06-01T08:00:00Z"
    },
    {
      "user_id": 2,
      "email": "assistant@example.com",
      "display_name": "Dr. Smith",
      "role": "researcher",
      "joined_at": "2024-06-02T09:00:00Z"
    }
  ]
}
```

**Errors:**
- `404` - Project not found
- `403` - Forbidden (not a member)

---

#### Update Project

```http
PUT /api/projects/{id}
```

**Description:** Update project details (owner or leader only).

**Headers:**
```http
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "Glina 2024-2025 Excavation",
  "description": "Extended excavation season",
  "location": "Glina, Romania"
}
```

**Response:** `200 OK`
```json
{
  "id": 1,
  "name": "Glina 2024-2025 Excavation",
  "description": "Extended excavation season",
  "location": "Glina, Romania",
  "owner_id": 1,
  "updated_at": "2024-09-15T11:20:00Z"
}
```

**Errors:**
- `403` - Forbidden (insufficient permissions)
- `404` - Project not found

---

#### Delete Project

```http
DELETE /api/projects/{id}
```

**Description:** Delete a project (owner only).

**Headers:**
```http
Authorization: Bearer <token>
```

**Response:** `204 No Content`

**Errors:**
- `403` - Forbidden (not owner)
- `404` - Project not found

---

#### Add Project Member

```http
POST /api/projects/{id}/members
```

**Description:** Invite a user to the project.

**Headers:**
```http
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "user_id": 3,
  "role": "researcher"
}
```

**Roles:** `leader`, `researcher`, `guest`

**Response:** `201 Created`
```json
{
  "user_id": 3,
  "email": "newmember@example.com",
  "display_name": "Dr. Brown",
  "role": "researcher",
  "joined_at": "2024-06-05T14:00:00Z"
}
```

**Errors:**
- `400` - User already a member
- `403` - Forbidden (insufficient permissions)
- `404` - Project or user not found

---

#### Remove Project Member

```http
DELETE /api/projects/{id}/members/{user_id}
```

**Description:** Remove a member from the project.

**Headers:**
```http
Authorization: Bearer <token>
```

**Response:** `204 No Content`

**Errors:**
- `403` - Forbidden (cannot remove owner or insufficient permissions)
- `404` - Project or member not found

---

#### Update Member Role

```http
PUT /api/projects/{id}/members/{user_id}
```

**Description:** Change a member's role.

**Headers:**
```http
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "role": "leader"
}
```

**Response:** `200 OK`
```json
{
  "user_id": 3,
  "role": "leader",
  "updated_at": "2024-06-10T16:00:00Z"
}
```

---

### Note Endpoints

#### Create Note

```http
POST /api/notes
```

**Description:** Create a new note in a project.

**Headers:**
```http
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "project_id": 1,
  "title": "Trench 4 - Layer 3 Findings",
  "content": "Discovered pottery fragments and charcoal samples..."
}
```

**Response:** `201 Created`
```json
{
  "id": 42,
  "project_id": 1,
  "author_id": 1,
  "title": "Trench 4 - Layer 3 Findings",
  "content": "Discovered pottery fragments and charcoal samples...",
  "created_at": "2024-06-15T09:30:00Z",
  "updated_at": "2024-06-15T09:30:00Z",
  "author": {
    "id": 1,
    "email": "archaeologist@example.com",
    "display_name": "Dr. Jones"
  }
}
```

**Errors:**
- `403` - Forbidden (guest role or not a member)
- `404` - Project not found

---

#### List Project Notes

```http
GET /api/notes/project/{project_id}
```

**Description:** Get all notes for a project.

**Headers:**
```http
Authorization: Bearer <token>
```

**Response:** `200 OK`
```json
[
  {
    "id": 42,
    "project_id": 1,
    "author_id": 1,
    "title": "Trench 4 - Layer 3 Findings",
    "content": "Discovered pottery fragments...",
    "created_at": "2024-06-15T09:30:00Z",
    "updated_at": "2024-06-15T09:30:00Z",
    "author": {
      "id": 1,
      "display_name": "Dr. Jones"
    }
  }
]
```

---

#### Get Note Details

```http
GET /api/notes/{id}
```

**Description:** Get a specific note with attachments.

**Headers:**
```http
Authorization: Bearer <token>
```

**Response:** `200 OK`
```json
{
  "id": 42,
  "project_id": 1,
  "title": "Trench 4 - Layer 3 Findings",
  "content": "Discovered pottery fragments...",
  "attachments": [
    {
      "id": 101,
      "filename": "IMG_2024.jpg",
      "url": "https://minio.../presigned-url",
      "uploaded_at": "2024-06-15T09:35:00Z"
    }
  ],
  "author": {
    "display_name": "Dr. Jones"
  }
}
```

---

#### Update Note

```http
PUT /api/notes/{id}
```

**Description:** Update note content (author, leader, or owner).

**Headers:**
```http
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "title": "Updated Title",
  "content": "Updated content..."
}
```

**Response:** `200 OK`

---

#### Delete Note

```http
DELETE /api/notes/{id}
```

**Description:** Delete a note (author, leader, or owner).

**Headers:**
```http
Authorization: Bearer <token>
```

**Response:** `204 No Content`

**Errors:**
- `403` - Forbidden (insufficient permissions)

---

#### Upload Note Attachment

```http
POST /api/notes/{id}/attachments
```

**Description:** Upload a photo/file to a note.

**Headers:**
```http
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Form Data:**
- `file` (file) - The file to upload

**Response:** `201 Created`
```json
{
  "id": 101,
  "filename": "IMG_2024.jpg",
  "url": "https://minio.../presigned-url",
  "uploaded_at": "2024-06-15T09:35:00Z"
}
```

**Example (cURL):**
```bash
curl -X POST "http://localhost:8000/api/notes/42/attachments" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@photo.jpg"
```

---

### File Endpoints

#### List Files

```http
GET /api/files/{project_id}?parent_id={parent_id}
```

**Description:** List files and folders in a directory.

**Headers:**
```http
Authorization: Bearer <token>
```

**Query Parameters:**
- `parent_id` (integer, optional) - Parent folder ID (null for root)

**Response:** `200 OK`
```json
[
  {
    "id": 1,
    "name": "Photos",
    "is_folder": true,
    "parent_id": null,
    "created_at": "2024-06-01T10:00:00Z"
  },
  {
    "id": 2,
    "name": "site_map.pdf",
    "is_folder": false,
    "parent_id": null,
    "size": 2048576,
    "mime_type": "application/pdf",
    "minio_key": "project-1/files/site_map.pdf",
    "created_at": "2024-06-02T11:00:00Z"
  }
]
```

---

#### Create Folder

```http
POST /api/files/{project_id}/folder
```

**Description:** Create a new folder.

**Headers:**
```http
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "Trench_1_Photos",
  "parent_id": 1
}
```

**Response:** `201 Created`
```json
{
  "id": 10,
  "name": "Trench_1_Photos",
  "is_folder": true,
  "parent_id": 1,
  "created_at": "2024-06-03T09:00:00Z"
}
```

---

#### Upload File

```http
POST /api/files/{project_id}/upload
```

**Description:** Upload a file to a folder.

**Headers:**
```http
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Form Data:**
- `file` (file) - The file to upload
- `parent_id` (integer, optional) - Parent folder ID

**Response:** `201 Created`
```json
{
  "id": 15,
  "name": "excavation_photo.jpg",
  "is_folder": false,
  "parent_id": 10,
  "size": 4567890,
  "mime_type": "image/jpeg",
  "minio_key": "project-1/files/excavation_photo.jpg",
  "created_at": "2024-06-03T10:30:00Z"
}
```

---

#### Download File

```http
GET /api/files/{file_id}/download
```

**Description:** Get a presigned URL to download a file.

**Headers:**
```http
Authorization: Bearer <token>
```

**Response:** `200 OK`
```json
{
  "url": "https://minio.../presigned-url?expires=...",
  "expires_in": 3600
}
```

**Usage:**
1. Call this endpoint to get presigned URL
2. Use URL to download file directly from MinIO
3. URL expires after 1 hour

---

#### Move File/Folder

```http
PUT /api/files/{file_id}/move
```

**Description:** Move a file or folder to a different parent.

**Headers:**
```http
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "new_parent_id": 5
}
```

**Response:** `200 OK`
```json
{
  "id": 15,
  "name": "excavation_photo.jpg",
  "parent_id": 5,
  "updated_at": "2024-06-04T11:00:00Z"
}
```

**Errors:**
- `409` - Conflict (file with same name exists in destination)

---

#### Rename File/Folder

```http
PUT /api/files/{file_id}/rename
```

**Description:** Rename a file or folder.

**Headers:**
```http
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "new_name": "trench1_overview.jpg"
}
```

**Response:** `200 OK`

---

#### Delete File/Folder

```http
DELETE /api/files/{file_id}
```

**Description:** Delete a file or folder (recursive for folders).

**Headers:**
```http
Authorization: Bearer <token>
```

**Response:** `204 No Content`

---

### GPS & Location Endpoints

#### Save GPS Coordinates

```http
POST /api/gps/{project_id}
```

**Description:** Save GPS coordinates for a project location.

**Request Body:**
```json
{
  "latitude": 45.123456,
  "longitude": 25.654321,
  "altitude": 125.5,
  "accuracy": 5.2,
  "note": "Northwest corner of site"
}
```

**Response:** `201 Created`

---

## 🔢 HTTP Status Codes

| Code | Meaning | Usage |
|------|---------|-------|
| `200` | OK | Successful GET, PUT |
| `201` | Created | Successful POST (resource created) |
| `204` | No Content | Successful DELETE |
| `400` | Bad Request | Invalid request data |
| `401` | Unauthorized | Missing or invalid token |
| `403` | Forbidden | Authenticated but not authorized |
| `404` | Not Found | Resource doesn't exist |
| `409` | Conflict | Resource conflict (e.g., duplicate file name) |
| `500` | Internal Server Error | Server error |

---

## 🛡️ Error Responses

All errors return a consistent format:

```json
{
  "detail": "Human-readable error message"
}
```

**Examples:**

```json
// 401 Unauthorized
{
  "detail": "Not authenticated"
}

// 403 Forbidden
{
  "detail": "Insufficient permissions"
}

// 404 Not Found
{
  "detail": "Project not found"
}

// 409 Conflict
{
  "detail": "A file with this name already exists in the destination folder"
}
```

---

## 📝 Request Examples

### Using cURL

```bash
# Get current user
curl -X GET "http://localhost:8000/api/auth/me" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Create project
curl -X POST "http://localhost:8000/api/projects" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "New Site",
    "description": "Description here",
    "location": "Location"
  }'

# Upload file
curl -X POST "http://localhost:8000/api/files/1/upload" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@document.pdf" \
  -F "parent_id=5"
```

### Using JavaScript (Axios)

```javascript
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:8000/api',
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

// Get projects
const projects = await api.get('/projects');

// Create note
const note = await api.post('/notes', {
  project_id: 1,
  title: 'Field Notes',
  content: 'Today we discovered...'
});

// Upload file
const formData = new FormData();
formData.append('file', fileBlob);
const upload = await api.post('/files/1/upload', formData, {
  headers: { 'Content-Type': 'multipart/form-data' }
});
```

### Using Python (requests)

```python
import requests

headers = {
    'Authorization': f'Bearer {token}'
}

# Get current user
response = requests.get(
    'http://localhost:8000/api/auth/me',
    headers=headers
)
user = response.json()

# Create project
response = requests.post(
    'http://localhost:8000/api/projects',
    headers=headers,
    json={
        'name': 'New Site',
        'description': 'Description',
        'location': 'Location'
    }
)
project = response.json()
```

---

## 🔧 Interactive API Documentation

Visit the **Swagger UI** for interactive documentation:

```
http://localhost:8000/docs
```

Features:
- 📚 Complete endpoint list
- 🧪 Try endpoints directly
- 📝 Request/response examples
- 🔍 Schema definitions
- 🔐 Authorization support

---

## 📊 Rate Limiting

**Current:** No rate limiting implemented

**Planned:**
- 1000 requests per hour per user
- 100 uploads per hour
- Burst allowance for normal usage

---

## 🔄 API Versioning

**Current Version:** v1 (implicit)

**URL Structure:**
```
/api/...
```

Future versions will use:
```
/api/v2/...
```

---

## 📚 Related Documentation

- [Getting Started](Getting-Started) - Setup guide
- [Features Documentation](Features-Documentation) - What you can build
- [Development Guide](Development-Guide) - Contributing
- [Troubleshooting](Troubleshooting) - Common issues

---

<div align="center">

**Need help with the API?**

[← Features](Features-Documentation) | [Development Guide →](Development-Guide)

</div>
