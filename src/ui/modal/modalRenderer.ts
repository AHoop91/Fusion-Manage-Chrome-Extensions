import type { ModalAction } from '../../shared/runtime/types'

/**
 * Render shared placeholder modal markup.
 */
export function renderModal(modalId: string, action: ModalAction, onClose: () => void): HTMLDivElement {
  const overlay = document.createElement('div')
  overlay.id = modalId
  overlay.style.cssText = [
    'position:fixed',
    'inset:0',
    'background:rgba(0,0,0,0.45)',
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'z-index:2147483647'
  ].join(';')

  const panel = document.createElement('div')
  panel.style.cssText = [
    'width:min(560px,90vw)',
    'background:#ffffff',
    'border-radius:12px',
    'box-shadow:0 24px 80px rgba(0,0,0,0.25)',
    'padding:18px',
    'font-family:Segoe UI,Arial,sans-serif'
  ].join(';')

  const title = document.createElement('h3')
  title.textContent = action.label
  title.style.cssText = 'margin:0 0 10px;font-size:20px;color:#19222e;'

  const body = document.createElement('p')
  body.textContent = 'Modal is ready. Action content will be added next.'
  body.style.cssText = 'margin:0 0 16px;color:#384456;font-size:14px;'

  const buttonRow = document.createElement('div')
  buttonRow.style.cssText = 'display:flex;justify-content:flex-end;'

  const closeButton = document.createElement('button')
  closeButton.type = 'button'
  closeButton.textContent = 'Close'
  closeButton.style.cssText = [
    'border:none',
    'padding:8px 14px',
    'border-radius:8px',
    'background:#1f6feb',
    'color:#fff',
    'cursor:pointer'
  ].join(';')
  closeButton.addEventListener('click', onClose)

  buttonRow.appendChild(closeButton)
  panel.appendChild(title)
  panel.appendChild(body)
  panel.appendChild(buttonRow)
  overlay.appendChild(panel)

  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) onClose()
  })

  return overlay
}

