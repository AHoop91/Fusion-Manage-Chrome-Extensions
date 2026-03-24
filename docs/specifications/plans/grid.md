# Grid Implementation Plan

> **For agentic workers:** REQUIRED: follow `architecture.md`, keep feature orchestration in the owning layer, and place feature tests in top-level feature `__tests__` folders.

**Goal:** Keep the grid feature as a route-aware page module that composes filtering, export support, and advanced editing without collapsing them into one controller.

**Architecture:** `grid.feature.ts` and `grid.controller.ts` remain the root page entry. `filters/`, `advanced-view/`, and `export/` stay as explicit capability slices with clear ownership and lazy loading where needed.

**Tech Stack:** TypeScript, React 19 for advanced editor UI, Vitest, Vite, Chrome Extension MV3, Fusion Manage grid DOM/runtime

---

## Background knowledge for the implementer

### How grid enters runtime today

The item-page bootstrap detects grid routes and loads `src/features/grid/grid.feature.ts`.

### What the root owns

The root owns page lifecycle, page-level state, and capability composition.

### What should remain in child slices

- row filtering
- advanced modal editing
- export helper behavior

---

## File map

### Primary files
| Path | Purpose |
|---|---|
| `src/features/grid/grid.feature.ts` | Grid page module entry |
| `src/features/grid/grid.controller.ts` | Root composition layer |
| `src/features/grid/grid.dom.ts` | Grid-specific DOM access |
| `src/features/grid/filters/*` | Filtering workflow |
| `src/features/grid/advanced-view/*` | Advanced editing workflow |
| `src/features/grid/export/*` | Grid-local export support |

---

## Chunk 1: Root shell

- [ ] Keep route matching and root lifecycle in the grid page module
- [ ] Keep root state limited to page-level composition concerns
- [ ] Avoid embedding child capability rules in the root controller

## Chunk 2: Capability composition

- [ ] Keep filters mounted with the grid lifecycle
- [ ] Keep advanced view lazy-loaded because of bundle size and complexity
- [ ] Keep export support narrow and reusable

## Chunk 3: Shared boundaries and verification

- [ ] Maintain a top-level feature `__tests__` folder for this feature
- [ ] Add or update Vitest coverage for root composition helpers and extracted pure logic
- [ ] Route shared form behavior through `src/shared/form/*`
- [ ] Avoid feature-to-feature imports into BOM or item-details code
- [ ] Verify with `npm run test`, `npm run build`, and `npm run typecheck`
- [ ] Manually validate grid mount, filters, export, and advanced-view launch behavior

---

## Risks and non-goals

### Risks

- turning the root controller into a second advanced-view controller
- cross-importing sibling capability code instead of extracting real shared logic

### Non-goals

- one monolithic grid feature
- a generic `grid utils` dumping ground
