export type GridFormEventManager = {
  mount: () => void
  update: () => void
  unmount: () => void
}

type GridFormEventManagerDeps = {
  navEventName: string
  buttonId: string
  isActive: () => boolean
  ensureButton: () => void
  getButton: () => HTMLButtonElement | null
  updateButtonState: (button: HTMLButtonElement) => void
  onButtonTrigger: (event: Event) => void
}

export function createGridFormEventManager(deps: GridFormEventManagerDeps): GridFormEventManager {
  let rootObserver: MutationObserver | null = null
  let refreshTimer: number | null = null
  let keepAliveTimer: number | null = null
  let mounted = false
  let lastUrl = window.location.href
  let documentClickHandler: ((event: MouseEvent) => void) | null = null
  let documentPointerDownHandler: ((event: PointerEvent) => void) | null = null

  function clearRefreshTimer(): void {
    if (refreshTimer === null) return
    window.clearTimeout(refreshTimer)
    refreshTimer = null
  }

  function clearKeepAliveTimer(): void {
    if (keepAliveTimer === null) return
    window.clearInterval(keepAliveTimer)
    keepAliveTimer = null
  }

  function getEventTargetElement(target: EventTarget | null): Element | null {
    if (target instanceof Element) return target
    if (target instanceof Node) return target.parentElement
    return null
  }

  function scheduleSync(delayMs: number): void {
    if (refreshTimer !== null) return
    refreshTimer = window.setTimeout(() => {
      refreshTimer = null
      deps.ensureButton()
    }, Math.max(0, delayMs))
  }

  function onUrlMaybeChanged(): void {
    const currentUrl = window.location.href
    if (currentUrl === lastUrl) return
    lastUrl = currentUrl
    scheduleSync(0)
  }

  function onInteractionMaybeChanged(): void {
    if (!deps.isActive()) return
    scheduleSync(0)
  }

  function ensureObserver(): void {
    if (rootObserver) return
    rootObserver = new MutationObserver(() => {
      const shouldExist = deps.isActive()
      const button = deps.getButton()

      if (!shouldExist) {
        if (button) scheduleSync(0)
        return
      }

      if (!button || !document.contains(button)) {
        scheduleSync(16)
      }
    })
    rootObserver.observe(document.documentElement, { childList: true, subtree: true })
  }

  function stopObserver(): void {
    if (!rootObserver) return
    rootObserver.disconnect()
    rootObserver = null
  }

  function mount(): void {
    if (!mounted) {
      mounted = true
      lastUrl = window.location.href
      window.addEventListener(deps.navEventName, onUrlMaybeChanged)
      window.addEventListener('hashchange', onUrlMaybeChanged)
      window.addEventListener('popstate', onUrlMaybeChanged)
      window.addEventListener('focusout', onInteractionMaybeChanged, true)
      window.addEventListener('click', onInteractionMaybeChanged, true)
      window.addEventListener('change', onInteractionMaybeChanged, true)
      if (!documentClickHandler) {
        documentClickHandler = (event: MouseEvent): void => {
          const target = getEventTargetElement(event.target)
          const button = target?.closest?.(`#${deps.buttonId}`) as HTMLButtonElement | null
          if (!button || button.disabled) return
          deps.onButtonTrigger(event)
        }
        document.addEventListener('click', documentClickHandler, true)
      }
      if (!documentPointerDownHandler) {
        documentPointerDownHandler = (event: PointerEvent): void => {
          const target = getEventTargetElement(event.target)
          const button = target?.closest?.(`#${deps.buttonId}`) as HTMLButtonElement | null
          if (!button) return
          event.stopPropagation()
        }
        document.addEventListener('pointerdown', documentPointerDownHandler, true)
      }
    }

    ensureObserver()
    deps.ensureButton()

    if (keepAliveTimer === null) {
      keepAliveTimer = window.setInterval(() => {
        if (!deps.isActive()) return
        const button = deps.getButton()
        if (!button) {
          scheduleSync(0)
          return
        }
        deps.updateButtonState(button)
      }, 300)
    }
  }

  function update(): void {
    deps.ensureButton()
  }

  function unmount(): void {
    if (mounted) {
      mounted = false
      window.removeEventListener(deps.navEventName, onUrlMaybeChanged)
      window.removeEventListener('hashchange', onUrlMaybeChanged)
      window.removeEventListener('popstate', onUrlMaybeChanged)
      window.removeEventListener('focusout', onInteractionMaybeChanged, true)
      window.removeEventListener('click', onInteractionMaybeChanged, true)
      window.removeEventListener('change', onInteractionMaybeChanged, true)
      if (documentClickHandler) {
        document.removeEventListener('click', documentClickHandler, true)
        documentClickHandler = null
      }
      if (documentPointerDownHandler) {
        document.removeEventListener('pointerdown', documentPointerDownHandler, true)
        documentPointerDownHandler = null
      }
    }

    clearRefreshTimer()
    clearKeepAliveTimer()
    stopObserver()
  }

  return {
    mount,
    update,
    unmount
  }
}
