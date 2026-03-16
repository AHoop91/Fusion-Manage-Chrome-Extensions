# Grid Export Specification

## Purpose

`src/features/grid/export` is a small support slice for grid export behavior.

It does not mount as an independent page feature. Instead, it exposes reusable export helpers that other grid capabilities call.

Current responsibilities include:

- CSV escaping
- download initiation
- timestamped filename generation
- cooperative yielding during long export loops
- export button progress helpers

---

## Runtime Role

This folder is consumed mainly by `src/features/grid/filters`, which owns the visible export workflow for grid users.

`export.feature.ts` and `export.controller.ts` act as a thin re-export surface over the shared service functions.

---

## Structure

```text
src/features/grid/export/
  export.feature.ts
  export.controller.ts
  export.service.ts
```

`export.service.ts` currently re-exports the underlying implementation from `src/shared/utils/export`.

---

## Boundaries

Important boundaries:

- keep this folder narrowly focused on export support
- do not duplicate general-purpose export helpers here when `src/shared/utils/export` already owns them
- let mounted capabilities such as grid filters own the user-facing workflow

---

## Current Notes

- This folder is effectively a grid-local compatibility and convenience surface over shared export helpers.
- It remains useful because it keeps grid capability imports stable without duplicating logic.
