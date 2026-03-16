export function ensureStyleTag(id: string, css: string | string[]) {
  const nextCss = Array.isArray(css) ? css.join("\n") : css
  const existing = document.getElementById(id)
  if (existing instanceof HTMLStyleElement) {
    if (existing.textContent !== nextCss) existing.textContent = nextCss
    return
  }

  const style = document.createElement("style")
  style.id = id
  style.textContent = nextCss

  ;(document.head || document.documentElement).appendChild(style)
}
