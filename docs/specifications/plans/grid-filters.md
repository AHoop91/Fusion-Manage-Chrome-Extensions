# Grid Filters Implementation Plan

> **For agentic workers:** REQUIRED: follow `architecture.md`, keep feature orchestration in the owning layer, and place feature tests in top-level feature `__tests__` folders.

**Goal:** Keep grid filters as the concrete filtering and visible-row export experience for grid pages, with pure rule evaluation separated from DOM-heavy lifecycle behavior.

**Architecture:** `feature.ts` owns lifecycle, observers, and applied state; `data.ts` owns table discovery and row indexing; `filterEngine.ts` and `groupUtils.ts` own pure rule logic; UI helpers own panel rendering and summaries.

**Tech Stack:** TypeScript, Vitest, Vite, Chrome Extension MV3, Fusion Manage grid DOM

---

## Background knowledge for the implementer

### What the feature owns today

- filter-panel injection
- draft and applied rule state
- row visibility updates
- summaries and result counts
- visible-row CSV export workflow

### What should remain pure

- operator behavior
- rule matching
- filter-group mutations

---

## File map

### Primary files
| Path | Purpose |
|---|---|
| `src/features/grid/filters/feature.ts` | Lifecycle, observers, state, export flow |
| `src/features/grid/filters/data.ts` | Table parsing and route context |
| `src/features/grid/filters/filterEngine.ts` | Rule evaluation |
| `src/features/grid/filters/groupUtils.ts` | Filter-group mutations |
| `src/features/grid/filters/panel.ts` | Panel composition |
| `src/features/grid/filters/summary.ts` | Summary UI |

---

## Chunk 1: Table lifecycle

- [ ] Keep host table parsing and indexing in `data.ts`
- [ ] Keep observers and reindex scheduling in the mounted feature lifecycle
- [ ] Scope DOM work tightly to the grid table

## Chunk 2: Rule logic

- [ ] Keep operator and value-matching logic pure in `filterEngine.ts`
- [ ] Keep group mutation helpers pure in `groupUtils.ts`
- [ ] Preserve explicit model types for rules, groups, and panel state

## Chunk 3: UI and verification

- [ ] Maintain a top-level feature `__tests__` folder for this feature
- [ ] Add or update Vitest coverage for rule evaluation, group mutations, and extracted parsing helpers
- [ ] Keep panel and summary behavior in focused UI helpers
- [ ] Keep visible-row export owned by filters while reusing shared export helpers
- [ ] Verify with `npm run test`, `npm run build`, and `npm run typecheck`
- [ ] Manually validate filter application, counts, summaries, and CSV export

---

## Risks and non-goals

### Risks

- over-coupling export progress, DOM observers, and filter state
- mixing advanced editor behavior into the filters slice

### Non-goals

- a generic cross-feature table framework
- replacing field-aware filtering with string-only shortcuts
