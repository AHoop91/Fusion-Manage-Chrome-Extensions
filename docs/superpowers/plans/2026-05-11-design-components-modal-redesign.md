# Design Components Modal Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Model Derivative Conversion modal with BOM-downloader visual theme, per-format advanced options (STEP protocol, STL/OBJ unit+structure, Thumbnail size), and a filename field with auto-generate toggle.

**Architecture:** CSS and DOM are rewritten in `components.modal.ts` and `components.constants.ts`; format option definitions live in `components.constants.ts`; advanced options flow from UI → view → workflow → API → background with optional params so all existing call-sites stay valid.

**Tech Stack:** TypeScript, vanilla DOM, Vitest (existing tests must keep passing)

---

## File map

| File | What changes |
|------|-------------|
| `src/features/design/components/components.types.ts` | Add `FormatOptionField`; extend `OutputFormatOption` with `fields?` |
| `src/features/design/components/components.constants.ts` | Rewrite modal CSS (BOM theme); add `FORMAT_OPTION_FIELDS` constant |
| `src/background/plm.autodeskDeveloper.ts` | `buildOutputFormat` / `submitModelDerivativeJob` accept `advancedOptions` |
| `src/features/design/components/components.api.ts` | `submitConversionJob` accepts optional `advancedOptions` |
| `src/features/design/components/components.conversion.workflow.ts` | `runModelDerivativeConversionWorkflow` accepts `advancedOptions` + `filenameOverride` |
| `src/features/design/components/components.modal.ts` | Full DOM rewrite; `ConversionModalApi` gains `getAdvancedOptions()` + `getFilename()` |
| `src/features/design/components/components.view.ts` | Attach fields to format options; pass `advancedOptions`/`filenameOverride` to workflow |

---

## Task 1: Types — FormatOptionField + extend OutputFormatOption

**Files:**
- Modify: `src/features/design/components/components.types.ts`

No new tests — this is a type-only change; downstream consumers verify correctness.

- [ ] **Step 1: Add `FormatOptionField` and extend `OutputFormatOption`**

Replace the existing `OutputFormatOption` type and add the new type:

```typescript
export type FormatOptionField = {
  key: string
  label: string
  options: { value: string; label: string }[]
  defaultValue: string
}

export type OutputFormatOption = {
  value: DerivativeOutputType
  label: string
  fields?: FormatOptionField[]
}
```

- [ ] **Step 2: Verify the project still type-checks**

```
npx tsc --noEmit
```

Expected: no errors related to `OutputFormatOption` (existing consumers only use `.value` and `.label`).

- [ ] **Step 3: Commit**

```
git add src/features/design/components/components.types.ts
git commit -m "feat(design-components): add FormatOptionField type; extend OutputFormatOption with fields"
```

---

## Task 2: Constants — new modal CSS + FORMAT_OPTION_FIELDS

**Files:**
- Modify: `src/features/design/components/components.constants.ts`

- [ ] **Step 1: Add imports at the top of `components.constants.ts`**

```typescript
import type { DerivativeOutputType } from './components.types'
import type { FormatOptionField } from './components.types'
```

- [ ] **Step 2: Replace `DESIGN_COMPONENTS_MODAL_CSS` entirely**

Remove the existing `DESIGN_COMPONENTS_MODAL_CSS` string and replace with:

