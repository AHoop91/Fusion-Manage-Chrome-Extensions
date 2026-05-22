# Design Components — Model Derivative Translation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire up Model Derivative translation (submit job, poll manifest, download result) with a two-column modal that resolves the format list via GraphQL + APS /formats, and adds FBX, SVF, SVF2 to the supported output types.

**Architecture:** On button click the menu opens instantly (no API calls). On menu item selection the modal opens immediately in a loading state and fires a sequential chain (PLM items → GraphQL → APS /formats) to populate the left panel (design details) and right panel (format radio list). Clicking Convert then fetches `encodedDesignUrn` from PLM /designs, submits the translation job, and polls the manifest. SVF/SVF2 show "Translation complete" without a browser download.

**Tech Stack:** TypeScript, Vitest, Chrome Extension MV3, Autodesk Platform Services Model Derivative v2, Autodesk MFG GraphQL v3.

---

## File Map

| File | Change |
|---|---|
| `src/features/design/components/components.types.ts` | Add `'fbx' \| 'svf' \| 'svf2'` to `DerivativeOutputType`; add `DesignItemDetails` type |
| `src/features/design/components/components.manifest.ts` | Add fbx/svf/svf2 entries to `FORMAT_TO_ROLES` |
| `src/features/design/components/components.formats.catalog.ts` | Add fbx/svf/svf2 to `CATALOG_OUTPUT_KEY_TO_UI` and `FORMAT_DISPLAY_ORDER` |
| `src/features/design/components/components.constants.ts` | Add fbx/svf/svf2 to `FORMAT_OPTIONS` and `SOURCE_FORMAT_POLICY`; add two-column CSS |
| `src/features/design/components/components.translationCapabilities.ts` | Add `'fbx'` to `FILE_TRANSLATION_OUTPUT_TYPES` |
| `src/background/plm.autodeskDeveloper.ts` | Add `fetchMfgGraphQL`; add fbx/svf/svf2 to `OutputType`, `normalizeOutputType`, `buildOutputFormat` |
| `src/background/plmActionAllowlist.ts` | Add `'fetchMfgGraphQL'` |
| `src/background/plm.ts` | Export `fetchMfgGraphQL` |
| `src/features/design/components/components.api.ts` | Add `resolveModelIdForItem`, `fetchDesignItemFromGraphQL`, `resolveTranslationSources`; update `derivativeDownloadFilename` |
| `src/features/design/components/components.modal.ts` | Replace single-column layout with two-column; replace `renderSourceReady` with `renderDesignDetails` + `renderFormatList` |
| `src/features/design/components/components.view.ts` | Simplify `openDesignMenuFlow`; lazy-load in `handleDesignMenuSelection`; deferred URN fetch in `wireConversionWorkflow` |
| `src/features/design/components/components.conversion.workflow.ts` | Short-circuit download for SVF/SVF2 |
| `src/features/design/components/__tests__/components.manifest.test.ts` | Add fbx/svf/svf2 FORMAT_TO_ROLES tests |
| `src/features/design/components/__tests__/components.formats.catalog.test.ts` | Add fbx/svf/svf2 catalog tests |
| `src/features/design/components/__tests__/components.constants.test.ts` | Update SOURCE_FORMAT_POLICY expectations |
| `src/features/design/components/__tests__/components.api.test.ts` | New — unit tests for the three new API functions |
| `src/features/design/components/__tests__/components.conversion.workflow.test.ts` | Add SVF/SVF2 short-circuit test |

---

## Task 1: Extend types — `DerivativeOutputType` and `DesignItemDetails`

**Files:**
- Modify: `src/features/design/components/components.types.ts`

No unit test needed — these are pure type declarations; TypeScript itself enforces correctness in later tasks.

- [ ] **Step 1: Update `DerivativeOutputType` and add `DesignItemDetails`**

Replace the `DerivativeOutputType` line and add the new type after it:

```typescript
// components.types.ts — replace existing DerivativeOutputType line
export type DerivativeOutputType =
  | 'pdf'
  | 'step'
  | 'stl'
  | 'iges'
  | 'obj'
  | 'dwg'
  | 'thumbnail'
  | 'fbx'
  | 'svf'
  | 'svf2'

// Add after DerivativeOutputType
export type DesignItemDetails = {
  id: string
  name: string
  extensionType: string
  mimeType: string
  size: string
  fusionWebUrl: string
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run build
```

Expected: build succeeds (no new errors — FORMAT_TO_ROLES will warn until Task 2).

- [ ] **Step 3: Commit**

```bash
git add src/features/design/components/components.types.ts
git commit -m "feat(design-components): extend DerivativeOutputType with fbx/svf/svf2; add DesignItemDetails"
```

---

## Task 2: Extend `FORMAT_TO_ROLES` in manifest

**Files:**
- Modify: `src/features/design/components/components.manifest.ts`
- Modify: `src/features/design/components/__tests__/components.manifest.test.ts`

`FORMAT_TO_ROLES` maps UI output type to manifest resource roles. TypeScript will flag an incomplete `Record<DerivativeOutputType, …>` after Task 1 until this task is done.

- [ ] **Step 1: Write the failing tests**

Open `src/features/design/components/__tests__/components.manifest.test.ts` and add after the last `describe` block:

```typescript
describe('findDerivativeForFormat — new format types', () => {
  it('finds fbx derivative by fbx role', () => {
    const manifest = {
      status: 'success',
      derivatives: [{
        children: [{
          type: 'resource',
          status: 'success',
          role: 'fbx',
          urn: 'urn:adsk.forge:derivative:fbx-1'
        }]
      }]
    } as ConversionJobManifest
    expect(findDerivativeForFormat(manifest, 'fbx')?.urn).toBe('urn:adsk.forge:derivative:fbx-1')
  })

  it('finds svf derivative by svf role', () => {
    const manifest = {
      status: 'success',
      derivatives: [{
        children: [{
          type: 'resource',
          status: 'success',
          role: 'svf',
          urn: 'urn:adsk.forge:derivative:svf-1'
        }]
      }]
    } as ConversionJobManifest
    expect(findDerivativeForFormat(manifest, 'svf')?.urn).toBe('urn:adsk.forge:derivative:svf-1')
  })

  it('finds svf2 derivative by svf2 role', () => {
    const manifest = {
      status: 'success',
      derivatives: [{
        children: [{
          type: 'resource',
          status: 'success',
          role: 'svf2',
          urn: 'urn:adsk.forge:derivative:svf2-1'
        }]
      }]
    } as ConversionJobManifest
    expect(findDerivativeForFormat(manifest, 'svf2')?.urn).toBe('urn:adsk.forge:derivative:svf2-1')
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- --reporter=verbose src/features/design/components/__tests__/components.manifest.test.ts
```

Expected: 3 new tests FAIL with TypeScript error — `FORMAT_TO_ROLES` does not satisfy `Record<DerivativeOutputType, …>`.

