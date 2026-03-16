# Architecture

## Purpose

This document describes the current architecture of the Chromium PLM Extension as it exists in the repository today.

It is intentionally descriptive rather than aspirational. The goal is to help contributors understand:

- the runtime surfaces in the extension
- how content features are bootstrapped
- where shared logic belongs
- how major feature areas are organized
- which boundaries are important to preserve

The extension is built around three main runtime surfaces:

1. background service worker
2. content scripts and page modules
3. popup application

---

## Runtime Surfaces

### 1. Background service worker

Files under `public/background/` implement the Manifest V3 background worker. This layer handles privileged browser-side work such as routed HTTP requests, badge state, and extension-wide message handling.

Main files:

- `public/background/index.js`
- `public/background/http.js`
- `public/background/plm.js`

This layer is intentionally separate from the content runtime. Content scripts request background work through messaging rather than calling browser APIs directly.

### 2. Content scripts and page modules

The content side is the largest runtime surface. It injects behavior into supported Fusion Manage pages, detects which page is active, and mounts the appropriate page module.

Main files:

- `src/app/sharedRuntimeBootstrap.ts`
- `src/app/pageModuleBootstrap.ts`
- `src/app/itemPagesBootstrap.ts`

This runtime is page-aware, health-aware, and designed to lazily load heavier page-specific modules only when needed.

### 3. Popup application

The popup is a separate React application that renders extension health and user-facing controls.

Main files:

- `src/popup/main.jsx`
- `src/popup/Popup.jsx`

The popup is built independently from the content bootstrap and background worker, even though they share telemetry and storage contracts.

---

## Extension Entry Points

The extension entry points are defined by `public/manifest.json`.

Current entry surfaces:

- background service worker: `background/index.js`
- shared content runtime: `content/shared/index.js`
- item-page bootstrap: `content/item-pages/index.js`
- admin/security content script: `content/security/users-filter.js`
- popup page: `popup.html`

The manifest also exposes lazily loaded page bundles as web-accessible resources so the item-page bootstrap can import them on demand.

---

## Source Tree Overview

The main source layout under `src/` is:

```text
src/
  app/
  core/
  dom/
  features/
  platform/
  popup/
  shared/
  styles/
  ui/
```

Each top-level area has a different responsibility.

### `src/app`

Application bootstrap and top-level runtime composition.

This folder wires together:

- shared content runtime initialization
- page-module bootstrapping
- lazy loading of page-specific modules

### `src/core`

Cross-cutting runtime concerns that should not belong to a specific product feature.

This includes:

- orchestration
- health evaluation
- observability and telemetry
- safety wrappers

`core` should remain feature-agnostic.

### `src/dom`

Low-level DOM helpers and style-injection utilities used by content features.

This is the place for generic browser DOM support code, not page-specific business behavior.

### `src/features`

Product behavior grouped by page area or domain capability.

This is where page modules and most user-facing logic live.

Current major areas include:

- `features/item-details`
- `features/grid`
- `features/bom`
- `features/security`
- `features/search` (compatibility surface)

### `src/platform`

Wrappers around browser-extension platform APIs such as storage and permissions.

The goal is to keep platform details isolated from most feature logic.

### `src/popup`

The popup React application and its local UI logic.

### `src/shared`

Cross-feature modules that are genuinely reused across feature boundaries.

This is not intended to be a dumping ground. Code belongs here only when it has a clear shared responsibility.

### `src/styles`

Global base CSS and shared static style assets.

### `src/ui`

Reusable UI primitives and shared UI-specific builders that are broader than a single feature but narrower than generic DOM utilities.

---

## Content Runtime Architecture

### Shared runtime bootstrap

`src/app/sharedRuntimeBootstrap.ts` creates a single shared runtime instance on `window.__plmExt`.

That runtime provides common services to content features, including:

- navigation patching
- deep DOM lookup helpers
- URL parsing and route helpers
- modal open/close helpers
- local option storage
- background action requests
- page-module registration

This is the common foundation for content-side behavior.

### Page module bootstrap

`src/app/pageModuleBootstrap.ts` is the orchestration layer that turns page modules into managed runtime features.

