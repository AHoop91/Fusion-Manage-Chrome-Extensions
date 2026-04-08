# Tableau Export / Import / Manage — Design Spec

**Date:** 2026-04-07 (updated 2026-04-08)
**Branch:** feature/tabeleus
**Status:** Implemented

---

## Overview

A Chrome extension feature that injects a gear icon dropdown into the Fusion Manage views-switcher header. The dropdown provides three actions: **Manage Views**, **Import Views**, and **Export Views**. Views (tableaus) can be exported to a compressed portable `.plmview` file and re-imported into the same or a different tenant/workspace.

---

## Activation

Mounts on two URL patterns (any workspace ID):

| Pattern | Condition |
|---|---|
| `/plm/workspaces/{wsId}/items` | No sub-path — plain items list |
| `/plm/workspaces/{wsId}/items/itemDetails` | Query param `view=split` must be present |

The workspace ID (`wsId`) and tenant name are extracted from the URL at runtime and used for all API calls.

---

## Architecture

Feature slice at `src/features/tableaus/`, parallel to `grid/`, `bom/`, and `item-details/`. No dependency on any other feature.

Registered as a lazy-loaded entry in `src/app/itemPagesBootstrap.ts`, building into its own chunk.

---

## File Structure

```
src/features/tableaus/
  index.ts
  tableaus.feature.ts            # PageModule factory, URL matching
  tableaus.controller.ts         # Composition root, lifecycle
  tableaus.types.ts              # TableauExport, TableauListResponse, etc.
  tableaus.constants.ts          # COMPRESS_EXPORT flag
  services/
    tableaus.service.ts          # URL matching helpers, wsId/tenant extraction
    tableaus.api.ts              # Wrappers over requestPlmAction
    schema.ts                    # parseTableauExport() type guard + extractWsIdFromSelf
  view/
    tableaus.view.ts             # MutationObserver, gear button, dropdown menu
    export/
      exportDialog.ts            # Multi-select modal, progress bar, compressed download
    import/
      importDialog.ts            # Table UI, conflict detection, staged save, progress
    manage/
      manageDialog.ts            # Staged bulk delete with at-least-one guard
  __tests__/
    schema.test.ts
    export.utils.test.ts
    importUtils.test.ts

src/background/
  plm.tableau.ts                 # getTableauList, getTableau, createTableau, updateTableau, deleteTableau

src/shared/utils/
  export.ts                      # downloadJson, compressToBase64, decompressFromBase64
```

### Modified files

| File | Change |
|---|---|
| `src/app/itemPagesBootstrap.ts` | Add tableaus loader |
| `src/background/plm.ts` | Re-export all 5 tableau actions |
| `src/background/plmActionAllowlist.ts` | Add 5 actions to `item-page` scope |
| `src/background/index.ts` | Relax `ITEM_PAGE_PATH_RE` to match `/items` without sub-path |

---

## UI Injection

A `MutationObserver` on `document.body` watches for `.views-switcher-flyout__panel-container`. When it appears, a single gear button is injected into `.views-switcher-content--header`. When it disappears, injected state is cleaned up.

**Gear button:** 24×30px, `#f3f3f3` background, `margin-left:5px`. Turns `#0696d7` when the menu is open.

**Dropdown menu** (fixed position, closes on outside click):
1. Manage Views
2. Import Views
3. Export Views

Each item has a prefixed SVG icon. Clicking an item closes the menu and opens the corresponding dialog.

---

## File Format — `.plmview`

Exported files use the `.plmview` extension. The file contains a JSON-serialised, gzip-compressed, base64-encoded string (the base64 string is then wrapped in `JSON.stringify` so the file starts with `"`).

**Cross-tenant portability:** Before encoding, all occurrences of the source workspace ID and tenant name are replaced with portable placeholders:

| Original | Placeholder |
|---|---|
| `/workspaces/{wsId}/` | `/workspaces/{WS_ID}/` |
| `:{TENANT}.{wsId}.` | `:{TENANT}.{WS_ID}.` |

On import, placeholders are restored with the target environment's tenant and workspace ID before validation or API calls.

---

## Export Flow

1. User clicks **Export Views** from the dropdown.
2. A modal dialog appears listing all non-deleted views with checkboxes.
3. **Select All / Deselect All** toggle above the list.
4. User selects one or more views and clicks **Export Selected**.
5. Views are fetched in parallel batches of 5 via `getTableau`. A progress bar shows "Fetching N of M…".
6. `owner` is stripped from each response. Cross-tenant placeholders are substituted.
7. Payload is gzip+base64 compressed and downloaded:
   - Single view: `{title}.plmview`
   - Multiple views: `tableaus-export-ws{wsId}.plmview`
8. If any fetches fail, the Export button turns red showing **Retry failed (N)**.

---

## Import Flow

1. User clicks **Import Views** → hidden `<input type="file" accept=".plmview">` is triggered.
2. File is read as text, `JSON.parse`d to unwrap the base64 string, decompressed, cross-tenant placeholders restored.
3. Each item is validated with `parseTableauExport()`.
4. On validation failure → error dialog, abort.
5. `fetchTableauList` is called to build:
   - `existingTitles: Set<string>` (lowercase)
   - `existingMap: Map<string, tableauId>` (lowercase title → ID)

### Import dialog (table UI)

