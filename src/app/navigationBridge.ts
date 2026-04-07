/**
 * Navigation bridge — injected into the page's MAIN world at document_start.
 *
 * Patches history.pushState / replaceState before the SPA router initialises,
 * guaranteeing that every client-side navigation fires a DOM event that the
 * extension's isolated-world content scripts can receive.
 */
const NAV_EVENT = 'plm-extension-location-change'

const originalPush = history.pushState.bind(history)
const originalReplace = history.replaceState.bind(history)

history.pushState = function (...args: Parameters<History['pushState']>) {
  const result = originalPush(...args)
  window.dispatchEvent(new Event(NAV_EVENT))
  return result
}

history.replaceState = function (...args: Parameters<History['replaceState']>) {
  const result = originalReplace(...args)
  window.dispatchEvent(new Event(NAV_EVENT))
  return result
}

export {}
