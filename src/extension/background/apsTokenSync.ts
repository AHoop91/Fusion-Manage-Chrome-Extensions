import { sendRuntimeMessageFireAndForget } from '../messaging/runtimeClient'

export async function syncApsTokenToBackground(): Promise<void> {
  try {
    const res = await fetch('/api/v3/token', {
      method: 'GET',
      credentials: 'same-origin',
      headers: { Accept: 'application/json' }
    })
    if (!res.ok) {
      setTimeout(syncApsTokenToBackground, 60_000)
      return
    }

    const data = (await res.json()) as { accessToken?: unknown; expiresIn?: unknown }
    const token = typeof data.accessToken === 'string' ? data.accessToken : ''
    const expiresIn = typeof data.expiresIn === 'number' && data.expiresIn > 0 ? data.expiresIn : 3600
    if (!token) return

    sendRuntimeMessageFireAndForget({
      type: 'AUTH_TOKEN_SYNC',
      payload: { token, expiresIn }
    })

    const refreshAfterMs = Math.max(60_000, (expiresIn - 300) * 1000)
    setTimeout(syncApsTokenToBackground, refreshAfterMs)
  } catch {
    // Retry in 60 seconds on failure rather than stopping permanently
    setTimeout(syncApsTokenToBackground, 60_000)
  }
}