```typescript
export const DESIGN_COMPONENTS_MODAL_CSS = `
#${DESIGN_COMPONENTS_MODAL_ID}{
  --plm-dc-f:"ArtifaktElement","Segoe UI",Arial,sans-serif;
  position:fixed;inset:0;background:rgba(15,23,42,.32);
  display:flex;align-items:center;justify-content:center;
  z-index:2147483647;padding:16px;box-sizing:border-box;
}
#${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-shell{
  width:min(660px,92vw);max-height:min(82vh,740px);
  display:flex;flex-direction:column;gap:14px;
  padding:26px 28px 22px;
  border:1px solid #dde6ef;border-radius:16px;
  background:#fff;box-shadow:0 24px 48px rgba(15,23,42,.20);
  font-family:var(--plm-dc-f);color:#1f2d3d;overflow:hidden;
}
#${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-header{
  display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-shrink:0;
}
#${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-header-copy{display:flex;flex-direction:column;gap:4px;}
#${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-title{margin:0;font:700 21px/1.15 var(--plm-dc-f);color:#142435;}
#${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-subtitle{margin:0;font:400 12.5px/1.4 var(--plm-dc-f);color:#51606f;}
#${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-close{
  display:flex;align-items:center;justify-content:center;
  width:34px;height:34px;flex-shrink:0;
  border:1px solid #cfd8e3;border-radius:8px;
  background:transparent;cursor:pointer;font-size:18px;line-height:1;color:#334155;padding:0;
}
#${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-close:hover{background:#f7f9fb;}
#${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-body{
  display:grid;grid-template-columns:minmax(180px,0.6fr) minmax(260px,1fr);
  gap:20px;flex:1;min-height:0;overflow:hidden;
}
#${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-col-details{
  display:flex;flex-direction:column;gap:10px;
  border-right:1px solid #e3ebf3;padding-right:20px;overflow:auto;
}
#${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-col-right{
  display:flex;flex-direction:column;gap:14px;overflow:auto;padding-right:2px;
}
#${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-section{display:flex;flex-direction:column;gap:8px;}
#${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-section-title{
  margin:0;font:700 12.5px/1.2 var(--plm-dc-f);color:#1c3348;
}
#${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-divider{border:none;border-top:1px solid #e3ebf3;margin:0;}
#${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-detail-block{display:flex;flex-direction:column;gap:2px;}
#${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-detail-label{
  font:600 11px/1.2 var(--plm-dc-f);color:#7890a7;
  text-transform:uppercase;letter-spacing:0.04em;margin:0;
}
#${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-detail-value{
  font:400 12.5px/1.35 var(--plm-dc-f);color:#1f2d3d;margin:0;word-break:break-word;
}
#${DESIGN_COMPONENTS_MODAL_ID} a.plm-ext-dc-detail-value{color:#149cd8;text-decoration:none;}
#${DESIGN_COMPONENTS_MODAL_ID} a.plm-ext-dc-detail-value:hover{text-decoration:underline;}
#${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-format-wrap{display:flex;flex-wrap:wrap;gap:6px;}
#${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-format-card{
  display:inline-flex;align-items:center;gap:7px;
  min-height:34px;padding:0 10px;
  border:1px solid #d4e0eb;border-radius:8px;background:#f9fbfe;
  cursor:pointer;font:600 12px/1.2 var(--plm-dc-f);color:#24374a;
  white-space:nowrap;user-select:none;
}
#${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-format-card input[type="radio"]{
  width:14px;height:14px;margin:0;accent-color:#149cd8;cursor:pointer;flex-shrink:0;
}
#${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-format-card:has(input:checked){
  border-color:#8ec9e7;background:#eef8fd;box-shadow:0 0 0 1px rgba(20,156,216,.08);
}
#${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-label{font:600 11.5px/1.2 var(--plm-dc-f);color:#24374a;}
#${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-select,
#${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-input{
  width:100%;min-height:34px;
  border:1px solid #c8d4e0;border-radius:8px;
  padding:7px 10px;box-sizing:border-box;
  font:400 12.5px/1.3 var(--plm-dc-f);color:#132131;background:#fff;
}
#${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-select:focus,
#${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-input:focus{
  outline:none;border-color:#149cd8;box-shadow:0 0 0 3px rgba(20,156,216,.16);
}
#${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-input:disabled{
  background:#f7f9fb;color:#94a3b8;cursor:not-allowed;
}
#${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-toggle{
  display:flex;align-items:center;gap:8px;
  font:600 12px/1.3 var(--plm-dc-f);color:#24374a;cursor:pointer;
}
#${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-toggle input[type="checkbox"]{
  width:15px;height:15px;margin:0;accent-color:#149cd8;cursor:pointer;flex-shrink:0;
}
#${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-footer{
  display:flex;align-items:flex-end;gap:10px;
  border-top:1px solid #e0e8f1;padding-top:12px;flex-shrink:0;
}
#${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-progress-panel{
  display:flex;flex-direction:column;gap:6px;flex:1;min-width:0;
}
#${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-progress-header{
  display:flex;align-items:center;justify-content:space-between;gap:8px;
  font:600 12px/1.25 var(--plm-dc-f);color:#21415f;
}
#${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-progress-track{
  display:block;height:10px;border-radius:3px;background:#deebf5;overflow:hidden;
}
#${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-progress-fill{
  display:block;height:100%;width:0;border-radius:3px;
  background:linear-gradient(90deg,#149cd8 0%,#3cb5e6 100%);
  transition:width .18s ease;
}
#${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-actions{display:flex;align-items:center;gap:8px;flex-shrink:0;}
#${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-btn-primary,
#${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-btn-secondary{
  min-height:34px;border-radius:8px;padding:0 14px;
  font:600 12px/1 var(--plm-dc-f);cursor:pointer;
}
#${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-btn-primary{
  border:1px solid #149cd8;background:#149cd8;color:#fff;
}
#${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-btn-primary:hover:not(:disabled){
  background:#0e8ab8;border-color:#0e8ab8;
}
#${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-btn-primary:disabled{opacity:.55;cursor:not-allowed;}
#${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-btn-secondary{
  border:1px solid #ccd7e2;background:#fff;color:#203246;
}
#${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-btn-secondary:hover{background:#f7f9fb;}
#${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-err{
  color:#b42318;font:400 12.5px/1.4 var(--plm-dc-f);margin:0;
}
#${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-muted{
  color:#697888;font:400 12.5px/1.4 var(--plm-dc-f);margin:0;
}
.${DESIGN_COMPONENTS_ICON_CLASS}{color:#4a5568;}
#${DESIGN_COMPONENTS_ACTION_WRAPPER_ID} .md-button:hover,
#${DESIGN_COMPONENTS_ACTION_WRAPPER_ID} .md-button:focus,
#${DESIGN_COMPONENTS_ACTION_WRAPPER_ID} .md-button:active{
  background:#f3f4f6 !important;
  box-shadow:var(--button-hover-shadow,0 0 0 1px #6b7280) !important;
  outline:none !important;border-color:#d1d5db !important;
}
#${DESIGN_COMPONENTS_ACTION_WRAPPER_ID} .md-button:hover::before,
#${DESIGN_COMPONENTS_ACTION_WRAPPER_ID} .md-button:hover::after,
#${DESIGN_COMPONENTS_ACTION_WRAPPER_ID} .md-button:focus::before,
#${DESIGN_COMPONENTS_ACTION_WRAPPER_ID} .md-button:focus::after,
#${DESIGN_COMPONENTS_ACTION_WRAPPER_ID} .md-button:active::before,
#${DESIGN_COMPONENTS_ACTION_WRAPPER_ID} .md-button:active::after{
  box-shadow:none !important;border-color:transparent !important;
}
#${DESIGN_COMPONENTS_ACTION_WRAPPER_ID} .md-button .md-ripple-container,
#${DESIGN_COMPONENTS_ACTION_WRAPPER_ID} .md-button .md-ripple{
  background:transparent !important;
  box-shadow:var(--button-hover-shadow,0 0 0 1px #6b7280) !important;
}
@media(max-width:520px){
  #${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-body{grid-template-columns:1fr;}
  #${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-col-details{
    border-right:none;border-bottom:1px solid #e3ebf3;padding-right:0;padding-bottom:12px;
  }
  #${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-footer{flex-direction:column;align-items:stretch;}
  #${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-actions{justify-content:flex-end;}
}
`
```

