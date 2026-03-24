# Security Users Filters Implementation Plan

> **For agentic workers:** REQUIRED: follow `architecture.md`, keep feature orchestration in the owning layer, and place feature tests in top-level feature `__tests__` folders.

**Goal:** Keep `src/features/security/users/filters` as the self-contained filtering and export workflow for the security users table.

**Architecture:** `feature.ts` owns lifecycle and observers, `context.ts` owns page detection, `table.ts` owns row parsing and indexing, and `ui.ts` owns visible filtering UI and result/export affordances.

**Tech Stack:** TypeScript, Vitest, Vite, Chrome Extension MV3, Fusion Manage security users DOM

---

## Background knowledge for the implementer

### What this slice owns today

- users-table context detection
- row and column indexing
- filter UI
- row visibility updates
- CSV export of visible rows

### What should stay out

- generic cross-feature table abstractions
- unrelated security admin behavior

---

## File map

### Primary files
| Path | Purpose |
|---|---|
| `src/features/security/users/filters/feature.ts` | Lifecycle, observers, state, export progress |
| `src/features/security/users/filters/context.ts` | Context detection |
| `src/features/security/users/filters/table.ts` | Table parsing and indexing |
| `src/features/security/users/filters/ui.ts` | Filter UI and affordances |
| `src/features/security/users/filters/utils.ts` | Pure helpers |

---

## Chunk 1: Context and parsing

- [ ] Keep page-context detection in `context.ts`
- [ ] Keep users-table indexing and parsing in `table.ts`
- [ ] Keep page-specific DOM assumptions explicit

## Chunk 2: Lifecycle and UI

- [ ] Keep filter state, observers, and export progress in `feature.ts`
- [ ] Keep visible UI composition in `ui.ts`
- [ ] Keep generic export behavior sourced from shared helpers where possible

## Chunk 3: Testing and verification

- [ ] Maintain a top-level feature `__tests__` folder for this feature
- [ ] Add or update Vitest coverage for pure utility helpers and filter-state logic
- [ ] Add parsing tests when row indexing becomes more complex
- [ ] Verify with `npm run test`, `npm run build`, and `npm run typecheck`
- [ ] Manually validate filter application, counts, table refreshes, and CSV export

---

## Risks and non-goals

### Risks

- treating this as a generic table engine
- copying grid filter abstractions that do not match the security page

### Non-goals

- full unification with grid filters
- a generic security administration framework
