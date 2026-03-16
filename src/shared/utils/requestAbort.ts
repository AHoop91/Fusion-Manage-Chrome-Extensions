/**
 * Reusable cancellation manager for "latest request wins" async flows.
 */
export interface RequestAbortManager {
  /**
   * Cancels the current request (if any) and returns a fresh signal.
   */
  createSignal: () => AbortSignal
  /**
   * Cancels the current request (if any).
   */
  cancel: () => void
}

/**
 * Creates a generic AbortController manager that keeps only one active request.
 */
export function createRequestAbortManager(): RequestAbortManager {
  let activeController: AbortController | null = null

  const cancel = (): void => {
    if (!activeController) return
    activeController.abort()
    activeController = null
  }

  const createSignal = (): AbortSignal => {
    cancel()
    activeController = new AbortController()
    return activeController.signal
  }

  return { createSignal, cancel }
}

/**
 * Returns true when an error is an abort/cancellation error.
 */
export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

