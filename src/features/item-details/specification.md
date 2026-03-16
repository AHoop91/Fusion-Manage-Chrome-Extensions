# Item Details Specification

## Purpose

`src/features/item-details` enhances Fusion Manage item details and add-item pages.

Current user-facing behavior includes:

- hiding empty fields in view mode
- hiding non-required fields in edit mode
- section visibility management
- command-bar actions such as expand/collapse helpers
- in-page field search with highlight and filter modes
- linked-items navigation shortcuts

This document describes the current implementation shape. It does not propose a redesign.

---

## Runtime Entry

The item details feature is a lazy-loaded page module.

Primary flow:

1. `src/app/itemPagesBootstrap.ts` detects an item-details or add-item route
2. `src/app/item-pages/itemDetailsPageModule.ts` loads the feature bundle
3. `src/features/item-details/item-details.feature.ts` exposes the `PageModule`
4. `src/features/item-details/item-details.controller.ts` orchestrates mount, update, and teardown

The feature uses the shared content runtime rather than talking to extension APIs directly.

---

## Structure

```text
src/features/item-details/
  index.ts
  item-details.feature.ts
  item-details.controller.ts
  item-details.dom.ts
  item-details.state.ts
  item-details.types.ts
  item-details.constants.ts
  item-details.utils.ts
  hideEmpty.ts
  hiddenSections.ts
  requiredOnly.ts
  options/
  services/
  view/
```

This feature still follows a relatively classic controller/state/view split compared with the more layered BOM and grid areas.

---

## Responsibilities

### `item-details.feature.ts`

Defines the `PageModule` contract for item-details pages and delegates lifecycle work to the controller.

### `item-details.controller.ts`

Acts as the feature composition root.

It is responsible for:

- route matching and lifecycle delegation
- composing state, DOM helpers, view helpers, and services
- coordinating host loading observation
- coordinating sub-capabilities under `options/`

### `item-details.dom.ts`

Wraps host DOM concerns such as page readiness and loading transitions so the controller does not own raw DOM observer logic.

### `item-details.state.ts`

Owns shared feature state, including the current options mode used by the command-bar controls.

### `services/`

Contains page matching, mode resolution, and item-details data helpers.

### `view/`

Contains rendering and UI composition helpers for:

- the command bar
- the options menu
- search UI
- linked-items menu
- mode-specific application logic

---

## Capability Breakdown

### Visibility controls

- `hideEmpty.ts` handles view-mode suppression of empty rows and sections
- `hiddenSections.ts` handles workspace-scoped section visibility persistence
- `requiredOnly.ts` handles edit-mode filtering for required fields

### Command-bar extensions

`options/` owns the feature controls that sit in the host command bar, including:

- options menu orchestration
- search control lifecycle
- section action helpers

### Linked items

Linked-items behavior is rendered from item-details API data fetched through the runtime request boundary and cached locally within the feature.

---

## Dependencies and Boundaries

Allowed dependencies:

- `src/features/item-details/*`
- narrow helpers from `src/shared/*`
- runtime methods exposed through `ItemDetailsRuntime`

Important boundaries:

- no direct `chrome.*` access
- no direct dependency on popup code
- no direct dependency on other product features
- platform and background work should stay behind the runtime boundary

---

## Current Notes

- This is one of the more DOM-driven features in the repository.
- It remains flatter and easier to trace than BOM clone or grid advanced view.
- The feature should stay focused on item-details page behavior rather than becoming a home for generic shared utilities.
