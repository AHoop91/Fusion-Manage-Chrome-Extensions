/**
 * BOM page feature — `createBomPageModule` is the export used by the app shell.
 *
 * Folders under `bom/` use a consistent `bom-*` prefix:
 * - `bom-clone/` — clone-from-BOM UI, structure/edit flows, PLM integration
 * - `bom-clone-dom/` — clone DOM adapter (buttons, modals, observers)
 * - `bom-downloader/` — attachment download UI and services
 * - `bom-downloader-dom.ts` — downloader DOM adapter
 * - `bom-shared/` — BOM route/context helpers shared by clone and downloader
 */
export { createBomPageModule } from './bom.feature'
