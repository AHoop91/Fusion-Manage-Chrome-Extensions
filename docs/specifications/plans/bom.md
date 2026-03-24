# BOM Implementation Plan

> **For agentic workers:** REQUIRED: follow `architecture.md`, keep feature orchestration in the owning layer, and place feature tests in top-level feature `__tests__` folders.

**Goal:** Keep the BOM page feature as a lightweight route-aware shell that mounts BOM-specific capabilities without absorbing their business logic.

**Architecture:** `src/features/bom/bom.feature.ts` remains the page-module entry and delegates user-facing workflows to BOM-local capability slices such as `clone/`. New BOM capabilities should be added as sibling slices or shared BOM helpers, not pushed into the root page-module shell.

**Tech Stack:** TypeScript, Chrome Extension MV3, Vite, Vitest, Fusion Manage item-page runtime

---

## Background knowledge for the implementer

### How the BOM page enters runtime today

`src/app/itemPagesBootstrap.ts` detects a BOM route, lazy-loads the BOM page bundle, and mounts `src/features/bom/bom.feature.ts`.

### What belongs here

This layer owns page matching, lifecycle delegation, and capability composition. It should not own staged workflow rules, modal orchestration, or API-heavy behavior.

### What should stay out

- deep clone workflow rules
- downloader logic
- shared form rules
- background API implementation details

---

## File map

### Primary files
| Path | Purpose |
|---|---|
| `src/features/bom/bom.feature.ts` | BOM page module entry and lifecycle delegation |
| `src/features/bom/index.ts` | Stable feature export surface |
| `src/features/bom/clone/*` | Current heavy BOM capability |

### Supporting docs
| Path | Purpose |
|---|---|
| `src/features/bom/specification.md` | Current descriptive architecture |
| `src/features/bom/clone/specification.md` | Current clone capability shape |

---

## Chunk 1: Page-module shell

- [ ] Keep route matching and required-selector ownership in `bom.feature.ts`
- [ ] Keep `mount`, `update`, and `unmount` shallow and capability-oriented
- [ ] Preserve support for currently supported BOM views without embedding workflow behavior

## Chunk 2: Capability composition

- [ ] Add new BOM behaviors as local capability slices rather than inflating the root shell
- [ ] Introduce `src/features/bom/shared/*` only if two BOM capabilities genuinely need the same logic
- [ ] Keep React out of the root shell unless the shell itself becomes stateful

## Chunk 3: Testing and verification

- [ ] Maintain a top-level feature `__tests__` folder for this feature
- [ ] Add or update Vitest coverage for route, delegation, and any extracted pure helpers
- [ ] Keep heavy workflow tests in the owning BOM capability while still preserving feature-level `__tests__`
- [ ] Verify with `npm run test`, `npm run build`, and `npm run typecheck`
- [ ] Manual check on supported BOM routes after any routing or lifecycle change

---

## Risks and non-goals

### Risks

- letting `bom.feature.ts` absorb clone or downloader rules
- creating unclear shared helpers before there is real reuse

### Non-goals

- turning the root BOM feature into a modal workflow feature
- duplicating logic that already belongs in `clone/` or future BOM capability slices
