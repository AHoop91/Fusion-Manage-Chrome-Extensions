import { fetchLookupOptionsByQuery } from '../../../shared/form/lookupOptions'
import { normalizeText } from '../../../shared/utils/text'
import {
  normalizeGridPayloadValue,
  toGridPayloadType
} from '../grid-services/gridFieldMetadata'
import type { GridImportField, GridImportSubmitDataEntry } from './types'
import type { GridStagedFieldValue } from '../grid-staging/grid-import-edit-session'

function isApiPathValue(value: string): boolean {
  return /^\/api\/v3\//i.test(String(value || '').trim())
}

function isLookupPayloadType(type: string): boolean {
  const normalized = String(type || '').trim().toLowerCase()
  return normalized === 'single-select' || normalized === 'radio' || normalized === 'buom' || normalized === 'multi-select'
}

async function resolveLookupValue(field: GridImportField, payloadType: string, value: string): Promise<string> {
  const picklistPath = String(field.field.picklistPath || '').trim()
  const raw = String(value || '').trim()
  if (!picklistPath || !raw || isApiPathValue(raw)) return raw
  if (payloadType === 'multi-select') {
    const resolved: string[] = []
    for (const part of raw.split(',').map((entry) => entry.trim()).filter(Boolean)) {
      if (isApiPathValue(part)) {
        resolved.push(part)
        continue
      }
      const page = await fetchLookupOptionsByQuery(picklistPath, part, 100, 0, { useCache: true })
      const exact = page.options.find((option) => normalizeText(option.label) === normalizeText(part))
      resolved.push(exact?.value && isApiPathValue(exact.value) ? exact.value : part)
    }
    return resolved.join(',')
  }
  const page = await fetchLookupOptionsByQuery(picklistPath, raw, 100, 0, { useCache: true })
  const exact = page.options.find((option) => normalizeText(option.label) === normalizeText(raw))
  return exact?.value && isApiPathValue(exact.value) ? exact.value : raw
}

async function resolveLookupDisplayAndPayload(
  field: GridImportField,
  payloadType: string,
  value: string
): Promise<{ display: string; payloadValue: string }> {
  const raw = String(value || '').trim()
  const picklistPath = String(field.field.picklistPath || '').trim()
  if (!picklistPath || !raw || !isLookupPayloadType(payloadType)) {
    return { display: raw, payloadValue: raw }
  }

  if (payloadType === 'multi-select') {
    const displays: string[] = []
    const payloadValues: string[] = []
    for (const part of raw.split(',').map((entry) => entry.trim()).filter(Boolean)) {
      if (isApiPathValue(part)) {
        displays.push(part)
        payloadValues.push(part)
        continue
      }
      const page = await fetchLookupOptionsByQuery(picklistPath, part, 100, 0, { useCache: true })
      const exact = page.options.find((option) => normalizeText(option.label) === normalizeText(part))
      if (exact?.value && isApiPathValue(exact.value)) {
        displays.push(part)
        payloadValues.push(exact.value)
      }
    }
    return { display: displays.join(','), payloadValue: payloadValues.join(',') }
  }

  if (isApiPathValue(raw)) return { display: raw, payloadValue: raw }
  const page = await fetchLookupOptionsByQuery(picklistPath, raw, 100, 0, { useCache: true })
  const exact = page.options.find((option) => normalizeText(option.label) === normalizeText(raw))
  if (!exact?.value || !isApiPathValue(exact.value)) return { display: '', payloadValue: '' }
  return { display: raw, payloadValue: exact.value }
}

export async function buildGridImportRowData(
  cells: Array<{ field: GridImportField; value: string }>
): Promise<GridImportSubmitDataEntry[]> {
  const data: GridImportSubmitDataEntry[] = []
  for (const cell of cells) {
    const payloadType = toGridPayloadType(cell.field.field)
    const resolved = await resolveLookupDisplayAndPayload(cell.field, payloadType, cell.value)
    const display = resolved.display
    const payloadValue = isLookupPayloadType(payloadType)
      ? await resolveLookupValue(cell.field, payloadType, resolved.payloadValue)
      : display
    data.push({
      fieldId: cell.field.fieldId,
      type: payloadType,
      value: normalizeGridPayloadValue(payloadType, payloadValue),
      display,
      title: String(cell.field.field.title || cell.field.name || ''),
      typeId: cell.field.field.typeId ?? null,
      typeLink: cell.field.field.typeLink ?? null,
      typeUrn: cell.field.field.typeUrn ?? null,
      typeTitle: cell.field.field.typeTitle ?? null,
      fieldSelf: cell.field.field.fieldSelf ?? cell.field.raw.__self__ ?? null,
      fieldUrn: cell.field.field.fieldUrn ?? cell.field.raw.urn ?? null
    })
  }
  return data
}

export function gridStagedFieldValuesFromSubmitData(entries: GridImportSubmitDataEntry[]): GridStagedFieldValue[] {
  return entries.map((entry) => ({
    fieldId: entry.fieldId,
    payload: String(entry.value ?? ''),
    display: entry.display
  }))
}

/**
 * Staged values for import → edit update rows.
 * Match On keys identify the target row but are not staged as editable updates (direct import submit still sends them).
 */
export function gridStagedFieldValuesForImportEditUpdate(
  entries: GridImportSubmitDataEntry[],
  matchFieldIds: string[]
): GridStagedFieldValue[] {
  const staged = gridStagedFieldValuesFromSubmitData(entries)
  if (matchFieldIds.length === 0) return staged
  const matchIds = new Set(matchFieldIds)
  return staged.filter((field) => !matchIds.has(field.fieldId))
}
