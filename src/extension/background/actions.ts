import { isApsPlmAction } from './apsActions'
import { ensureApsTokenSynced } from './apsTokenSync'
import { sendRuntimeMessage } from '../messaging/runtimeClient'

type RuntimeResponse<T> = { ok?: boolean; data?: T; error?: string }

/**
 * Invoke a named PLM background action via the shared HTTP_REQUEST channel.
 * API auth uses the user's Fusion Manage session cookies in the service worker.
 */
export async function requestPlmAction<T = unknown>(
  action: string,
  payload: Record<string, unknown> = {}
): Promise<T> {
  if (isApsPlmAction(action)) {
    await ensureApsTokenSynced()
  }

  const response = await sendRuntimeMessage<
    { type: 'HTTP_REQUEST'; payload: { action: string; payload: Record<string, unknown> } },
    RuntimeResponse<T>
  >({
    type: 'HTTP_REQUEST',
    payload: { action, payload }
  })

  if (!response?.ok) {
    throw new Error(response?.error || `PLM action failed: ${action}`)
  }

  return response.data as T
}
