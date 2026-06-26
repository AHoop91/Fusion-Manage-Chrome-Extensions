import { ensureGenericLoaderStyles } from './genericLoader.styles'

export type GenericLoaderElementOptions = {
  compact?: boolean
  inline?: boolean
  className?: string
  labelClassName?: string
}

export function createGenericLoaderElement(label: string, options: GenericLoaderElementOptions = {}): HTMLDivElement {
  ensureGenericLoaderStyles()

  const root = document.createElement('div')
  root.className = [
    'plm-extension-generic-loader',
    options.compact ? 'plm-extension-generic-loader--compact' : '',
    options.inline ? 'plm-extension-generic-loader--inline' : '',
    options.className ?? ''
  ].filter(Boolean).join(' ')
  root.setAttribute('role', 'status')
  root.setAttribute('aria-live', 'polite')

  const dots = document.createElement('div')
  dots.className = 'plm-extension-generic-loader__dots'
  dots.setAttribute('aria-hidden', 'true')
  dots.appendChild(createDot())
  dots.appendChild(createDot())
  dots.appendChild(createDot())

  const text = document.createElement('span')
  text.className = [
    'plm-extension-generic-loader__label',
    options.labelClassName ?? ''
  ].filter(Boolean).join(' ')
  text.textContent = label

  root.appendChild(dots)
  root.appendChild(text)
  return root
}

function createDot(): HTMLSpanElement {
  const dot = document.createElement('span')
  dot.className = 'plm-extension-generic-loader__dot'
  return dot
}
