/**
 * Fluent DOM builder used to create and wire elements declaratively.
 */
export interface ElementBuilder<K extends keyof HTMLElementTagNameMap> {
  /**
   * Appends CSS classes to the current element.
   */
  cls(...names: string[]): this
  /**
   * Sets the element id.
   */
  id(value: string): this
  /**
   * Sets textContent.
   */
  text(value: string): this
  /**
   * Sets innerHTML.
   */
  html(value: string): this
  /**
   * Sets a generic HTML attribute.
   */
  attr(name: string, value: string): this
  /**
   * Sets a data-* attribute.
   */
  data(key: string, value: string): this
  /**
   * Sets input/button type where applicable.
   */
  type(value: string): this
  /**
   * Registers an event listener.
   */
  on<E extends keyof HTMLElementEventMap>(event: E, handler: (e: HTMLElementEventMap[E]) => void): this
  /**
   * Appends children to the current element.
   */
  append(...children: Array<ElementBuilder<any> | HTMLElement | null | undefined>): this
  /**
   * Sets disabled state when the target supports it.
   */
  disabled(value: boolean): this
  /**
   * Sets the title attribute.
   */
  title(value: string): this
  /**
   * Returns the underlying element instance.
   */
  build(): HTMLElementTagNameMap[K]
}

class HtmlElementBuilder<K extends keyof HTMLElementTagNameMap> implements ElementBuilder<K> {
  private readonly node: HTMLElementTagNameMap[K]

  constructor(tag: K) {
    this.node = document.createElement(tag)
  }

  cls(...names: string[]): this {
    const tokens = names.map((name) => String(name || '').trim()).filter(Boolean)
    if (tokens.length > 0) this.node.classList.add(...tokens)
    return this
  }

  id(value: string): this {
    this.node.id = value
    return this
  }

  text(value: string): this {
    this.node.textContent = value
    return this
  }

  html(value: string): this {
    this.node.innerHTML = value
    return this
  }

  attr(name: string, value: string): this {
    this.node.setAttribute(name, value)
    return this
  }

  data(key: string, value: string): this {
    this.node.dataset[key] = value
    return this
  }

  type(value: string): this {
    if ('type' in this.node) {
      ;(this.node as HTMLInputElement | HTMLButtonElement).type = value
    }
    return this
  }

  on<E extends keyof HTMLElementEventMap>(event: E, handler: (e: HTMLElementEventMap[E]) => void): this {
    this.node.addEventListener(event, handler as EventListener)
    return this
  }

  append(...children: Array<ElementBuilder<any> | HTMLElement | null | undefined>): this {
    for (const child of children) {
      if (!child) continue
      const node = child instanceof HTMLElement ? child : child.build()
      this.node.appendChild(node)
    }
    return this
  }

  disabled(value: boolean): this {
    if ('disabled' in this.node) {
      ;(this.node as HTMLInputElement | HTMLButtonElement | HTMLSelectElement | HTMLTextAreaElement).disabled = value
    }
    return this
  }

  title(value: string): this {
    this.node.title = value
    return this
  }

  build(): HTMLElementTagNameMap[K] {
    return this.node
  }
}

/**
 * Creates a new fluent builder for the provided tag.
 */
export function el<K extends keyof HTMLElementTagNameMap>(tag: K): ElementBuilder<K> {
  return new HtmlElementBuilder(tag)
}

