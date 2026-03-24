# Security Implementation Plan

> **For agentic workers:** REQUIRED: follow `architecture.md`, keep feature orchestration in the owning layer, and place feature tests in top-level feature `__tests__` folders.

**Goal:** Keep `src/features/security` as the security-area shell while the real mounted behavior stays in `users/`.

**Architecture:** The active runtime starts in `src/app/securityUsersBootstrap.ts`, which registers the users capability. Root security files remain composition helpers rather than the center of user-facing behavior.

**Tech Stack:** TypeScript, Vitest, Vite, Chrome Extension MV3, Fusion Manage admin/security runtime

---

## Background knowledge for the implementer

### What runs today

The meaningful mounted behavior is the security users workflow under `src/features/security/users`.

### What the root layer should own

- light composition
- stable feature exports
- security-area structure

### What should stay out

- concrete users-table filtering behavior
- generic admin-framework abstractions

---

## File map

### Primary files
| Path | Purpose |
|---|---|
| `src/features/security/security.feature.ts` | Security-area wrapper |
| `src/features/security/controller.ts` | Lightweight composition |
| `src/features/security/state.ts` | Root security state |
| `src/features/security/users/*` | Concrete mounted capability |

---

## Chunk 1: Root shell

- [ ] Keep bootstrap understanding anchored in `src/app/securityUsersBootstrap.ts`
- [ ] Keep root security composition thin
- [ ] Avoid duplicating users-table behavior at the root

## Chunk 2: Future growth

- [ ] Add future security capabilities as explicit child slices
- [ ] Reuse shared registry and telemetry behavior rather than inventing a local framework
- [ ] Preserve clear ownership between root shell and concrete page capabilities

## Chunk 3: Testing and verification

- [ ] Maintain a top-level feature `__tests__` folder for this feature
- [ ] Add or update Vitest coverage when root security composition logic becomes non-trivial
- [ ] Keep most meaningful tests in `users/` and `users/filters/`
- [ ] Verify with `npm run test`, `npm run build`, and `npm run typecheck`
- [ ] Manually validate supported security/admin routes after changes

---

## Risks and non-goals

### Risks

- letting the root shell accumulate users-table implementation details
- replacing the shared registry model with local custom orchestration

### Non-goals

- a generic admin framework
- duplicating mounted users behavior outside `users/`
