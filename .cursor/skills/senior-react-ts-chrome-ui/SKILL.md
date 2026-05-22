---
name: senior-react-ts-chrome-ui
description: Guides senior-level React, JSX/TSX UI components, TypeScript scripts, Chrome Extension MV3 architecture, and scalable frontend work with clean file naming, pragmatic refactoring, typed extension contracts, and performance discipline. Use when building or refactoring extension architecture, content scripts, messaging, Chrome APIs, large React apps, legacy codebases, bundle optimisation, or scalable UI.
---

# Senior React, TypeScript, Chrome Extension & Scalable UI Standards

## Core Principles

- Write minimal, readable, maintainable code.
- Apply DRY, SOLID, and clean architecture pragmatically.
- Refactor strategically, not cosmetically.
- Preserve existing behaviour unless explicitly asked to change it.
- Prefer simple, resilient architecture over clever abstractions.
- Optimise for performance, maintainability, bundle size, and developer experience.
- Do not separate files, hooks, utilities, or components just for the sake of separation.
- Extract reusable logic only when it clearly improves clarity, reuse, testing, or scalability.

## File and Language Conventions

- Use React components with JSX/TSX where UI is required.
- Use TypeScript for scripts, utilities, extension logic, messaging, background workers, content scripts, and shared contracts.
- Prefer `.tsx` only for files that render JSX.
- Prefer `.ts` for non-UI logic.
- Keep filenames clean, descriptive, and predictable.
- Use kebab-case for filenames.
- Avoid vague names like `utils.ts`, `helpers.ts`, `common.ts`, or `misc.ts`.
- Name files by responsibility, not implementation detail.

Examples:

- `popup-view.tsx`
- `settings-form.tsx`
- `message-router.ts`
- `storage-client.ts`
- `tab-events.ts`
- `content-script.ts`
- `extension-message.ts`
- `use-active-tab.ts`
- `format-shortcut.ts`

## Architecture Conventions

- Prefer clean, feature-based architecture.
- Keep UI components close to the feature they belong to.
- Keep shared components genuinely reusable.
- Separate UI, state, Chrome API access, messaging, storage, and domain logic.
- Prefer explicit file names over generic grouping.
- Keep files small enough to understand, but do not split files prematurely.
- Avoid excessive folder nesting.
- Do not create folders or abstraction layers unless they improve clarity.
- Prefer extending existing systems over introducing parallel abstractions.

## Preferred Structure

Use a structure similar to this when appropriate:

```text
src/
  shared/
    components/
    hooks/
    messaging/
    storage/
    types/
  features/
    feature-name/
      components/
      hooks/
      state/
      feature-name-view.tsx
  extension/
    background/
    content/
    popup/
    options/

Adjust the structure to the project size. Do not introduce folders that are not needed.

Expertise

Apply deep expertise in:

React
TypeScript
Chrome Extensions
Manifest V3
Background service workers
Content scripts
Extension messaging
Chrome storage APIs
Permissions and security
Scalable frontend architecture
High-performance UI rendering
Large-scale React applications
Complex state management
Code splitting and lazy loading
Bundle optimisation
Shared component systems
Design-system integration
Feature-based architecture
Refactoring legacy applications
Engineering Style

Prefer:

Functional React components
Strict TypeScript
Strong types and discriminated unions
Clear data flow
Small, composable functions
Explicit naming
Early returns
Native browser APIs where appropriate
Typed extension messaging contracts
Minimal dependencies
Composition over inheritance

Avoid:

Over-engineering
Premature abstraction
Large unnecessary dependencies
Excessive folder nesting
Duplicated business logic
Weak typing
Unnecessary global state
Memoisation without a clear reason
Rewrites when targeted refactoring is safer
TypeScript Rules
Avoid any.
Prefer unknown over any.
Use discriminated unions for state machines and extension messaging.
Infer types where readability improves.
Export explicit public types for shared extension contracts.
Avoid overly complex generic abstractions.
Prefer readonly data where practical.
Keep shared types close to the boundary they describe.
Use clear domain names for types, not generic names like Data, Item, or Payload unless context makes them obvious.
React Rules
Prefer simple functional components.
Keep components predictable and composable.
Keep local state local.
Avoid unnecessary global state.
Extract hooks only when they clarify reusable behaviour.
Avoid excessive memoisation.
Use useMemo, useCallback, and React.memo only when there is a clear performance or referential-stability reason.
Keep rendering logic readable.
Split large components when responsibilities become unclear.
Refactoring Approach

When refactoring:

Understand the existing behaviour first.
Identify duplication, unclear responsibilities, weak types, lifecycle bugs, and performance bottlenecks.
Make the smallest safe improvement.
Extract reusable logic only when there is a clear strategic benefit.
Keep public APIs stable where possible.
Improve naming, typing, and structure.
Leave the codebase easier to understand than you found it.
Modification Discipline

When editing existing code:

Do not rewrite entire files unnecessarily.
Preserve existing patterns unless they are actively harmful.
Minimise diff size where possible.
Avoid introducing new dependencies without justification.
Avoid changing unrelated formatting.
Avoid unrelated changes.
Keep changes conceptually isolated.
Mention assumptions.
Highlight risky changes.
Before Implementing

Before making changes:

Identify the existing architecture and data flow.
Understand extension context boundaries.
Check for existing reusable utilities, hooks, components, and types.
Identify potential performance implications.
Prefer extending existing systems over introducing parallel abstractions.
Chrome Extension Rules

When working on Chrome Extensions:

Keep permissions minimal.
Use Manifest V3 best practices.
Handle service worker wake/sleep behaviour.
Use typed messaging between extension contexts.
Avoid unsafe script injection.
Separate popup, content script, background, options, and injected script concerns clearly.
Prefer declarative APIs where available.
Respect CSP limitations.
Optimise startup time and background execution.
Keep content scripts lightweight.
Avoid unnecessary DOM observers.
Avoid excessive storage reads and writes.
Batch messaging where appropriate.
Extension Messaging Rules
Use typed messaging contracts.
Prefer discriminated unions for message types.
Keep request and response types paired.
Validate message payloads at trust boundaries when needed.
Avoid stringly typed message handling scattered across the codebase.
Centralise routing when it improves clarity.
Keep context-specific logic out of shared contracts.
Scalable UI Rules

When building scalable, performant UIs:

Keep components predictable and composable.
Optimise render paths.
Minimise bundle impact.
Use lazy loading where valuable.
Keep shared components generic but not overly abstract.
Design APIs that are easy to extend.
Ensure patterns scale across teams and features.
Profile before adding complex performance optimisations.
Code Output Rules

When producing code:

Provide complete, working code.
Keep it minimal and clean.
Use strong TypeScript types.
Use JSX/TSX for React UI components.
Use TypeScript for scripts and non-UI logic.
Include only necessary comments.
Avoid unrelated changes.
Explain trade-offs briefly.
Mention assumptions.
Highlight risky changes.
Prefer production-grade practicality over theoretical purity.