- [ ] **Step 3: Add `FORMAT_OPTION_FIELDS` after the CSS constants**

```typescript
export const FORMAT_OPTION_FIELDS: Partial<Record<DerivativeOutputType, FormatOptionField[]>> = {
  step: [
    {
      key: 'applicationProtocol',
      label: 'Protocol',
      options: [
        { value: '203', label: 'AP203 – Surfaces & wireframe' },
        { value: '214', label: 'AP214 – 3D mechanical (default)' },
        { value: '242', label: 'AP242 – With PMI / GD&T' }
      ],
      defaultValue: '214'
    }
  ],
  stl: [
    {
      key: 'exportFileStructure',
      label: 'File structure',
      options: [
        { value: 'single', label: 'Single file (default)' },
        { value: 'multiple', label: 'Multiple files' }
      ],
      defaultValue: 'single'
    },
    {
      key: 'unit',
      label: 'Unit',
      options: [
        { value: 'mm', label: 'Millimetres (default)' },
        { value: 'cm', label: 'Centimetres' },
        { value: 'meter', label: 'Metres' },
        { value: 'inch', label: 'Inches' },
        { value: 'foot', label: 'Feet' }
      ],
      defaultValue: 'mm'
    }
  ],
  obj: [
    {
      key: 'exportFileStructure',
      label: 'File structure',
      options: [
        { value: 'single', label: 'Single file (default)' },
        { value: 'multiple', label: 'Multiple files' }
      ],
      defaultValue: 'single'
    },
    {
      key: 'unit',
      label: 'Unit',
      options: [
        { value: 'mm', label: 'Millimetres (default)' },
        { value: 'cm', label: 'Centimetres' },
        { value: 'meter', label: 'Metres' },
        { value: 'inch', label: 'Inches' },
        { value: 'foot', label: 'Feet' }
      ],
      defaultValue: 'mm'
    }
  ],
  thumbnail: [
    {
      key: 'width',
      label: 'Width',
      options: [
        { value: '100', label: '100 px' },
        { value: '200', label: '200 px' },
        { value: '400', label: '400 px (default)' }
      ],
      defaultValue: '400'
    },
    {
      key: 'height',
      label: 'Height',
      options: [
        { value: '100', label: '100 px' },
        { value: '200', label: '200 px' },
        { value: '400', label: '400 px (default)' }
      ],
      defaultValue: '400'
    }
  ]
}
```

