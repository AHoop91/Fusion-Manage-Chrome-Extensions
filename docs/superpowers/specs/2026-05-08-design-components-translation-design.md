# Design Components — Model Derivative Translation

**Date:** 2026-05-08  
**Branch:** dev/clean-up  
**Scope:** Wire up translation job submission and status polling for the `CW_COMPONENTS` workspace feature. Fix slow menu, add missing output formats (FBX, SVF, SVF2), and replace the pre-fetch pattern with a lazy-load modal.

---

## Goals

By the end of this work:

- Clicking the Design button shows the menu **instantly** (zero API calls on click).
- Opening the translation modal triggers a single loading chain that resolves the available format list from the actual file extension.
- The modal has a two-column layout: left panel shows design details from GraphQL (name, extension, mime type, file size, Fusion web URL); right panel shows all available format options as selectable items.
- Available formats for f3d: **DWG, FBX, IGES, OBJ, STEP, STL, SVF, SVF2, Thumbnail** (PDF drops out because it is absent from the APS `/formats` response for f3d).
- Clicking Convert fetches the `encodedDesignUrn`, submits the translation job, and polls the manifest until terminal.
- SVF and SVF2 translations show "Translation complete" without a browser download (viewer bundles are multi-file; single-file download is out of scope).

---

## Data Flow

### Button click → menu (instant, no API calls)

```
User clicks Design button
  → openDesignActionMenu() with all items enabled
  → menu appears immediately
```

The previous capability-gating (disabling menu items based on formats matrix) is removed. All four menu items are always enabled.

### Menu item click → modal loading state → format dropdown

```
User picks "File Translation" (or Thumbnail / Geometry Extraction)
  → modal opens immediately in loading_source state
  → resolveTranslationSources(runtime, pageUrl)
        /api/v3/workspaces/{ws}/items/{id}   →  modelId
        POST /mfg/v3/graphql/public          →  extensionType (e.g. "f3d")
        GET  /modelderivative/v2/designdata/formats  →  formats matrix
        derivativeOutputsForSourceExtension(matrix, extensionType)
        →  formatOptions[]
  → modal populates:
       left panel  — design details (name, extensionType, mimeType, size, fusionWebUrl)
       right panel — selectable format list, Convert button enabled
```

The three calls in `resolveTranslationSources` are sequential (each depends on the previous result). Typical wall time: ~1–2 s.

`resolveTranslationSources` is updated to also return `designDetails: { name, extensionType, mimeType, size, fusionWebUrl }` from the GraphQL response so the left panel can be populated without an extra call.

### Convert click → URN fetch → job submission → polling

```
User selects format, clicks Convert
  → resolveDesignSourceForItem(runtime, pageUrl)
        /api/v3/workspaces/{ws}/items/{id}/designs  →  encodedDesignUrn
  → submitConversionJob(runtime, encodedDesignUrn, outputFormat)
        POST /modelderivative/v2/designdata/job
  → pollManifestUntilTerminal(...)
        GET  /modelderivative/v2/designdata/{urn}/manifest  (every 2.5 s, max 60 attempts)
  → success: download file (non-SVF/SVF2) or show "Translation complete" (SVF/SVF2)
  → failure: show error message
```

---

## New Background Function

**`fetchMfgGraphQL`** added to `src/background/plm.autodeskDeveloper.ts`:

- POST `https://developer.api.autodesk.com/mfg/v3/graphql/public`
- Session-authed via browser cookies (`credentials: 'include'`) on `developer.api.autodesk.com`
- Accepts `{ query: string, variables: object }` from the content script
- Returns the raw parsed response body
- Registered in `plmActionAllowlist.ts` as `'fetchMfgGraphQL'`
- Exported from `plm.ts`

`manifest.json` host permissions already include `https://developer.api.autodesk.com/*` — no change needed.

### GraphQL query used

```graphql
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
```

`extensionType` drives format resolution. `name`, `mimeType`, `size`, and `fusionWebUrl` populate the modal left panel.

---

## API Layer Changes (`components.api.ts`)

### New: `resolveModelIdForItem(runtime, pageUrl): Promise<string>`

Calls PLM `GET /api/v3/workspaces/{ws}/items/{id}` (the item record, not the designs sub-resource). Extracts `modelId` from the response. Throws if not found.

### New: `fetchDesignItemFromGraphQL(runtime, modelId): Promise<DesignItemDetails>`

Calls `fetchMfgGraphQL` with the `GetModelSourceFile` query. Extracts and returns `data.model.designItem`:

