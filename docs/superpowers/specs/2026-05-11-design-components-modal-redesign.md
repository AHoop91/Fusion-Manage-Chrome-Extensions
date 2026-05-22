# Design Components Modal Redesign

## Goal

Redesign the Model Derivative Conversion modal to match the BOM downloader visual theme, add per-format advanced options (STEP protocol, STL/OBJ unit/structure, thumbnail size), and add a filename field with an auto-generate toggle.

## Visual Design

### Design tokens (matched exactly from BOM downloader)

| Token | Value |
|-------|-------|
| Font | `"ArtifaktElement","Segoe UI",Arial,sans-serif` via `--plm-dc-font-sans` |
| Overlay background | `rgba(15,23,42,.32)` |
| Modal border | `1px solid #dde6ef` |
| Modal border-radius | `16px` |
| Modal box-shadow | `0 24px 48px rgba(15,23,42,.20)` |
| Modal padding | `26px 28px 22px` |
| Title | `700 21px/1.15`, `#142435` |
| Subtitle / description | `400 12.5px/1.4`, `#51606f` |
| Section title | `700 12.5px/1.2`, `#1c3348` |
| Section divider | `border-bottom: 1px solid #e3ebf3` |
| Field label | `600 11.5px/1.2`, `#24374a` |
| Input / select | `min-height:34px`, `border:1px solid #c8d4e0`, `border-radius:8px`, `padding:7px 10px`, `400 12.5px/1.3`, `#132131` |
| Input focus | `border-color:#149cd8`, `box-shadow:0 0 0 3px rgba(20,156,216,.16)` |
| Format card default | `min-height:40px`, `border:1px solid #d4e0eb`, `border-radius:8px`, `background:#f9fbfe`, `600 12px/1.2`, `#24374a` |
| Format card checked | `border-color:#8ec9e7`, `background:#eef8fd`, `box-shadow:0 0 0 1px rgba(20,156,216,.08)` |
| Progress track | `height:14px`, `border-radius:3px`, `background:#deebf5` |
| Progress fill | `linear-gradient(90deg,#149cd8 0%,#3cb5e6 100%)`, `transition:width .18s ease` |
| Primary button | `background:#149cd8`, `border:1px solid #149cd8`, `color:#fff`, `min-height:34px`, `border-radius:8px`, `600 12px/1` |
| Secondary button | `background:#fff`, `border:1px solid #ccd7e2`, `color:#203246` |
| Disabled buttons | `opacity:.55`, `cursor:not-allowed` |
| Accent (checkbox/radio) | `accent-color:#149cd8` |
| Footer border | `border-top:1px solid #e0e8f1`, `padding-top:12px` |
| Help / muted text | `400 11px/1.35`, `#697888` |
| Error text | `#b42318` |

### Layout structure

```
overlay  (fixed inset:0, flex center, z-index max, rgba(15,23,42,.32))
└── modal-shell  (flex-col, gap:14px, padding:26px 28px 22px, max-width:min(660px,92vw),
                  border-radius:16px, border:1px solid #dde6ef, bg:#fff, shadow)
    ├── header  (flex, align-items:flex-start, justify-content:space-between, gap:12px)
    │   ├── header-copy  (flex-col, gap:4px)
    │   │   ├── h3  "Model Derivative Conversion"  [title style]
    │   │   └── p   "Convert your design to another file format."  [subtitle style]
    │   └── close-btn  (×, 34×34px, border:1px solid #cfd8e3, border-radius:8px)
    ├── body  (grid 2-col: minmax(220px,0.65fr) minmax(300px,1fr), gap:18px)
    │   ├── col-details  (flex-col, gap:10px)
    │   │   ├── section-title  "Source"
    │   │   ├── divider
    │   │   └── detail-rows  (name, type, size, link)  — each: label 11.5px + value 12.5px
    │   └── col-right  (flex-col, gap:14px)
    │       ├── format-section
    │       │   ├── section-title  "Output Format"
    │       │   ├── divider
    │       │   └── format-grid  (flex wrap, gap:8px — format cards)
    │       ├── options-section  (hidden when no options; no animation needed)
    │       │   ├── section-title  "Format Options"
    │       │   ├── divider
    │       │   └── option-fields  (rendered dynamically per selected format)
    │       └── filename-section
    │           ├── section-title  "Output File"
    │           ├── divider
    │           ├── auto-toggle  (checkbox + label "Auto-generate filename")
    │           └── filename-input  (disabled when auto-generate is on)
    └── footer  (flex, align-items:flex-end, gap:10px, border-top)
        ├── progress-panel  (flex-1, flex-col, gap:8px — hidden when not converting)
        │   ├── progress-header  (status text left, "67%" right)
        │   └── progress-track → progress-fill
        └── actions  (flex, gap:10px)
            ├── secondary-btn  "Cancel"
            └── primary-btn   "Convert →"
```

