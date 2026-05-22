/**
 * Deep DOM lookup helpers.
 */
export function findByIdDeep(root: Document | ShadowRoot | Element | null, id: string): HTMLElement | null {
  if (!root) return null

  if ('getElementById' in root && typeof root.getElementById === 'function') {
    const direct = root.getElementById(id)
    if (direct) return direct
  }

  const queryRoot = root as Document | ShadowRoot | Element
  const elements = queryRoot.querySelectorAll ? Array.from(queryRoot.querySelectorAll('*')) : []

  for (const element of elements) {
    if ((element as HTMLElement).id === id) return element as HTMLElement

    const el = element as HTMLElement
    if (el.shadowRoot) {
      const nested = findByIdDeep(el.shadowRoot, id)
      if (nested) return nested
    }
  }

  return null
}

