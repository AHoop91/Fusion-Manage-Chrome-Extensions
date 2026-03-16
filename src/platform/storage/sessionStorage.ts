import { getRuntimeLastErrorMessage, hasExtensionContext } from '../runtime/chromeContext'

export function getSessionValues<T = unknown>(keys: string | string[]): Promise<T | Record<string, unknown> | null> {
  return new Promise((resolve) => {
    if (!hasExtensionContext()) {
      resolve(null)
      return
    }

    try {
      chrome.storage.session.get(keys, (result) => {
        const lastErrorMessage = getRuntimeLastErrorMessage()
        if (lastErrorMessage) {
          resolve(null)
          return
        }
        resolve(result || null)
      })
    } catch {
      resolve(null)
    }
  })
}

export function setSessionValues(values: Record<string, unknown>): Promise<void> {
  return new Promise((resolve) => {
    if (!hasExtensionContext()) {
      resolve()
      return
    }

    try {
      chrome.storage.session.set(values, () => {
        getRuntimeLastErrorMessage()
        resolve()
      })
    } catch {
      resolve()
    }
  })
}
