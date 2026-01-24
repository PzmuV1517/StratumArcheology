First of all, thanks for considering contributing to STRATUM!

STRATUM is a closed source project. Internal team members can contribute following these guidelines.

## Development Setup

1. Create a virtual environment and install dependencies:
   ```bash
   python -m venv venv
   source venv/bin/activate
   cd backend
   pip install -r requirements.txt
   ```

2. In a new terminal, install frontend dependencies:
   ```bash
   cd frontend/stratum-app
   npm install
   npx expo install
   ```

3. Configure environment variables by copying .env.example to .env in both backend and frontend directories.

## Making Changes

1. Create a new branch for your work:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes and ensure code follows project conventions.

3. Test your changes thoroughly before submitting.

4. Commit with clear messages using present tense and [BACKEND] or [FRONTEND] prefix:
   ```bash
   git commit -m "[FRONTEND] Add new feature X"
   ```

5. Push your branch and create a pull request.