It is responsible for:

- registering feature definitions
- evaluating page health before mount
- applying route changes
- updating active modules when the page changes
- tearing modules down when they no longer match
- reporting health telemetry

This layer is where the content runtime, health checks, and feature registry meet.

### Lazy item-page bootstrap

`src/app/itemPagesBootstrap.ts` is a lightweight router for item-related pages.

It detects which page type is active and lazily imports the matching module bundle for:

- item details
- grid
- bill of materials

This keeps the initial content-script payload smaller and allows heavier feature areas to load only when needed.

---

## Core Runtime Model

### Page modules

The central content-side contract is `PageModule` from `src/shared/runtime/types.ts`.

A page module provides:

- `id`
- `matches(context)`
- `requiredSelectors`
- `riskLevel`
- `mount(context)`
- `update(context)`
- `unmount()`

This is the current top-level unit of page behavior.

### Feature registry

`src/core/orchestration/featureRegistry.ts` keeps track of registered features, active features, and health-gated lifecycle transitions.

It applies route updates by:

- checking whether a feature matches the current page
- deciding whether health allows initialization
- mounting new features
- updating already-mounted features
- unmounting features that no longer match

### Health model

Health gating is centralized in `src/core/health/`.

Notable pieces:

- `bootstrapGuard.ts` evaluates startup health and tracks downgrade grace periods
- health snapshots are emitted to telemetry
- transient page instability is tolerated so features are not torn down too aggressively

This health-aware orchestration is one of the main structural differences between the current architecture and a simple "run everything on load" content script.

### Observability

Observability is centralized in `src/core/observability/`.

This layer records runtime diagnostics for the popup and debugging workflows without letting each feature invent its own telemetry model.

---

## Feature Organization

There is no single rigid internal shape that every feature must follow. The repository has evolved into a layered feature architecture where the top-level page module contract is consistent, but the internal structure of a feature can vary with complexity.

The important rule is not identical folder shape. The important rule is clear responsibility boundaries.

### `features/item-details`

This area is still close to the classic feature layout:

- feature definition
- controller
- DOM helpers
- state
- types
- view helpers
- supporting services

This feature is a good example of a page module with relatively direct DOM-driven behavior.

### `features/grid`

The grid area is a page module plus multiple subfeatures.

It contains:

- grid page feature files
- filters
- export behavior
- advanced view editing

`features/grid/advanced-view` is effectively its own internal slice with controllers, services, view logic, and shared form dependencies.

### `features/bom`

The BOM area is split between a top-level page feature and a much larger clone workflow under `features/bom/clone`.

The clone flow has multiple layers:

- root feature/controller/state/view files
- controller flow modules
- API services
- form services
- structure services
- view-model creation
- React view components and dialogs

This is one of the most internally layered domains in the codebase.

### `features/security`

The security area includes page-specific behavior and a users-filtering capability.

It is smaller than the BOM and grid domains but still follows the same general pattern of keeping page logic within feature boundaries.

### `features/search`

This area now acts mainly as a compatibility import surface. Shared selector logic has been consolidated into `src/shared/item-selector`, and the older feature-facing paths remain as wrappers to avoid breaking imports.

---

## Shared Modules and Reuse Boundaries

The preferred reuse hierarchy is:

1. same file
2. same folder
3. same feature
4. same domain area
5. app-wide shared

That means code should move into `src/shared` only when it is truly cross-feature and conceptually the same.

Current meaningful shared areas include:

- `src/shared/runtime/` for runtime contracts
- `src/shared/item-selector/` for cross-feature item-selection behavior
- `src/shared/form/` for form-related helpers reused by BOM and grid flows
- `src/shared/url/` and `src/shared/utils/` for narrow generic helpers

This repository intentionally avoids turning `shared/` into a generic dumping ground.

---

## UI, Styles, and DOM Responsibilities

### `src/ui`

`ui` is the home for reusable UI-facing building blocks that are broader than one feature but still clearly about presentation.

Example:

- `src/ui/formPanel/formPanel.styles.ts`

This module is used by both BOM clone and grid advanced view and exists to keep shared presentation structure in one place.

