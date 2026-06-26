import { parseGridContextFromPageUrl, parseGridRouteContextFromPageUrl } from '../../../shared/url/parse'

export function parseGridPageContext(urlString: string): { workspaceId: number; dmsId: number } | null {
  return parseGridContextFromPageUrl(urlString)
}

export function parseGridRouteContext(urlString: string): { workspaceId: number; dmsId: number; mode: string } | null {
  return parseGridRouteContextFromPageUrl(urlString)
}

export function isGridPage(urlString: string): boolean {
  return parseGridRouteContext(urlString) !== null
}

export function isStrictGridPage(urlString: string): boolean {
  return parseGridPageContext(urlString) !== null
}

export function isGridEditPage(urlString: string): boolean {
  const route = parseGridRouteContext(urlString)
  return Boolean(route && route.mode === 'edit')
}