Columns: **View Name** | **Status** | **Actions** | **Result**

- **Status pill:** Green "New" if the name is not taken; amber "Overwrite" if a matching title exists on the server.
- Intra-batch duplicates are auto-resolved by appending `(1)`, `(2)`, etc.
- **Actions — Rename:** Inline input with Confirm/Cancel and validation:
  - Empty name blocked.
  - Name already used by another row in the batch blocked.
  - Renaming to an existing server name is allowed (switches pill to Overwrite).
- **Save button:** Saves all rows sequentially. All Rename buttons are disabled immediately on click.
- **Result column:** ✓ (green) or ✕ (red with hover tooltip showing the error message).
- **Progress bar** shows "Saving N of M…".
- After all rows: summary shown ("X saved, Y failed" or "All N saved successfully"). Save button is disabled and faded.
- **Close / overlay click:** Reloads the page if any saves completed.

### Payload transformation (create / update)

Applied to every imported view before the API call:

**`stripFieldObject(field)`** — removes `value`, `uomConverted`, `formulaField`, `defaultValue`; reduces `type` to `{ link }` only.

**`stripColumn(col)`** — removes `appliedFilters`, `originalElement`; sets `visible: true`; wraps cleaned column in `originalElement`; passes through `displayOrder` and `sort`.

**`stripDefaults(body)`** — removes `showOnlyDeletedRecords` when falsy, `description` when empty; applies `stripColumn` to every column.

**POST (create):** Strips `__self__`, `urn`, `createdDate` (source), `modifiedDate`, `owner`. Keeps `workspace`. Adds `createdDate: new Date().toISOString()`.

**PUT (update):** Same stripping, plus removes `workspace`.

---

## Manage Views Flow

1. User clicks **Manage Views** from the dropdown.
2. A modal dialog loads all non-deleted views from `fetchTableauList`.
3. Columns: **View Name** | **Status** | **Actions** | **Result**
4. Each row has a **Delete** button (with trash icon). Clicking it stages the view (red "Delete" pill, button becomes **Undo**).
5. Footer shows count of staged views and a red **Delete (N)** button.
6. **Guard:** If all views are staged, the Delete button is disabled and a warning appears: *"At least one view must remain — unmark a view to continue."*
7. Clicking **Delete (N):** All staged view buttons and the Delete button are disabled. Views are deleted sequentially via `deleteTableau`.
8. **Result column:** ✓ (green, name struck through) or ✕ (red, hover tooltip with error).
9. **Progress bar** shows "Deleting N of M…".
10. After completion: summary shown. **Close** button reloads the page if any deletions succeeded.

---

## Validation Schema (`schema.ts`)

`parseTableauExport(data: unknown): TableauExport` — throws `ValidationError` on failure. Does not mutate the input.

| Field | Rule |
|---|---|
| `__self__` | `string` matching `/\/api\/v3\/workspaces\/\d+\/tableaus\/\d+/` |
| `name` / `title` | Prefers `title` (display name); falls back to `name`. Must be non-empty. |
| `columns` | Non-empty array |
| `columns[n].field.__self__` | Non-empty string |
| `columns[n].displayOrder` | Number, numeric string (coerced), or missing (falls back to column index) |

---

## Background API Actions

File: `src/background/plm.tableau.ts`

| Action | Method | Endpoint | Headers |
|---|---|---|---|
| `getTableauList` | GET | `/api/v3/workspaces/{wsId}/tableaus` | `Accept: application/json` |
| `getTableau` | GET | `/api/v3/workspaces/{wsId}/tableaus/{tableauId}` | `Accept: application/vnd.autodesk.plm.meta+json` |
| `createTableau` | POST | `/api/v3/workspaces/{wsId}/tableaus` | `Content-Type: application/vnd.autodesk.plm.meta+json` |
| `updateTableau` | PUT | `/api/v3/workspaces/{wsId}/tableaus/{tableauId}` | `Content-Type: application/vnd.autodesk.plm.meta+json` |
| `deleteTableau` | DELETE | `/api/v3/workspaces/{wsId}/tableaus/{tableauId}` | — |

All five registered in `plmActionAllowlist.ts` under `item-page` scope.

---

## Shared Utilities (`src/shared/utils/export.ts`)

| Export | Description |
|---|---|
| `downloadJson(filename, data)` | Serialises `data` with `JSON.stringify` and triggers a browser download |
| `compressToBase64(data)` | Gzip-compresses then base64-encodes any JSON-serialisable value (chunked btoa to avoid stack overflow) |
| `decompressFromBase64(encoded)` | Reverses `compressToBase64` |

---

## Testing

| File | Coverage |
|---|---|
| `schema.test.ts` | `parseTableauExport` — valid input, each invalid field, `title` fallback, immutability, `extractWsIdFromSelf` |
| `export.utils.test.ts` | `compressToBase64` / `decompressFromBase64` round-trips including file-format round-trip, unicode, compression ratio |
| `importUtils.test.ts` | `resolveUniqueName`, `stripFieldObject`, `stripColumn`, `stripDefaults` |

---

## Boundaries

- No dependency on `grid/`, `bom/`, or `item-details/` features.
- No direct `chrome.*` access — all API calls go through `requestPlmAction`.
- All dialogs are plain DOM (no React/framework dependency).