- [ ] **Step 3: Add fbx/svf/svf2 to `FORMAT_TO_ROLES`**

In `src/features/design/components/components.manifest.ts`, extend `FORMAT_TO_ROLES`:

```typescript
const FORMAT_TO_ROLES: Record<DerivativeOutputType, string[]> = {
  pdf: ['pdf'],
  step: ['step', 'stp'],
  stl: ['stl'],
  iges: ['iges', 'igs'],
  obj: ['obj'],
  dwg: ['dwg'],
  thumbnail: ['thumbnail', 'graphics'],
  fbx: ['fbx'],
  svf: ['svf', 'graphics'],
  svf2: ['svf2', 'graphics']
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- --reporter=verbose src/features/design/components/__tests__/components.manifest.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/design/components/components.manifest.ts src/features/design/components/__tests__/components.manifest.test.ts
git commit -m "feat(design-components): add fbx/svf/svf2 manifest role mappings"
```

---

## Task 3: Extend format catalog

**Files:**
- Modify: `src/features/design/components/components.formats.catalog.ts`
- Modify: `src/features/design/components/__tests__/components.formats.catalog.test.ts`

`CATALOG_OUTPUT_KEY_TO_UI` maps keys from the APS `/formats` response to `DerivativeOutputType`. `FORMAT_DISPLAY_ORDER` controls the order in the format list.

- [ ] **Step 1: Write the failing tests**

Open `src/features/design/components/__tests__/components.formats.catalog.test.ts` and add after the last `describe` block:

```typescript
describe('derivativeOutputsForSourceExtension — fbx/svf/svf2 catalog keys', () => {
  const matrix = {
    fbx:  ['f3d'],
    svf:  ['f3d', 'ipt'],
    svf2: ['f3d', 'ipt'],
    stl:  ['f3d']
  }

  it('returns fbx when catalog key fbx lists the source extension', () => {
    const out = derivativeOutputsForSourceExtension(matrix, 'f3d')
    expect(out).toContain('fbx')
  })

  it('returns svf when catalog key svf lists the source extension', () => {
    const out = derivativeOutputsForSourceExtension(matrix, 'f3d')
    expect(out).toContain('svf')
  })

  it('returns svf2 when catalog key svf2 lists the source extension', () => {
    const out = derivativeOutputsForSourceExtension(matrix, 'f3d')
    expect(out).toContain('svf2')
  })

  it('orders formats: fbx before svf before svf2 before thumbnail', () => {
    const matrixWithAll = {
      fbx:       ['f3d'],
      svf:       ['f3d'],
      svf2:      ['f3d'],
      thumbnail: ['f3d']
    }
    const out = derivativeOutputsForSourceExtension(matrixWithAll, 'f3d')
    expect(out.indexOf('fbx')).toBeLessThan(out.indexOf('svf'))
    expect(out.indexOf('svf')).toBeLessThan(out.indexOf('svf2'))
    expect(out.indexOf('svf2')).toBeLessThan(out.indexOf('thumbnail'))
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- --reporter=verbose src/features/design/components/__tests__/components.formats.catalog.test.ts
```

Expected: 4 new tests FAIL — `fbx`/`svf`/`svf2` keys unknown to `CATALOG_OUTPUT_KEY_TO_UI`.

- [ ] **Step 3: Update `CATALOG_OUTPUT_KEY_TO_UI` and `FORMAT_DISPLAY_ORDER`**

In `src/features/design/components/components.formats.catalog.ts`:

```typescript
const CATALOG_OUTPUT_KEY_TO_UI: Record<string, DerivativeOutputType | undefined> = {
  pdf:       'pdf',
  step:      'step',
  stp:       'step',
  stl:       'stl',
  iges:      'iges',
  obj:       'obj',
  dwg:       'dwg',
  thumbnail: 'thumbnail',
  fbx:       'fbx',
  svf:       'svf',
  svf2:      'svf2'
}

const FORMAT_DISPLAY_ORDER: DerivativeOutputType[] = [
  'dwg', 'fbx', 'iges', 'obj', 'pdf', 'step', 'stl', 'svf', 'svf2', 'thumbnail'
]
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- --reporter=verbose src/features/design/components/__tests__/components.formats.catalog.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/design/components/components.formats.catalog.ts src/features/design/components/__tests__/components.formats.catalog.test.ts
git commit -m "feat(design-components): add fbx/svf/svf2 to format catalog and display order"
```

---

## Task 4: Extend constants — `FORMAT_OPTIONS`, `SOURCE_FORMAT_POLICY`, CSS

**Files:**
- Modify: `src/features/design/components/components.constants.ts`
- Modify: `src/features/design/components/__tests__/components.constants.test.ts`

`FORMAT_OPTIONS` must include all `DerivativeOutputType` values. `SOURCE_FORMAT_POLICY` is the fallback when the live APS /formats call fails — update it to match what the live API returns for f3d. The two-column modal CSS is also added here.

- [ ] **Step 1: Update the existing constants test expectations**

The test at line 6 currently expects `['step', 'stl', 'iges', 'obj', 'pdf', 'thumbnail']` for f3d. Update it to include fbx/svf/svf2:

```typescript
it('returns CAD conversion options for f3d sources', () => {
  expect(getAllowedOutputTypesForExtension('.f3d')).toEqual([
    'step', 'stl', 'iges', 'obj', 'pdf', 'dwg', 'fbx', 'svf', 'svf2', 'thumbnail'
  ])
})

it('falls back to Fusion 3D defaults for unknown source extension (CW_COMPONENTS)', () => {
  expect(getAllowedOutputTypesForExtension('abc')).toEqual([
    'step', 'stl', 'iges', 'obj', 'pdf', 'dwg', 'fbx', 'svf', 'svf2', 'thumbnail'
  ])
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- --reporter=verbose src/features/design/components/__tests__/components.constants.test.ts
```

Expected: 2 tests FAIL — `getAllowedOutputTypesForExtension` does not yet return fbx/svf/svf2.

- [ ] **Step 3: Update `FORMAT_OPTIONS`, `SOURCE_FORMAT_POLICY`, `DEFAULT_FORMAT_OPTIONS`, and CSS in `components.constants.ts`**

