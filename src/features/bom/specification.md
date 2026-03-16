# BOM Specification

## Purpose

`src/features/bom` enhances supported item BOM pages.

Today the BOM page module is intentionally thin. Its primary job is to detect BOM routes and delegate all user-facing behavior to the BOM clone capability under `src/features/bom/clone`.

Current user-facing behavior includes:

- showing a clone launcher on supported BOM pages
- opening BOM clone workflows for engineering and manufacturing modes
- loading and editing staged clone operations inside modal flows

---

## Runtime Entry

The BOM feature is a lazy-loaded item-page module.

Primary flow:

1. `src/app/itemPagesBootstrap.ts` detects a BOM route
2. `src/app/item-pages/bomPageModule.ts` loads the BOM bundle
3. `src/features/bom/bom.feature.ts` exposes the `PageModule`
4. `src/features/bom/bom.feature.ts` lazy-loads `src/features/bom/clone`

The top-level BOM feature is deliberately small. The real capability logic lives one level deeper.

---

## Structure

```text
src/features/bom/
  index.ts
  bom.feature.ts
  clone/
```

This folder is a page-module wrapper around the clone capability rather than a large feature area in its own right.

---

## Responsibilities

### `bom.feature.ts`

Owns:

- BOM page route matching
- runtime contract definition for the page module
- lazy loading of the clone capability
- delegating mount, update, and unmount to the clone feature once loaded

### `clone/`

Owns the actual BOM enhancement behavior, including:

- launcher injection
- permissions
- search and item selection
- structure loading
- staged edit flows
- commit workflows
- health diagnostics

---

## Dependencies and Boundaries

Allowed dependencies:

- shared runtime contracts
- BOM-local clone capability

Important boundaries:

- the top-level BOM page module should stay thin
- BOM routing logic should not absorb clone business logic
- background and platform work must remain behind runtime request boundaries

---

## Current Notes

- `bom.feature.ts` now supports both `full` and `split` BOM views when `tab=bom` and `mode=view`.
- The BOM feature is one of the clearest examples of page-module lazy delegation in the codebase.
- Detailed behavior is specified further in `src/features/bom/clone/specification.md`.
