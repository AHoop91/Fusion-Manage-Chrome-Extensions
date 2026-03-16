type PositionFloatingMenuOptions = {
  anchor: HTMLElement
  menu: HTMLElement
  minWidth?: number
  constrainToEditPanel?: boolean
}

export function positionFloatingMenu(options: PositionFloatingMenuOptions): void {
  const { anchor, menu, minWidth = 220, constrainToEditPanel = false } = options
  const rect = anchor.getBoundingClientRect()
  const belowSpace = window.innerHeight - rect.bottom - 12
  const aboveSpace = rect.top - 12
  const openUp = belowSpace < 220 && aboveSpace > belowSpace
  const maxHeight = Math.max(120, Math.min(300, openUp ? aboveSpace : belowSpace))
  const viewportMinLeft = 8
  const viewportMaxRight = window.innerWidth - 8

  let left = Math.round(rect.left)
  let width = Math.max(minWidth, Math.round(rect.width))

  if (constrainToEditPanel) {
    const panelRect = anchor.closest('.plm-extension-bom-clone-edit-panel')?.getBoundingClientRect() || null
    const panelMinLeft = panelRect ? Math.round(panelRect.left) + 8 : viewportMinLeft
    const panelMaxRight = panelRect ? Math.round(panelRect.right) - 8 : viewportMaxRight
    const minLeft = Math.max(viewportMinLeft, panelMinLeft)
    const maxRight = Math.min(viewportMaxRight, panelMaxRight)
    const availableWidth = Math.max(120, maxRight - minLeft)
    width = Math.min(width, availableWidth)
    const maxLeft = Math.max(minLeft, maxRight - width)
    left = Math.min(Math.max(left, minLeft), maxLeft)
  } else {
    const maxLeft = Math.max(viewportMinLeft, viewportMaxRight - width)
    left = Math.min(Math.max(left, viewportMinLeft), maxLeft)
  }

  menu.classList.toggle('is-open-up', openUp)
  menu.style.position = 'fixed'
  menu.style.left = `${left}px`
  menu.style.width = `${width}px`
  menu.style.right = 'auto'
  menu.style.maxHeight = `${Math.round(maxHeight)}px`
  menu.style.top = openUp ? 'auto' : `${Math.round(rect.bottom + 4)}px`
  menu.style.bottom = openUp ? `${Math.round(window.innerHeight - rect.top + 4)}px` : 'auto'
  menu.style.zIndex = '2147483647'
}

export function resetFloatingMenuPosition(menu: HTMLElement): void {
  menu.classList.remove('is-open-up')
  menu.style.position = ''
  menu.style.left = ''
  menu.style.width = ''
  menu.style.right = ''
  menu.style.maxHeight = ''
  menu.style.top = ''
  menu.style.bottom = ''
  menu.style.zIndex = ''
}