```typescript
const FORMAT_OPTIONS: Record<DerivativeOutputType, OutputFormatOption> = {
  pdf:       { value: 'pdf',       label: 'PDF'       },
  step:      { value: 'step',      label: 'STEP'      },
  stl:       { value: 'stl',       label: 'STL'       },
  iges:      { value: 'iges',      label: 'IGES'      },
  obj:       { value: 'obj',       label: 'OBJ'       },
  dwg:       { value: 'dwg',       label: 'DWG'       },
  thumbnail: { value: 'thumbnail', label: 'Thumbnail' },
  fbx:       { value: 'fbx',       label: 'FBX'       },
  svf:       { value: 'svf',       label: 'SVF'       },
  svf2:      { value: 'svf2',      label: 'SVF2'      }
}

const SOURCE_FORMAT_POLICY: Record<string, DerivativeOutputType[]> = {
  f3d:    ['step', 'stl', 'iges', 'obj', 'pdf', 'dwg', 'fbx', 'svf', 'svf2', 'thumbnail'],
  f3z:    ['step', 'stl', 'iges', 'obj', 'pdf', 'dwg', 'fbx', 'svf', 'svf2', 'thumbnail'],
  ipt:    ['step', 'stl', 'iges', 'obj', 'pdf', 'svf', 'svf2', 'thumbnail'],
  iam:    ['step', 'stl', 'iges', 'obj', 'pdf', 'svf', 'svf2', 'thumbnail'],
  sldprt: ['step', 'stl', 'iges', 'obj', 'pdf', 'svf', 'svf2', 'thumbnail'],
  sldasm: ['step', 'stl', 'iges', 'obj', 'pdf', 'svf', 'svf2', 'thumbnail'],
  stp:    ['step', 'stl', 'iges', 'obj', 'pdf', 'svf', 'svf2', 'thumbnail'],
  step:   ['step', 'stl', 'iges', 'obj', 'pdf', 'svf', 'svf2', 'thumbnail'],
  igs:    ['iges', 'step', 'stl', 'obj', 'pdf', 'svf', 'svf2', 'thumbnail'],
  iges:   ['iges', 'step', 'stl', 'obj', 'pdf', 'svf', 'svf2', 'thumbnail'],
  sat:    ['step', 'stl', 'iges', 'obj', 'pdf', 'svf', 'svf2', 'thumbnail'],
  jt:     ['step', 'stl', 'iges', 'obj', 'pdf', 'svf', 'svf2', 'thumbnail'],
  idw:    ['pdf', 'dwg', 'svf', 'svf2', 'thumbnail'],
  dwg:    ['pdf', 'dwg', 'svf', 'svf2', 'thumbnail'],
  dxf:    ['pdf', 'dwg', 'svf', 'svf2', 'thumbnail'],
  obj:    ['obj', 'stl', 'svf', 'svf2', 'thumbnail'],
  stl:    ['stl', 'obj', 'svf', 'svf2', 'thumbnail']
}

const DEFAULT_FORMAT_OPTIONS: DerivativeOutputType[] = [
  'step', 'stl', 'iges', 'obj', 'pdf', 'dwg', 'fbx', 'svf', 'svf2', 'thumbnail'
]
```

At the end of `DESIGN_COMPONENTS_MODAL_CSS` (before the closing template literal backtick), append the two-column layout styles:

```css
#${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-columns{display:flex;gap:16px;margin-bottom:12px}
#${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-col-details{flex:0 0 200px;border-right:1px solid #e8ecf0;padding-right:16px;overflow:hidden}
#${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-col-formats{flex:1;display:flex;flex-direction:column}
#${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-detail-row{font-size:12px;margin:0 0 6px;color:#334155;word-break:break-word}
#${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-detail-label{font-weight:600;color:#5c6b7a;margin-right:4px}
#${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-format-item{display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:4px;cursor:pointer;font-size:13px;color:#1e293b}
#${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-format-item:hover{background:#f1f5f9}
#${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-format-item input{cursor:pointer;accent-color:#2563eb}
@media(max-width:480px){#${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-columns{flex-direction:column}#${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-col-details{flex:none;border-right:none;border-bottom:1px solid #e8ecf0;padding-right:0;padding-bottom:12px}}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- --reporter=verbose src/features/design/components/__tests__/components.constants.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/design/components/components.constants.ts src/features/design/components/__tests__/components.constants.test.ts
git commit -m "feat(design-components): add fbx/svf/svf2 to FORMAT_OPTIONS/SOURCE_FORMAT_POLICY; add two-column modal CSS"
```

---

## Task 5: Update `translationCapabilities` and `derivativeDownloadFilename`

**Files:**
- Modify: `src/features/design/components/components.translationCapabilities.ts`
- Modify: `src/features/design/components/components.api.ts`

Small additions — no new test files needed; TypeScript exhaustiveness checking enforces correctness on `derivativeDownloadFilename`.

- [ ] **Step 1: Add `'fbx'` to `FILE_TRANSLATION_OUTPUT_TYPES`**

In `src/features/design/components/components.translationCapabilities.ts`:

```typescript
export const FILE_TRANSLATION_OUTPUT_TYPES: DerivativeOutputType[] = [
  'pdf', 'step', 'stl', 'iges', 'obj', 'dwg', 'fbx'
]
```

SVF/SVF2 are viewer formats — intentionally excluded from the file-download category.

- [ ] **Step 2: Extend `derivativeDownloadFilename` in `components.api.ts`**

The `extMap` in `derivativeDownloadFilename` must be exhaustive over `DerivativeOutputType`. Add the three new entries:

```typescript
const extMap: Record<DerivativeOutputType, string> = {
  pdf:       'pdf',
  step:      'step',
  stl:       'stl',
  iges:      'iges',
  obj:       'obj',
  dwg:       'dwg',
  thumbnail: 'png',
  fbx:       'fbx',
  svf:       'svf',
  svf2:      'svf2'
}
```

- [ ] **Step 3: Build to confirm no TS errors**

```bash
npm run build
```

Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/features/design/components/components.translationCapabilities.ts src/features/design/components/components.api.ts
git commit -m "feat(design-components): add fbx to FILE_TRANSLATION_OUTPUT_TYPES; extend derivativeDownloadFilename"
```

---

## Task 6: Add `fetchMfgGraphQL` to background and extend `OutputType`

**Files:**
- Modify: `src/background/plm.autodeskDeveloper.ts`
- Modify: `src/background/plmActionAllowlist.ts`
- Modify: `src/background/plm.ts`

- [ ] **Step 1: Extend `OutputType`, `normalizeOutputType`, and `buildOutputFormat` in `plm.autodeskDeveloper.ts`**

```typescript
// Replace OutputType
type OutputType = 'pdf' | 'step' | 'stl' | 'iges' | 'obj' | 'dwg' | 'thumbnail' | 'fbx' | 'svf' | 'svf2'

// Replace normalizeOutputType body (keep signature)
function normalizeOutputType(raw: unknown): OutputType {
  const value = String(raw || '').trim().toLowerCase()
  const valid: OutputType[] = ['pdf', 'step', 'stl', 'iges', 'obj', 'dwg', 'thumbnail', 'fbx', 'svf', 'svf2']
  if (!valid.includes(value as OutputType)) {
    throw new Error(`Unsupported outputType: ${value || '(empty)'}`)
  }
  return value as OutputType
}

