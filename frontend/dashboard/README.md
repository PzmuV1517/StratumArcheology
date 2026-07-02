# STRATUM Admin Dashboard

Web dashboard for STRATUM administrators and maintainers.

## Purpose

The dashboard is the operations surface for:

- user lifecycle administration
- instance moderation and data review
- export and backup management
- form-level inspection and quality control

## Stack

- React 19 + TypeScript
- Vite
- Axios
- Lucide icons

## Commands

```bash
npm install
npm run dev
npm run build
npm run lint
npm run preview
```

## Configuration

Use `VITE_API_URL` to point the dashboard to a backend API:

```bash
VITE_API_URL=http://localhost:8000/api npm run dev
```

If not provided, the app uses:

- development: `http://localhost:8000/api`
- production: `https://stratumarcheology.com/api`

## File Layout

- `src/App.tsx`: main application state and views
- `src/index.css`: shared tokens and component styles
- `src/main.tsx`: app bootstrap

## Design And Style Rules

The dashboard must follow the project style documentation:

1. `docs/development.rst`
2. `docs/frontend-styleguide.rst`

Implementation rules for this package:

- Prefer tokenized styles in `src/index.css`
- Avoid introducing one-off color values in components
- Keep interaction states keyboard-accessible
- Avoid layout-shifting animations on dense data views

## Quality Checklist Before PR

1. `npm run lint` passes.
2. Critical workflows work with keyboard-only navigation.
3. Dashboard layout remains functional on narrow widths.
4. New UI text is concise and avoids duplicate labels.
5. Any visual system changes are reflected in docs.
