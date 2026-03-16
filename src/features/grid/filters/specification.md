# Grid Filters Specification

## Purpose

`src/features/grid/filters` provides interactive filtering for grid pages.

Current behavior includes:

- filter-panel injection
- column-aware filter rule editing
- row reindexing and visibility toggling
- filter summaries and result counts
- CSV export of visible rows

This capability is mounted directly by the root grid controller.

---

## Runtime Entry

`src/features/grid/grid.controller.ts` composes `createGridFiltersFeature()` as one of the root grid capabilities.

The filters capability is DOM-driven and stays mounted with the grid page lifecycle.

---

## Structure

```text
src/features/grid/filters/
  feature.ts
  data.ts
  filterEngine.ts
  groupUtils.ts
  model.ts
  panel.ts
  panelLayout.ts
  panelTypes.ts
  ruleBuilder.ts
  styles.ts
  summary.ts
  constants.ts
```

---

## Responsibilities

### `feature.ts`

Owns lifecycle orchestration, observers, draft/applied filter state, reindex scheduling, and CSV export flow.

### `data.ts`

Owns grid-table discovery, route context parsing, metadata helpers, and row/column extraction.

### `filterEngine.ts`

Owns operator selection, kind-aware comparisons, and rule matching.

### `panel.ts`, `summary.ts`, `panelLayout.ts`

Own the visible filter UI and layout helpers.

### `styles.ts`

Owns filter-panel styling for this capability.

---

## Shared Dependencies

The filters feature uses:

- `src/features/grid/export/*` for export helpers
- `src/shared/form/fieldTypes.ts` for shared field-kind logic

That reuse should stay narrow and explicit rather than being folded into a generic shared UI layer.

---

## Boundaries

Important boundaries:

- keep grid advanced editor behavior out of this folder
- keep export helper logic narrow and reusable, but let this capability own the end-user CSV workflow
- avoid coupling filters to unrelated page features

---

## Current Notes

- This feature is one of the most DOM-observer-heavy slices in the repository.
- It combines filter state, panel UI, and export workflow because those behaviors are tightly connected in the current product surface.
