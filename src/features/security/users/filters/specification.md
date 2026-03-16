# Security Users Filters Specification

## Purpose

`src/features/security/users/filters` is the concrete filtering capability for the security users table.

It provides:

- users-table context detection
- indexed row and column metadata
- filter UI
- row visibility updates
- CSV export of visible rows

This folder is the real behavior center of the security users feature.

---

## Runtime Entry

The capability can be entered through either:

- `src/features/security/users/users.feature.ts`
- `src/features/security/users/filters/index.ts`

In both cases, the runtime ends up creating the filter feature from `feature.ts`.

---

## Structure

```text
src/features/security/users/filters/
  feature.ts
  index.ts
  constants.ts
  context.ts
  table.ts
  types.ts
  ui.ts
  utils.ts
```

---

## Responsibilities

### `feature.ts`

Owns lifecycle, observers, filter state, reindex scheduling, DOM updates, and export progress.

### `context.ts`

Owns page-context detection and locating the users table.

### `table.ts`

Owns table parsing and row indexing.

### `ui.ts`

Owns filter UI composition and result/export affordances.

---

## Boundaries

Important boundaries:

- keep security users filtering self-contained in this folder
- use `src/shared/utils/export` for generic export helpers
- do not turn this folder into a generic table framework

---

## Current Notes

- This slice intentionally stays separate from grid filters even though some structural ideas overlap.
- The shared shape is similar, but the data model and host DOM are security-specific.
