# Item Details Options Specification

## Purpose

`src/features/item-details/options` owns the command-bar controls added to item-details pages.

Current behavior includes:

- rendering the Options button and popover
- rendering the Related Links button and menu
- rendering the search control
- wiring section-level expand and collapse helpers

This folder is a capability slice inside the item-details feature rather than a standalone page module.

---

## Runtime Entry

`src/features/item-details/item-details.controller.ts` composes `createOptionsButtonFeature()` from `options/feature.ts`.

That feature manages command-bar presence and delegates specific behaviors to:

- `sectionActions.ts`
- `searchControl.ts`
- view helpers under `../view/`

---

## Structure

```text
src/features/item-details/options/
  feature.ts
  sectionActions.ts
  searchControl.ts
  searchControlHelpers.ts
```

---

## Responsibilities

### `feature.ts`

Owns command-bar presence, action-button insertion, and menu/search coordination.

### `sectionActions.ts`

Owns compact command-bar actions that expand or collapse visible item-details sections.

### `searchControl.ts`

Owns the in-page field search lifecycle and works with the surrounding item-details feature to suspend and resume visibility overrides when needed.

---

## Boundaries

Important boundaries:

- keep command-bar behavior here rather than in the root controller
- let the root item-details feature keep page-level lifecycle ownership
- reuse view helpers from `../view/` rather than duplicating button or menu rendering

---

## Current Notes

- This folder is the command-bar capability center for item-details pages.
- It is intentionally separate from the root feature so the core page lifecycle stays easier to read.