### Format cards

Format cards use a `<label>` wrapping a hidden `<input type="radio">`. They are displayed as flex-wrap cards (not a fixed grid) so they wrap naturally on narrow widths. The extension name is shown in uppercase bold (e.g. **STEP**, **PDF**). Checked state uses the BOM card checked tokens above.

---

## Format Advanced Options

Options are defined in `components.constants.ts` as a `FORMAT_OPTION_FIELDS` map. Each format maps to zero or more `FormatOptionField` objects. Fields of type `'select'` render as `<select>` inputs.

| Format | Fields |
|--------|--------|
| STEP | `applicationProtocol`: AP203 / AP214 (default) / AP242 |
| STL | `exportFileStructure`: Single file / Multiple files; `unit`: mm (default) / cm / m / inch / foot |
| OBJ | `exportFileStructure`: Single file / Multiple files; `unit`: mm (default) / cm / m / inch / foot |
| IGES | *(no user-facing options)* |
| Thumbnail | `width`: 100 / 200 / 400 (default); `height`: 100 / 200 / 400 (default) |
| PDF, DWG, FBX, SVF, SVF2 | *(no user-facing options)* |

When a format with no options is selected, the options section is hidden entirely.

---

## Filename Auto-Generate

- **Auto-generate on (default):** filename input is disabled and displays the derived name as placeholder: `{designBaseName}_{format}.{ext}`
  - Extension mapping: `step→stp`, `iges→igs`, `thumbnail→png`, others match format name
- **Auto-generate off:** filename input is enabled; user types a custom name (no extension forced)
- `getFilename()` returns the custom name when auto-generate is off, or `''` when on (controller derives the name using `derivativeDownloadFilename`)

---

## API changes

`buildOutputFormat` in `plm.autodeskDeveloper.ts` currently hardcodes `applicationProtocol:'214'` for STEP. It will be extended to accept an optional `advancedOptions: Record<string,string>` parameter and merge them into the `advanced` object for the format.

```typescript
// Before
function buildOutputFormat(outputType: OutputType): Record<string, unknown>

// After
function buildOutputFormat(
  outputType: OutputType,
  advancedOptions?: Record<string, string>
): Record<string, unknown>
```

`submitConversionJob` in `components.api.ts` gains an optional `advancedOptions` param passed through to `buildOutputFormat`.

---

## Files changed

| File | Change |
|------|--------|
| `src/features/design/components/components.types.ts` | Add `FormatOptionField` type; extend `OutputFormatOption` with `fields?: FormatOptionField[]` |
| `src/features/design/components/components.constants.ts` | Full CSS rewrite for modal (BOM theme); add `FORMAT_OPTION_FIELDS` map |
| `src/features/design/components/components.modal.ts` | New DOM structure; update `ConversionModalApi` — add `getAdvancedOptions()`, `getFilename()`; internal options-panel rendering on format selection |
| `src/features/design/components/components.api.ts` | `submitConversionJob` accepts optional `advancedOptions` |
| `src/features/design/components/components.feature.ts` | Pass `FORMAT_OPTION_FIELDS[format]` when building format list; read `getAdvancedOptions()` + `getFilename()` on convert |
| `src/background/plm.autodeskDeveloper.ts` | `buildOutputFormat` accepts `advancedOptions`; remove hardcoded `applicationProtocol` |

---

## Modal API delta

```typescript
// New additions to ConversionModalApi
getAdvancedOptions: () => Record<string, string>
getFilename: () => string  // '' = auto-generate
```

All existing methods remain unchanged (`renderSourceLoading`, `renderDesignDetails`, `renderFormatList`, `renderState`, `renderError`, `renderSourceError`, `setConvertDisabled`, `setConversionProgress`, `setConversionProgressVisible`, `downloadDerivativeFile`, `close`).

`renderFormatList` receives updated `OutputFormatOption[]` where each option may include `fields`. The modal internally handles showing/hiding the options section when a card is selected.

---

## Testing

- Existing tests in `components.manifest.test.ts` and `components.conversion.workflow.test.ts` are unaffected (no workflow logic changes).
- No new unit tests required for the modal DOM (visual component, no logic to unit-test).
- Manual smoke test: open the conversion modal on a design item, verify each format's options appear/disappear correctly, verify auto-generate filename updates when format changes, verify Convert calls through correct advanced options.