```typescript
type DesignItemDetails = {
  id: string
  name: string
  extensionType: string
  mimeType: string
  size: string
  fusionWebUrl: string
}
```

Falls back `extensionType` to `"f3d"` if absent (CW_COMPONENTS is always Fusion designs).

### New: `resolveTranslationSources(runtime, pageUrl): Promise<{ designDetails, formatOptions }>`

Orchestrates the three-call chain:

```
resolveModelIdForItem → fetchDesignItemFromGraphQL → getModelDerivativeFormats
                                                      → derivativeOutputsForSourceExtension
                                                      → getOutputFormatOptionsForTypes
```

Returns:
```typescript
{
  designDetails: DesignItemDetails   // populates left panel
  formatOptions: OutputFormatOption[] // populates right panel
}
```

Does **not** return `encodedDesignUrn` — that is fetched lazily on Convert.

### Existing: `resolveDesignSourceForItem` — unchanged

Still called on Convert click to obtain `encodedDesignUrn`. No changes to its implementation.

---

## Format Type Additions

### `DerivativeOutputType` (components.types.ts)

```typescript
export type DerivativeOutputType =
  | 'pdf' | 'step' | 'stl' | 'iges' | 'obj' | 'dwg' | 'thumbnail'
  | 'fbx' | 'svf' | 'svf2'
```

### `CATALOG_OUTPUT_KEY_TO_UI` (components.formats.catalog.ts)

Add three entries mapping APS `/formats` response keys to UI types:

```typescript
fbx:  'fbx',
svf:  'svf',
svf2: 'svf2',
```

### `FORMAT_OPTIONS` (components.constants.ts)

```typescript
fbx:  { value: 'fbx',  label: 'FBX'  },
svf:  { value: 'svf',  label: 'SVF'  },
svf2: { value: 'svf2', label: 'SVF2' },
```

### `FORMAT_DISPLAY_ORDER` (components.formats.catalog.ts)

```
['dwg', 'fbx', 'iges', 'obj', 'step', 'stl', 'svf', 'svf2', 'thumbnail']
```

PDF moves to end-of-list (or drops out naturally if absent from the APS response).

### `FILE_TRANSLATION_OUTPUT_TYPES` (components.translationCapabilities.ts)

Add `'fbx'`. SVF/SVF2 are viewer formats — they are intentionally excluded from the file-download category and treated as translation-only outputs.

### APS job body (`plm.autodeskDeveloper.ts`)

`buildOutputFormat` extended:

```typescript
if (outputType === 'svf')  return { type: 'svf',  views: ['2d', '3d'] }
if (outputType === 'svf2') return { type: 'svf2', views: ['2d', '3d'] }
if (outputType === 'fbx')  return { type: 'fbx' }
```

`normalizeOutputType` validation extended to accept `'fbx' | 'svf' | 'svf2'`.

### `derivativeDownloadFilename` (components.api.ts)

```typescript
fbx:  'fbx',
svf:  'svf',   // not downloaded, included for completeness
svf2: 'svf2',  // not downloaded, included for completeness
```

---

## Modal Layout

The conversion modal changes from a single-column form to a two-column panel.

```
┌─────────────────────────────────────────────────────┐
│  Design Components                              [×]  │
├───────────────────────────┬─────────────────────────┤
│  Design Details           │  Available Formats       │
│                           │                          │
│  Name:  Reciprocating Saw │  ○ DWG                   │
│  Type:  f3d               │  ○ FBX                   │
│  Mime:  application/...   │  ○ IGES                  │
│  Size:  8.0 MB            │  ○ OBJ                   │
│  Link:  Open in Fusion    │  ○ STEP                  │
│                           │  ○ STL                   │
│                           │  ○ SVF                   │
│                           │  ○ SVF2                  │
│                           │  ○ Thumbnail             │
│                           │                          │
│                           │  [Convert]               │
├───────────────────────────┴─────────────────────────┤
│  ░░░░░░░░░░░░░░░░░░ Translating… 42%               │
└─────────────────────────────────────────────────────┘
```

**Left panel — design details** (populated from `designDetails` returned by `resolveTranslationSources`):
- `name` — design name
- `extensionType` — source file type (e.g. `f3d`)
- `mimeType` — MIME type
- `size` — file size formatted as human-readable (e.g. `8.0 MB`)
- `fusionWebUrl` — rendered as an "Open in Fusion" link if present

