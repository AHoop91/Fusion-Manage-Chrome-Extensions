import { hasExtensionContext } from './chromeContext'

export function getExtensionVersion(): string {
  if (!hasExtensionContext()) return '0.0.0'

  try {
    return chrome.runtime.getManifest().version || '0.0.0'
  } catch {
    return '0.0.0'
  }
}

export function getRuntimeUrl(path: string): string | null {
  if (!hasExtensionContext()) return null

  try {
    return chrome.runtime.getURL(path)
  } catch {
    return null
  }
}

