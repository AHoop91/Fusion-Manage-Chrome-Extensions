# Grid Advanced View Specification

## Purpose

`src/features/grid/advanced-view` provides the advanced editor experience for grid pages.

It is responsible for:

- permission-aware command button injection
- loading grid metadata and row payloads
- opening the advanced editor modal
- rendering dynamic field controls
- staging row-level edits before commit

This is a major capability slice under the grid feature, not a standalone page module.

---

## Runtime Entry

`src/features/grid/grid.controller.ts` lazy-loads `src/features/grid/advanced-view/index.ts`, which re-exports `createGridFormFeature`.

Primary flow:

1. `controller/feature.ts` composes the advanced-view capability
2. `controller/eventManager.ts` owns button and listener lifecycle
3. `controller/modalController.ts` coordinates opening and closing the editor
4. `services/` hydrate metadata, controls, staging, and validation
5. `view/` renders the modal shell and form UI

---

## Structure

```text
src/features/grid/advanced-view/
  index.ts
  controller/
  services/
  view/
  types.ts
```

The advanced-view slice is intentionally layered because it mixes host DOM integration, metadata hydration, modal orchestration, and form rendering.

---

## Responsibilities

### `controller/`

Owns capability orchestration:

- command button presence
- permission loading
- modal lifecycle
- event and route update handling

### `services/`

Owns:

- field-definition hydration
- lookup and control strategies
- row projection and staging
- validation and permissions
- shared grid parsing and caching

### `view/`

Owns:

- modal shell composition
- form rendering
- dialog rendering
- summary rendering
- shared styles for the advanced editor

---

## Shared Dependencies

This capability reuses:

- `src/shared/form/*`
- `src/shared/utils/*`
- `src/ui/formPanel/*`

Those shared modules exist largely because grid advanced view and BOM clone need the same underlying form behavior.

---

## Boundaries

Important boundaries:

- do not move grid-page routing into this slice
- do not duplicate shared form logic locally when `src/shared/form/*` already owns it
- keep heavy modal behavior here rather than inflating `grid.controller.ts`

---

## Current Notes

- The advanced editor is lazy-loaded from the root grid feature.
- Permission gating happens before the command button is kept on screen.
- This slice is one of the main reasons the build emits a dedicated `grid-advanced-view` chunk.
