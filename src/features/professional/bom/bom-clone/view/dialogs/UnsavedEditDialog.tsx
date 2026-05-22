import React from 'react'
import { buildButtonClassName } from '../shell/CloneShell'

export function UnsavedEditDialog(props: {
  open: boolean
  onKeepEditing: () => void
  onDiscard: () => void
}): React.JSX.Element | null {
  const { open, onKeepEditing, onDiscard } = props
  if (!open) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15,23,42,0.35)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2147483647
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onKeepEditing()
      }}
    >
      <div
        style={{
          width: 'min(420px,92vw)',
          background: '#ffffff',
          borderRadius: '10px',
          boxShadow: '0 20px 50px rgba(0,0,0,0.28)',
          padding: '16px'
        }}
      >
        <div style={{ margin: '0 0 8px', fontSize: '17px', fontWeight: 600, color: '#19222e' }}>
          Discard Unsaved Changes?
        </div>
        <div style={{ margin: '0 0 14px', color: '#384456', fontSize: '14px', lineHeight: 1.45 }}>
          You have unsaved changes. Are you sure you want to cancel?
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button
            type="button"
            className={buildButtonClassName('secondary')}
            onClick={onKeepEditing}
          >
            Keep Editing
          </button>
          <button
            type="button"
            className={buildButtonClassName('primary')}
            onClick={onDiscard}
          >
            Discard
          </button>
        </div>
      </div>
    </div>
  )
}
