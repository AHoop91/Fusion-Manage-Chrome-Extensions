# BOM Clone Specification

## Purpose

`src/features/bom/clone` is the main user-facing capability on BOM pages.

It provides:

- clone launcher injection on supported BOM tabs
- permission-aware enablement
- source-item search and item selection
- structure loading for source and target BOMs
- staged edit and commit workflows
- engineering and manufacturing launch modes
- health diagnostics for the clone workflow

This capability is significantly more layered than the top-level BOM page module.

---

## Runtime Entry

The BOM page module lazy-loads `src/features/bom/clone/index.ts`, which re-exports `createBomCloneFeature`.

Primary flow:

1. `clone.feature.ts` manages button presence, permissions, and lazy controller loading
2. `clone.controller.ts` composes state, service, DOM, view, health, and interaction flows
3. controller submodules under `controller/` manage search, structure, edit, and commit flows

---

## Structure

```text
src/features/bom/clone/
  clone.feature.ts
  clone.controller.ts
  clone.dom.ts
  clone.health.ts
  clone.permissions.ts
  clone.service.ts
  clone.state.ts
  clone.styles.ts
  clone.types.ts
  clone.view.tsx
  controller/
  services/
  view/
```

Important internal layers:

- `controller/` for workflow orchestration
- `services/` for API, form, structure, and view-model logic
- `view/` for React UI, dialogs, form rendering, and structure presentation

---

## Core Responsibilities

### `clone.feature.ts`

Owns the lightweight page-presence behavior before the heavy controller is needed:

- detect supported BOM context
- resolve permissions
- inject or remove launcher buttons
- observe host DOM changes
- lazy-load the controller on demand

### `clone.controller.ts`

Acts as the capability composition root.

It is responsible for:

- modal lifecycle
- state transitions
- wiring search, structure, edit, and commit flows
- view rendering
- permission refresh and metadata hydration
- health state and diagnostic emission

### `services/`

Owns:

- background API access and payload parsing
- linkability and field-definition loading
- form metadata and validation
- BOM tree building and mutation helpers
- staged operation modeling
- view-model creation

### `view/`

Owns the React presentation layer for:

- dialogs
- shell and footer
- search phase
- edit phase
- structure phase
- operation forms

---

## Shared Dependencies

BOM clone depends on several shared modules rather than reimplementing them locally.

Key examples:

- `src/shared/item-selector/*` for reusable search and item-detail behavior
- `src/shared/form/*` for form field classification, lookup handling, and control helpers
- `src/ui/formPanel/*` for shared form-panel styling

This keeps BOM clone and grid advanced view aligned without direct feature-to-feature coupling.

---

## Boundaries

Important boundaries:

- no direct `chrome.*` usage
- no direct dependency on popup code
- shared form logic should come from `src/shared/form/*`
- item-selection logic should come from `src/shared/item-selector/*`
- the top-level BOM page module should stay a thin delegator

---

## Current Notes

- Linkability is part of the workflow, but the implementation is intentionally more tolerant than an early strict phase-based design.
- The structure phase is no longer read-only; it supports staged edits and operation modeling before commit.
- This is one of the heaviest feature areas in the repository and should remain internally layered rather than flattened.
