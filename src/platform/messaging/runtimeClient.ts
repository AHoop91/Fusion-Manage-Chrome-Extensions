import { getRuntimeLastErrorMessage, hasExtensionContext } from '../runtime/chromeContext'

export function sendMessage<TReq extends object, TRes = unknown>(message: TReq): Promise<TRes> {
  return new Promise((resolve, reject) => {
    if (!hasExtensionContext()) {
      reject(new Error('Extension context is unavailable'))
      return
    }

    try {
      chrome.runtime.sendMessage(message, (response?: TRes) => {
        const lastErrorMessage = getRuntimeLastErrorMessage()
        if (lastErrorMessage) {
          reject(new Error(lastErrorMessage))
          return
        }
        resolve(response as TRes)
      })
    } catch {
      reject(new Error('Extension context is unavailable'))
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
