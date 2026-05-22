/**
 * Grid page feature — `createGridPageModule` is the only export consumed by the app shell.
 *
 * Folders under `grid/` are named consistently (`grid-*`):
 * - `grid-filters/` — rules panel, filtering, coordinates export UX
 * - `grid-export/` — CSV helpers and export controller wiring
 * - `grid-page/` — shared grid route parsing and table indexing
 * - `grid-services/` — page URL matching (`grid-page.service`), metadata helpers
 * - `grid-view/` — runs mounted grid capabilities (lifecycle fan-out)
 * - `grid-dom/` — spreadsheet selectors required by the page router
 * - `grid-advanced-editor/` — lazy-loaded modal/form editor (large chunk)
 */
export { createGridPageModule } from './grid.feature'