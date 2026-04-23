====================================
Frontend Style Guide (2026)
====================================

Design and implementation standards for STRATUM frontend surfaces.

.. contents:: Table of Contents
   :local:
   :depth: 2

Purpose
=======

STRATUM is a field-first archaeology platform. Frontend decisions must optimize for:

- Fast comprehension in high-cognitive workflows
- Reliable interaction in varied light/network/device conditions
- Consistent behavior across web and mobile

Design Direction
================

The target aesthetic is **utilitarian clarity with warm editorial cues**:

- Clear hierarchy over decoration
- Distinctive typography with restrained accents
- Intentional asymmetry where it improves scanability
- Motion that communicates state, not novelty

Token Sources
=============

Use token sources as the single source of truth:

- Mobile app tokens: ``frontend/stratum-app/src/config/theme.ts``
- Dashboard tokens: ``frontend/dashboard/src/index.css``

Rules:

- Do not hard-code one-off colors in components unless data semantics require it.
- Prefer semantic token names (for example ``surface-muted``) over visual names (for example ``gray-200``).
- Update tokens first, then consume them in components.

Color And Contrast
==================

- Meet WCAG 2.2 AA minimum contrast: 4.5:1 for normal text, 3:1 for large text/UI components.
- Avoid pure black ``#000`` and pure white ``#fff`` in production themes.
- Tint neutrals toward the active brand hue for visual cohesion.
- Never rely on color alone to communicate destructive, warning, or success states.

When adding new palettes:

- Prefer perceptual color systems (OKLCH where platform allows).
- Define light and dark values at the token layer together.

Typography
==========

- Pair a distinctive heading family with a highly legible body family.
- Do not introduce default browser/system stacks as a design shortcut.
- Use fluid scale via ``clamp()`` on web surfaces.

Recommended web scale:

- Display: ``clamp(2rem, 3vw + 1rem, 3.5rem)``
- H1: ``clamp(1.5rem, 1.4vw + 1rem, 2.25rem)``
- H2: ``clamp(1.25rem, 1vw + 0.9rem, 1.75rem)``
- Body: ``clamp(0.95rem, 0.2vw + 0.9rem, 1.05rem)``

Layout And Spacing
==================

- Build rhythm with varied spacing density; avoid uniform padding everywhere.
- Use fluid spacing values with ``clamp()`` where practical.
- Prefer left-aligned body copy for readability.
- Avoid unnecessary card nesting.

Responsive Standards
====================

- Treat 320 px width as minimum supported viewport.
- Ensure no horizontal scroll in primary workflows.
- Preserve feature parity on mobile; adapt interactions rather than removing core actions.
- Use container queries for component-level adaptation where supported.

Interaction And Motion
======================

- Use progressive disclosure for advanced controls.
- Keep perceived latency low with optimistic UI where safe.
- Prefer easing curves with natural deceleration (ease-out quart/quint/expo).
- Animate ``transform`` and ``opacity`` only for most transitions.

Avoid:

- Animating ``width``, ``height``, ``left``, ``top``, or margins for common transitions
- Bounce/elastic timing for core product interactions

Accessibility Requirements
==========================

- Keyboard accessibility for all actionable controls.
- Visible focus indicators with sufficient contrast.
- Semantic landmarks and heading order.
- Labels and help text for all form controls.
- Meaningful alt text for informative images.
- Minimum mobile hit area: 44x44 px.

Performance Standards
=====================

- Keep bundles lean by avoiding unused heavy dependencies.
- Virtualize large tabular lists where needed.
- Lazy-load non-critical media.
- Avoid layout thrashing in render/update loops.

Anti-Patterns To Avoid
======================

These are considered quality regressions and should be removed during review:

- Generic template color gradients and default dark-neon palettes
- Decorative gradient text for headings/metrics
- Excessive glassmorphism and blurred cards
- Repetitive equal-card grids without hierarchy
- Tiny decorative charts without decision value
- Redundant copy that repeats visible labels

PR Review Checklist
===================

Before opening a PR:

1. Run lint and tests for the modified frontend package.
2. Validate keyboard navigation and focus states.
3. Verify at least one mobile and one desktop viewport.
4. Check color contrast for new/changed text and controls.
5. Confirm token usage instead of hard-coded styles.
6. Add or update docs/screenshots for notable UI changes.
