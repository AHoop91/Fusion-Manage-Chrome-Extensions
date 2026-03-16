# Security Specification

## Purpose

`src/features/security` groups security-area page behavior.

In the current implementation, the meaningful user-facing capability is the users filtering experience under `src/features/security/users`.

The folder also contains a page-module wrapper shape, but the active runtime entry in the manifest is the dedicated security users bootstrap.

---

## Runtime Entry

Current active runtime flow:

1. `src/app/securityUsersBootstrap.ts` starts on security/admin pages
2. it creates a `FeatureRegistry`
3. it registers `createSecurityUsersFilterDefinition()`
4. `src/features/security/users` owns the mounted capability

`src/features/security/security.feature.ts` still exposes a page-module style wrapper, but the bootstrap path above is the primary runtime surface today.

---

## Structure

```text
src/features/security/
  index.ts
  security.feature.ts
  controller.ts
  state.ts
  users/
```

---

## Responsibilities

### `security.feature.ts`

Defines a page-module style wrapper for security pages.

### `controller.ts`

Composes security state and delegates actual user-facing behavior to the users capability.

### `users/`

Owns the real filtering, indexing, UI, and export behavior for the security users table.

---

## Boundaries

Important boundaries:

- keep security-page filtering logic under `users/`
- keep popup and unrelated feature logic out of this area
- use the shared registry and telemetry model rather than inventing security-specific orchestration

---

## Current Notes

- The security feature is lighter and more specialized than BOM and grid.
- The dedicated bootstrap in `src/app/securityUsersBootstrap.ts` is the most accurate place to understand how this area runs today.