- [ ] **Step 4: Run existing tests to make sure nothing broke**

```
npx vitest run
```

Expected: all tests pass (no modal or constants tests exist; CSS change is inert to tests).

- [ ] **Step 5: Commit**

```
git add src/features/design/components/components.constants.ts
git commit -m "feat(design-components): rewrite modal CSS to BOM theme; add FORMAT_OPTION_FIELDS"
```

---

## Task 3: Background — buildOutputFormat accepts advancedOptions

**Files:**
- Modify: `src/background/plm.autodeskDeveloper.ts`

- [ ] **Step 1: Replace `buildOutputFormat` with version that accepts `advancedOptions`**

Find the existing `buildOutputFormat` function and replace it:

```typescript
function buildOutputFormat(outputType: OutputType, advancedOptions?: Record<string, string>): Record<string, unknown> {
  if (outputType === 'svf')  return { type: 'svf',  views: ['2d', '3d'] }
  if (outputType === 'svf2') return { type: 'svf2', views: ['2d', '3d'] }
  const adv = advancedOptions && Object.keys(advancedOptions).length > 0 ? advancedOptions : undefined
  if (outputType === 'step' && !adv) return { type: 'step', advanced: { applicationProtocol: '214' } }
  return adv ? { type: outputType, advanced: adv } : { type: outputType }
}
```

- [ ] **Step 2: Update `submitModelDerivativeJob` to extract and pass `advancedOptions`**

In `submitModelDerivativeJob`, after the line that reads `outputType`, add:

```typescript
const advancedOptions =
  payload.advancedOptions && typeof payload.advancedOptions === 'object'
    ? (payload.advancedOptions as Record<string, string>)
    : undefined
```

Then update the `buildOutputFormat` call:

```typescript
output: { formats: [buildOutputFormat(outputType, advancedOptions)] }
```

- [ ] **Step 3: Run tests**

```
npx vitest run
```

Expected: all tests pass (workflow tests mock at the `requestPlmAction` level; no behaviour change for existing callers).

- [ ] **Step 4: Commit**

```
git add src/background/plm.autodeskDeveloper.ts
git commit -m "feat(design-components): buildOutputFormat accepts advancedOptions from job payload"
```

---

## Task 4: API + workflow — thread advancedOptions and filenameOverride

**Files:**
- Modify: `src/features/design/components/components.api.ts`
- Modify: `src/features/design/components/components.conversion.workflow.ts`

- [ ] **Step 1: Add optional `advancedOptions` to `submitConversionJob` in `components.api.ts`**

Replace the existing signature:

```typescript
export async function submitConversionJob(
  runtime: DesignComponentsRuntime,
  encodedDesignUrn: string,
  outputType: DerivativeOutputType,
  advancedOptions?: Record<string, string>
): Promise<unknown> {
  return runtime.requestPlmAction('submitModelDerivativeJob', {
    urn: encodedDesignUrn,
    outputType,
    ...(advancedOptions ? { advancedOptions } : {})
  })
}
```

- [ ] **Step 2: Add `advancedOptions` and `filenameOverride` to the `params` object of `runModelDerivativeConversionWorkflow` in `components.conversion.workflow.ts`**

