# STRATUM Mobile And Web App

Cross-platform frontend for field archaeology workflows.

## Overview

The STRATUM app supports:

- project and team collaboration
- offline-first notes and forms
- media upload and file organization
- GPS mapping and contextual documentation
- synchronization with the STRATUM backend

Tech stack:

- Expo + React Native + Expo Router
- TypeScript
- Axios for API calls
- SQLite and offline queue services

## Quick Start

```bash
npm install
npm run start
```

Useful scripts:

- `npm run web`
- `npm run ios`
- `npm run android`
- `npm run lint`
- `npm run test`

For full environment and device setup, see `GUIDE.md`.

## Project Structure

Detailed folder and architecture notes live in `STRUCTURE.md`.

## Design And UI Standards

All UI work in this package must follow:

1. `docs/development.rst`
2. `docs/frontend-styleguide.rst`

Token ownership:

- colors and font families: `src/config/theme.ts`
- reusable themed wrappers: `src/components/ui/themed-text.tsx`, `src/components/ui/themed-view.tsx`

Minimum quality expectations:

- no hard-coded visual values when a token exists
- focus and keyboard accessibility on web surfaces
- touch targets large enough for field use
- responsive layouts that preserve functionality

## API Configuration

Set `EXPO_PUBLIC_API_URL` to override backend endpoint selection.

If unset, the app uses platform-aware defaults defined in config.

## Contribution Checklist

1. Run lint and tests for changed areas.
2. Validate at least one mobile and one web path.
3. Keep docs synchronized with behavior/UI updates.
4. Add screenshots for major visual changes.
