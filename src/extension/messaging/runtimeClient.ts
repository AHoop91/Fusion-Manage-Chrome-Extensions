import { getRuntimeLastErrorMessage, hasExtensionContext } from '../runtime/chromeContext'

export function sendMessage<TReq extends object, TRes = unknown>(
  message: TReq,
  timeoutMs = 15_000
): Promise<TRes> {
  return new Promise((resolve, reject) => {
    if (!hasExtensionContext()) {
      reject(new Error('Extension context is unavailable'))
      return
    }

    let settled = false
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      reject(new Error(`sendMessage timed out after ${timeoutMs}ms`))
    }, timeoutMs)

    try {
      chrome.runtime.sendMessage(message, (response?: TRes) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        const lastErrorMessage = getRuntimeLastErrorMessage()
        if (lastErrorMessage) {
          reject(new Error(lastErrorMessage))
          return
        }
        resolve(response as TRes)
      })
    } catch {
      if (!settled) {
        settled = true
        clearTimeout(timer)
        reject(new Error('Extension context is unavailable'))
      }
    }
  })
}

export const sendRuntimeMessage = sendMessage

export function sendRuntimeMessageFireAndForget<TReq extends object>(message: TReq): void {
  if (!hasExtensionContext()) return

  try {
    chrome.runtime.sendMessage(message)
  } catch {
    // No-op by design: production should degrade silently.
  }
}