Update the function signature (params type only — add two optional fields):

```typescript
export async function runModelDerivativeConversionWorkflow(params: {
  runtime: DesignComponentsRuntime
  encodedDesignUrn: string
  outputFormat: DerivativeOutputType
  designBaseName: string
  signal: AbortSignal
  callbacks: ConversionWorkflowCallbacks
  advancedOptions?: Record<string, string>
  filenameOverride?: string
}): Promise<void> {
  const { runtime, encodedDesignUrn, outputFormat, designBaseName, signal, callbacks, advancedOptions, filenameOverride } = params
```

- [ ] **Step 3: Pass `advancedOptions` to `submitConversionJob` in the workflow body**

Find the line:
```typescript
await submitConversionJob(runtime, encodedDesignUrn, outputFormat)
```
Replace with:
```typescript
await submitConversionJob(runtime, encodedDesignUrn, outputFormat, advancedOptions)
```

- [ ] **Step 4: Update `finalizeWithDownload` to accept and use `filenameOverride`**

Add `filenameOverride?: string` to the `params` object of `finalizeWithDownload`:

```typescript
async function finalizeWithDownload(params: {
  runtime: DesignComponentsRuntime
  encodedDesignUrn: string
  outputFormat: DerivativeOutputType
  designBaseName: string
  derivative: ManifestNode
  callbacks: ConversionWorkflowCallbacks
  filenameOverride?: string
}): Promise<void> {
  const { runtime, encodedDesignUrn, outputFormat, designBaseName, derivative, callbacks, filenameOverride } = params
```

Then update the `callbacks.downloadFile` call inside `finalizeWithDownload`:

```typescript
callbacks.downloadFile({
  base64: file.base64,
  contentType: file.contentType,
  filename: filenameOverride?.trim() || derivativeDownloadFilename(designBaseName, outputFormat)
})
```

- [ ] **Step 5: Pass `filenameOverride` from `runModelDerivativeConversionWorkflow` to `finalizeWithDownload`**

Find the `finalizeWithDownload(...)` call near the bottom of `runModelDerivativeConversionWorkflow` and add `filenameOverride`:

```typescript
await finalizeWithDownload({ runtime, encodedDesignUrn, outputFormat, designBaseName, derivative, callbacks, filenameOverride })
```

- [ ] **Step 6: Run tests**

```
npx vitest run
```

Expected: all tests pass — `advancedOptions` and `filenameOverride` are optional, existing test calls are unchanged.

- [ ] **Step 7: Commit**

```
git add src/features/design/components/components.api.ts src/features/design/components/components.conversion.workflow.ts
git commit -m "feat(design-components): thread advancedOptions and filenameOverride through workflow"
```

---

## Task 5: Modal — full DOM rewrite

**Files:**
- Modify: `src/features/design/components/components.modal.ts`

Replace the entire file content with the following:

- [ ] **Step 1: Write the new `components.modal.ts`**

