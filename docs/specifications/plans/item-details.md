# Item Details Implementation Plan

> **For agentic workers:** REQUIRED: follow `architecture.md`, keep feature orchestration in the owning layer, and place feature tests in top-level feature `__tests__` folders.

**Goal:** Keep item-details as the main DOM-driven page feature for item details and add-item pages, with focused sub-capabilities for visibility controls, command-bar options, and linked-item behavior.

**Architecture:** `item-details.feature.ts` remains the page-module entry, `item-details.controller.ts` remains the composition root, DOM observation stays in feature helpers, and command-bar behavior stays in `options/` rather than leaking into the root controller.

**Tech Stack:** TypeScript, Vitest, Vite, Chrome Extension MV3, Fusion Manage item-details DOM/runtime

---

## Background knowledge for the implementer

### What this feature owns today

- hide empty fields
- required-only edit mode
- section visibility persistence
- command-bar options and search
- linked-items shortcuts

### What stays out

- popup logic
- direct `chrome.*` usage
- unrelated grid or BOM workflows

---

## File map

### Primary files
| Path | Purpose |
|---|---|
| `src/features/item-details/item-details.feature.ts` | Page-module entry |
| `src/features/item-details/item-details.controller.ts` | Composition root |
| `src/features/item-details/item-details.dom.ts` | DOM readiness and host observation |
| `src/features/item-details/item-details.state.ts` | Shared feature state |
| `src/features/item-details/options/*` | Command-bar capabilities |
| `src/features/item-details/services/*` | Data and mode helpers |
| `src/features/item-details/view/*` | Presentation helpers |

---

## Chunk 1: Root lifecycle

- [ ] Keep route matching and lifecycle delegation in the root feature/controller
- [ ] Keep host page readiness and loading observation inside DOM helpers
- [ ] Keep shared state explicit and narrow

## Chunk 2: Capability ownership

- [ ] Keep hide-empty, required-only, and hidden-sections logic in dedicated modules
- [ ] Keep command-bar controls in `options/`
- [ ] Keep linked-item data helpers in services instead of view modules

## Chunk 3: Testing and verification

- [ ] Maintain a top-level feature `__tests__` folder for this feature
- [ ] Add or update Vitest coverage for utility and mode-resolution logic
- [ ] Extract pure helpers before attempting to test DOM-heavy behavior
- [ ] Verify with `npm run test`, `npm run build`, and `npm run typecheck`
- [ ] Manually validate view mode, edit mode, options controls, and linked-items behavior

---

## Risks and non-goals

### Risks

- moving page lifecycle logic into scattered utilities
- turning item-details into a generic home for unrelated helpers

### Non-goals

- rebuilding the root feature as a React app
- mixing unrelated page capabilities into the item-details shell