// Replace buildOutputFormat body (keep signature)
function buildOutputFormat(outputType: OutputType): Record<string, unknown> {
  if (outputType === 'thumbnail') return { type: 'thumbnail' }
  if (outputType === 'svf')  return { type: 'svf',  views: ['2d', '3d'] }
  if (outputType === 'svf2') return { type: 'svf2', views: ['2d', '3d'] }
  return { type: outputType }
}
```

- [ ] **Step 2: Add `fetchMfgGraphQL` to `plm.autodeskDeveloper.ts`**

Add after the existing `getModelDerivativeMetadata` export:

```typescript
/**
 * Executes a GraphQL query against the Autodesk MFG v3 public endpoint.
 * Passes `{ query, variables }` from the content script; returns the raw parsed body.
 * @see https://developer.api.autodesk.com/mfg/v3/graphql/public
 */
export async function fetchMfgGraphQL(payload: Record<string, unknown>): Promise<unknown> {
  const query     = typeof payload.query     === 'string' ? payload.query : ''
  const variables = payload.variables && typeof payload.variables === 'object' ? payload.variables : {}

  if (!query.trim()) {
    throw new Error('fetchMfgGraphQL: query is required')
  }

  const res = await fetch('https://developer.api.autodesk.com/mfg/v3/graphql/public', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query, variables }),
    credentials: 'include'
  })

  const parsed = await parseResponsePayload(res)
  assertOkResponse(res, parsed, 'Mfg GraphQL')
  return parsed
}
```

- [ ] **Step 3: Register in `plmActionAllowlist.ts`**

Add `'fetchMfgGraphQL'` to `ITEM_PAGE_PLM_ACTIONS` (alphabetical position between `fetchFields` and `getAttachments` is fine — keep consistent with the existing style):

```typescript
'fetchMfgGraphQL',
```

- [ ] **Step 4: Export from `plm.ts`**

Add to the export block in `src/background/plm.ts`:

```typescript
export {
  downloadModelDerivativeAsset,
  fetchMfgGraphQL,
  getModelDerivativeFormats,
  getModelDerivativeManifest,
  getModelDerivativeMetadata,
  submitModelDerivativeJob
} from './plm.autodeskDeveloper'
```

- [ ] **Step 5: Build to confirm no TS errors**

```bash
npm run build
```

Expected: build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/background/plm.autodeskDeveloper.ts src/background/plmActionAllowlist.ts src/background/plm.ts
git commit -m "feat(background): add fetchMfgGraphQL action; add fbx/svf/svf2 to OutputType and buildOutputFormat"
```

---

## Task 7: Add `resolveModelIdForItem`, `fetchDesignItemFromGraphQL`, `resolveTranslationSources` to API layer

**Files:**
- Modify: `src/features/design/components/components.api.ts`
- Create: `src/features/design/components/__tests__/components.api.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/features/design/components/__tests__/components.api.test.ts`:

```typescript
import { describe, expect, it, vi } from 'vitest'
import {
  fetchDesignItemFromGraphQL,
  resolveModelIdForItem,
  resolveTranslationSources
} from '../components.api'
import type { DesignComponentsRuntime } from '../components.types'

function makeRuntime(responses: Record<string, unknown>): DesignComponentsRuntime {
  return {
    requestPlmAction: vi.fn(async (action: string) => {
      if (action in responses) return responses[action]
      throw new Error(`Unexpected action: ${action}`)
    }) as DesignComponentsRuntime['requestPlmAction']
  }
}

const FAKE_URL =
  'https://test.autodeskplm360.net/plm/workspaces/57/items/itemDetails?view=full&tab=details&mode=view&itemId=57%2C15535'

describe('resolveModelIdForItem', () => {
  it('extracts modelId from the item API response', async () => {
    const runtime = makeRuntime({
      fetchApiJson: { id: 15535, modelId: 'model-abc-123' }
    })
    const modelId = await resolveModelIdForItem(runtime, FAKE_URL)
    expect(modelId).toBe('model-abc-123')
  })

  it('throws when modelId is absent from the response', async () => {
    const runtime = makeRuntime({ fetchApiJson: { id: 15535 } })
    await expect(resolveModelIdForItem(runtime, FAKE_URL)).rejects.toThrow('modelId')
  })
})

describe('fetchDesignItemFromGraphQL', () => {
  it('returns designItem from a successful GraphQL response', async () => {
    const gqlResponse = {
      data: {
        model: {
          id: 'model-abc-123',
          designItem: {
            id: 'item-xyz',
            name: 'Reciprocating Saw',
            extensionType: 'f3d',
            mimeType: 'application/vnd.autodesk.fusion360',
            size: '8424819',
            fusionWebUrl: 'https://fusion.autodesk.com/x'
          }
        }
      }
    }
    const runtime = makeRuntime({ fetchMfgGraphQL: gqlResponse })
    const details = await fetchDesignItemFromGraphQL(runtime, 'model-abc-123')
    expect(details.extensionType).toBe('f3d')
    expect(details.name).toBe('Reciprocating Saw')
    expect(details.size).toBe('8424819')
  })

  it('falls back extensionType to f3d when absent', async () => {
    const gqlResponse = {
      data: {
        model: {
          id: 'model-abc-123',
          designItem: {
            id: 'item-xyz',
            name: 'Unknown Design',
            extensionType: null,
            mimeType: '',
            size: '0',
            fusionWebUrl: ''
          }
        }
      }
    }
    const runtime = makeRuntime({ fetchMfgGraphQL: gqlResponse })
    const details = await fetchDesignItemFromGraphQL(runtime, 'model-abc-123')
    expect(details.extensionType).toBe('f3d')
  })

  it('throws when model is missing from response', async () => {
    const runtime = makeRuntime({ fetchMfgGraphQL: { data: { model: null } } })
    await expect(fetchDesignItemFromGraphQL(runtime, 'model-abc-123')).rejects.toThrow()
  })
})

describe('resolveTranslationSources', () => {
  it('returns designDetails and formatOptions after successful chain', async () => {
    const runtime = makeRuntime({
      fetchApiJson: { id: 15535, modelId: 'model-abc-123' },
      fetchMfgGraphQL: {
        data: {
          model: {
            id: 'model-abc-123',
            designItem: {
              id: 'di-1',
              name: 'Saw',
              extensionType: 'f3d',
              mimeType: 'application/vnd.autodesk.fusion360',
              size: '1000000',
              fusionWebUrl: ''
            }
          }
        }
      },
      getModelDerivativeFormats: {
        formats: {
          step: ['f3d'],
          fbx:  ['f3d'],
          svf:  ['f3d'],
          svf2: ['f3d'],
          thumbnail: ['f3d']
        }
      }
    })

    const result = await resolveTranslationSources(runtime, FAKE_URL)
    expect(result.designDetails.name).toBe('Saw')
    expect(result.designDetails.extensionType).toBe('f3d')
    expect(result.formatOptions.map((o) => o.value)).toContain('step')
    expect(result.formatOptions.map((o) => o.value)).toContain('fbx')
    expect(result.formatOptions.map((o) => o.value)).toContain('svf')
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- --reporter=verbose src/features/design/components/__tests__/components.api.test.ts
```

