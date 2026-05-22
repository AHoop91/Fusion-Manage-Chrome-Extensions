import { COMMAND_BAR_OPTIONS_MENU_ID } from '../item-details.constants'
import type { ItemDetailsOptionsMode } from '../item-details.types'

type OptionsMenuDeps = {
  getOptionsMode: () => ItemDetailsOptionsMode
  isHideEmptyEnabled: () => boolean
  setHideEmptyEnabled: (next: boolean) => Promise<void>
  isRequiredOnlyEnabled: () => boolean
  setRequiredOnlyEnabled: (next: boolean) => Promise<void>
  openSectionsModal: () => Promise<void>
}

type OptionsMenuController = {
  close: () => void
  open: (anchor: HTMLElement) => Promise<void>
}

export function createOptionsMenuController({
  getOptionsMode,
  isHideEmptyEnabled,
  setHideEmptyEnabled,
  isRequiredOnlyEnabled,
  setRequiredOnlyEnabled,
  openSectionsModal
}: OptionsMenuDeps): OptionsMenuController {
  let outsideClickHandler: ((event: Event) => void) | null = null
  let outsideClickAttachTimer: number | null = null

  function stopOutsideClickListener(): void {
    if (outsideClickAttachTimer !== null) {
      window.clearTimeout(outsideClickAttachTimer)
      outsideClickAttachTimer = null
    }

    if (outsideClickHandler) {
      document.removeEventListener('click', outsideClickHandler, true)
      outsideClickHandler = null
    }
  }

  function close(): void {
    stopOutsideClickListener()
    const menu = document.getElementById(COMMAND_BAR_OPTIONS_MENU_ID)
    if (menu) menu.remove()
  }

  async function open(anchor: HTMLElement): Promise<void> {
    close()
    const mode = getOptionsMode()

    const menu = document.createElement('div')
    menu.id = COMMAND_BAR_OPTIONS_MENU_ID
    menu.style.cssText = [
      'position:absolute',
      'top:calc(100% + 8px)',
      'right:0',
      'width:360px',
      'max-width:calc(100vw - 24px)',
      'background:#ffffff',
      'border:1px solid #cfd8e6',
      'border-radius:14px',
      'box-shadow:0 14px 30px rgba(15,23,42,0.14), 0 2px 8px rgba(15,23,42,0.06)',
      'padding:16px',
      'z-index:2147483647'
    ].join(';')

    const title = document.createElement('div')
    title.textContent = 'Options'
    title.style.cssText = 'font:700 17px/1.2 Segoe UI,Arial,sans-serif;color:#0f172a;margin:0 0 4px;'

    const subtitle = document.createElement('div')
    subtitle.textContent = mode === 'edit' ? 'Edit mode controls' : 'Display and section controls'
    subtitle.style.cssText = 'font:500 12px/1.4 Segoe UI,Arial,sans-serif;color:#64748b;margin:0 0 14px;'

    const rows = document.createElement('div')
    rows.style.cssText = 'margin-top:2px;'

    function createToggleRow(params: {
      title: string
      hint: string
      checked: boolean
      ariaLabel: string
      accentColor: string
      onChange: (next: boolean) => Promise<void>
    }): HTMLElement {
      const row = document.createElement('label')
      row.style.cssText = [
        'box-sizing:border-box',
        'display:flex',
        'align-items:center',
        'justify-content:space-between',
        'gap:12px',
        'padding:12px 14px',
        'border-radius:11px',
        'border:1px solid #dbe2ee',
        'background:#f8fafc',
        'cursor:pointer'
      ].join(';')

      const labelWrap = document.createElement('span')
      labelWrap.style.cssText = 'display:flex;flex-direction:column;gap:2px;min-width:0;'

      const text = document.createElement('span')
      text.textContent = params.title
      text.style.cssText = 'font:700 13px/1.3 Segoe UI,Arial,sans-serif;color:#0f172a;'

      const hint = document.createElement('span')
      hint.textContent = params.hint
      hint.style.cssText = 'font:500 11px/1.3 Segoe UI,Arial,sans-serif;color:#64748b;'

      const toggle = document.createElement('input')
      toggle.type = 'checkbox'
      toggle.setAttribute('aria-label', params.ariaLabel)
      toggle.checked = params.checked
      toggle.style.cssText = `width:20px;height:20px;accent-color:${params.accentColor};cursor:pointer;flex:0 0 auto;`
      toggle.addEventListener('change', () => {
        void params.onChange(toggle.checked)
      })

      labelWrap.appendChild(text)
      labelWrap.appendChild(hint)
      row.appendChild(labelWrap)
      row.appendChild(toggle)
      return row
    }

    if (mode === 'edit') {
      rows.appendChild(
        createToggleRow({
          title: 'Required fields only',
          hint: 'Show only required fields while editing',
          checked: isRequiredOnlyEnabled(),
          ariaLabel: 'Required fields only',
          accentColor: '#16a34a',
          onChange: setRequiredOnlyEnabled
        })
      )
    } else {
      const sectionsAction = document.createElement('button')
      sectionsAction.type = 'button'
      sectionsAction.style.cssText = [
        'all:unset',
        'box-sizing:border-box',
        'display:grid',
        'grid-template-columns:minmax(0,1fr) auto',
        'align-items:center',
        'column-gap:12px',
        'width:100%',
        'padding:12px 14px',
        'border-radius:11px',
        'border:1px solid #dbe2ee',
        'background:#f8fafc',
        'color:#0f172a',
        'cursor:pointer',
        'text-align:left',
        'text-decoration:none',
        'font-family:Segoe UI,Arial,sans-serif'
      ].join(';')
      sectionsAction.addEventListener('click', () => {
        close()
        void openSectionsModal()
      })

      const sectionsLabelWrap = document.createElement('span')
      sectionsLabelWrap.style.cssText = 'display:flex;flex-direction:column;gap:2px;min-width:0;'

      const sectionsTitle = document.createElement('span')
      sectionsTitle.textContent = 'Manage Sections'
      sectionsTitle.style.cssText = 'font:700 13px/1.3 Segoe UI,Arial,sans-serif;color:#0f172a;text-decoration:none;'

      const sectionsHint = document.createElement('span')
      sectionsHint.textContent = 'Turn sections on to show, off to hide'
      sectionsHint.style.cssText = 'font:500 11px/1.3 Segoe UI,Arial,sans-serif;color:#64748b;text-decoration:none;'

      const sectionsActionTag = document.createElement('span')
      sectionsActionTag.textContent = 'Open'
      sectionsActionTag.style.cssText = [
        'display:inline-flex',
        'align-items:center',
        'justify-content:center',
        'min-width:52px',
        'height:24px',
        'padding:0 8px',
        'border-radius:999px',
        'font:700 11px/1 Segoe UI,Arial,sans-serif',
        'color:#1d4ed8',
        'background:#e8efff',
        'border:1px solid #c7d7fb',
        'text-decoration:none'
      ].join(';')

      sectionsLabelWrap.appendChild(sectionsTitle)
      sectionsLabelWrap.appendChild(sectionsHint)
      sectionsAction.appendChild(sectionsLabelWrap)
      sectionsAction.appendChild(sectionsActionTag)

      const optionRow = createToggleRow({
        title: 'Hide empty fields',
        hint: 'Automatically collapse fields with no value',
        checked: isHideEmptyEnabled(),
        ariaLabel: 'Hide empty fields',
        accentColor: '#2563eb',
        onChange: setHideEmptyEnabled
      })
      optionRow.style.marginTop = '10px'

      rows.appendChild(sectionsAction)
      rows.appendChild(optionRow)
    }

    menu.appendChild(title)
    menu.appendChild(subtitle)
    menu.appendChild(rows)
    anchor.appendChild(menu)

    outsideClickAttachTimer = window.setTimeout(() => {
      outsideClickAttachTimer = null
      outsideClickHandler = (event: Event) => {
        const target = event.target as Node | null
        if (target && !anchor.contains(target)) {
          close()
        }
      }
      document.addEventListener('click', outsideClickHandler, true)
    }, 0)
  }

  return { close, open }
}
