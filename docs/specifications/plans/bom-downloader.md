# BOM Downloader Implementation Plan

> **For agentic workers:** REQUIRED: follow `architecture.md`, keep feature orchestration in the owning layer, and place feature tests in top-level feature `__tests__` folders.

**Goal:** Keep the BOM downloader as a BOM-owned attachment export workflow, with page integration in the feature layer, download rules and filtering in services, and complex modal rendering isolated to feature-local React views.

**Architecture:** `feature.ts` owns launcher injection, modal lifecycle, and preview bootstrapping. `services/*` own filtering, manifest normalization, download rules, URL trust checks, and file-download orchestration. `view/*` render the downloader modal and progress UI. Shared BOM page context continues to come from `src/features/bom/shared/*`.

**Tech Stack:** TypeScript, React 19, Vitest, Vite, Chrome Extension MV3, File System Access API, Fusion Manage REST-backed runtime requests

---

## Background knowledge for the implementer

### How downloader enters runtime today

The root BOM page feature mounts `src/features/bom/downloader/index.ts`, which exposes `createBomAttachmentDownloadFeature`.

### What the feature owns

`feature.ts` and `dom.ts` own button presence, modal shell lifecycle, preview bootstrapping, and lightweight DOM observation on BOM pages.

### What the services own

Rules, attachment filtering, URL validation, preview/manifest shaping, and the async download worker model stay in `services/*`.

### What the view owns

The modal, filters, progress state presentation, warnings, and user interaction wiring stay in React view modules. React should not become the orchestration layer for page-runtime ownership.

---

## File map

### Primary files
| Path | Purpose |
|---|---|
| `src/features/bom/downloader/feature.ts` | Launcher entry, modal lifecycle, preview orchestration |
| `src/features/bom/downloader/dom.ts` | BOM-page button and shell DOM helpers |
| `src/features/bom/downloader/services/*` | Rules, filtering, manifest shaping, URL trust checks, download orchestration |
| `src/features/bom/downloader/view/*` | React modal and rendering helpers |
| `src/features/bom/downloader/__tests__/*` | Colocated Vitest coverage |

### Shared dependencies
| Path | Purpose |
|---|---|
| `src/features/bom/shared/*` | Shared BOM page context and view-def parsing |
| `src/shared/runtime/*` | Runtime contracts used by the feature |

---

## Chunk 1: Entry and modal ownership

- [ ] Keep BOM-page button presence, modal shell bootstrapping, and preview loading in `feature.ts`
- [ ] Preserve lazy view loading so downloader UI does not inflate BOM page startup
- [ ] Keep route/page-context resolution in BOM feature/shared layers, not inside React components

## Chunk 2: Rules and filtering

- [ ] Keep rule defaults, extension toggles, and custom-date behavior in `rules.service.ts`
- [ ] Keep attachment-name, extension, and modified-date filtering in `attachments.service.ts`
- [ ] Keep manifest normalization and trusted-URL gating in service layers rather than view code

## Chunk 3: Download execution

- [ ] Keep pause/resume/cancel and concurrency control in `download.service.ts`
- [ ] Keep folder and filename resolution in downloader services, not React components
- [ ] Keep path-risk validation and trusted-host enforcement as downloader-owned service logic

## Chunk 4: View and UX

- [ ] Keep the React modal focused on rendering state and dispatching callbacks
- [ ] Keep progress, warnings, and completion states in feature-local view modules
- [ ] Promote only truly shared UI to shared layers

## Chunk 5: Testing and verification

- [ ] Maintain a top-level feature `__tests__` folder for this feature
- [ ] Use TDD for rules, filtering, controller semantics, and trusted-URL behavior
- [ ] Keep tests colocated in `src/features/bom/downloader/__tests__`
- [ ] Prefer pure service and controller tests over brittle modal wiring tests
- [ ] Verify with `npm run test`, `npm run build`, and `npm run typecheck`
- [ ] Manually validate BOM launcher, preview loading, download start, pause/resume, and completion flows in browser

---

## Risks and non-goals

### Risks

- pushing page-runtime orchestration into React
- coupling downloader behavior back into BOM clone
- adding tests that only protect styling or passthrough wiring instead of download behavior

### Non-goals

- moving downloader rules into shared modules without real cross-feature reuse
- forcing unit tests over browser-only file-system integration details
