# Security Users Specification

## Purpose

`src/features/security/users` enhances the security users table with filtering and export support.

Current behavior includes:

- detecting users-table context
- building an indexed view of table rows
- applying column filters
- showing result counts
- exporting visible rows to CSV

This is the actual mounted security capability in the current extension runtime.

---

## Runtime Entry

`src/app/securityUsersBootstrap.ts` registers `createSecurityUsersFilterDefinition()`.

That definition delegates to the controller and filter feature under this folder:

- `users.feature.ts`
- `controller.ts`
- `filters/feature.ts`

---

## Structure

```text
src/features/security/users/
  index.ts
  users.feature.ts
  filterDefinition.ts
  controller.ts
  state.ts
  types.ts
  dom/
  filters/
```

---

## Responsibilities

### `users.feature.ts`

Exposes both:

- the registry-facing `FeatureDefinition`
- the controller-facing `createSecurityUsersFeature()` helper

### `controller.ts`

Owns lightweight lifecycle coordination and instantiates the filters capability on first mount.

### `filters/`

Owns the main capability behavior:

- table discovery
- row indexing
- filter state
- panel UI
- CSV export flow

---

## Boundaries

Important boundaries:

- keep page-level registry wiring thin
- keep users-table behavior inside this folder
- let shared export helpers come from `src/shared/utils/export`
- avoid growing this feature into a generic admin framework

---

## Current Notes

- This feature mirrors some of the structural ideas used by grid filters, but it stays separate because the table shape and user workflow are security-specific.
- The nested `filters/` folder is the real center of behavior.
