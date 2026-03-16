import { normalizeText } from '../../../../../../shared/utils/text'
import { isLookupPayloadValue } from '../../../services/form/fieldTypes'
import { fetchLookupOptionsByQuery, splitCommaSeparated } from '../../../services/form/lookupManagers'
import type { LookupOption } from '../../../services/form/types'

export type ResolveLookupPayloadValueOptions = {
  isMultiSelect: boolean
  userInputValue: string
  currentLabel?: string
  currentLink?: string
  selectedLabels?: string[]
  selectedLinks?: string[]
  labelToLink: Map<string, string>
}

export function joinLookupValues(values: string[]): string {
  return values
    .map((entry) => String(entry || '').trim())
    .filter(Boolean)
    .join(',')
}

export function seedLookupLabelLinkMap(labels: string[], links: string[]): Map<string, string> {
  const map = new Map<string, string>()
  for (let index = 0; index < labels.length; index += 1) {
    const label = String(labels[index] || '').trim()
    const link = String(links[index] || '').trim()
    if (!label || !link) continue
    map.set(normalizeText(label), link)
  }
  return map
}

export function resolveLookupPayloadValueFromState(options: ResolveLookupPayloadValueOptions): string {
  const {
    isMultiSelect,
    userInputValue,
    currentLabel = '',
    currentLink = '',
    selectedLabels = [],
    selectedLinks = [],
    labelToLink
  } = options
  const normalizedInput = String(userInputValue || '').trim()

  if (isMultiSelect) {
    const links: string[] = []
    for (let index = 0; index < selectedLabels.length; index += 1) {
      const label = String(selectedLabels[index] || '').trim()
      const linked = String(selectedLinks[index] || '').trim() || labelToLink.get(normalizeText(label)) || ''
      if (linked) links.push(linked)
    }
    const currentLinked = joinLookupValues(selectedLinks)
    if (selectedLabels.length > 0 && links.length === selectedLabels.length) return joinLookupValues(links)
    if (selectedLabels.length > 0 && currentLinked) return currentLinked
    if (links.length > 0) return joinLookupValues(links)
    return currentLinked
  }

  const normalizedCurrentLabel = String(currentLabel || '').trim()
  const normalizedCurrentLink = String(currentLink || '').trim()
  if (
    normalizedCurrentLabel
    && normalizedInput
    && normalizedCurrentLabel.toLowerCase() === normalizedInput.toLowerCase()
    && normalizedCurrentLink
  ) {
    return normalizedCurrentLink
  }
  if (normalizedCurrentLink && !normalizedInput) return normalizedCurrentLink
  if (isLookupPayloadValue(normalizedInput)) return normalizedInput
  const mapped = labelToLink.get(normalizeText(normalizedInput)) || ''
  if (mapped) return mapped
  if (normalizedCurrentLink && normalizedInput) return normalizedCurrentLink
  return ''
}

export async function hydrateLookupLinksForLabels(
  picklistPath: string,
  labels: string[],
  existingLinks: string[]
): Promise<{ links: string[]; labelToLink: Map<string, string> }> {
  const nextLinks = [...existingLinks]
  const labelToLink = seedLookupLabelLinkMap(labels, nextLinks)
  if (!String(picklistPath || '').trim() || labels.length === 0) {
    return { links: nextLinks, labelToLink }
  }

  if (nextLinks.length < labels.length) {
    nextLinks.push(...new Array(labels.length - nextLinks.length).fill(''))
  }

  await Promise.all(
    labels.map(async (label, index) => {
      if (String(nextLinks[index] || '').trim()) return
      const trimmedLabel = String(label || '').trim()
      if (!trimmedLabel) return
      const page = await fetchLookupOptionsByQuery(picklistPath, trimmedLabel, 100, 0, { useCache: true })
      const normalizedLabel = normalizeText(trimmedLabel)
      const exact = page.options.find((option) => normalizeText(option.label) === normalizedLabel)
      const fallback = page.options[0]
      const resolved = exact || fallback
      if (!resolved) return
      nextLinks[index] = resolved.value
      labelToLink.set(normalizeText(resolved.label), resolved.value)
    })
  )

  return { links: nextLinks, labelToLink }
}

export async function loadRadioFieldOptions(picklistPath: string): Promise<LookupOption[]> {
  const normalizedPath = String(picklistPath || '').trim()
  if (!normalizedPath) return []
  const page = await fetchLookupOptionsByQuery(normalizedPath, '', 250, 0, { useCache: true })
  return page.options
}

export function splitLookupDisplayValue(value: string): string[] {
  return splitCommaSeparated(value)
}
