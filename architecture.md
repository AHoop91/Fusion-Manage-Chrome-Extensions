# Architecture

## Purpose

This document describes the current architecture of the Chromium PLM Extension as it exists in the repository today.

It is intentionally descriptive rather than aspirational. The goal is to help contributors understand:

- the runtime surfaces in the extension
- how content features are bootstrapped
- where shared logic belongs
- how major feature areas are organized
- which boundaries are important to preserve
- which implementation and testing defaults contributors are expected to follow

The extension is built around three main runtime surfaces:

1. background service worker
2. content scripts and page modules
3. popup application

---

## Runtime Surfaces

### 1. Background service worker

Files under `src/background/` implement the Manifest V3 background worker. This layer handles privileged browser-side work such as routed HTTP requests, badge state, and extension-wide message handling.

Main files:

- `src/background/index.ts`
- `src/background/http.ts`
- `src/background/plm.ts`

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

React is also used selectively inside content features where the UI complexity justifies it. The extension is not a single React SPA. It is a browser extension with multiple runtime surfaces, where React is used as a feature-level rendering tool rather than as the top-level application shell for all content behavior.

---

## Extension Entry Points

The extension entry points are defined by `public/manifest.json`.

Current entry surfaces:

- background service worker: `background/index.js`
- shared content runtime: `content/shared/index.js`
- item-page bootstrap: `content/item-pages/index.js`
- admin/security content script: `content/security/users-filter.js`
- popup page: `popup.html`

The manifest also exposes only the lazy item-page entry bundles and their chunk directory as web-accessible resources so the item-page bootstrap can import them on demand without exposing the entire shared asset bucket.

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

This is also where feature-local React views should live when a page area needs richer stateful UI. React components should remain inside the owning feature or a narrowly-scoped shared UI module rather than becoming a new cross-feature dumping ground.

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

This area mixes direct page/runtime orchestration with React-backed editing surfaces. The preferred split is:

- orchestration and DOM integration in feature/controller/service files
- presentation-heavy stateful UI in React view modules

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

The downloader workflow follows the same direction: feature-owned orchestration and services, with React used for the modal and complex interactive state.

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

One important practical exception is the background service worker in `src/background/`. Because it is its own extension runtime surface and is declared directly from the manifest, it does not live under `src/platform`.

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
- bundled background service worker emitted to `dist/background/`

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

The background service worker is bundled from `src/background/index.ts` directly into `dist/background/index.js`, so the worker source stays inside the typed source tree while the emitted extension output still matches the manifest contract.

---

## Testing and Quality Gates

The repository now uses `vitest` for unit testing.

Current scripts:

- `npm run test`
- `npm run test:watch`
- `npm run build`
- `npm run typecheck`

### Unit test placement

Unit tests should be colocated with the code they protect using `__tests__` folders under `src/`.

Examples:

- `src/features/.../__tests__/...`
- `src/shared/.../__tests__/...`

The Vitest include pattern is intentionally aligned to that structure:

- `src/**/__tests__/**/*.test.ts`

This keeps tests close to the feature or shared module they validate and avoids a detached parallel test tree.

### What should be unit tested

Vitest is the default tool for pure logic and deterministic behavior, especially:

- parsing and normalization helpers
- filter evaluation and rule logic
- tree and view-model transforms
- rename, folder, and path-resolution logic
- business rules extracted out of React components or extension handlers

The goal is not to unit test every file and it is explicitly not to drive the repository toward 100% coverage. The testing goal is to maximize confidence while keeping tests maintainable, readable, and resilient to refactoring.

Default testing principles:

- test behavior, not implementation details
- prefer fewer high-value tests over many low-value ones
- do not add tests just to satisfy coverage metrics
- avoid brittle tests that break during safe refactors
- keep mocks minimal, realistic, and necessary
- avoid redundant or duplicate tests
- avoid snapshot tests unless they clearly add value
- use coverage reports only as a signal for gaps, not as a goal

Thin wrappers, raw API pass-throughs, compatibility barrels, and DOM-heavy runtime wiring are usually better validated through integration or browser-level testing instead of unit tests. If a test does not increase confidence, it should not be added just to cover a line.

### TDD and legacy-code expectations

For new features and bug fixes, the preferred workflow is test-driven where practical:

1. write a failing test first
2. implement the minimum code required to pass
3. refactor while keeping tests green

For existing code, do not force strict TDD where it creates awkward tests. Instead:

1. add characterization tests before changing behavior
2. improve tests incrementally
3. refactor code that is hard to test rather than over-mocking around poor seams

### What not to unit test

Avoid or deprioritize tests for:

- trivial getters and setters
- simple passthrough code
- framework or library internals
- code that provides little business value

If a line is uncovered but low value, that is acceptable. The right response is to explain why it is not worth testing, not to force artificial coverage.

### Contributor expectation for future prompts and changes

When implementing future prompts, Vitest should be treated as part of the normal engineering workflow, not as an optional cleanup step.

Default expectation:

1. extract or keep business logic in testable modules
2. add or update colocated Vitest coverage when behavior changes in a unit-testable area
3. review whether existing tests are high-value, brittle, redundant, or not worth keeping
4. prefer removing low-value tests over preserving a misleading coverage number
5. run the relevant verification commands before closing the task

For most feature work, the minimum verification bar is:

- `npm run test`
- `npm run build`
- `npm run typecheck`

If a change is intentionally too DOM- or runtime-heavy for meaningful unit coverage, that should be a deliberate choice rather than an omission by default. If something is hard to test, contributors should question the design before adding test complexity.

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

### 7. React is a feature UI layer, not the global architecture

Use React for complex popup surfaces and feature-local interactive UI, but keep extension orchestration, runtime lifecycle, messaging, and DOM/page integration outside React unless there is a clear reason to couple them.

### 8. Unit-testable logic should be extracted and covered with Vitest

When logic can reasonably be expressed as a pure or near-pure module, prefer that structure and add colocated Vitest coverage. This is now part of the expected architecture, not an afterthought.

### 9. Confidence matters more than coverage

The repository should optimize for confidence, maintainability, and clarity, not artificial completeness. High percentages are not a success criterion by themselves. The right test suite is the one that protects core business logic, critical flows, edge cases, and meaningful failures without turning the codebase into a coverage game.

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
6. keep React focused on complex UI surfaces, not page-runtime ownership
7. add or update colocated Vitest coverage for unit-testable behavior
8. remove or simplify tests that no longer add confidence
9. finish by running `test`, `build`, and `typecheck`

That approach matches how the extension is structured today and keeps new work aligned with the existing architecture instead of fighting it.
