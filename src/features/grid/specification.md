# Grid Specification

## Purpose

`src/features/grid` enhances Fusion Manage grid pages.

Current capabilities include:

- column and row filtering
- CSV export support
- advanced modal-based grid editing

The grid feature is the clearest example in the repository of a thin page module that composes several internal capability slices.

---

## Runtime Entry

The grid feature is a lazy-loaded item-page module.

Primary flow:

1. `src/app/itemPagesBootstrap.ts` detects a grid route
2. `src/app/item-pages/gridPageModule.ts` loads the grid bundle
3. `src/features/grid/grid.feature.ts` exposes the `PageModule`
4. `src/features/grid/grid.controller.ts` coordinates root lifecycle

The root feature keeps page-level routing and capability composition shallow, while heavier behavior lives in subfolders.

---

## Structure

```text
src/features/grid/
  index.ts
  grid.feature.ts
  grid.controller.ts
  grid.dom.ts
  grid.state.ts
  grid.types.ts
  constants.ts
  services/
  view/
  filters/
  advanced-view/
  export/
  dom/
```

---

## Root Responsibilities

### `grid.feature.ts`

Creates the page module and connects route matching, required selectors, and lifecycle hooks to the shared router.

### `grid.controller.ts`

Acts as the composition root for the page feature.

It is responsible for:

- creating root state
- creating root services
- composing grid capabilities
- lazy-loading advanced view only when needed
- delegating mount, update, and unmount to the root view

### `grid.service.ts`

Owns route matching and capability composition helpers used by the root feature.

### `grid.view.ts`

Applies the root lifecycle to the composed capabilities while keeping their execution order predictable.

### `grid.dom.ts`

Provides root-level selector and DOM support for the grid page.

---

## Capability Areas

### `filters/`

Owns the interactive filter panel, row indexing, visibility toggling, and the main user-facing CSV export workflow.

### `advanced-view/`

Owns the advanced editor modal, permission-aware command button injection, metadata hydration, row staging, and form rendering.

This capability is lazy-loaded from the root controller because it is materially heavier than the rest of the grid page behavior.

### `export/`

Provides shared export utilities that are reused by filtering and related grid workflows rather than acting as an independently mounted page feature.

---

## Dependencies and Boundaries

Allowed dependencies:

- root grid modules may compose child capability slices
- grid capabilities may depend on `src/shared/*`, `src/ui/*`, and runtime contracts
- shared form helpers should flow through `src/shared/form/*`

Important boundaries:

- no direct `chrome.*` access
- no direct popup dependency
- no feature-to-feature coupling with BOM or item-details
- cross-cutting form and utility reuse should be routed through shared modules, not sibling feature imports

---

## Current Notes

- `grid.controller.ts` lazy-loads `advanced-view/` to keep the initial grid module lighter.
- `filters/` and `advanced-view/` intentionally have deeper internal structure than the root page layer.
- The grid feature now depends on the shared `form-shared` bundle at build time to avoid chunk-level coupling with BOM clone.
