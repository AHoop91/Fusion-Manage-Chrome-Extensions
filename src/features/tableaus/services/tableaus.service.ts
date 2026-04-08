export function matchesTableausPage(urlString: string): boolean {
  try {
    const url = new URL(urlString)
    if (!url.hostname.toLowerCase().endsWith('.autodeskplm360.net')) return false

    if (/^\/plm\/workspaces\/\d+\/items$/i.test(url.pathname)) return true

    if (/^\/plm\/workspaces\/\d+\/items\/itemDetails$/i.test(url.pathname)) {
      return url.searchParams.get('view')?.toLowerCase() === 'split'
    }

    return false
  } catch {
    return false
  }
}

export function extractWsId(urlString: string): string | null {
  try {
    const url = new URL(urlString)
    const match = url.pathname.match(/^\/plm\/workspaces\/(\d+)\/items/i)
    return match?.[1] ?? null
  } catch {
    return null
  }
}

export function extractActiveTableauId(urlString: string): string | null {
  try {
    return new URL(urlString).searchParams.get('tableau')
  } catch {
    return null
  }
}

export function extractTenant(urlString: string): string | null {
  try {
    const url = new URL(urlString)
    const parts = url.hostname.split('.')
    if (parts.length < 3) return null
    return parts[0]?.toUpperCase() || null
  } catch {
    return null
  }
}
