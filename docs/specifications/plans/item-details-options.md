# Item Details Options Implementation Plan

> **For agentic workers:** REQUIRED: follow `architecture.md`, keep feature orchestration in the owning layer, and place feature tests in top-level feature `__tests__` folders.

**Goal:** Keep item-details options as the command-bar capability slice for options, related-links, search, and section actions.

**Architecture:** `options/feature.ts` owns command-bar presence and coordination, `searchControl.ts` owns in-page search lifecycle, and `sectionActions.ts` owns compact section commands. The root item-details controller remains the page-level owner.

**Tech Stack:** TypeScript, Vitest, Vite, Chrome Extension MV3, Fusion Manage command-bar DOM

---

## Background knowledge for the implementer

### What this slice owns today

- Options button and menu
- Related Links button and menu
- in-page field search
- expand/collapse section actions

### What should stay out

- root item-details lifecycle orchestration
- generic view-mode rules
- unrelated shared UI not used elsewhere

---

## File map

### Primary files
| Path | Purpose |
|---|---|
| `src/features/item-details/options/feature.ts` | Command-bar lifecycle and coordination |
| `src/features/item-details/options/searchControl.ts` | Search lifecycle |
| `src/features/item-details/options/searchControlHelpers.ts` | Search helpers |
| `src/features/item-details/options/sectionActions.ts` | Section command actions |

---

## Chunk 1: Command-bar lifecycle

- [ ] Keep insertion, cleanup, and coordination in `feature.ts`
- [ ] Keep command-bar behavior resilient to host rerenders
- [ ] Avoid pushing root item-details lifecycle into this slice

## Chunk 2: Search and section actions

- [ ] Keep search normalization and state helpers separate from raw DOM wiring
- [ ] Keep section action behavior focused and compact
- [ ] Reuse surrounding item-details view helpers rather than duplicating UI patterns

## Chunk 3: Testing and verification

- [ ] Maintain a top-level feature `__tests__` folder for this feature
- [ ] Add or update Vitest coverage for search helpers and any extracted menu-state helpers
- [ ] Add UI contract tests only if command-bar render behavior becomes important to protect
- [ ] Verify with `npm run test`, `npm run build`, and `npm run typecheck`
- [ ] Manually validate options menu, related-links menu, search, and section buttons

---

## Risks and non-goals

### Risks

- command-bar logic leaking back into the root controller
- embedding too much page logic inside search UI code

### Non-goals

- a separate page router
- duplicating root feature state or lifecycle contracts
