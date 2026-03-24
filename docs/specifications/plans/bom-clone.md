# BOM Clone Implementation Plan

> **For agentic workers:** REQUIRED: follow `architecture.md`, keep feature orchestration in the owning layer, and place feature tests in top-level feature `__tests__` folders.

**Goal:** Keep BOM clone as the primary staged BOM workflow for engineering and manufacturing modes, with clear ownership across launcher entry, controller orchestration, services, and React presentation.

**Architecture:** `clone.feature.ts` handles page presence and lazy boot, `clone.controller.ts` composes workflow state and flows, `services/*` own business logic and API parsing, and `view/*` render the modal experience. Shared item-selector and form logic continue to come from `src/shared/*`.

**Tech Stack:** TypeScript, React 19, Vitest, Vite, Chrome Extension MV3, Fusion Manage REST-backed runtime requests

---

## Background knowledge for the implementer

### How BOM clone enters runtime today

The root BOM page feature lazy-loads `src/features/bom/clone/index.ts`, which exposes `createBomCloneFeature`.

### What the controller owns

`clone.controller.ts` and `controller/*` own modal lifecycle, search flow, structure flow, edit flow, and commit flow.

### What the services own

API parsing, field helpers, linkability, normalization, staged structure mutations, and commit batching stay in `services/*`.

### What the view owns

The modal shell, phases, dialogs, structure rendering, and footer interactions stay in React view modules. React should not become the orchestration layer.

---

## File map

### Primary files
| Path | Purpose |
|---|---|
| `src/features/bom/clone/clone.feature.ts` | Launcher entry, permission checks, lazy controller boot |
| `src/features/bom/clone/clone.controller.ts` | Composition root |
| `src/features/bom/clone/controller/*` | Search, structure, edit, and commit orchestration |
| `src/features/bom/clone/services/*` | Business logic, parsing, and staged workflow helpers |
| `src/features/bom/clone/view/*` | React UI and dialogs |
| `src/features/bom/clone/__tests__/*` | Colocated Vitest coverage |

### Shared dependencies
| Path | Purpose |
|---|---|
| `src/shared/item-selector/*` | Search and item selection |
| `src/shared/form/*` | Shared form and field behavior |
| `src/ui/formPanel/*` | Shared form-panel presentation |

---

## Chunk 1: Entry and permissions

- [ ] Keep launcher injection, permission refresh, and light DOM observation in `clone.feature.ts`
- [ ] Preserve lazy-loading so heavy workflow code does not inflate BOM page startup
- [ ] Keep engineering and manufacturing launch-mode behavior explicit

## Chunk 2: Workflow orchestration

- [ ] Keep search, structure, edit, and commit orchestration in `controller/*`
- [ ] Keep modal state and workflow snapshots in typed state modules
- [ ] Avoid moving workflow branching into React components

## Chunk 3: Service ownership

- [ ] Keep API parsing under `services/api/*`
- [ ] Keep staged structure logic under `services/structure/*`
- [ ] Keep commit batching and operation resolution in `commit.service.ts`
- [ ] Keep normalization, field logic, and linkability as pure service logic where possible

## Chunk 4: View and UX

- [ ] Keep the React tree focused on rendering and callbacks
- [ ] Add new dialogs and phase panels under `view/*`
- [ ] Promote only truly reusable UI to shared layers

## Chunk 5: Testing and verification

- [ ] Maintain a top-level feature `__tests__` folder for this feature
- [ ] Use TDD for commit logic, tree mutations, permissions, and view-models
- [ ] Keep tests colocated in `src/features/bom/clone/__tests__`
- [ ] Add UI contract tests for important render-state changes
- [ ] Verify with `npm run test`, `npm run build`, and `npm run typecheck`
- [ ] Manually validate launcher, search, structure editing, and commit flows in browser

---

## Risks and non-goals

### Risks

- pushing orchestration into React
- duplicating shared form or item-selector behavior locally
- flattening internal boundaries until staged workflow bugs are hard to isolate

### Non-goals

- converting clone into a single giant component
- moving clone rules up into the root BOM feature
