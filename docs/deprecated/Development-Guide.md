# Development Guide 👨‍💻

Welcome to the STRATUM development team! This guide will help you contribute effectively to the project.

---

## 🎯 Development Philosophy

**STRATUM follows these principles:**

1. **🎨 Clean Code** - Readable, maintainable, well-documented
2. **🧪 Test First** - Write tests before or with features
3. **📦 Small Commits** - Atomic, focused changes
4. **📝 Document Everything** - Code comments and wiki updates
5. **🤝 Collaborate** - Code reviews and pair programming
6. **🚀 Ship Often** - Small, frequent releases

---

## 🛠 Setup

### Development Environment

**Required Tools:**
- VS Code (recommended) or your preferred editor
- Git client
- Python 3.9+ with pip
- Node.js 18+ with npm
- PostgreSQL 14+
- Docker Desktop
- Postman or similar (for API testing)

**VS Code Extensions (Recommended):**
- Python
- Pylance
- ESLint
- Prettier
- GitLens
- Thunder Client (API testing)
- React Native Tools

### Clone and Setup

```bash
# Clone repository
git clone https://github.com/PzmuV1517/QuantumBitsFLL2025-2026.git
cd QuantumBitsFLL2025-2026

# Follow installation guide
# See: Installation & Setup wiki page
```

---

## 🏗️ Project Structure

### Backend (`backend/`)

```
backend/
├── app/
│   ├── routes/           # API endpoints (one file per resource)
│   ├── models.py         # SQLAlchemy models
│   ├── schemas.py        # Pydantic schemas
│   ├── database.py       # DB connection
│   ├── config.py         # Configuration
│   └── main.py           # App entry point
├── tests/                # Unit and integration tests
├── requirements.txt      # Dependencies
└── .env                  # Environment variables
```

**Key Files:**
- `models.py` - Database table definitions
- `schemas.py` - Request/response data structures
- `routes/*.py` - API endpoint implementations
- `main.py` - FastAPI app configuration

### Frontend (`frontend/stratum-app/`)

```
frontend/stratum-app/
├── app/                  # Expo Router pages
│   ├── (auth)/          # Auth screens
│   ├── (tabs)/          # Main app
│   └── _layout.tsx      # Root layout
├── src/
│   ├── components/      # Reusable UI components
│   ├── contexts/        # React Context
│   ├── services/        # API client
│   └── config/          # Configuration
├── package.json
└── app.json
```

**Key Directories:**
- `app/` - File-based routing (pages)
- `src/components/` - Reusable components
- `src/services/` - API integration layer
- `src/contexts/` - Global state management

---

## 🎨 Code Style

### Python (Backend)

