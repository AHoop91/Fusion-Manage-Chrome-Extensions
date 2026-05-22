type DomErrorCode = 'INVALID_SELECTOR' | 'MISSING_SELECTOR' | 'INVALID_ROOT'

export type DomError = {
  code: DomErrorCode
  selector: string
  message: string
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: DomError }

function domError(code: DomErrorCode, selector: string, message: string): DomError {
  return { code, selector, message }
}

export class DomAdapter {
  constructor(private readonly root: Document | Element = document) {}

  query<T extends Element>(selector: string): Result<T> {
    if (!selector || typeof selector !== 'string') {
      return { ok: false, error: domError('INVALID_SELECTOR', selector || '', 'Selector must be a non-empty string') }
    }

    try {
      const node = this.root.querySelector(selector) as T | null
      if (!node) {
        return { ok: false, error: domError('MISSING_SELECTOR', selector, 'Selector did not match any element') }
      }
      return { ok: true, value: node }
    } catch {
      return { ok: false, error: domError('INVALID_SELECTOR', selector, 'Selector is invalid') }
    }
  }

  queryAll<T extends Element>(selector: string): Result<T[]> {
    if (!selector || typeof selector !== 'string') {
      return { ok: false, error: domError('INVALID_SELECTOR', selector || '', 'Selector must be a non-empty string') }
    }

    try {
      const nodes = Array.from(this.root.querySelectorAll(selector)) as T[]
      return { ok: true, value: nodes }
    } catch {
      return { ok: false, error: domError('INVALID_SELECTOR', selector, 'Selector is invalid') }
    }
  }

  exists(selector: string): boolean {
    return this.query(selector).ok
  }

  hasAll(selectors: string[]): { ok: boolean; missingSelectors: string[] } {
    const missingSelectors: string[] = []
    for (const selector of selectors) {
      if (!this.exists(selector)) missingSelectors.push(selector)
    }
    return { ok: missingSelectors.length === 0, missingSelectors }
  }
}