### `src/dom`

`dom` contains lower-level DOM primitives such as style-tag creation and DOM support helpers that are not tied to one feature's business rules.

### `src/styles`

`styles` contains shared static CSS such as `base.css`, which is injected by the shared content runtime.

The current style system is a mix of:

- base global CSS
- feature-local CSS builders
- shared UI style builders
- DOM-injected content styles

This is more flexible than the older "tokens only" description and more accurate to the current codebase.

---

## Platform Boundary

`src/platform` is the preferred home for wrappers around extension platform APIs such as:

- local storage
- session storage
- permissions support

Most feature code should depend on platform adapters rather than raw browser APIs.

One important practical exception is the background service worker in `public/background/`. Because it is its own extension runtime surface and is declared directly from the manifest, it does not live under `src/platform`.

---

## Background Architecture

The background worker is responsible for extension-level actions that should not live in page scripts.

Current responsibilities include:

- handling routed message requests
- performing authenticated background HTTP requests
- validating request senders
- maintaining popup-facing health state
- updating badge and action state

The background layer acts as a privileged broker between content scripts and browser-managed capabilities.

---

## Popup Architecture

The popup is a separate React application with its own build entry and UI lifecycle.

Its main responsibilities are:

- surfacing runtime health information
- showing extension state to the user
- exposing lightweight controls and status

The popup depends on shared telemetry and storage contracts but is otherwise decoupled from page-module rendering.

---

## Build and Bundling Model

The build pipeline is defined in `scripts/build.mjs`.

This is not a single default Vite app build. It is a multi-entry extension build that produces:

- popup bundle
- shared content bootstrap
- item-page bootstrap
- lazy page bundles for item details, grid, and BOM
- admin/security content script
- background scripts copied from `public/`

### Manual chunking

The build uses manual chunks to keep major runtime concerns separated and to avoid unnecessary cross-feature coupling in the output.

Current notable chunks include:

- `react-vendor`
- `platform-permissions`
- `dom-styles`
- `form-shared`
- `bom-clone`
- `grid-advanced-view`
- `grid-core`

The dedicated `form-shared` chunk exists so BOM clone and grid advanced view can depend on the same shared form modules without importing each other at the chunk level.

### Background minification

After the main build completes, emitted background scripts in `dist/background/` are minified as a post-build step. This reduces packaged extension size while keeping source files readable in the repository.

---

## Current Architectural Rules

These are the rules that best fit the current repository state.

### 1. Top-level page behavior should enter through page modules

The `PageModule` contract is the primary integration point for content-side page behavior.

### 2. Core stays feature-agnostic

`src/core` may coordinate features, but it should not absorb feature-specific business rules.

### 3. Reuse should stay as local as possible

Prefer feature-local extraction first. Promote code to domain-level or app-wide shared only when the reuse is real and stable.

### 4. Cross-feature reuse should flow through shared modules, not direct feature coupling

If BOM and grid share logic, the preferred home is a narrow shared module such as `src/shared/form/`, not one feature importing the other.

### 5. Platform access should stay wrapped where practical

Use `src/platform` abstractions for storage and extension APIs unless the code is part of the manifest-declared background runtime.

### 6. Compatibility surfaces are acceptable when they reduce migration risk

Thin wrappers and barrels are acceptable if they preserve stable imports while keeping one real source of truth underneath.

---

## Current Exceptions and Compatibility Layers

The repository contains a few intentional compatibility surfaces:

- `src/features/search/*` now forwards to shared item-selector modules
- `src/core/BootstrapGuard.ts`
- `src/core/FeatureRegistry.ts`
- `src/core/HealthState.ts`

These files exist to preserve import stability and reduce churn. They are not the primary implementation locations.

---

## In Practice

When adding or refactoring code, the healthiest default path is:

1. start from the runtime surface you are changing
2. keep feature logic inside the relevant feature folder
3. extract only the duplication that is genuinely shared
4. route cross-feature reuse through a narrow shared module
5. keep orchestration in `app` and `core`, not inside views

That approach matches how the extension is structured today and keeps new work aligned with the existing architecture instead of fighting it.