**Right panel — format list** (populated from `formatOptions`):
- Radio-button style list, one option per available format
- Convert button below the list, disabled until a format is selected
- Loading spinner shown while `resolveTranslationSources` is in flight

**Progress bar** spans the full width at the bottom, shown only during translation.

**CSS** changes in `DESIGN_COMPONENTS_MODAL_CSS`: panel body switches from single column to `display: flex; flex-direction: row`. Left and right panels each take 50% width. On narrow viewports (< 480 px) stack vertically.

## View Changes (`components.view.ts`)

### `openDesignMenuFlow` — simplified

Remove the `Promise.all` pre-fetch. Remove `matrix` and `source` parameters from downstream calls. Menu always opens immediately with all items enabled via a helper `allMenuCapsEnabled()`.

### `handleDesignMenuSelection` — lazy load

Signature changes from `(runtime, source, matrix, action)` to `(runtime, action)`.

1. Opens modal immediately: `modal.renderState(toConversionState('loading_source'))`
2. Calls `resolveTranslationSources(runtime, window.location.href)`
3. On success: calls `wireConversionWorkflow(modal, runtime, designDetails, formatOptions)`
4. On error: `modal.renderSourceError(error)`

`DesignConversionMenuMode` filtering is removed — the formats matrix already filters by extension, so all results from `resolveTranslationSources` are valid for the selected action. If thumbnail-only or geometry-only filtering is needed in future, it can be re-added as a post-filter on `formatOptions`.

### `wireConversionWorkflow` — deferred URN fetch

Signature changes from `(modal, runtime, source, formatOptions)` to `(modal, runtime, designDetails, formatOptions)`.

On Convert click, before running the workflow:

```typescript
const source = await resolveDesignSourceForItem(runtime, window.location.href)
```

Then passes `source.encodedDesignUrn` and `source.designName` to `runModelDerivativeConversionWorkflow`.

### SVF/SVF2 download handling

In `runModelDerivativeConversionWorkflow`, after a successful translation:

```typescript
if (outputFormat === 'svf' || outputFormat === 'svf2') {
  callbacks.showSuccess('Translation complete. Open in Viewer to access the result.')
  return
}
```

No download triggered for viewer formats.

---

## Files Changed

| File | Type of change |
|---|---|
| `src/background/plm.autodeskDeveloper.ts` | Add `fetchMfgGraphQL`; add fbx/svf/svf2 to `OutputType`, `normalizeOutputType`, `buildOutputFormat` |
| `src/background/plm.ts` | Export `fetchMfgGraphQL` |
| `src/background/plmActionAllowlist.ts` | Add `'fetchMfgGraphQL'` |
| `src/features/design/components/components.types.ts` | Extend `DerivativeOutputType` |
| `src/features/design/components/components.constants.ts` | Add fbx/svf/svf2 to `FORMAT_OPTIONS`; remove `SOURCE_FORMAT_POLICY` (replaced by live `/formats` call) |
| `src/features/design/components/components.formats.catalog.ts` | Add fbx/svf/svf2 to `CATALOG_OUTPUT_KEY_TO_UI` and `FORMAT_DISPLAY_ORDER` |
| `src/features/design/components/components.translationCapabilities.ts` | Add `'fbx'` to `FILE_TRANSLATION_OUTPUT_TYPES` |
| `src/features/design/components/components.api.ts` | Add `resolveModelIdForItem`, `fetchExtensionTypeFromGraphQL`, `resolveTranslationSources`; update `derivativeDownloadFilename` |
| `src/features/design/components/components.types.ts` | Add `DesignItemDetails` type |
| `src/features/design/components/components.modal.ts` | Two-column layout: `renderDesignDetails(details)` for left panel; `renderFormatList(options)` replaces dropdown for right panel |
| `src/features/design/components/components.constants.ts` | Update `DESIGN_COMPONENTS_MODAL_CSS` for two-column flex layout |
| `src/features/design/components/components.view.ts` | Simplify `openDesignMenuFlow`; update `handleDesignMenuSelection` and `wireConversionWorkflow` |
| `src/features/design/components/components.conversion.workflow.ts` | Add SVF/SVF2 short-circuit before download |

---

## Out of Scope

- SVF/SVF2 file download (multi-file bundle — separate task)
- Thumbnail preview rendering in the modal
- Re-adding per-category format filtering (File Translation vs Geometry Extraction vs Thumbnail menus) — can be added back as a post-filter once the core flow is working
- Test updates (covered in implementation plan)