Expected: all 6 tests FAIL — functions do not exist yet.

- [ ] **Step 3: Add the three functions to `components.api.ts`**

Add after the existing `resolveDesignSourceForItem` function:

```typescript
const GET_MODEL_SOURCE_FILE_QUERY = `
query GetModelSourceFile($modelId: ID!) {
  model(modelId: $modelId) {
    id
    designItem {
      id
      name
      extensionType
      mimeType
      size
      fusionWebUrl
    }
  }
}
`.trim()

async function resolveModelIdForItem(
  runtime: DesignComponentsRuntime,
  pageUrl: string
): Promise<string> {
  const context = resolveItemContextFromPageUrl(pageUrl)
  if (!context) throw new Error('Could not resolve workspace/item from the current URL.')
  const tenant = getTenantFromPlmHost(pageUrl)
  if (!tenant) throw new Error('Could not resolve tenant from current URL.')

  const payload = await runtime.requestPlmAction<Record<string, unknown>>('fetchApiJson', {
    tenant,
    path: `/api/v3/workspaces/${context.workspaceId}/items/${context.dmsId}`
  })

  const modelId = typeof payload?.modelId === 'string' ? payload.modelId.trim() : ''
  if (!modelId) throw new Error('Item record is missing modelId.')
  return modelId
}

export async function fetchDesignItemFromGraphQL(
  runtime: DesignComponentsRuntime,
  modelId: string
): Promise<DesignItemDetails> {
  const response = await runtime.requestPlmAction<Record<string, unknown>>('fetchMfgGraphQL', {
    query:     GET_MODEL_SOURCE_FILE_QUERY,
    variables: { modelId }
  })

  const model = (response as any)?.data?.model
  if (!model || typeof model !== 'object') {
    throw new Error('GraphQL response missing data.model.')
  }

  const di = (model as any).designItem
  if (!di || typeof di !== 'object') {
    throw new Error('GraphQL response missing data.model.designItem.')
  }

  return {
    id:            typeof di.id            === 'string' ? di.id            : '',
    name:          typeof di.name          === 'string' ? di.name          : '',
    extensionType: typeof di.extensionType === 'string' && di.extensionType.trim()
                     ? di.extensionType.trim().toLowerCase()
                     : 'f3d',
    mimeType:      typeof di.mimeType      === 'string' ? di.mimeType      : '',
    size:          typeof di.size          === 'string' ? di.size          : '',
    fusionWebUrl:  typeof di.fusionWebUrl  === 'string' ? di.fusionWebUrl  : ''
  }
}

export async function resolveTranslationSources(
  runtime: DesignComponentsRuntime,
  pageUrl: string
): Promise<{ designDetails: DesignItemDetails; formatOptions: OutputFormatOption[] }> {
  const modelId      = await resolveModelIdForItem(runtime, pageUrl)
  const designDetails = await fetchDesignItemFromGraphQL(runtime, modelId)

  const formatsPayload = await runtime.requestPlmAction<unknown>('getModelDerivativeFormats', {})
  const matrix = extractFormatsMatrix(formatsPayload)

  const formatOptions = matrix
    ? getOutputFormatOptionsForTypes(derivativeOutputsForSourceExtension(matrix, designDetails.extensionType))
    : getOutputFormatOptionsForExtension(designDetails.extensionType)

  return { designDetails, formatOptions }
}
```

Also add `DesignItemDetails` to the import from `./components.types` at the top of the file.

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- --reporter=verbose src/features/design/components/__tests__/components.api.test.ts
```

Expected: all 6 tests PASS.

- [ ] **Step 5: Run the full test suite to check for regressions**

```bash
npm test
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/design/components/components.api.ts src/features/design/components/__tests__/components.api.test.ts
git commit -m "feat(design-components): add resolveModelIdForItem, fetchDesignItemFromGraphQL, resolveTranslationSources"
```

---

## Task 8: Rebuild modal — two-column layout

**Files:**
- Modify: `src/features/design/components/components.modal.ts`

The modal is pure DOM manipulation — no unit tests. Manual verification is described in the testing section.

- [ ] **Step 1: Update `ConversionModalApi` type and replace `openConversionModal` implementation**

Replace the entire contents of `src/features/design/components/components.modal.ts`:

```typescript
import { DESIGN_COMPONENTS_MODAL_ID } from './components.constants'
import type { ConversionState, DesignItemDetails, OutputFormatOption } from './components.types'

let activeModalAbort: AbortController | null = null

function detachModalDom(): void {
  document.getElementById(DESIGN_COMPONENTS_MODAL_ID)?.remove()
}

export function removeConversionModal(): void {
  activeModalAbort?.abort()
  activeModalAbort = null
  detachModalDom()
}

export type ConversionModalApi = {
  abortSignal: AbortSignal
  onConvert: (handler: () => void) => void
  getSelectedFormat: () => string
  renderSourceLoading: () => void
  renderDesignDetails: (details: DesignItemDetails) => void
  renderFormatList: (options: OutputFormatOption[]) => void
  renderSourceError: (error: unknown) => void
  renderState: (state: ConversionState) => void
  renderError: (error: unknown) => void
  setConvertDisabled: (disabled: boolean) => void
  setConversionProgress: (ratio: number | null, statusText: string) => void
  setConversionProgressVisible: (visible: boolean) => void
  downloadDerivativeFile: (params: { base64: string; contentType: string; filename: string }) => void
  close: () => void
}

function createPanelHead(title: string, close: () => void): HTMLDivElement {
  const head = document.createElement('div')
  head.className = 'plm-ext-dc-panel-head'
  const h3 = document.createElement('h3')
  h3.textContent = title
  const closeBtn = document.createElement('button')
  closeBtn.type = 'button'
  closeBtn.className = 'plm-ext-dc-close'
  closeBtn.setAttribute('aria-label', 'Close')
  closeBtn.textContent = '×'
  closeBtn.addEventListener('click', close)
  head.appendChild(h3)
  head.appendChild(closeBtn)
  return head
}

