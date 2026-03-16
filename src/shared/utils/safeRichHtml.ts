const BLOCKED_TAGS = new Set([
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'link',
  'meta',
  'svg',
  'math',
  'form',
  'input',
  'button',
  'textarea',
  'select',
  'option'
])

const ALLOWED_TAGS = new Set([
  'a',
  'b',
  'br',
  'div',
  'em',
  'i',
  'li',
  'ol',
  'p',
  'span',
  'strong',
  's',
  'table',
  'tbody',
  'td',
  'th',
  'thead',
  'tr',
  'u',
  'ul'
])

function sanitizeAnchorHref(rawHref: string): string | null {
  const href = String(rawHref || '').trim()
  if (!href || /^\/\//.test(href)) return null
  if (href.startsWith('#')) return href
  if (href.startsWith('/')) return href
  if (/^\s*(javascript|data|vbscript|file):/i.test(href)) return null
  if (/^(mailto:|tel:)/i.test(href)) return href
  if (/^[a-z][a-z0-9+.-]*:/i.test(href)) return href

  try {
    const url = new URL(href, window.location.origin)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    if (url.origin === window.location.origin) {
      return `${url.pathname}${url.search}${url.hash}`
    }
    return url.toString()
  } catch {
    return null
  }
}

function extractSafeUrlFromOnclick(rawOnclick: string): string | null {
  const onclick = String(rawOnclick || '').trim()
  if (!onclick) return null

  const patterns = [
    /(?:window\.)?open\(\s*['"]([^'"]+)['"]/i,
    /location(?:\.href)?\s*=\s*['"]([^'"]+)['"]/i,
    /location\.assign\(\s*['"]([^'"]+)['"]\s*\)/i,
    /location\.replace\(\s*['"]([^'"]+)['"]\s*\)/i
  ]

  for (const pattern of patterns) {
    const match = pattern.exec(onclick)
    if (!match?.[1]) continue
    const safeHref = sanitizeAnchorHref(match[1])
    if (safeHref) return safeHref
  }

  return null
}

function copySafeAttributes(source: Element, target: Element, tagName: string): void {
  if (tagName === 'a') {
    const safeHref =
      sanitizeAnchorHref(source.getAttribute('href') || '')
      || extractSafeUrlFromOnclick(source.getAttribute('onclick') || '')
    if (!safeHref) return
    target.setAttribute('href', safeHref)
    const targetValue = String(source.getAttribute('target') || '').trim().toLowerCase()
    if (targetValue === '_blank') {
      target.setAttribute('target', '_blank')
      target.setAttribute('rel', 'noopener noreferrer')
    }
  }
}

function sanitizeNode(node: Node): Node | null {
  if (node.nodeType === Node.TEXT_NODE) {
    return document.createTextNode(node.textContent || '')
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return null

  const element = node as Element
  const tagName = element.tagName.toLowerCase()
  if (BLOCKED_TAGS.has(tagName)) return null

  const sanitizedChildren = Array.from(element.childNodes)
    .map((child) => sanitizeNode(child))
    .filter((child): child is Node => child !== null)

  if (!ALLOWED_TAGS.has(tagName)) {
    const fragment = document.createDocumentFragment()
    for (const child of sanitizedChildren) fragment.appendChild(child)
    return fragment
  }

  const safeElement = document.createElement(tagName)
  copySafeAttributes(element, safeElement, tagName)
  for (const child of sanitizedChildren) safeElement.appendChild(child)
  return safeElement
}

export function sanitizeRichHtml(rawHtml: string): string {
  const html = String(rawHtml || '')
  if (!html.trim()) return ''

  const template = document.createElement('template')
  template.innerHTML = html

  const host = document.createElement('div')
  for (const child of Array.from(template.content.childNodes)) {
    const safeChild = sanitizeNode(child)
    if (safeChild) host.appendChild(safeChild)
  }

  return host.innerHTML
}
