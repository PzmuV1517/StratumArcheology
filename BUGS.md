# List of known bugs and issues

## Categories:
- Backend, Frontend, Mobile, Performance, Security, UX
- Priority: Low, Medium, High, Critical

## When reporting a bug, please include:
- Steps to reproduce
- Expected behavior
- Actual behavior
- Screenshots or logs if applicable

## Current Known Bugs:

| ID  | Title                                      | Description                                                                 | Category   | Priority  | Status     |
|-----|--------------------------------------------|-----------------------------------------------------------------------------|------------|-----------|------------|
| 001 | View files: Viewing jpg files hangs and gives an error after timeout is reached | When trying to view jpg files in the app, it hangs and eventually gives an error after a timeout. | Frontend   | Medium    | Open       |
| 002 | Triggering project update resets other users' project views | When one user triggers a project update, it resets the project view for all other users currently viewing that project. | Backend    | High      | In Progress|
| 004 | For some reason, backend accepts any user credentials | The backend is currently accepting any user credentials, allowing unauthorized access. | Security   | Critical  | Open       |
