import type { CsvParseResult } from './types'

export const GRID_IMPORT_PREVIEW_ROW_LIMIT = 50

export function isCsvFileName(fileName: string): boolean {
  return /\.csv$/i.test(String(fileName || '').trim())
}

export function parseCsv(text: string): CsvParseResult {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    const next = text[index + 1]

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"'
        index += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (char === ',' && !inQuotes) {
      row.push(cell)
      cell = ''
      continue
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') index += 1
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
      continue
    }

    cell += char
  }

  row.push(cell)
  rows.push(row)

  const trimmedRows = rows.filter((entries, index) => index < rows.length - 1 || entries.some((entry) => entry.trim()))
  return {
    headers: (trimmedRows[0] || []).map((header) => String(header || '').trim()),
    rows: trimmedRows.slice(1)
  }
}

export function sampleCsvRows(rows: string[][], limit = GRID_IMPORT_PREVIEW_ROW_LIMIT): string[][] {
  return rows.slice(0, Math.max(0, limit))
}

