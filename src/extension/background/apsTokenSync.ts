import { sendRuntimeMessage } from '../messaging/runtimeClient'

const REFRESH_BUFFER_MS = 300_000
const RETRY_MS = 60_000

type AuthTokenSyncResponse = { ok?: boolean; error?: string }

let syncInFlight: Promise<void> | null = null
let cachedExpiresAt = 0
let refreshTimer: ReturnType<typeof setTimeout> | null = null
let retryTimer: ReturnType<typeof setTimeout> | null = null

function scheduleRefresh(expiresIn: number): void {
  if (refreshTimer) clearTimeout(refreshTimer)
  const refreshAfterMs = Math.max(RETRY_MS, expiresIn * 1000 - REFRESH_BUFFER_MS)
  refreshTimer = setTimeout(() => {
    void ensureApsTokenSynced({ force: true }).catch(scheduleRetry)
  }, refreshAfterMs)
}

function scheduleRetry(): void {
  if (retryTimer) clearTimeout(retryTimer)
  retryTimer = setTimeout(() => {
    void ensureApsTokenSynced({ force: true }).catch(scheduleRetry)
  }, RETRY_MS)
}

/**
 * Fetch the PLM session token and sync it to the background worker.
 * Deduplicates concurrent callers and skips re-fetch while the cached token is still fresh.
 */
export async function ensureApsTokenSynced(options?: { force?: boolean }): Promise<void> {
  const now = Date.now()
  if (!options?.force && cachedExpiresAt - REFRESH_BUFFER_MS > now) {
    return
  }

  if (!syncInFlight) {
    syncInFlight = performApsTokenSync().finally(() => {
      syncInFlight = null
    })
  }
  return syncInFlight
}

async function performApsTokenSync(): Promise<void> {
  const res = await fetch('/api/v3/token', {
    method: 'GET',
    credentials: 'same-origin',
    headers: { Accept: 'application/json' }
  })
  if (!res.ok) {
    throw new Error(`APS token fetch failed with status ${res.status}`)
  }

  const data = (await res.json()) as { accessToken?: unknown; expiresIn?: unknown }
  const token = typeof data.accessToken === 'string' ? data.accessToken : ''
  const expiresIn = typeof data.expiresIn === 'number' && data.expiresIn > 0 ? data.expiresIn : 3600
  if (!token) {
    throw new Error('APS token response missing accessToken')
  }

  const response = await sendRuntimeMessage<
    { type: 'AUTH_TOKEN_SYNC'; payload: { token: string; expiresIn: number } },
    AuthTokenSyncResponse
  >({
    type: 'AUTH_TOKEN_SYNC',
    payload: { token, expiresIn }
  })

  if (!response?.ok) {
    throw new Error(response?.error || 'AUTH_TOKEN_SYNC rejected by background')
  }

  cachedExpiresAt = Date.now() + expiresIn * 1000
  scheduleRefresh(expiresIn)
}

/** Retry wrapper used by scheduled refresh timers after a prior successful sync. */
export function syncApsTokenToBackground(): void {
  void ensureApsTokenSynced().catch(() => {
    scheduleRetry()
  })
}
