# Grid Advanced View Implementation Plan

> **For agentic workers:** REQUIRED: follow `architecture.md`, keep feature orchestration in the owning layer, and place feature tests in top-level feature `__tests__` folders.

**Goal:** Keep grid advanced view as the heavy, permission-aware editing slice for grid pages, with explicit controller, service, and view ownership.

**Architecture:** `controller/*` owns feature presence and modal lifecycle, `services/*` own metadata, staging, permissions, and validation, and `view/*` owns shell and form rendering. The slice stays lazy-loaded from the root grid feature.

**Tech Stack:** TypeScript, React 19-adjacent view modules where needed, Vitest, Vite, Chrome Extension MV3, Fusion Manage grid metadata and row APIs

---

## Background knowledge for the implementer

### Why this slice is separate

It mixes host DOM integration, metadata hydration, staging, validation, and modal rendering. Keeping it separate prevents the root grid feature from becoming too heavy.

### What belongs in services

- staging queue behavior
- permissions envelopes
- validation rules
- field/control strategies
- metadata and row projection helpers

### What belongs in the view

- modal shell
- form rendering
- row tables
- summary and dialog rendering

---

## File map

### Primary files
| Path | Purpose |
|---|---|
| `src/features/grid/advanced-view/controller/*` | Presence, event, and modal lifecycle |
| `src/features/grid/advanced-view/services/*` | Metadata, staging, validation, permissions |
| `src/features/grid/advanced-view/view/*` | Modal UI and rendering |
| `src/features/grid/advanced-view/__tests__/*` | Colocated Vitest coverage |

---

## Chunk 1: Entry and lifecycle

- [ ] Keep command-button injection and cleanup in controller modules
- [ ] Keep modal state and close/reset behavior outside the view
- [ ] Ensure permission checks happen before actions remain available

## Chunk 2: Data and staging

- [ ] Keep metadata caching and row hydration in services
- [ ] Keep staging queue and validation logic pure where possible
- [ ] Avoid moving data-shape rules into rendering modules

## Chunk 3: Rendering and verification

- [ ] Keep the modal shell and form rendering in `view/*`
- [ ] Maintain a top-level feature `__tests__` folder for this feature
- [ ] Add or update Vitest coverage for permissions, staging, validation, and extracted pure helpers
- [ ] Add component tests only for important UI contracts
- [ ] Verify with `npm run test`, `npm run build`, and `npm run typecheck`
- [ ] Manually validate button presence, modal open/close, staging, and commit flow

---

## Risks and non-goals

### Risks

- controller modules owning business rules that should stay testable in services
- duplicating shared form behavior instead of using shared modules

### Non-goals

- turning advanced view into the grid router
- replacing dedicated services with one large mutable editor object
