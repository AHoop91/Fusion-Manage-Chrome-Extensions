import { getRuntimeLastErrorMessage, hasExtensionContext } from '../runtime/chromeContext'

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

/**
 * Read options from extension local storage with defaults.
 */
export function getLocalOptions<T extends object>(storageKey: string, defaults: T): Promise<T> {
  return new Promise((resolve) => {
    if (!hasExtensionContext()) {
      resolve({ ...defaults })
      return
    }

    try {
      chrome.storage.local.get(storageKey, (result) => {
        const lastErrorMessage = getRuntimeLastErrorMessage()
        if (lastErrorMessage) {
          resolve({ ...defaults })
          return
        }

        const storedValue = result?.[storageKey]
        const nextStoredValues = isPlainObject(storedValue) ? storedValue : {}

        resolve({
          ...defaults,
          ...nextStoredValues
        } as T)
      })
    } catch {
      resolve({ ...defaults })
    }
  })
}

/**
 * Persist options into extension local storage.
 */
export function setLocalOptions<T extends object>(storageKey: string, nextOptions: T): Promise<void> {
  return new Promise((resolve) => {
    if (!hasExtensionContext()) {
      resolve()
      return
    }

    try {
      chrome.storage.local.set({ [storageKey]: nextOptions }, () => {
        getRuntimeLastErrorMessage()
        resolve()
      })
    } catch {
      resolve()
    }
  })
}

export function getLocalValue<T = unknown>(key: string): Promise<T | null> {
  return new Promise((resolve) => {
    if (!hasExtensionContext()) {
      resolve(null)
      return
    }

    try {
      chrome.storage.local.get(key, (result) => {
        const lastErrorMessage = getRuntimeLastErrorMessage()
        if (lastErrorMessage) {
          resolve(null)
          return
        }
        resolve((result?.[key] as T) || null)
      })
    } catch {
      resolve(null)
    }
  })
}

export function setLocalValues(values: Record<string, unknown>): Promise<boolean> {
  return new Promise((resolve) => {
    if (!hasExtensionContext()) {
      resolve(false)
      return
    }

    try {
      chrome.storage.local.set(values, () => {
        const lastErrorMessage = getRuntimeLastErrorMessage()
        resolve(!lastErrorMessage)
      })
    } catch {
      resolve(false)
    }
  })
}