**Style Guide:** [PEP 8](https://pep8.org/)

**Tools:**
```bash
# Format code
black app/

# Check style
flake8 app/

# Sort imports
isort app/

# Type checking
mypy app/
```

**Example:**
```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

router = APIRouter()


@router.get("/projects")
async def list_projects(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List all projects accessible to the current user.
    
    Args:
        db: Database session
        current_user: Authenticated user
        
    Returns:
        List of projects
    """
    projects = db.query(Project).filter(
        Project.owner_id == current_user.id
    ).all()
    
    return projects
```

**Best Practices:**
- ✅ Use type hints
- ✅ Write docstrings for functions
- ✅ Keep functions small (<50 lines)
- ✅ Use descriptive variable names
- ✅ Handle errors explicitly

### TypeScript (Frontend)

**Style Guide:** Airbnb + Prettier

**Tools:**
```bash
# Format code
npm run lint

# Type check
npm run type-check
```

**Example:**
```typescript
import { useState, useEffect } from 'react';
import { projectService } from '@/services/projectService';
import type { Project } from '@/types';

export const useProjects = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        setLoading(true);
        const data = await projectService.getProjects();
        setProjects(data);
      } catch (err) {
        setError('Failed to load projects');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchProjects();
  }, []);

  return { projects, loading, error };
};
```

**Best Practices:**
- ✅ Use TypeScript strictly (no `any`)
- ✅ Extract reusable hooks
- ✅ Keep components small and focused
- ✅ Use functional components
- ✅ Handle loading and error states

---

## 🧪 Testing

### Backend Tests

**Framework:** pytest

**Run Tests:**
```bash
cd backend
pytest tests/ -v
```

**Write Tests:**
```python
# tests/test_projects.py
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_create_project(auth_headers):
    """Test project creation endpoint."""
    response = client.post(
        "/api/projects",
        json={
            "name": "Test Project",
            "description": "Test description",
            "location": "Test location"
        },
        headers=auth_headers
    )
    
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Test Project"
    assert "id" in data


def test_list_projects(auth_headers):
    """Test listing projects."""
    response = client.get("/api/projects", headers=auth_headers)
    
    assert response.status_code == 200
    assert isinstance(response.json(), list)
```

**Coverage:**
```bash
pytest --cov=app tests/
```

### Frontend Tests

**Framework:** Jest + React Testing Library

**Run Tests:**
```bash
cd frontend/stratum-app
npm test
```

**Write Tests:**
```typescript
// __tests__/ProjectList.test.tsx
import { render, screen, waitFor } from '@testing-library/react-native';
import { ProjectList } from '@/components/ProjectList';

describe('ProjectList', () => {
  it('displays projects', async () => {
    const mockProjects = [
      { id: 1, name: 'Test Project', description: 'Test' }
    ];

    render(<ProjectList projects={mockProjects} />);

    await waitFor(() => {
      expect(screen.getByText('Test Project')).toBeTruthy();
    });
  });

  it('shows loading state', () => {
    render(<ProjectList projects={[]} loading={true} />);
    expect(screen.getByText('Loading...')).toBeTruthy();
  });
});
```

---

## 🔄 Git Workflow

### Branch Strategy

```
main (production-ready)
  └── develop (integration branch)
       ├── feature/user-authentication
       ├── feature/file-upload
       ├── bugfix/note-editing
       └── hotfix/security-patch
```

### Branch Naming

**Features:**
```
feature/descriptive-name
feature/gps-integration
feature/pdf-preview
```

**Bug Fixes:**
```
bugfix/issue-description
bugfix/login-error
bugfix/file-upload-timeout
```

**Hotfixes:**
```
hotfix/critical-issue
hotfix/security-vulnerability
```

### Commit Messages

**Format:**
```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation
- `style` - Formatting (no code change)
- `refactor` - Code restructuring
- `test` - Adding tests
- `chore` - Build/tooling changes

**Examples:**
```bash
feat(notes): add markdown rendering support

- Implement markdown parser
- Add syntax highlighting
- Support for math equations with KaTeX

Closes #45

---

fix(files): resolve file upload timeout issue

Files larger than 10MB were timing out.
Increased timeout to 5 minutes and added progress indicator.

Fixes #78

---

docs(wiki): update installation guide

- Add troubleshooting section
- Update Firebase setup steps
- Add screenshots
```

### Workflow Steps

**1. Create Feature Branch:**
```bash
git checkout develop
git pull origin develop
git checkout -b feature/my-feature
```

**2. Make Changes:**
```bash
# Make your changes
git add .
git commit -m "feat(component): description"
```

**3. Keep Updated:**
```bash
git fetch origin
git rebase origin/develop
```

**4. Push and Create PR:**
```bash
git push origin feature/my-feature
# Create Pull Request on GitHub
```

**5. After Review:**
```bash
# Squash commits if needed
git rebase -i HEAD~3

# Merge to develop
```

---

## 🔍 Code Review Process

### Creating a Pull Request

**PR Template:**
```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests added/updated
- [ ] Manual testing completed
- [ ] All tests passing

## Screenshots (if applicable)
Add screenshots of UI changes

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No new warnings
```

### Review Checklist

**For Reviewers:**
- ✅ Code is readable and maintainable
- ✅ Tests are comprehensive
- ✅ No security vulnerabilities
- ✅ Follows project conventions
- ✅ Documentation is updated
- ✅ No unnecessary dependencies

**Feedback Style:**
- 🟢 Approve - Looks good!
- 🟡 Comment - Suggestions for improvement
- 🔴 Request Changes - Issues must be fixed

---

## 🚀 Adding New Features

### Backend Feature

**Example: Add Project Tags**

**1. Update Model:**
```python
# models.py
class Project(Base):
    __tablename__ = "projects"
    
    id = Column(Integer, primary_key=True)
    name = Column(String)
    tags = Column(ARRAY(String))  # New field
```

**2. Create Schema:**
```python
# schemas.py
class ProjectCreate(BaseModel):
    name: str
    description: str
    tags: List[str] = []  # New field

class ProjectResponse(BaseModel):
    id: int
    name: str
    tags: List[str]
```

**3. Add Endpoint:**
```python
# routes/projects.py
@router.post("/projects")
async def create_project(
    project: ProjectCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    new_project = Project(
        name=project.name,
        tags=project.tags,  # New field
        owner_id=current_user.id
    )
    db.add(new_project)
    db.commit()
    return new_project
```

**4. Write Tests:**
```python
def test_create_project_with_tags():
    response = client.post("/api/projects", json={
        "name": "Test",
        "tags": ["neolithic", "pottery"]
    })
    assert response.status_code == 201
    assert "neolithic" in response.json()["tags"]
```

**5. Update Documentation:**
- Update API Reference wiki page
- Add example in Features documentation

### Frontend Feature

**Example: Display Project Tags**

**1. Update Type:**
```typescript
// types.ts
export interface Project {
  id: number;
  name: string;
  tags: string[];  // New field
}
```

**2. Update Service:**
```typescript
// services/projectService.ts
export const projectService = {
  async createProject(data: ProjectCreate): Promise<Project> {
    const response = await api.post('/projects', {
      name: data.name,
      tags: data.tags  // New field
    });
    return response.data;
  }
};
```

**3. Create Component:**
```typescript
// components/ProjectTags.tsx
export const ProjectTags = ({ tags }: { tags: string[] }) => {
  return (
    <View style={styles.container}>
      {tags.map(tag => (
        <View key={tag} style={styles.tag}>
          <Text style={styles.tagText}>#{tag}</Text>
        </View>
      ))}
    </View>
  );
};
```

**4. Use in Screen:**
```typescript
// app/(tabs)/index.tsx
<ProjectCard project={project}>
  <ProjectTags tags={project.tags} />
</ProjectCard>
```

---

## 🐛 Debugging Tips

### Backend Debugging

**Print Debugging:**
```python
import logging

logger = logging.getLogger(__name__)

@router.post("/projects")
async def create_project(project: ProjectCreate):
    logger.info(f"Creating project: {project.name}")
    logger.debug(f"Project data: {project.dict()}")
    # ... rest of code
```

**Interactive Debugger:**
```python
import pdb

@router.post("/projects")
async def create_project(project: ProjectCreate):
    pdb.set_trace()  # Breakpoint here
    # Use 'n' to step, 'c' to continue, 'p variable' to print
```

**VS Code Debug Config:**
```json
{
  "name": "Python: FastAPI",
  "type": "python",
  "request": "launch",
  "module": "uvicorn",
  "args": ["app.main:app", "--reload"],
  "cwd": "${workspaceFolder}/backend"
}
```

### Frontend Debugging

**Console Logging:**
```typescript
console.log('Projects:', projects);
console.debug('API call:', { url, params });
console.error('Error:', error);
```

**React DevTools:**
- Install React DevTools browser extension
- Inspect component state and props

**Network Debugging:**
```typescript
// services/api.ts
api.interceptors.request.use(config => {
  console.log('Request:', config);
  return config;
});

api.interceptors.response.use(
  response => {
    console.log('Response:', response);
    return response;
  },
  error => {
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);
```

---

## 📦 Dependencies

### Adding Dependencies

**Backend:**
```bash
cd backend
pip install package-name
pip freeze > requirements.txt
```

**Frontend:**
```bash
cd frontend/stratum-app
npm install package-name
# or for dev dependency:
npm install --save-dev package-name
```

**Best Practices:**
- ✅ Check package security and maintenance
- ✅ Use specific versions (avoid wildcards)
- ✅ Review license compatibility
- ✅ Keep dependencies minimal

---

## 🎯 Performance Optimization

### Backend Performance

**Database Queries:**
```python
# Bad - N+1 query problem
projects = db.query(Project).all()
for project in projects:
    notes = db.query(Note).filter(Note.project_id == project.id).all()

# Good - Use joins
projects = db.query(Project).options(
    joinedload(Project.notes)
).all()
```

**Caching:**
```python
from functools import lru_cache

@lru_cache(maxsize=128)
def get_project_stats(project_id: int):
    # Expensive calculation cached
    return calculate_stats(project_id)
```

### Frontend Performance

**Memoization:**
```typescript
import { useMemo } from 'react';

const ProjectList = ({ projects }) => {
  const sortedProjects = useMemo(() => {
    return projects.sort((a, b) => 
      a.name.localeCompare(b.name)
    );
  }, [projects]);

  return <>{/* render */}</>;
};
```

**Lazy Loading:**
```typescript
import { lazy, Suspense } from 'react';

const HeavyComponent = lazy(() => import('./HeavyComponent'));

export const App = () => (
  <Suspense fallback={<Loading />}>
    <HeavyComponent />
  </Suspense>
);
```

---

## 📚 Resources

### Documentation
- [FastAPI Docs](https://fastapi.tiangolo.com/)
- [React Native Docs](https://reactnative.dev/)
- [Expo Docs](https://docs.expo.dev/)
- [SQLAlchemy Docs](https://docs.sqlalchemy.org/)

### Learning
- [Real Python](https://realpython.com/)
- [React Native School](https://www.reactnativeschool.com/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

### Tools
- [Postman](https://www.postman.com/)
- [DB Browser for SQLite](https://sqlitebrowser.org/)
- [React DevTools](https://react.dev/learn/react-developer-tools)

---

## 🤝 Contributing

### First Time Contributors

**Good First Issues:**
- Documentation improvements
- UI polish (styling, animations)
- Test coverage
- Bug fixes

**Steps:**
1. Fork the repository
2. Create feature branch
3. Make your changes
4. Write tests
5. Submit pull request

### Getting Help

**Communication:**
- 💬 GitHub Discussions - Q&A and ideas
- 🐛 GitHub Issues - Bug reports
- 📧 Team Email - Private questions

**Questions to Ask:**
- What's the expected behavior?
- Where should I look in the codebase?
- Are there similar implementations?
- What tests should I write?

---

## 🎓 Advanced Topics

### Database Migrations

**Using Alembic:**
```bash
# Initialize
alembic init alembic

# Create migration
alembic revision --autogenerate -m "Add tags to projects"

# Apply migration
alembic upgrade head

# Rollback
alembic downgrade -1
```

### API Versioning

**Structure:**
```python
# routes/v1/projects.py
router = APIRouter(prefix="/v1")

# routes/v2/projects.py
router = APIRouter(prefix="/v2")

# main.py
app.include_router(v1_router)
app.include_router(v2_router)
```

### Background Tasks

**FastAPI Background Tasks:**
```python
from fastapi import BackgroundTasks

async def send_notification(user_id: int):
    # Send email or push notification
    pass

@router.post("/projects")
async def create_project(
    background_tasks: BackgroundTasks
):
    # Create project...
    background_tasks.add_task(send_notification, user.id)
    return project
```

---

## ✅ Checklist for Pull Requests

Before submitting:

- [ ] Code follows style guide
- [ ] All tests passing
- [ ] New tests added for new features
- [ ] Documentation updated
- [ ] No console errors or warnings
- [ ] Tested on all platforms (if frontend)
- [ ] No security vulnerabilities
- [ ] Commit messages are clear
- [ ] Branch is up to date with develop
- [ ] PR description is complete

---

<div align="center">

**Ready to contribute? Let's build STRATUM together! 🚀**

[← API Reference](API-Reference) | [Troubleshooting →](Troubleshooting)

</div>
