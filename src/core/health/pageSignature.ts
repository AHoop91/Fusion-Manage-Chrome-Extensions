import { DomAdapter } from '../../dom/DomAdapter'
import type { HealthSchemaV1 } from './contracts/HealthSchema.v1'

function hashString(value: string): string {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

function selectorFingerprint(adapter: DomAdapter, selector: string): string {
  const result = adapter.query<Element>(selector)
  if (!result.ok) return `${selector}=missing`

  const element = result.value
  const id = element.id || ''
  const role = element.getAttribute('role') || ''
  const name = element.getAttribute('name') || ''
  const tag = element.tagName.toLowerCase()
  return `${selector}=${tag}#${id}[role=${role}][name=${name}]`
}

export function computePageSignature(schema: HealthSchemaV1, adapter: DomAdapter): string {
  // Use required selectors only for baseline stability.
  // Optional selectors are intentionally excluded because host-page rendering
  // can attach/detach them during normal transitions.
  const selectors = [...schema.requiredSelectors]
  const parts = selectors.map((selector) => selectorFingerprint(adapter, selector))
  const raw = parts.join('|')
  return `v1:${hashString(raw)}`
}

