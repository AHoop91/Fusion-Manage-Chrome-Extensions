import React from 'react'
import { Loader } from './Loader'

export function applyPanelShellStyles(panel: HTMLDivElement, isExpanded: boolean): void {
  panel.classList.toggle('plm-extension-bom-clone-panel-expanded', isExpanded)
  panel.dataset.plmExpanded = isExpanded ? 'true' : 'false'
  panel.setAttribute(
    'style',
    [
      isExpanded ? 'width:calc(100vw - 48px)' : 'width:min(1820px,99vw)',
      isExpanded ? 'height:calc(100vh - 48px)' : 'height:min(88vh,860px)',
      isExpanded ? 'max-height:calc(100vh - 48px)' : 'max-height:94vh',
      'overflow:hidden',
      'display:flex',
      'flex-direction:column',
      'position:relative',
      'background:#ffffff',
      'border-radius:12px',
      'box-shadow:0 24px 80px rgba(0,0,0,0.25)',
      'padding:18px',
      'font-family:"ArtifaktElement","Segoe UI",Arial,sans-serif'
    ].join(';')
  )
}

export function buildButtonClassName(variant: 'primary' | 'secondary'): string {
  return variant === 'primary'
    ? 'md-button md-default-theme md-button md-ink-ripple plm-extension-bom-clone-btn plm-extension-bom-clone-btn-primary plm-extension-btn plm-extension-btn--primary'
    : 'md-button md-default-theme md-button md-ink-ripple plm-extension-bom-clone-btn plm-extension-btn plm-extension-btn--secondary'
}

export function CloneShellHeader(props: {
  title: string
  isExpanded: boolean
  onToggleExpanded: () => void
}): React.JSX.Element {
  const { title, isExpanded, onToggleExpanded } = props
  return (
    <div className="plm-extension-bom-clone-header">
      <h3 style={{ margin: 0, fontSize: '20px', color: '#19222e' }}>{title}</h3>
      <button
        type="button"
        className="plm-extension-bom-clone-expand-btn"
        title={isExpanded ? 'Exit expanded view' : 'Expand view'}
        aria-label={isExpanded ? 'Exit expanded view' : 'Expand view'}
        onClick={onToggleExpanded}
      >
        <span className={isExpanded ? 'zmdi zmdi-fullscreen-exit' : 'zmdi zmdi-fullscreen'} />
      </button>
    </div>
  )
}

export function CloneSearchModeToggle(props: {
  advancedMode: boolean
  onToggleAdvancedMode: (nextAdvancedMode: boolean) => void
}): React.JSX.Element {
  const { advancedMode, onToggleAdvancedMode } = props
  return (
    <div className="plm-extension-bom-clone-mode-toggle">
      <button
        type="button"
        className={`plm-extension-bom-clone-mode-btn${!advancedMode ? ' is-active' : ''}`}
        onClick={() => onToggleAdvancedMode(false)}
      >
        Basic Mode
      </button>
      <button
        type="button"
        className={`plm-extension-bom-clone-mode-btn${advancedMode ? ' is-active' : ''}`}
        onClick={() => onToggleAdvancedMode(true)}
      >
        Advanced Mode
      </button>
    </div>
  )
}

export function ClonePhaseLoader(props: { label: string }): React.JSX.Element {
  const { label } = props
  return (
    <div
      className="plm-extension-bom-clone-content is-validation-loading"
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: '1 1 auto',
        minHeight: '0',
        position: 'relative'
      }}
    >
      <Loader label={label} />
    </div>
  )
}
