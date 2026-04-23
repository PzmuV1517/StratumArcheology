============================
Development Guide
============================

Contributing to STRATUM development across backend, mobile, and dashboard surfaces.

.. seealso::
   **New to development?** See :doc:`legend <legend>` for explanations of development terminology, Git commands, and code concepts.

.. seealso::
   **Working on UI?** See :doc:`frontend-styleguide <frontend-styleguide>` for detailed visual and interaction standards.

.. contents:: Table of Contents
   :local:
   :depth: 2

Setup
=====

See :doc:`installation <installation>` for development environment setup.

Engineering Standards
=====================

Backend (Python)
----------------

- Use **Ruff** formatting and linting rules consistently.
- Follow **PEP 8** and project conventions.
- Require type hints on public functions and service boundaries.
- Keep endpoint handlers thin; move business logic into services.
- Add or update tests for behavior changes.

Frontend (TypeScript)
---------------------

- Use **ESLint** and **Prettier** in CI and locally before PRs.
- Prefer strict TypeScript and avoid ``any`` where practical.
- Keep side effects isolated in hooks/services.
- Use shared token sources rather than hard-coded visual values.
- Validate keyboard and screen-reader behavior for all interactive flows.

Documentation
-------------

- Update docs in the same PR as behavior changes.
- Prefer concrete examples over abstract descriptions.
- Record breaking changes in :doc:`changelog <changelog>`.

Frontend Style Summary
======================

The complete guide lives in :doc:`frontend-styleguide <frontend-styleguide>`. The baseline rules below apply to every frontend change.

Design Intent
-------------

- Prioritize field usability, clarity, and fast scanning under real-world conditions.
- Build for archaeologists first, with desktop and mobile parity.
- Avoid generic template aesthetics and decorative UI without functional value.

Tokens First
------------

- Mobile token source: ``frontend/stratum-app/src/config/theme.ts``.
- Dashboard token source: ``frontend/dashboard/src/index.css``.
- Add semantic tokens before introducing new colors, spacing, or type styles.

Accessibility Baseline
----------------------

- Meet WCAG 2.2 AA contrast and focus visibility requirements.
- Keep touch targets at least 44x44 px on mobile surfaces.
- Ensure full keyboard access for dashboard workflows.
- Use semantic HTML/roles and descriptive labels for form controls.

Responsive Baseline
-------------------

- Design mobile-first, then progressively enhance for larger viewports.
- Avoid fixed-width layouts that can trigger horizontal scrolling.
- Test at 320 px, 768 px, 1024 px, and large desktop sizes.

Motion And Performance
----------------------

- Animate ``transform`` and ``opacity`` instead of layout properties.
- Use concise, meaningful motion to communicate state changes.
- Avoid effects that reduce legibility or battery efficiency.

Contributing Workflow
=====================

1. Create a branch with a descriptive name.
2. Implement changes with tests and doc updates.
3. Run lint, tests, and local smoke checks.
4. Verify accessibility-critical flows manually.
5. Open a pull request with scope, risk, and validation notes.

.. seealso::
   GitHub repository for contribution and review guidelines.
