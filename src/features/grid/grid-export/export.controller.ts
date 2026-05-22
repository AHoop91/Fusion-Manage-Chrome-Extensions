export type GridExportController = {
  csvEscape: typeof import('./export.service').csvEscape
  downloadCsv: typeof import('./export.service').downloadCsv
  makeTimestamp: typeof import('./export.service').makeTimestamp
  nextTick: typeof import('./export.service').nextTick
  setExportButtonLabel: typeof import('./export.service').setExportButtonLabel
  setExportProgress: typeof import('./export.service').setExportProgress
}

import {
  csvEscape,
  downloadCsv,
  makeTimestamp,
  nextTick,
  setExportButtonLabel,
  setExportProgress
} from './export.service'

export function createGridExportController(): GridExportController {
  return { csvEscape, downloadCsv, makeTimestamp, nextTick, setExportButtonLabel, setExportProgress }
}
