import { normalizeApiUrlPath } from '../../../shared/url/parse'

export function parseViewDefIdFromLink(link: unknown): number | null {
  const text = String(link || '').trim()
  if (!text) return null
  const normalized = normalizeApiUrlPath(text)
  const match = /\/viewdef\/(\d+)(?:[/?#]|$)/i.exec(normalized)
  if (!match) return null
  const parsed = Number(match[1])
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

export function parseViewDefFieldIdFromLink(link: unknown): string | null {
  const text = String(link || '').trim()
  if (!text) return null
  const normalized = normalizeApiUrlPath(text)
  const match = /\/fields\/(\d+)(?:[/?#]|$)/i.exec(normalized)
  if (!match) return null
  return String(match[1])
}
