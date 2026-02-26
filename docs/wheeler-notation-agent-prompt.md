# Agent Prompt: Implement Wheeler Stratigraphic Notation in STRATUM

## Context for the Agent

You are working on **STRATUM**, an archaeological site management platform built
with React Native / Expo / TypeScript. The app is organized as a mono-repo at
`/Users/levin/Documents/Dev/TeamProjects/QuantumBits/QuantumBitsFLL2025-2026/` with
the frontend in `frontend/stratum-app/`.

The current Git branch is `wheelerStratigraphicNotation` (PR #38). Your task is
to implement a full **Wheeler Stratigraphic Notation** feature — a space–time
diagram used in archaeology to visualize which stratigraphic layers are present
(or absent) across different horizontal trench positions, plotted against
relative time/depth.

---

## What Is a Wheeler Stratigraphic Diagram?

The Wheeler diagram (also called the Wheeler Space–Time Diagram or
Chronostratigraphic Chart) is a 2-D visualization invented in the context of
Mortimer Wheeler's archaeological grid-trench method. It is **complementary to**,
but distinct from, the Harris Matrix:

- **Harris Matrix**: a directed acyclic graph showing *sequential relationships*
  between stratigraphic contexts (above/below/cuts/fills).
- **Wheeler Diagram**: a 2-D grid showing *spatial extent over time* — each
  layer is drawn as a rectangle whose:
  - **Width** = the horizontal distance across the excavation it occupies (X-axis).
  - **Height** = its relative age / duration / stratigraphic thickness (Y-axis,
    oldest at the bottom).

### Key visual elements

| Element | Description |
|---|---|
| **Layer rectangles** | Filled, labeled boxes representing individual stratigraphic units. Each has a horizontal extent (trench columns it covers) and a vertical extent (relative time depth it spans). |
| **Hiatus zones** | Blank or cross-hatched cells where a layer is absent in a given trench column — indicating erosion, non-deposition, or a stratigraphic gap. |
| **Phase lines** | Optional horizontal dashed lines separating broad archaeological phases (e.g., Phase I Bronze Age, Phase II Iron Age). |
| **Context labels** | The context number (e.g., "SU-001") displayed inside each layer rectangle. |
| **X-axis** | Trench position labels — e.g., "T1", "T2", "T3", or absolute grid references. |
| **Y-axis** | Relative time / depth — can be labelled with arbitrary depth values or phase names. Older layers at the bottom. |
| **Legend** | Color-key for layer types (layer, deposit, cut, fill, structure) matching the same color scheme as the Harris Matrix. |

### Relationship to existing app data

Because STRATUM already stores stratigraphic contexts in the Harris Matrix
feature, the Wheeler diagram should **read the same context data** but display
it differently. The contexts have:
- A type: `"layer" | "deposit" | "cut" | "fill" | "structure"`
- Optional `earliestDate` / `latestDate` numeric fields (relative, can be used
  for Y positioning)
- A description and ID
- Optional `groupId` / `phaseId` for grouping

---

## Where It Fits in Navigation

### Current project-level tab structure

The project tabs live at `app/project/[id]/(tabs)/_layout.tsx`. The **5 visible
project tabs** are:

1. `index` → Overview  
2. `notes` → Notes  
3. `artefacts` → Artefacts  
4. `matrix` → Matrix (Harris Matrix)  
5. `gallery` → "More" — this is a **fake tab** that opens a `MoreToolsSheet`
   overlay instead of actually navigating.

The **hidden tabs** (navigable from `MoreToolsSheet`, set with `href: null`) are:
- `gps` — GPS map
- `history` — Timeline / Time Machine
- `tools` — Tools

### Where to place Wheeler

Add `wheeler` as a **new hidden tab** (set `href: null` in the layout so it does
not appear in the tab bar). It will be reachable from the `MoreToolsSheet`
alongside GPS, History, and Tools.

---

## Files to Create or Modify

### Step 1 — Route file

Create `frontend/stratum-app/app/project/[id]/(tabs)/wheeler.tsx`.

Pattern it exactly after `matrix.tsx`:

```tsx
/**
 * @file
 * Project Wheeler Stratigraphic Notation tab.
 *
 * Displays the Wheeler Space–Time diagram for the project.
 *
 * MIT License
 * Copyright (c) 2025 Banu Andrei & Mircea Levin-Constantin
 * [... standard MIT license block ...]
 */
import React from "react";
import { ProjectWheelerScreen } from "@/src/components/project/ProjectTabsScreens";

export default function ProjectWheelerRoute() {
  return <ProjectWheelerScreen />;
}
```

### Step 2 — Register the tab in the layout

In `app/project/[id]/(tabs)/_layout.tsx`, add a new `Tabs.Screen` entry for
`wheeler`, hidden from the tab bar:

```tsx
<Tabs.Screen name="wheeler" options={{ title: "Wheeler", href: null }} />
```

Place it after the existing hidden screens (`gps`, `history`, `tools`).

### Step 3 — Add to MoreToolsSheet

Open the `MoreToolsSheet` component (somewhere in `src/components/` — find it
with a search). It renders a list of additional navigation options. Add an entry
for Wheeler with:
- **Label**: `"Wheeler Notation"`
- **Icon**: `chart.bar.xaxis` (SF Symbol) or `"analytics-outline"` (Ionicons) —
  whichever icon library the sheet uses for other items.
- **onPress**: calls `onNavigate("wheeler")`.

### Step 4 — Add `ProjectWheelerScreen` to ProjectTabsScreens

Open `src/components/project/ProjectTabsScreens.tsx` (or `.tsx` variant) and
add a new exported component `ProjectWheelerScreen` that wraps the Wheeler
diagram component. Pattern it after the existing `ProjectMatrixScreen`:

```tsx
export function ProjectWheelerScreen() {
  const { projectId } = useProjectDetailContext();
  return (
    <View style={{ flex: 1, backgroundColor: "#111111" }}>
      <Stack.Screen
        options={{
          title: "Wheeler Notation",
          headerStyle: { backgroundColor: "#111111" },
          headerTintColor: "#FF2A2A",
          headerTitleStyle: { color: "#F5F5F5" },
        }}
      />
      <WheelerDiagram projectId={projectId} />
    </View>
  );
}
```

The `WheelerDiagram` import will resolve to the `.web.tsx` or `.native.tsx`
version depending on the platform.

### Step 5 — Web component: `WheelerDiagram.web.tsx`

Create `frontend/stratum-app/src/components/matrix/WheelerDiagram.web.tsx`.

This component should render a full interactive Wheeler diagram in the browser.
Model the **file structure and CSS variable usage** after `HarrisMatrix.web.tsx`
but implement a completely different visualization.

#### Props

```tsx
interface WheelerDiagramProps {
  projectId: string;
  canEdit?: boolean;
}
```

#### Visualization approach

Use **SVG rendered directly in React** (not an iframe) for simplicity on web.
The diagram is a 2-D grid:

```
Y (time/depth) ↑
|  oldest       | = bottom
|               |
|  newest       | = top
└──────────────────────── X (trench columns) →
     T1    T2    T3    T4
```

- Draw a grid of cells. Each column = one trench/excavation area ID.
- Each row = one time slice (auto-generated from context date ranges, or evenly
  spaced if no dates are available).
- A context rectangle spans one or more columns (based on its `trenchIds` field
  — if this field doesn't exist yet, design it to be added) and one or more rows
  (based on its `earliestDate`/`latestDate`).
- If a context has no date information, place it in a user-assignable row using
  drag-to-assign or a simple inline edit panel.
- Hiatus cells (cells with no context assigned) are rendered with a subtle
  cross-hatch pattern using an SVG `<pattern>` element.

#### Data model additions

The existing context data (`ArchContext`) needs two new optional fields:
- `trenchIds: string[]` — which trench columns this context physically spans.
- `wheelerRow?: number` — manual override for Y-axis row position.

These should be added to the `ArchContext` interface in
`HarrisMatrix.native.tsx` and any shared model files.

#### Toolbar (web)

Provide a toolbar above or below the SVG with:
- **"Add Trench"** button: prompts for a trench ID string and adds a new column.
- **"Auto-layout"** button: uses the `earliestDate`/`latestDate` fields to
  automatically assign rows; shows a warning if dates are missing.
- **"Save"** button: serializes the wheeler data (trench list + row assignments)
  and saves via `api.patch()` or `formsService` following the Harris Matrix
  pattern.
- **"Load"** button: fetches existing Wheeler data from the API.

#### Color coding

Use the **same context-type color scheme** as the Harris Matrix:
- `layer` → `#FF2A2A` (primary red accent)
- `deposit` → `#ffc107` (warning yellow)
- `cut` → `#dc3545` (danger red)
- `fill` → `#28a745` (success green)
- `structure` → `#9c27b0` (purple)

All label text on colored rectangles: white `#FFFFFF`.

#### Interactivity

- **Hover / tap** on a rectangle: show a tooltip or sidebar panel with the
  context details (ID, type, description, dates).
- **Drag** a rectangle left/right to change its trench column span.
- **Click a hiatus cell**: option to mark it as intentional hiatus or leave blank.

### Step 6 — Native component: `WheelerDiagram.native.tsx`

Create `frontend/stratum-app/src/components/matrix/WheelerDiagram.native.tsx`.

On mobile, render the same grid using `react-native-svg` (`Svg`, `Rect`, `Text`,
`Pattern`, `Line` from `react-native-svg`). Use `react-native-gesture-handler`
and `react-native-reanimated` for pan and zoom — the same imports already used
by `HarrisMatrix.native.tsx`.

The mobile version does **not** need drag-to-edit for the initial implementation.
It is read-only with tap-to-inspect. Full editing can be gated behind a "Desktop
recommended" banner.

Wrap the SVG inside a `<GestureDetector>` with a pan + pinch gesture for
zooming and panning, using the same `useSharedValue` / `useAnimatedStyle`
pattern as in `HarrisMatrix.native.tsx`.

### Step 7 — Hook: `useWheelerData.ts`

Create `frontend/stratum-app/src/hooks/useWheelerData.ts`.

```ts
/**
 * @file
 * useWheelerData hook.
 *
 * Manages loading, saving, and local state for the Wheeler
 * Space–Time diagram data associated with a project.
 */
import { useState, useEffect, useCallback } from "react";
import api from "../services/api";

export interface WheelerTrench {
  id: string;      // e.g. "T1", "North Section"
  label: string;
  order: number;   // left-to-right column order
}

export interface WheelerContextPlacement {
  contextId: string;
  trenchIds: string[];   // columns this context spans
  rowStart: number;      // Y-axis row (0 = oldest)
  rowEnd: number;
}

export interface WheelerData {
  trenches: WheelerTrench[];
  placements: WheelerContextPlacement[];
}

export function useWheelerData(projectId: string) {
  const [data, setData] = useState<WheelerData>({ trenches: [], placements: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  const load = useCallback(async () => { /* ... fetch from API */ }, [projectId]);
  const save = useCallback(async () => { /* ... PATCH to API */ }, [projectId, data]);
  const addTrench = useCallback((trench: WheelerTrench) => { /* ... */ }, []);
  const updatePlacement = useCallback((placement: WheelerContextPlacement) => { /* ... */ }, []);

  useEffect(() => { load(); }, [load]);

  return { data, loading, error, dirty, load, save, addTrench, updatePlacement };
}
```

---

## Backend (optional / stretch goal)

If time permits, add a `wheeler_data` JSONB column to the existing `projects`
table (or create a separate table `project_wheeler_data`) and expose:
- `GET /projects/{id}/wheeler` → returns the stored Wheeler data JSON.
- `PATCH /projects/{id}/wheeler` → stores the updated Wheeler data JSON.

Follow the existing FastAPI route pattern in `backend/app/routes/`. The backend
already has a `projects.py` route file — add these two endpoints there.

---

## Styling Requirements

All components **must** match the STRATUM dark theme:

| Token | Value |
|---|---|
| Background | `#111111` |
| Container bg | `#1A1A1A` |
| Panel bg | `#222222` |
| Header / primary text | `#F5F5F5` |
| Body text | `#EAEAEA` |
| Border / separator | `rgba(255, 255, 255, 0.1)` |
| Primary accent | `#FF2A2A` |
| Primary accent hover | `#CC2222` |
| Tab bar background | `#1A1A1A` |
| Tab height (iOS) | `60` |
| Tab height (Android) | `84` (add `paddingBottom: 24`) |

Use `StyleSheet.create()` for React Native styles. Use CSS custom properties
(`var(--primary-accent)` etc.) for web styles, mirroring the approach in
`HarrisMatrix.web.tsx`.

---

## Code Quality Rules

- **MIT License header** on every new file (see any existing file in `src/` for
  the exact template).
- **JSDoc** on every exported function, component, hook, and interface.
- **No `any` types** — define proper interfaces.
- **ESLint** must pass with zero errors and zero warnings. Run
  `npx eslint . --fix` from `frontend/stratum-app/` before finishing.
- Prefix intentionally unused destructured parameters with `_` (e.g.,
  `{ color: _color }`).
- Add `// eslint-disable-next-line react-hooks/exhaustive-deps` only where the
  dependency intentionally does not change (and explain why in a comment).
- Imports that require `@/` alias resolution may need
  `// eslint-disable-next-line import/no-unresolved` if ESLint's resolver
  cannot resolve them (TypeScript / Metro can, so this is a known limitation).

---

## File Reference Map

Use these existing files as direct models:

| File to create | Model after |
|---|---|
| `app/project/[id]/(tabs)/wheeler.tsx` | `app/project/[id]/(tabs)/matrix.tsx` |
| `src/components/matrix/WheelerDiagram.web.tsx` | `src/components/matrix/HarrisMatrix.web.tsx` |
| `src/components/matrix/WheelerDiagram.native.tsx` | `src/components/matrix/HarrisMatrix.native.tsx` |
| `src/hooks/useWheelerData.ts` | `src/hooks/useHarrisMatrix.ts` (if it exists) or the data-fetching pattern in `useNotes.ts` |
| Entry in `ProjectTabsScreens.tsx` | `ProjectMatrixScreen` in the same file |
| Entry in `MoreToolsSheet` | Any existing entry in that sheet |

---

## Suggested Component Breakdown

```
WheelerDiagram (platform-split)
├── WheelerGrid          — the SVG grid area (rows × columns)
│   ├── WheelerCell      — a single grid cell (filled or hiatus)
│   ├── HiatusPattern    — SVG <defs> cross-hatch pattern
│   ├── PhaseLines       — optional horizontal phase dividers
│   └── AxisLabels       — X-axis (trench IDs) + Y-axis (time labels)
├── WheelerToolbar       — Add Trench, Auto-layout, Save, Load buttons
├── WheelerContextPanel  — slide-out or modal panel for inspecting a context
└── WheelerLegend        — color legend matching Harris Matrix color scheme
```

---

## Questions to Ask Before Starting

If anything is ambiguous, ask the user rather than guessing. Specifically:

1. **Should the Wheeler tab appear directly in the bottom tab bar** (replacing or
   alongside "Matrix"), or should it stay in the "More" sheet as a hidden tab?
   (Recommended: hidden tab in "More" sheet, consistent with GPS and History.)

2. **Should Wheeler share context data with the Harris Matrix**, reading from the
   same project contexts API endpoint, or should it have its own separate data
   store? (Recommended: share contexts, add Wheeler-specific placement metadata
   separately.)

3. **Is there an existing `trenchIds` or spatial position field** on contexts, or
   does this need to be added to the data model from scratch?

4. **Should the native (mobile) version be read-only initially**, with full
   editing only on web? (Recommended: yes, to keep scope manageable.)

---

## Acceptance Criteria

- [ ] `app/project/[id]/(tabs)/wheeler.tsx` exists and registers correctly.
- [ ] `wheeler` tab is hidden (`href: null`) in the project layout.
- [ ] `MoreToolsSheet` shows a "Wheeler Notation" entry that navigates to the
      wheeler tab.
- [ ] `WheelerDiagram.web.tsx` renders a labeled grid with at least one
      placeholder context when no real data is available.
- [ ] `WheelerDiagram.native.tsx` renders the same grid in a pan-/zoom-enabled
      SVG on iOS/Android.
- [ ] `useWheelerData.ts` hook handles load/save lifecycle.
- [ ] `ProjectWheelerScreen` is exported from `ProjectTabsScreens.tsx`.
- [ ] All new files have MIT license headers and JSDoc.
- [ ] `npx eslint .` from `frontend/stratum-app/` exits with 0 errors and 0
      warnings.
- [ ] Visual style matches the STRATUM dark theme exactly.

---

## Notes on the Wheeler Diagram Concept (for academic accuracy)

The Wheeler Space–Time Diagram was developed to address a limitation of
section-based recording: a section profile shows stratigraphy at one slice of
a trench, but cannot show how layers correlate *across* multiple trenches.

In a Wheeler diagram:
- **Horizontal axis** = space (distance across an excavation, or different
  trench IDs).
- **Vertical axis** = time/depth (oldest at the bottom, most recent at the top).
- A layer that exists in trenches T1 and T2 but not T3 will be drawn as a
  rectangle spanning the T1 and T2 columns, with a blank (hiatus) in T3.
- Layers that have been removed by later cutting/erosion are shown as gaps.
- The diagram is read top-down to understand the deposition sequence across
  the site.

This is important for the app because:
- It shows spatial continuity of deposits — useful for understanding site
  formation.
- It helps project archaeologists identify where deposits have been truncated.
- It complements the Harris Matrix: the Harris Matrix answers "what came before
  what?" while the Wheeler answers "where was it?"

Implement this understanding into the data model and visual design.
