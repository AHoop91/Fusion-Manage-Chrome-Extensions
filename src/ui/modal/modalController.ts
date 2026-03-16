import { renderModal } from './modalRenderer'
import type { ModalAction } from '../../shared/runtime/types'

/**
 * Idempotent modal controller used by page modules.
 */
export function createModalController(): {
  closeModal: (modalId: string) => void
  openModal: (modalId: string, action: ModalAction) => void
} {
  function closeModal(modalId: string): void {
    const modal = document.getElementById(modalId)
    if (!modal) return
    modal.remove()
  }

  function openModal(modalId: string, action: ModalAction): void {
    closeModal(modalId)
    const modal = renderModal(modalId, action, () => closeModal(modalId))
    document.body.appendChild(modal)
  }

  return { closeModal, openModal }
}

