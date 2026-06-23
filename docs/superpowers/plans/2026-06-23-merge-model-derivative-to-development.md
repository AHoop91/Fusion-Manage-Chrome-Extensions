# Merge feature/model-derivative → development Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring all 15 commits from `feature/model-derivative` into `development` cleanly, including APS bearer-token auth, Design Components feature, picklist bugfixes, and all supporting infrastructure.

**Architecture:** The two branches diverged at `4eff6e9`. `development` has one commit ahead (`2f06706`); `feature/model-derivative` has 15. Analysis shows all 21 merge conflicts resolve in favour of the feature branch — it is a consistent superset of development (adds `enableDesignComponents` flag, APS auth, and picklist validation fixes; development's lone extra commit introduced the same scripts and flag scaffolding but without those additions). The plan creates a working merge branch, resolves all conflicts by checking out the feature branch version, then fast-forward merges into `development`.

**Tech Stack:** Git, TypeScript, Vite, Vitest, Chrome Extensions MV3

---

## What is coming over from `feature/model-derivative`

| Area | What changes |
|---|---|
| **APS Token Auth** | `apsAuth.ts` (chrome.storage.session token store), `apsTokenSync.ts` (content-script bearer-token refresh), `AUTH_TOKEN_SYNC` handler in background `index.ts`, bearer token injected on all APS fetch calls |
| **Design Components feature** | Entire `src/features/design/components/` (15 files), `designComponentsPageModule.ts`, design-components entry in manifest |
| **Feature Flags** | `enableDesignComponents` added to `featureFlags.ts`, `featureFlagKeys.ts`, `effectiveFeatures.ts`, `runtimeToggleDefs.ts`, `featureBuildSummary.ts` |
| **Bootstrap refactor** | `src/app/bootstrap/` (moved from `src/core/`), `workspaceTierGate.ts`, security/health bootstrap deleted |
| **Grid** | Grid import restructured to `src/features/grid/grid-import/`; picklist bugfix in `import-row-data.ts` and `validation.service.ts` |
| **Shared** | `generic-loader/`, `search-dialog-modal/`, `workspaceFeatureTier.ts`, `numberInputWheel.ts`, UI styles |
| **Build** | `loadFeatureFlags.mjs`, `lazyPageBundleGates.mjs`, `buildUserFeedback.mjs`, `patchDistManifest.mjs`, updated `build.mjs` |
| **Docs** | APS auth spec/plan, design-components translation spec/plan, modal redesign spec/plan |

---

## Task 1: Create the merge working branch

**Files:** none (git only)

- [ ] **Step 1: Confirm you are on development and it is clean**

```bash
git status
git checkout development
```

Expected: working tree clean, on branch `development`.

- [ ] **Step 2: Create working branch off development**

```bash
git checkout -b merge/model-derivative
```

Expected: `Switched to a new branch 'merge/model-derivative'`

- [ ] **Step 3: Confirm branch state**

```bash
git log --oneline -3
```

Expected: top commit is `2f06706 refactor: clean up features and add grid import`.

---

## Task 2: Start the merge (expect conflicts)

**Files:** all 21 conflict files (listed in Task 3)

- [ ] **Step 1: Initiate the merge without auto-committing**

```bash
git merge --no-commit --no-ff feature/model-derivative
```

Expected output ends with:
```
Automatic merge failed; fix conflicts and then commit the result.
```

21 files will be listed as `CONFLICT`. That is expected — do not panic.

- [ ] **Step 2: Confirm conflict list**

```bash
git diff --name-only --diff-filter=U
```

Expected (21 files):
```
PRIVACY.md
README.md
features.js
public/manifest.json
scripts/build.mjs
scripts/buildUserFeedback.mjs
scripts/loadFeatureFlags.mjs
scripts/patchDistManifest.mjs
src/app/itemPagesBootstrap.ts
src/app/sharedRuntimeBootstrap.ts
src/app/workspace/workspaceTierGate.ts
src/background/index.ts
src/build/__tests__/gridFeatureFlags.test.ts
src/build/featureFlagKeys.ts
src/build/featureFlags.ts
src/extension/runtime/__tests__/effectiveFeaturesMerge.test.ts
src/extension/runtime/effectiveFeatures.ts
src/features/grid/grid-import/import-row-data.ts
src/features/grid/grid-import/validation.service.ts
src/popup/featureBuildSummary.ts
src/popup/runtimeToggleDefs.ts
```

---

## Task 3: Resolve all 21 conflicts — take feature branch version

**Why feature branch wins every time:** Analysis shows `feature/model-derivative` is a strict superset for all 21 files. It either adds `enableDesignComponents` support, adds the APS auth handler, or has the picklist validation bugfix. Development's sole unique commit (`2f06706`) added the same scaffolding files but without those additions — the feature branch already contains the equivalent. Taking `--theirs` (feature branch) loses nothing from development.

- [ ] **Step 1: Resolve all 21 files in one command**

```bash
git checkout --theirs \
  PRIVACY.md \
  README.md \
  features.js \
  public/manifest.json \
  scripts/build.mjs \
  scripts/buildUserFeedback.mjs \
  scripts/loadFeatureFlags.mjs \
  scripts/patchDistManifest.mjs \
  src/app/itemPagesBootstrap.ts \
  src/app/sharedRuntimeBootstrap.ts \
  src/app/workspace/workspaceTierGate.ts \
  src/background/index.ts \
  src/build/__tests__/gridFeatureFlags.test.ts \
  src/build/featureFlagKeys.ts \
  src/build/featureFlags.ts \
  src/extension/runtime/__tests__/effectiveFeaturesMerge.test.ts \
  src/extension/runtime/effectiveFeatures.ts \
  src/features/grid/grid-import/import-row-data.ts \
  src/features/grid/grid-import/validation.service.ts \
  src/popup/featureBuildSummary.ts \
  src/popup/runtimeToggleDefs.ts
```

- [ ] **Step 2: Spot-check three key files to confirm resolution is correct**

Open `src/background/index.ts` and verify:
- Line 1: `import { setApsToken } from './apsAuth'`
- Contains function `isTrustedPlmSender`
- Contains `if (message.type === 'AUTH_TOKEN_SYNC')` block before the `HTTP_REQUEST` block

Open `src/build/featureFlags.ts` and verify:
- `enableDesignComponents: boolean` exists in `FeatureFlags` type
- `enableDesignComponents: __BUILD_FEATURE_FLAG_enableDesignComponents__` exists in `FEATURES` object

Open `src/features/grid/grid-import/import-row-data.ts` and verify:
- Contains the block: `if (field.allowedPicklistValues.length > 0 && payloadType !== 'multi-select' && !isApiPathValue(raw))`

- [ ] **Step 3: Stage all resolved files**

```bash
git add \
  PRIVACY.md \
  README.md \
  features.js \
  public/manifest.json \
  scripts/build.mjs \
  scripts/buildUserFeedback.mjs \
  scripts/loadFeatureFlags.mjs \
  scripts/patchDistManifest.mjs \
  src/app/itemPagesBootstrap.ts \
  src/app/sharedRuntimeBootstrap.ts \
  src/app/workspace/workspaceTierGate.ts \
  src/background/index.ts \
  src/build/__tests__/gridFeatureFlags.test.ts \
  src/build/featureFlagKeys.ts \
  src/build/featureFlags.ts \
  src/extension/runtime/__tests__/effectiveFeaturesMerge.test.ts \
  src/extension/runtime/effectiveFeatures.ts \
  src/features/grid/grid-import/import-row-data.ts \
  src/features/grid/grid-import/validation.service.ts \
  src/popup/featureBuildSummary.ts \
  src/popup/runtimeToggleDefs.ts
```

- [ ] **Step 4: Confirm no remaining conflicts**

```bash
git diff --name-only --diff-filter=U
```

Expected: no output (empty).

---

## Task 4: Create the merge commit

- [ ] **Step 1: Check the staged state looks right**

```bash
git status
```

Expected: `All conflicts fixed but you are still merging.` — a list of `modified` and `new file` entries, nothing under "Unmerged paths".

- [ ] **Step 2: Commit the merge**

```bash
git commit -m "$(cat <<'EOF'
merge: bring feature/model-derivative into development

Merges APS bearer-token auth (apsAuth, apsTokenSync, AUTH_TOKEN_SYNC
handler), Design Components feature, enableDesignComponents feature
flag, picklist validation bugfix for grid import, and all supporting
infrastructure (bootstrap refactor, build scripts, shared components).

All 21 conflicts resolved by taking feature/model-derivative version
(confirmed superset of development for every conflicted file).

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

Expected: commit SHA printed, e.g. `[merge/model-derivative abc1234] merge: bring feature/model-derivative...`

---

## Task 5: Build verification

- [ ] **Step 1: Install dependencies if needed**

```bash
npm install
```

Expected: no errors. If lock file is already up to date, this is instant.

- [ ] **Step 2: Run the test suite**

```bash
npm test
```

Expected: all tests pass. If any test fails, **stop here** — do not merge until fixed.

- [ ] **Step 3: Run the production build**

```bash
npm run build
```

Expected: build completes without errors. The `dist/` directory should contain:
- `content/item-pages/design-components.js` (new — Design Components bundle)
- `background/index.js` (updated — includes APS auth handler)
- `content/shared/index.js` (updated — includes apsTokenSync call)

- [ ] **Step 4: Verify manifest in dist**

Open `dist/manifest.json` and check:
- `"https://developer.api.autodesk.com/*"` is present in `host_permissions`
- `"content/item-pages/design-components.js"` is present in `web_accessible_resources`

---

## Task 6: Merge to development

- [ ] **Step 1: Switch to development**

```bash
git checkout development
```

- [ ] **Step 2: Fast-forward merge the working branch**

```bash
git merge --ff-only merge/model-derivative
```

Expected: `Fast-forward` — `development` now points at the merge commit.

- [ ] **Step 3: Verify development log**

```bash
git log --oneline -5
```

Expected: merge commit is at the top, followed by `2f06706`.

- [ ] **Step 4: Delete the working branch**

```bash
git branch -d merge/model-derivative
```

- [ ] **Step 5: Confirm final state**

```bash
git diff development..feature/model-derivative
```

Expected: no output (branches are identical).
