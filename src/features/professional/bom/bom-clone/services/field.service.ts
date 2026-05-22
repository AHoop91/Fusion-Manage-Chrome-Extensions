import type { BomCloneNode, BomCloneStateSnapshot } from '../clone.types'

export function resolveQuantityFieldId(snapshot: Pick<BomCloneStateSnapshot, 'bomViewFields'>): string | null {
  const exact = snapshot.bomViewFields.find((field) => String(field.fieldId) === '103')
  if (exact) return exact.fieldId
  const byTitle = snapshot.bomViewFields.find((field) => /(^|\b)(qty|quantity)(\b|$)/i.test(String(field.title || '')))
  return byTitle?.fieldId || null
}

export function resolvePinnedFieldId(snapshot: Pick<BomCloneStateSnapshot, 'bomViewFields'>): string | null {
  const exact = snapshot.bomViewFields.find((field) => String(field.fieldId) === '302')
  if (exact) return exact.fieldId
  const byTitle = snapshot.bomViewFields.find((field) => /(pin|pinned)/i.test(String(field.title || '')))
  return byTitle?.fieldId || null
}

export function parseBooleanLike(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  const text = String(value ?? '').trim().toLowerCase()
  if (!text) return fallback
  if (['true', '1', 'yes', 'y', 'on'].includes(text)) return true
  if (['false', '0', 'no', 'n', 'off'].includes(text)) return false
  return fallback
}

export function remapBomFieldValuesByFieldId(
  nodes: BomCloneNode[],
  viewDefFieldIdToFieldId: Record<string, string>
): BomCloneNode[] {
  const hasMappings = Object.keys(viewDefFieldIdToFieldId).length > 0
  if (!hasMappings) return nodes

  const remapNode = (node: BomCloneNode): BomCloneNode => {
    const sourceValues = node.bomFieldValues || {}
    const remappedValues: Record<string, string> = {}
    for (const [rawFieldId, rawValue] of Object.entries(sourceValues)) {
      const resolvedFieldId = String(viewDefFieldIdToFieldId[rawFieldId] || rawFieldId).trim()
      if (!resolvedFieldId) continue
      const nextValue = String(rawValue ?? '')
      const existing = String(remappedValues[resolvedFieldId] ?? '')
      if (!existing || nextValue) remappedValues[resolvedFieldId] = nextValue
    }

    return {
      ...node,
      ...(Object.keys(remappedValues).length > 0 ? { bomFieldValues: remappedValues } : {}),
      children: node.children.map(remapNode)
    }
  }

  return nodes.map(remapNode)
}


