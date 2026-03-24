# Grid Export Implementation Plan

> **For agentic workers:** REQUIRED: follow `architecture.md`, keep feature orchestration in the owning layer, and place feature tests in top-level feature `__tests__` folders.

**Goal:** Keep grid export as a thin grid-local compatibility layer over shared export helpers.

**Architecture:** `src/features/grid/export/*` remains a stable import surface for grid workflows, while real CSV and download helper logic stays in `src/shared/utils/export`.

**Tech Stack:** TypeScript, Vitest, Vite, Chrome Extension MV3

---

## Background knowledge for the implementer

### What this slice is today

It is not an independently mounted page feature. It exists to provide grid-local export imports without duplicating generic export logic.

### What belongs in shared code

- CSV escaping
- filename generation
- yielding during large export loops
- generic browser download helpers

---

## File map

### Primary files
| Path | Purpose |
|---|---|
| `src/features/grid/export/export.feature.ts` | Thin compatibility surface |
| `src/features/grid/export/export.controller.ts` | Thin compatibility surface |
| `src/features/grid/export/export.service.ts` | Re-export bridge to shared logic |
| `src/shared/utils/export/*` | Real reusable export behavior |

---

## Chunk 1: Compatibility ownership

- [ ] Keep this folder thin and explicit about its compatibility role
- [ ] Avoid adding feature lifecycle or UI logic here
- [ ] Keep the real reusable logic in `src/shared/utils/export`

## Chunk 2: Testing and verification

- [ ] Maintain a top-level feature `__tests__` folder for this feature
- [ ] Add or update Vitest coverage for any feature-local export wrappers or adapter logic
- [ ] Add or update tests where the real shared export logic lives when shared behavior changes
- [ ] Verify with `npm run test`, `npm run build`, and `npm run typecheck`
- [ ] Manually check CSV naming and download behavior from the consuming workflow

---

## Risks and non-goals

### Risks

- duplicating shared export logic here
- treating this folder like a mounted feature when it is not

### Non-goals

- a separate export UI
- a second copy of generic CSV helpers
