import React from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { AttachmentDownloadModal } from './AttachmentDownloadModal'
import type { AttachmentDownloadView } from './types'

export function createAttachmentDownloadView(): AttachmentDownloadView {
  const roots = new WeakMap<Element, Root>()

  return {
    render(modalRoot, handlers) {
      const panel = modalRoot.querySelector('div')
      if (!panel) return
      let root = roots.get(panel)
      if (!root) {
        root = createRoot(panel)
        roots.set(panel, root)
      }
      root.render(<AttachmentDownloadModal {...handlers} />)
    },
    unmount(modalRoot) {
      const panel = modalRoot.querySelector('div')
      if (!panel) return
      const root = roots.get(panel)
      root?.unmount()
      roots.delete(panel)
    }
  }
}
