import { GRID_FORM_MODAL_ID } from './constants'

const SUPPRESSED_ATTR = 'data-plm-import-suppressed'

/**
 * Hides the advanced editor modal while grid import is shown on top (avoids double backdrop).
 */
export function suppressGridFormModalOverlay(): void {
  const overlay = document.getElementById(GRID_FORM_MODAL_ID)
  if (!overlay || overlay.hasAttribute(SUPPRESSED_ATTR)) return
  overlay.setAttribute(SUPPRESSED_ATTR, 'true')
  overlay.style.visibility = 'hidden'
  overlay.style.pointerEvents = 'none'
}

/**
 * Restores the advanced editor modal after grid import closes.
 */
export function restoreGridFormModalOverlay(): void {
  const overlay = document.getElementById(GRID_FORM_MODAL_ID)
  if (!overlay || !overlay.hasAttribute(SUPPRESSED_ATTR)) return
  overlay.removeAttribute(SUPPRESSED_ATTR)
  overlay.style.visibility = ''
  overlay.style.pointerEvents = ''
}