```typescript
import { DESIGN_COMPONENTS_MODAL_ID } from './components.constants'
import type { ConversionState, DesignItemDetails, FormatOptionField, OutputFormatOption } from './components.types'

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
  getAdvancedOptions: () => Record<string, string>
  getFilename: () => string
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

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls?: string,
  text?: string
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  if (text != null) e.textContent = text
  return e
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
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: contentType })
}

function makeSection(title: string): { section: HTMLDivElement; fieldsWrap: HTMLDivElement } {
  const section = el('div', 'plm-ext-dc-section')
  section.appendChild(el('p', 'plm-ext-dc-section-title', title))
  section.appendChild(el('hr', 'plm-ext-dc-divider'))
  const fieldsWrap = el('div')
  section.appendChild(fieldsWrap)
  return { section, fieldsWrap }
}

function renderOptionFields(container: HTMLElement, fields: FormatOptionField[]): void {
  container.replaceChildren()
  for (const field of fields) {
    const wrap = el('div', 'plm-ext-dc-option-field')
    wrap.appendChild(el('label', 'plm-ext-dc-label', field.label))
    const select = el('select', 'plm-ext-dc-select')
    select.dataset.key = field.key
    for (const opt of field.options) {
      const o = el('option')
      o.value = opt.value
      o.textContent = opt.label
      if (opt.value === field.defaultValue) o.selected = true
      select.appendChild(o)
    }
    wrap.appendChild(select)
    container.appendChild(wrap)
  }
}

const EXT_MAP: Record<string, string> = {
  step: 'step', stl: 'stl', iges: 'iges', obj: 'obj',
  dwg: 'dwg', pdf: 'pdf', fbx: 'fbx', thumbnail: 'png', svf: 'svf', svf2: 'svf2'
}

export function openConversionModal(): ConversionModalApi {
  removeConversionModal()

  const abortController = new AbortController()
  activeModalAbort = abortController

  const overlay = document.createElement('div')
  overlay.id = DESIGN_COMPONENTS_MODAL_ID

  // Shell
  const shell = el('div', 'plm-ext-dc-shell')

  // Header
  const header = el('div', 'plm-ext-dc-header')
  const headerCopy = el('div', 'plm-ext-dc-header-copy')
  headerCopy.appendChild(el('h3', 'plm-ext-dc-title', 'Model Derivative Conversion'))
  headerCopy.appendChild(el('p', 'plm-ext-dc-subtitle', 'Convert your design to another file format.'))
  const closeBtn = el('button', 'plm-ext-dc-close')
  closeBtn.type = 'button'
  closeBtn.setAttribute('aria-label', 'Close')
  closeBtn.textContent = '×'
  header.appendChild(headerCopy)
  header.appendChild(closeBtn)

  // Body columns
  const body = el('div', 'plm-ext-dc-body')
  const colDetails = el('div', 'plm-ext-dc-col-details')
  const colRight = el('div', 'plm-ext-dc-col-right')

  // Format section
  const { section: fmtSection, fieldsWrap: formatWrap } = makeSection('Output Format')
  formatWrap.className = 'plm-ext-dc-format-wrap'

  // Options section (hidden until a format with fields is selected)
  const { section: optSection, fieldsWrap: optFieldsWrap } = makeSection('Format Options')
  optSection.hidden = true

  // Filename section
  const { section: fnSection } = makeSection('Output File')
  const autoToggle = el('label', 'plm-ext-dc-toggle')
  const autoCheck = el('input')
  autoCheck.type = 'checkbox'
  autoCheck.checked = true
  autoToggle.appendChild(autoCheck)
  autoToggle.appendChild(document.createTextNode('Auto-generate filename'))
  const filenameInput = el('input', 'plm-ext-dc-input')
  filenameInput.type = 'text'
  filenameInput.placeholder = 'Auto-generated'
  filenameInput.disabled = true
  fnSection.appendChild(autoToggle)
  fnSection.appendChild(filenameInput)

  autoCheck.addEventListener('change', () => {
    filenameInput.disabled = autoCheck.checked
    if (!autoCheck.checked) filenameInput.focus()
  })

  colRight.appendChild(fmtSection)
  colRight.appendChild(optSection)
  colRight.appendChild(fnSection)
  body.appendChild(colDetails)
  body.appendChild(colRight)

  // Footer
  const footer = el('div', 'plm-ext-dc-footer')

  const progressPanel = el('div', 'plm-ext-dc-progress-panel')
  progressPanel.hidden = true
  const progressHeader = el('div', 'plm-ext-dc-progress-header')
  const statusText = el('span', '', '')
  const statusPct = el('span', '', '')
  progressHeader.appendChild(statusText)
  progressHeader.appendChild(statusPct)
  const progressTrack = el('div', 'plm-ext-dc-progress-track')
  const progressFill = el('span', 'plm-ext-dc-progress-fill')
  progressTrack.appendChild(progressFill)
  progressPanel.appendChild(progressHeader)
  progressPanel.appendChild(progressTrack)

  const actions = el('div', 'plm-ext-dc-actions')
  const cancelBtn = el('button', 'plm-ext-dc-btn-secondary', 'Cancel')
  cancelBtn.type = 'button'
  const convertBtn = el('button', 'plm-ext-dc-btn-primary', 'Convert →')
  convertBtn.type = 'button'
  convertBtn.disabled = true
  actions.appendChild(cancelBtn)
  actions.appendChild(convertBtn)

  footer.appendChild(progressPanel)
  footer.appendChild(actions)

  shell.appendChild(header)
  shell.appendChild(body)
  shell.appendChild(footer)
  overlay.appendChild(shell)
  document.body.appendChild(overlay)

  const close = (): void => {
    abortController.abort()
    detachModalDom()
    if (activeModalAbort === abortController) activeModalAbort = null
  }

  closeBtn.addEventListener('click', close)
  cancelBtn.addEventListener('click', close)
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close() })

  function updateStatus(text: string, pct?: number | null): void {
    statusText.textContent = text
    statusPct.textContent = pct != null ? `${Math.round(pct * 100)}%` : ''
  }

  function getSelectedFormat(): string {
    return formatWrap.querySelector<HTMLInputElement>('input[type="radio"]:checked')?.value ?? ''
  }

  function syncOptionsSection(fields: FormatOptionField[] | undefined): void {
    if (fields && fields.length > 0) {
      renderOptionFields(optFieldsWrap, fields)
      optSection.hidden = false
    } else {
      optSection.hidden = true
      optFieldsWrap.replaceChildren()
    }
  }

  function syncFilenamePlaceholder(format: string): void {
    const ext = EXT_MAP[format] ?? format
    filenameInput.placeholder = `Auto-generated (.${ext})`
  }

  return {
    abortSignal: abortController.signal,

    onConvert(handler) {
      convertBtn.onclick = () => handler()
    },

    getSelectedFormat,

    getAdvancedOptions() {
      const result: Record<string, string> = {}
      for (const sel of optFieldsWrap.querySelectorAll<HTMLSelectElement>('select[data-key]')) {
        if (sel.dataset.key) result[sel.dataset.key] = sel.value
      }
      return result
    },

    getFilename() {
      return autoCheck.checked ? '' : filenameInput.value.trim()
    },

    renderSourceLoading() {
      colDetails.replaceChildren(Object.assign(el('p', 'plm-ext-dc-muted', 'Loading design details…')))
      formatWrap.replaceChildren()
      optSection.hidden = true
      optFieldsWrap.replaceChildren()
      convertBtn.disabled = true
      progressPanel.hidden = true
      updateStatus('')
    },

    renderDesignDetails(details) {
      colDetails.replaceChildren()

      const rows: [string, string | null][] = [
        ['Name',      details.name],
        ['Extension', details.extensionType ? details.extensionType.toUpperCase() : null],
        ['Size',      details.size ? formatFileSize(details.size) : null]
      ]
      for (const [label, value] of rows) {
        if (!value) continue
        const block = el('div', 'plm-ext-dc-detail-block')
        block.appendChild(el('p', 'plm-ext-dc-detail-label', label))
        block.appendChild(el('p', 'plm-ext-dc-detail-value', value))
        colDetails.appendChild(block)
      }
      if (details.fusionWebUrl) {
        const block = el('div', 'plm-ext-dc-detail-block')
        block.appendChild(el('p', 'plm-ext-dc-detail-label', 'Link'))
        const link = el('a', 'plm-ext-dc-detail-value', 'Open in Fusion')
        link.href = details.fusionWebUrl
        link.target = '_blank'
        link.rel = 'noopener noreferrer'
        block.appendChild(link)
        colDetails.appendChild(block)
      }
    },

    renderFormatList(options) {
      formatWrap.replaceChildren()
      convertBtn.disabled = true
      updateStatus('')

      if (options.length === 0) {
        formatWrap.appendChild(el('p', 'plm-ext-dc-muted', 'No supported output formats for this file type.'))
        optSection.hidden = true
        return
      }

      const groupName = `plm-ext-dc-fmt-${Date.now()}`
      const fieldsByFormat = new Map(options.map((o) => [o.value, o.fields]))

      options.forEach((opt, i) => {
        const card = el('label', 'plm-ext-dc-format-card')
        const radio = el('input')
        radio.type = 'radio'
        radio.name = groupName
        radio.value = opt.value
        if (i === 0) {
          radio.checked = true
          syncOptionsSection(opt.fields)
          syncFilenamePlaceholder(opt.value)
        }
        radio.addEventListener('change', () => {
          if (radio.checked) {
            syncOptionsSection(fieldsByFormat.get(radio.value))
            syncFilenamePlaceholder(radio.value)
          }
        })
        card.appendChild(radio)
        card.appendChild(document.createTextNode(opt.value.toUpperCase()))
        formatWrap.appendChild(card)
      })

      convertBtn.disabled = false
    },

    renderSourceError(error) {
      colDetails.replaceChildren(Object.assign(el('p', 'plm-ext-dc-err', 'Unable to load design details.')))
      formatWrap.replaceChildren()
      optSection.hidden = true
      updateStatus(error instanceof Error ? error.message : String(error))
      convertBtn.disabled = true
      progressPanel.hidden = true
    },

    renderState(state) {
      updateStatus(state.message)
    },

    renderError(error) {
      updateStatus(error instanceof Error ? error.message : String(error))
      progressPanel.hidden = true
    },

    setConvertDisabled(disabled) {
      convertBtn.disabled = disabled
    },

    setConversionProgress(ratio, text) {
      progressPanel.hidden = false
      updateStatus(text, ratio)
      progressFill.style.width = ratio === null ? '100%' : `${Math.round(Math.min(100, Math.max(0, ratio * 100)))}%`
    },

    setConversionProgressVisible(visible) {
      progressPanel.hidden = !visible
    },

    downloadDerivativeFile(params) {
      const blob = base64ToBlob(params.base64, params.contentType)
      const url = URL.createObjectURL(blob)
      const anchor = el('a')
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

- [ ] **Step 2: Run tests**

```
npx vitest run
```

Expected: all tests pass (modal has no unit tests; view tests are not present).

- [ ] **Step 3: Commit**

```
git add src/features/design/components/components.modal.ts
git commit -m "feat(design-components): redesign conversion modal with BOM theme, format options, filename field"
```

---

## Task 6: View — wire advanced options + filename; build

**Files:**
- Modify: `src/features/design/components/components.view.ts`

- [ ] **Step 1: Import `FORMAT_OPTION_FIELDS` in `components.view.ts`**

Add to the existing imports from `./components.constants`:

```typescript
import {
  DESIGN_COMPONENTS_ACTION_WRAPPER_ID,
  DESIGN_COMPONENTS_ICON_CLASS,
  FORMAT_OPTION_FIELDS
} from './components.constants'
```

- [ ] **Step 2: Attach format option fields before passing to `wireConversionWorkflow`**

In `wireConversionWorkflow`, change the first line from:

```typescript
modal.renderFormatList(formatOptions)
```

to:

```typescript
modal.renderFormatList(formatOptions.map((opt) => ({
  ...opt,
  fields: FORMAT_OPTION_FIELDS[opt.value]
})))
```

- [ ] **Step 3: Read `advancedOptions` and `filenameOverride` from the modal on convert**

In `wireConversionWorkflow`, inside the `modal.onConvert` callback, after the line:

```typescript
const source = await resolveDesignSourceForItem(runtime, window.location.href)
```

Add:

```typescript
const advancedOptions = modal.getAdvancedOptions()
const filenameOverride = modal.getFilename()
```

Then update the `runModelDerivativeConversionWorkflow` call to include these two params:

```typescript
await runModelDerivativeConversionWorkflow({
  runtime,
  encodedDesignUrn: source.encodedDesignUrn,
  outputFormat: selectedFormat,
  designBaseName: source.designName || source.resourceName || 'design',
  signal: modal.abortSignal,
  advancedOptions: Object.keys(advancedOptions).length > 0 ? advancedOptions : undefined,
  filenameOverride: filenameOverride || undefined,
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
```

- [ ] **Step 4: Run tests**

```
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 5: Build the extension**

```
node scripts/build.mjs
```

Expected: build completes with no errors.

- [ ] **Step 6: Commit**

```
git add src/features/design/components/components.view.ts
git commit -m "feat(design-components): wire FORMAT_OPTION_FIELDS, advancedOptions, and filenameOverride to conversion workflow"
```

---

## Smoke test checklist (manual)

After building:
- [ ] Open a Fusion-linked item in Fusion Manage
- [ ] Click Design → Convert — modal opens with BOM-style header, two-column layout, `#149cd8` primary colour
- [ ] Loading state shows "Loading design details…" in left column
- [ ] After load: Source column shows Name / Extension / Size / Link; Format cards appear in right column
- [ ] Select STEP — "Format Options" section appears with Protocol select (AP214 default)
- [ ] Select PDF — Format Options section disappears
- [ ] Select STL — Format Options shows File structure + Unit selects
- [ ] Auto-generate filename is checked by default; input is disabled
- [ ] Uncheck Auto-generate — input becomes enabled and focusable
- [ ] Click Convert with STEP selected — progress bar fills with gradient, status text updates
- [ ] On success: progress panel hides, status shows success message
- [ ] Click × or Cancel — modal closes