function formatFileSize(sizeStr: string): string {
  const bytes = Number.parseInt(sizeStr, 10)
  if (!Number.isFinite(bytes) || bytes <= 0) return sizeStr
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${bytes} B`
}

function base64ToBlob(base64: string, contentType: string): Blob {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new Blob([bytes], { type: contentType })
}

export function openConversionModal(): ConversionModalApi {
  removeConversionModal()

  const abortController = new AbortController()
  activeModalAbort = abortController

  const overlay = document.createElement('div')
  overlay.id = DESIGN_COMPONENTS_MODAL_ID

  const panel = document.createElement('div')
  panel.className = 'plm-ext-dc-panel'

  // --- two-column body ---
  const body = document.createElement('div')
  body.className = 'plm-ext-dc-body'

  const columns = document.createElement('div')
  columns.className = 'plm-ext-dc-columns'

  const colDetails = document.createElement('div')
  colDetails.className = 'plm-ext-dc-col-details'

  const colFormats = document.createElement('div')
  colFormats.className = 'plm-ext-dc-col-formats'

  const convertButton = document.createElement('button')
  convertButton.type = 'button'
  convertButton.className = 'plm-ext-dc-btn'
  convertButton.textContent = 'Convert'
  convertButton.disabled = true

  const statusLine = document.createElement('p')
  statusLine.className = 'plm-ext-dc-status'

  const progressWrap = document.createElement('div')
  progressWrap.className = 'plm-ext-dc-progress-wrap'
  progressWrap.hidden = true
  const progressEl = document.createElement('progress')
  progressEl.className = 'plm-ext-dc-progress'
  progressEl.max = 100
  progressWrap.appendChild(progressEl)

  const close = (): void => {
    abortController.abort()
    detachModalDom()
    if (activeModalAbort === abortController) activeModalAbort = null
  }

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close()
  })

  columns.appendChild(colDetails)
  columns.appendChild(colFormats)
  body.appendChild(columns)
  body.appendChild(statusLine)
  body.appendChild(progressWrap)
  panel.appendChild(createPanelHead('Model Derivative Conversion', close))
  panel.appendChild(body)
  overlay.appendChild(panel)
  document.body.appendChild(overlay)

  function updateStatus(text: string): void {
    statusLine.textContent = text
  }

  function getSelectedFormat(): string {
    const checked = colFormats.querySelector<HTMLInputElement>('input[type="radio"]:checked')
    return checked?.value ?? ''
  }

  return {
    abortSignal: abortController.signal,

    onConvert(handler) {
      convertButton.onclick = () => handler()
    },

    getSelectedFormat,

    renderSourceLoading() {
      colDetails.replaceChildren()
      const loading = document.createElement('p')
      loading.className = 'plm-ext-dc-muted'
      loading.textContent = 'Loading design details…'
      colDetails.appendChild(loading)
      colFormats.replaceChildren()
      convertButton.disabled = true
      updateStatus('')
      progressWrap.hidden = true
    },

    renderDesignDetails(details) {
      colDetails.replaceChildren()
      const rows: [string, string | null][] = [
        ['Name',      details.name],
        ['Type',      details.extensionType ? details.extensionType.toUpperCase() : null],
        ['MIME',      details.mimeType || null],
        ['Size',      details.size ? formatFileSize(details.size) : null]
      ]
      for (const [label, value] of rows) {
        if (!value) continue
        const row = document.createElement('p')
        row.className = 'plm-ext-dc-detail-row'
        const lbl = document.createElement('span')
        lbl.className = 'plm-ext-dc-detail-label'
        lbl.textContent = `${label}: `
        row.appendChild(lbl)
        row.appendChild(document.createTextNode(value))
        colDetails.appendChild(row)
      }
      if (details.fusionWebUrl) {
        const row = document.createElement('p')
        row.className = 'plm-ext-dc-detail-row'
        const lbl = document.createElement('span')
        lbl.className = 'plm-ext-dc-detail-label'
        lbl.textContent = 'Link: '
        const link = document.createElement('a')
        link.href = details.fusionWebUrl
        link.target = '_blank'
        link.rel = 'noopener noreferrer'
        link.textContent = 'Open in Fusion'
        row.appendChild(lbl)
        row.appendChild(link)
        colDetails.appendChild(row)
      }
    },

    renderFormatList(options) {
      colFormats.replaceChildren()
      if (options.length === 0) {
        const msg = document.createElement('p')
        msg.className = 'plm-ext-dc-muted'
        msg.textContent = 'No supported output formats for this source file.'
        colFormats.appendChild(msg)
        convertButton.disabled = true
        colFormats.appendChild(convertButton)
        updateStatus('')
        return
      }
      const groupName = `plm-ext-dc-fmt-${Date.now()}`
      options.forEach((opt, i) => {
        const label = document.createElement('label')
        label.className = 'plm-ext-dc-format-item'
        const radio = document.createElement('input')
        radio.type = 'radio'
        radio.name = groupName
        radio.value = opt.value
        if (i === 0) radio.checked = true
        const text = document.createTextNode(opt.label)
        label.appendChild(radio)
        label.appendChild(text)
        colFormats.appendChild(label)
      })
      convertButton.disabled = false
      colFormats.appendChild(convertButton)
      updateStatus('Select a format and click Convert.')
    },

    renderSourceError(error) {
      colDetails.replaceChildren()
      colFormats.replaceChildren()
      const msg = document.createElement('p')
      msg.className = 'plm-ext-dc-err'
      msg.textContent = 'Unable to load design details.'
      colDetails.appendChild(msg)
      updateStatus(error instanceof Error ? error.message : String(error))
      convertButton.disabled = true
      progressWrap.hidden = true
    },

    renderState(state) {
      updateStatus(state.message)
    },

    renderError(error) {
      updateStatus(error instanceof Error ? error.message : String(error))
      progressWrap.hidden = true
    },

    setConvertDisabled(disabled) {
      convertButton.disabled = disabled
    },

    setConversionProgress(ratio, statusText) {
      progressWrap.hidden = false
      updateStatus(statusText)
      if (ratio === null) {
        progressEl.removeAttribute('value')
      } else {
        progressEl.value = Math.round(Math.min(100, Math.max(0, ratio * 100)))
      }
    },

    setConversionProgressVisible(visible) {
      progressWrap.hidden = !visible
    },

    downloadDerivativeFile(params) {
      const blob = base64ToBlob(params.base64, params.contentType)
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = params.filename
      anchor.rel = 'noopener'
      anchor.style.display = 'none'
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
    },

    close
  }
}
```

- [ ] **Step 2: Build to confirm no TS errors**

```bash
npm run build
```

Expected: build succeeds. (The view file will have TS errors until Task 9.)

- [ ] **Step 3: Commit**

```bash
git add src/features/design/components/components.modal.ts
git commit -m "feat(design-components): rebuild modal with two-column layout; add renderDesignDetails/renderFormatList"
```

---

## Task 9: Update `components.view.ts`

**Files:**
- Modify: `src/features/design/components/components.view.ts`

- [ ] **Step 1: Replace the entire view file**

```typescript
import { createCompactActionButton } from '../../professional/item-details/view/item-details.command-bar.view'
import {
  ConversionWorkflowAbortedError,
  runModelDerivativeConversionWorkflow
} from './components.conversion.workflow'
import {
  resolveDesignSourceForItem,
  resolveTranslationSources
} from './components.api'
import {
  DESIGN_COMPONENTS_ACTION_WRAPPER_ID,
  DESIGN_COMPONENTS_ICON_CLASS
} from './components.constants'
import { openDesignActionMenu, removeDesignActionMenu } from './components.designMenu'
import {
  ensureDesignComponentsStyles,
  getDesignComponentsStatusRowContainer,
  placeDesignComponentsWrapperAtRight,
  removeLegacyDesignComponentsButtons
} from './components.dom'
import { openMetadataInspectorModal, removeMetadataInspectorModal } from './components.metadata.modal'
import { type ConversionModalApi, openConversionModal, removeConversionModal } from './components.modal'
import { toConversionState } from './components.state'
import { translationCapabilitiesAllEnabled } from './components.translationCapabilities'
import type {
  DerivativeOutputType,
  DesignComponentsRuntime,
  DesignComponentsView,
  OutputFormatOption
} from './components.types'

function wireConversionWorkflow(
  modal: ConversionModalApi,
  runtime: DesignComponentsRuntime,
  formatOptions: OutputFormatOption[]
): void {
  modal.renderFormatList(formatOptions)
  modal.renderState(toConversionState('ready_to_convert'))

  modal.onConvert(() => {
    const selectedFormat = modal.getSelectedFormat() as DerivativeOutputType
    if (!selectedFormat) {
      modal.renderState(toConversionState('error', 'Please choose an output format.'))
      return
    }

    void (async () => {
      try {
        modal.setConvertDisabled(true)
        modal.renderState(toConversionState('loading_source', 'Resolving design…'))

        const source = await resolveDesignSourceForItem(runtime, window.location.href)

        await runModelDerivativeConversionWorkflow({
          runtime,
          encodedDesignUrn: source.encodedDesignUrn,
          outputFormat: selectedFormat,
          designBaseName: source.designName || source.resourceName || 'design',
          signal: modal.abortSignal,
          callbacks: {
            setProgress: (ratio, message) => {
              modal.setConversionProgressVisible(true)
              modal.setConversionProgress(ratio, message)
              modal.renderState(toConversionState('polling', message))
            },
            setSubmitting: () => {
              modal.setConversionProgressVisible(true)
              modal.setConversionProgress(null, 'Submitting translation job…')
              modal.renderState(toConversionState('submitting'))
            },
            downloadFile: (file) => modal.downloadDerivativeFile(file),
            showSuccess: (message) => {
              modal.setConversionProgressVisible(false)
              modal.renderState(toConversionState('success', message))
            },
            showFailure: (message) => {
              modal.setConversionProgressVisible(false)
              modal.renderState(toConversionState('error', message))
            }
          }
        })
      } catch (error: unknown) {
        if (error instanceof ConversionWorkflowAbortedError) return
        modal.renderState(toConversionState('error'))
        modal.renderError(error)
      } finally {
        modal.setConvertDisabled(false)
      }
    })()
  })
}

async function handleDesignMenuSelection(
  runtime: DesignComponentsRuntime,
  action: string
): Promise<void> {
  if (action === 'dataExtraction') {
    const modal = openConversionModal()
    modal.renderSourceLoading()
    try {
      const { designDetails } = await resolveTranslationSources(runtime, window.location.href)
      const { fetchDesignItemFromGraphQL: _, ..._2 } = await import('./components.api')
      // fetch metadata separately — resolveTranslationSources already has the URN path
      modal.renderDesignDetails(designDetails)
    } catch (error: unknown) {
      modal.renderSourceError(error)
    }
    return
  }

  const modal = openConversionModal()
  modal.renderSourceLoading()

  try {
    const { designDetails, formatOptions } = await resolveTranslationSources(
      runtime,
      window.location.href
    )
    modal.renderDesignDetails(designDetails)
    wireConversionWorkflow(modal, runtime, formatOptions)
  } catch (error: unknown) {
    modal.renderSourceError(error)
  }
}

async function openDesignMenuFlow(
  runtime: DesignComponentsRuntime,
  anchor: HTMLElement
): Promise<void> {
  openDesignActionMenu(anchor, translationCapabilitiesAllEnabled(), (action) => {
    void handleDesignMenuSelection(runtime, action)
  })
}

function createTriggerButton(runtime: DesignComponentsRuntime): HTMLButtonElement {
  const btn = createCompactActionButton({
    title: 'Design',
    ariaLabel: 'Design',
    iconClassName: `zmdi zmdi-download ${DESIGN_COMPONENTS_ICON_CLASS}`,
    iconSizePx: 19,
    iconInlineStyle: 'font-size:19px;line-height:1;display:block;color:#4a5568;',
    buttonClassName: 'square-icon md-button md-ink-ripple',
    onClick: () => {
      void openDesignMenuFlow(runtime, btn)
    }
  })
  return btn
}

export function createDesignComponentsView(runtime: DesignComponentsRuntime): DesignComponentsView {
  let wrap: HTMLElement | null = null

  function mount(): void {
    if (wrap && !wrap.isConnected) wrap = null
    if (wrap?.isConnected) return

    const container = getDesignComponentsStatusRowContainer()
    if (!container) return

    ensureDesignComponentsStyles()
    removeLegacyDesignComponentsButtons()

    const existing = document.getElementById(DESIGN_COMPONENTS_ACTION_WRAPPER_ID)
    if (existing) {
      existing.className = 'menu-buttons'
      placeDesignComponentsWrapperAtRight(container, existing)
      wrap = existing
      return
    }

    const wrapper = document.createElement('div')
    wrapper.id = DESIGN_COMPONENTS_ACTION_WRAPPER_ID
    wrapper.className = 'menu-buttons'
    wrapper.appendChild(createTriggerButton(runtime))
    placeDesignComponentsWrapperAtRight(container, wrapper)
    wrap = wrapper
  }

  function update(): void {
    if (!wrap?.isConnected) {
      wrap = null
      mount()
      return
    }
    const container = getDesignComponentsStatusRowContainer()
    if (!container) return
    removeLegacyDesignComponentsButtons()
    placeDesignComponentsWrapperAtRight(container, wrap)
  }

  function unmount(): void {
    wrap?.remove()
    wrap = null
    removeConversionModal()
    removeDesignActionMenu()
    removeMetadataInspectorModal()
  }

  return { mount, update, unmount }
}
```

- [ ] **Step 2: Add `translationCapabilitiesAllEnabled` to `components.translationCapabilities.ts`**

The view calls `translationCapabilitiesAllEnabled()` — add this helper to `components.translationCapabilities.ts`:

```typescript
export function translationCapabilitiesAllEnabled(): TranslationCapabilityFlags {
  return {
    fileTranslation:    true,
    thumbnail:          true,
    geometryExtraction: true,
    dataExtraction:     true
  }
}
```

- [ ] **Step 3: Fix the dataExtraction branch in `handleDesignMenuSelection`**

The `dataExtraction` branch in the view above was left incomplete with a placeholder. Replace it with the proper implementation that calls `fetchDesignMetadata` (which already exists in `components.api.ts`):

```typescript
if (action === 'dataExtraction') {
  const modal = openConversionModal()
  modal.renderSourceLoading()
  try {
    const { designDetails } = await resolveTranslationSources(runtime, window.location.href)
    modal.renderDesignDetails(designDetails)
    // metadata fetch uses the design URN — get it lazily
    const source = await resolveDesignSourceForItem(runtime, window.location.href)
    openMetadataInspectorModal('Model metadata', await (await import('./components.api')).fetchDesignMetadata(runtime, source.encodedDesignUrn))
  } catch (error: unknown) {
    modal.renderSourceError(error)
  }
  return
}
```

Actually, use a cleaner import at the top of the file instead. At the top of `components.view.ts`, add `fetchDesignMetadata` to the import from `./components.api`:

```typescript
import {
  fetchDesignMetadata,
  resolveDesignSourceForItem,
  resolveTranslationSources
} from './components.api'
```

Then the `dataExtraction` branch becomes:

```typescript
if (action === 'dataExtraction') {
  const modal = openConversionModal()
  modal.renderSourceLoading()
  try {
    const [{ designDetails }, source] = await Promise.all([
      resolveTranslationSources(runtime, window.location.href),
      resolveDesignSourceForItem(runtime, window.location.href)
    ])
    modal.renderDesignDetails(designDetails)
    const metadata = await fetchDesignMetadata(runtime, source.encodedDesignUrn)
    removeConversionModal()
    openMetadataInspectorModal('Model metadata', metadata)
  } catch (error: unknown) {
    modal.renderSourceError(error)
  }
  return
}
```

- [ ] **Step 4: Build to confirm no TS errors**

```bash
npm run build
```

Expected: build succeeds.

- [ ] **Step 5: Run full test suite**

```bash
npm test
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/design/components/components.view.ts src/features/design/components/components.translationCapabilities.ts
git commit -m "feat(design-components): lazy modal load with resolveTranslationSources; instant menu; deferred URN fetch"
```

---

## Task 10: SVF/SVF2 short-circuit in conversion workflow

**Files:**
- Modify: `src/features/design/components/components.conversion.workflow.ts`
- Modify: `src/features/design/components/__tests__/components.conversion.workflow.test.ts`

- [ ] **Step 1: Write the failing test**

Open `src/features/design/components/__tests__/components.conversion.workflow.test.ts` and add a new test. First read the existing tests to understand the mock pattern, then add:

```typescript
it('shows success without downloading for svf output', async () => {
  const callbacks = {
    setProgress:  vi.fn(),
    setSubmitting: vi.fn(),
    showSuccess:  vi.fn(),
    showFailure:  vi.fn(),
    downloadFile: vi.fn()
  }

  // Manifest immediately terminal with success
  const runtime = {
    requestPlmAction: vi.fn()
      .mockResolvedValueOnce(undefined)               // submitConversionJob
      .mockResolvedValue({ status: 'success', progress: 'complete' }) // manifest polls
  } as unknown as DesignComponentsRuntime

  const signal = new AbortController().signal

  await runModelDerivativeConversionWorkflow({
    runtime,
    encodedDesignUrn: 'urn-abc',
    outputFormat: 'svf',
    designBaseName: 'TestDesign',
    signal,
    callbacks
  })

  expect(callbacks.showSuccess).toHaveBeenCalledWith(
    expect.stringContaining('Translation complete')
  )
  expect(callbacks.downloadFile).not.toHaveBeenCalled()
})
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
npm test -- --reporter=verbose src/features/design/components/__tests__/components.conversion.workflow.test.ts
```

Expected: new test FAILS — no short-circuit exists yet.

- [ ] **Step 3: Add the SVF/SVF2 short-circuit in `runModelDerivativeConversionWorkflow`**

In `src/features/design/components/components.conversion.workflow.ts`, after the `if (derivative && isManifestSuccess(manifest))` block (around line 160), replace the final `else if` / `else` block:

```typescript
  if (derivative && isManifestSuccess(manifest)) {
    if (outputFormat === 'svf' || outputFormat === 'svf2') {
      callbacks.showSuccess('Translation complete. Open in Viewer to access the result.')
      return
    }
    await finalizeWithDownload({
      runtime,
      encodedDesignUrn: urn,
      outputFormat,
      designBaseName,
      derivative,
      callbacks
    })
  } else if (status === 'failed') {
    callbacks.showFailure('Translation failed.')
  } else {
    callbacks.showFailure(
      `Translation finished, but no derivative matched "${outputFormat}" in the manifest (resource type, role, and status success).`
    )
  }
```

- [ ] **Step 4: Run the test to confirm it passes**

```bash
npm test -- --reporter=verbose src/features/design/components/__tests__/components.conversion.workflow.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Run full test suite**

```bash
npm test
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/design/components/components.conversion.workflow.ts src/features/design/components/__tests__/components.conversion.workflow.test.ts
git commit -m "feat(design-components): short-circuit download for svf/svf2 — show Translation complete instead"
```

---

## Task 11: Final build and smoke test

- [ ] **Step 1: Run full test suite**

```bash
npm test
```

Expected: all tests PASS. Note the count — it should be higher than the baseline.

- [ ] **Step 2: Build the extension**

```bash
npm run build
```

Expected: build succeeds with no TS errors.

- [ ] **Step 3: Manual smoke test**

Load the unpacked extension in Chrome (`chrome://extensions` → Load unpacked → select `dist/`).

Navigate to a Fusion Manage item in the CW_COMPONENTS workspace (URL matches `/plm/workspaces/{id}/items/itemDetails?view=full&tab=details&mode=view&itemId=...`).

1. **Instant menu:** Click the Design button. The four-item menu (File Translation, Thumbnail, Geometry Extraction, Data Extraction) should appear with zero delay.
2. **Loading state:** Click "File Translation". The modal should open immediately showing "Loading design details…" in the left panel and empty right panel.
3. **Populated modal:** After 1–3 seconds, the left panel should show the design name, type (e.g. F3D), MIME type, size, and an "Open in Fusion" link. The right panel should show radio buttons for each available format (DWG, FBX, IGES, OBJ, STEP, STL, SVF, SVF2, Thumbnail for an f3d source).
4. **Convert (non-SVF):** Select STEP, click Convert. A progress bar should appear. After translation completes, the file should download automatically.
5. **Convert (SVF):** Open the modal again, select SVF, click Convert. Progress bar appears. On success, "Translation complete. Open in Viewer to access the result." should display — no file download.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat(design-components): complete Model Derivative translation feature with two-column modal and GraphQL source resolution"
```
