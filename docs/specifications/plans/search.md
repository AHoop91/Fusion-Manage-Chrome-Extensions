# Search Compatibility Implementation Plan

> **For agentic workers:** REQUIRED: follow `architecture.md`, keep feature orchestration in the owning layer, and place feature tests in top-level feature `__tests__` folders.

**Goal:** Preserve `src/features/search` as a stable compatibility surface over `src/shared/item-selector/*`.

**Architecture:** The real implementation remains in `src/shared/item-selector/*`; `src/features/search/*` provides stable imports for older feature-facing consumers such as BOM clone.

**Tech Stack:** TypeScript, Vitest, Vite

---

## Background knowledge for the implementer

### What this folder is

It is not a mounted page feature. It is a compatibility layer that re-exports the shared item-selector implementation.

### Where real logic belongs

Reusable search, item loading, session orchestration, and search rendering logic should live in `src/shared/item-selector/*`.

---

## File map

### Primary files
| Path | Purpose |
|---|---|
| `src/features/search/index.ts` | Compatibility export surface |
| `src/features/search/service.ts` | Wrapper export |
| `src/features/search/session.ts` | Wrapper export |
| `src/features/search/styles.ts` | Wrapper export |
| `src/features/search/types.ts` | Wrapper export |
| `src/features/search/view.ts` | Wrapper export |
| `src/shared/item-selector/*` | Real implementation |

---

## Chunk 1: Preserve wrapper behavior

- [ ] Keep this folder thin and explicit about its compatibility purpose
- [ ] Avoid adding new business logic here by default
- [ ] Push reusable behavior into `src/shared/item-selector/*`

## Chunk 2: Testing and verification

- [ ] Maintain a top-level feature `__tests__` folder for this feature
- [ ] Add or update Vitest coverage for any compatibility-wrapper behavior
- [ ] Test the real shared implementation rather than relying only on thin-wrapper tests
- [ ] Verify with `npm run test`, `npm run build`, and `npm run typecheck`
- [ ] Manually smoke-test consuming features if imports or shared behavior move

---

## Risks and non-goals

### Risks

- quietly growing a second search implementation here
- confusing future contributors into treating wrappers like a mounted feature

### Non-goals

- a second search engine beside `src/shared/item-selector`
- a generic dumping ground for unrelated search helpers
