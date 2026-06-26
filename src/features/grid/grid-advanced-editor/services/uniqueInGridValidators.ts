import { normalizeValidatorName } from '../../../../shared/form/validatorTree'
import type { CapturedGridFieldDefinition } from '../types'

function extractFieldIdFromVariables(variables: unknown): string | null {
  if (!variables || typeof variables !== 'object') return null
  const record = variables as Record<string, unknown>
  for (const [key, val] of Object.entries(record)) {
    const normalizedKey = key.replace(/[^a-z]/gi, '').toLowerCase()
    if (normalizedKey === 'fieldid') {
      const id = String(val ?? '').trim().toUpperCase()
      return id || null
    }
  }
  return null
}

/**
 * Walks the same validator-tree shape used for required flags and collects
 * field IDs referenced by `uniqueInGrid` validators (variables.fieldId / fieldid).
 */
export function collectUniqueInGridFieldIdsFromValidatorsPayload(data: unknown): string[] {
  const found = new Set<string>()

  function walk(node: unknown): void {
    if (!node) return
    if (Array.isArray(node)) {
      for (const entry of node) walk(entry)
      return
    }
    if (typeof node !== 'object') return
    const record = node as Record<string, unknown>
    const vName = normalizeValidatorName(record.validatorName ?? record.name)
    if (vName === 'uniqueingrid') {
      const fieldId = extractFieldIdFromVariables(record.variables)
      if (fieldId) found.add(fieldId)
    }
    if (Array.isArray(record.validators)) {
      for (const entry of record.validators) walk(entry)
    }
  }

  walk(data)
  return Array.from(found)
}

export function collectUniqueInGridFieldIdsFromFieldDefinitions(definitions: CapturedGridFieldDefinition[]): string[] {
  const found = new Set<string>()
  for (const definition of definitions) {
    if (!definition) continue
    for (const id of collectUniqueInGridFieldIdsFromValidatorsPayload(definition.fieldValidators)) {
      found.add(id)
    }
  }
  return Array.from(found)
}
