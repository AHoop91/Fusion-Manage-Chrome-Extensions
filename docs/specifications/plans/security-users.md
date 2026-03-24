# Security Users Implementation Plan

> **For agentic workers:** REQUIRED: follow `architecture.md`, keep feature orchestration in the owning layer, and place feature tests in top-level feature `__tests__` folders.

**Goal:** Keep `src/features/security/users` as the mounted capability for the security users table.

**Architecture:** `users.feature.ts` exposes the registry-facing definition, `controller.ts` owns light lifecycle composition, and `filters/` owns the actual filtering, indexing, and export workflow.

**Tech Stack:** TypeScript, Vitest, Vite, Chrome Extension MV3, Fusion Manage security users table DOM

---

## Background knowledge for the implementer

### What this slice owns today

- users-table context detection
- mounted feature wiring
- controller lifecycle
- delegation to the filters workflow

### What should stay in child filters

- row indexing
- filter state
- visible-row export behavior

---

## File map

### Primary files
| Path | Purpose |
|---|---|
| `src/features/security/users/users.feature.ts` | Registry-facing definition |
| `src/features/security/users/filterDefinition.ts` | Feature-definition bridge |
| `src/features/security/users/controller.ts` | Lightweight lifecycle composition |
| `src/features/security/users/state.ts` | Users capability state |
| `src/features/security/users/filters/*` | Main filtering workflow |

---

## Chunk 1: Registry and lifecycle

- [ ] Keep feature-definition wiring in `users.feature.ts`
- [ ] Keep controller lifecycle light and explicit
- [ ] Keep users-table state typed and feature-local

## Chunk 2: Capability growth

- [ ] Add future users-table behavior inside this slice rather than the root security shell
- [ ] Keep filter/export workflow delegated to `filters/`
- [ ] Keep DOM assumptions local rather than pretending they are generic across the admin area

## Chunk 3: Testing and verification

- [ ] Maintain a top-level feature `__tests__` folder for this feature
- [ ] Add or update Vitest coverage for users-table helpers and controller composition logic
- [ ] Keep filter-heavy tests in `users/filters`
- [ ] Verify with `npm run test`, `npm run build`, and `npm run typecheck`
- [ ] Manually validate context detection, counts, filters, and export

---

## Risks and non-goals

### Risks

- blurring registry wiring and concrete filter behavior
- over-sharing table abstractions with grid in ways that hide page-specific behavior

### Non-goals

- a generic table feature layer
- moving the concrete filtering workflow out of `users/filters`
