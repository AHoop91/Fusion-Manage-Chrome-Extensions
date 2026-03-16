# Search Specification

## Purpose

`src/features/search` is a compatibility surface for shared item-selection behavior.

It does not represent a standalone page module. Instead, it exposes search, session, view, style, and type helpers that feature-specific workflows can consume.

Today its main consumer is the BOM clone flow.

---

## Runtime Role

This folder is not mounted directly by the shared page router.

Instead, it re-exports the real implementation from `src/shared/item-selector/*` so older or feature-facing imports can remain stable while the source of truth lives in one shared place.

---

## Structure

```text
src/features/search/
  index.ts
  service.ts
  session.ts
  styles.ts
  types.ts
  view.ts
```

Every file in this folder is now a thin compatibility wrapper.

---

## Responsibilities

The underlying shared item-selector implementation provides:

- workspace-aware field loading
- search query composition
- item-details and attachment loading
- search state session orchestration
- reusable DOM rendering for the search phase

The `features/search` folder itself is responsible only for preserving a stable import surface.

---

## Boundaries

Important boundaries:

- do not add new business logic here unless this folder becomes a true feature again
- prefer `src/shared/item-selector/*` as the real implementation location
- let feature-specific workflows, such as BOM clone, keep their own orchestration outside this compatibility layer

---

## Current Notes

- This folder exists by design even though the heavy logic was deduplicated into `src/shared/item-selector`.
- Keeping these wrappers avoids import churn while still maintaining a single source of truth.
