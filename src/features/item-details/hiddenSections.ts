import {
  EXTENSION_SECTION_HIDDEN_ATTR,
  EXTENSION_SECTION_WRAPPER_HIDDEN_ATTR,
  SECTION_SELECTOR,
  SECTIONS_MODAL_ID,
  SECTIONS_VISIBILITY_STORAGE_KEY
} from './item-details.constants'
import type { ItemDetailsRuntime, SectionsVisibilityMap } from './item-details.types'
import { getAllSectionMeta, getWorkspaceIdFromUrl } from './item-details.utils'

type HiddenSectionsFeature = {
  applyHiddenSectionsForCurrentWorkspace: () => Promise<void>
  scheduleApplySectionVisibility: () => void
  ensureSectionVisibilityObserver: () => void
  suspendForSearch: () => void
  resumeFromSearch: () => void
  openSectionsModal: () => Promise<void>
  closeSectionsModal: () => void
  resetSectionVisibility: () => void
  cleanup: () => void
}

export function createHiddenSectionsFeature(ext: ItemDetailsRuntime): HiddenSectionsFeature {
  let hiddenSectionsMapCache: SectionsVisibilityMap | null = null
  let sectionVisibilityApplyTimer: number | null = null
  let sectionVisibilityObserver: MutationObserver | null = null
  let hiddenSectionsSuspendedForSearch = false

  async function getHiddenSectionsMap(): Promise<SectionsVisibilityMap> {
    if (hiddenSectionsMapCache) return hiddenSectionsMapCache
    hiddenSectionsMapCache = await ext.getLocalOptions(SECTIONS_VISIBILITY_STORAGE_KEY, {} as SectionsVisibilityMap)
    return hiddenSectionsMapCache
  }

  async function setHiddenSectionsMap(nextMap: SectionsVisibilityMap): Promise<void> {
    hiddenSectionsMapCache = nextMap
    await ext.setLocalOptions(SECTIONS_VISIBILITY_STORAGE_KEY, nextMap)
  }

  async function getHiddenSectionKeysForWorkspace(wsId: number): Promise<Set<string>> {
    const map = await getHiddenSectionsMap()
    const keys = Array.isArray(map[String(wsId)]) ? map[String(wsId)] : []
    return new Set(keys)
  }

  async function setHiddenSectionKeysForWorkspace(wsId: number, keys: string[]): Promise<void> {
    const map = await getHiddenSectionsMap()
    map[String(wsId)] = keys
    await setHiddenSectionsMap(map)
  }

  function setSectionHiddenByExtension(section: HTMLElement, hidden: boolean): void {
    const structuralWrapper =
      section.parentElement && section.parentElement.children.length === 1
        ? (section.parentElement as HTMLElement)
        : null

    if (hidden) {
      section.style.display = 'none'
      section.setAttribute(EXTENSION_SECTION_HIDDEN_ATTR, '1')
      if (structuralWrapper) {
        structuralWrapper.style.display = 'none'
        structuralWrapper.setAttribute(EXTENSION_SECTION_WRAPPER_HIDDEN_ATTR, '1')
      }
    } else if (section.hasAttribute(EXTENSION_SECTION_HIDDEN_ATTR)) {
      section.style.removeProperty('display')
      section.removeAttribute(EXTENSION_SECTION_HIDDEN_ATTR)
      if (structuralWrapper?.hasAttribute(EXTENSION_SECTION_WRAPPER_HIDDEN_ATTR)) {
        structuralWrapper.style.removeProperty('display')
        structuralWrapper.removeAttribute(EXTENSION_SECTION_WRAPPER_HIDDEN_ATTR)
      }
    }
  }

  async function applyHiddenSectionsForCurrentWorkspace(): Promise<void> {
    if (hiddenSectionsSuspendedForSearch) {
      resetSectionVisibility()
      return
    }

    const wsId = getWorkspaceIdFromUrl(window.location.href)
    const sections = getAllSectionMeta()

    if (!wsId) {
      for (const meta of sections) setSectionHiddenByExtension(meta.section, false)
      return
    }

    const hiddenKeys = await getHiddenSectionKeysForWorkspace(wsId)
    for (const meta of sections) {
      setSectionHiddenByExtension(meta.section, hiddenKeys.has(meta.key))
    }
  }

  function resetSectionVisibility(): void {
    const hiddenSections = Array.from(document.querySelectorAll(`[${EXTENSION_SECTION_HIDDEN_ATTR}="1"]`)) as HTMLElement[]
    for (const section of hiddenSections) {
      section.style.removeProperty('display')
      section.removeAttribute(EXTENSION_SECTION_HIDDEN_ATTR)
    }

    const hiddenWrappers = Array.from(
      document.querySelectorAll(`[${EXTENSION_SECTION_WRAPPER_HIDDEN_ATTR}="1"]`)
    ) as HTMLElement[]
    for (const wrapper of hiddenWrappers) {
      wrapper.style.removeProperty('display')
      wrapper.removeAttribute(EXTENSION_SECTION_WRAPPER_HIDDEN_ATTR)
    }
  }

  function stopSectionVisibilityApplyTimer(): void {
    if (sectionVisibilityApplyTimer !== null) {
      window.clearTimeout(sectionVisibilityApplyTimer)
      sectionVisibilityApplyTimer = null
    }
  }

  function scheduleApplySectionVisibility(): void {
    if (hiddenSectionsSuspendedForSearch) {
      resetSectionVisibility()
      return
    }

    stopSectionVisibilityApplyTimer()
    sectionVisibilityApplyTimer = window.setTimeout(() => {
      sectionVisibilityApplyTimer = null
      void applyHiddenSectionsForCurrentWorkspace()
    }, 80)
  }

  function stopSectionVisibilityObserver(): void {
    if (sectionVisibilityObserver) {
      sectionVisibilityObserver.disconnect()
      sectionVisibilityObserver = null
    }
  }

  function ensureSectionVisibilityObserver(): void {
    if (sectionVisibilityObserver || hiddenSectionsSuspendedForSearch) return

    sectionVisibilityObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of Array.from(mutation.addedNodes)) {
          if (!(node instanceof HTMLElement)) continue
          if (node.matches(SECTION_SELECTOR) || node.querySelector(SECTION_SELECTOR)) {
            scheduleApplySectionVisibility()
            return
          }
        }
      }
    })

    sectionVisibilityObserver.observe(document.documentElement, {
      childList: true,
      subtree: true
    })
  }

  function suspendForSearch(): void {
    if (hiddenSectionsSuspendedForSearch) return
    hiddenSectionsSuspendedForSearch = true
    stopSectionVisibilityApplyTimer()
    stopSectionVisibilityObserver()
    resetSectionVisibility()
  }

  function resumeFromSearch(): void {
    if (!hiddenSectionsSuspendedForSearch) return
    hiddenSectionsSuspendedForSearch = false
    ensureSectionVisibilityObserver()
    scheduleApplySectionVisibility()
  }

  function closeSectionsModal(): void {
    const modal = document.getElementById(SECTIONS_MODAL_ID)
    if (modal) modal.remove()
  }

  async function openSectionsModal(): Promise<void> {
    closeSectionsModal()

    const wsId = getWorkspaceIdFromUrl(window.location.href)
    const overlay = document.createElement('div')
    overlay.id = SECTIONS_MODAL_ID
    overlay.style.cssText = [
      'position:fixed',
      'inset:0',
      'background:rgba(15,23,42,0.45)',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'z-index:2147483647'
    ].join(';')

    const panel = document.createElement('div')
    panel.style.cssText = [
      'width:min(520px,92vw)',
      'max-height:min(70vh,680px)',
      'overflow:auto',
      'background:#ffffff',
      'border:1px solid #d8dee9',
      'border-radius:12px',
      'box-shadow:0 22px 40px rgba(16,24,40,0.24)',
      'padding:16px'
    ].join(';')

    const title = document.createElement('h3')
    title.textContent = 'Manage Sections'
    title.style.cssText = 'margin:0 0 4px;font:700 18px/1.3 Segoe UI,Arial,sans-serif;color:#0f172a;'

    const subtitle = document.createElement('p')
    subtitle.style.cssText = 'margin:0 0 14px;font:500 12px/1.4 Segoe UI,Arial,sans-serif;color:#64748b;'
    subtitle.textContent = wsId
      ? `Workspace ${wsId}: turn sections on to show and off to hide.`
      : 'Workspace could not be resolved for this URL.'

    panel.appendChild(title)
    panel.appendChild(subtitle)

    if (!wsId) {
      const closeOnly = document.createElement('button')
      closeOnly.type = 'button'
      closeOnly.textContent = 'Close'
      closeOnly.style.cssText = [
        'border:none',
        'padding:8px 14px',
        'border-radius:8px',
        'background:#2563eb',
        'color:#fff',
        'cursor:pointer',
        'font:600 12px/1 Segoe UI,Arial,sans-serif'
      ].join(';')
      closeOnly.addEventListener('click', closeSectionsModal)
      panel.appendChild(closeOnly)
      overlay.appendChild(panel)
      document.body.appendChild(overlay)
      return
    }

    const sections = getAllSectionMeta()
    const hiddenKeys = await getHiddenSectionKeysForWorkspace(wsId)
    const hiddenSelection = new Set(hiddenKeys)

    const list = document.createElement('div')
    list.style.cssText = 'display:flex;flex-direction:column;gap:6px;margin-bottom:14px;'

    for (const meta of sections) {
      const row = document.createElement('label')
      row.style.cssText = [
        'display:flex',
        'align-items:center',
        'justify-content:space-between',
        'gap:12px',
        'padding:9px 12px',
        'border:1px solid #dbe2ee',
        'border-radius:10px',
        'background:#f8fafc',
        'color:#1e293b',
        'cursor:pointer'
      ].join(';')

      const labelWrap = document.createElement('span')
      labelWrap.style.cssText = 'display:flex;align-items:center;gap:8px;min-width:0;'

      const text = document.createElement('span')
      text.textContent = meta.label
      text.style.cssText = 'font:700 13px/1.3 Segoe UI,Arial,sans-serif;color:#0f172a;'

      const state = document.createElement('span')
      state.style.cssText = 'font:600 12px/1.3 Segoe UI,Arial,sans-serif;white-space:nowrap;'

      const checkbox = document.createElement('input')
      checkbox.type = 'checkbox'
      checkbox.checked = !hiddenSelection.has(meta.key)
      checkbox.style.cssText = 'width:18px;height:18px;accent-color:#16a34a;cursor:pointer;'

      const updateStateLabel = (): void => {
        if (checkbox.checked) {
          state.textContent = '(Visible)'
          state.style.color = '#166534'
        } else {
          state.textContent = '(Hidden)'
          state.style.color = '#9f1239'
        }
      }
      updateStateLabel()

      checkbox.addEventListener('change', () => {
        if (checkbox.checked) {
          hiddenSelection.delete(meta.key)
        } else {
          hiddenSelection.add(meta.key)
        }
        updateStateLabel()
      })

      labelWrap.appendChild(text)
      labelWrap.appendChild(state)
      row.appendChild(labelWrap)
      row.appendChild(checkbox)
      list.appendChild(row)
    }

    const actions = document.createElement('div')
    actions.style.cssText = 'display:flex;justify-content:flex-end;gap:8px;'

    const cancelBtn = document.createElement('button')
    cancelBtn.type = 'button'
    cancelBtn.textContent = 'Cancel'
    cancelBtn.style.cssText =
      'border:1px solid #cbd5e1;padding:8px 14px;border-radius:8px;background:#fff;color:#334155;cursor:pointer;font:600 12px/1 Segoe UI,Arial,sans-serif'
    cancelBtn.addEventListener('click', closeSectionsModal)

    const applyBtn = document.createElement('button')
    applyBtn.type = 'button'
    applyBtn.textContent = 'Apply'
    applyBtn.style.cssText =
      'border:none;padding:8px 14px;border-radius:8px;background:#2563eb;color:#fff;cursor:pointer;font:600 12px/1 Segoe UI,Arial,sans-serif'
    applyBtn.addEventListener('click', async () => {
      await setHiddenSectionKeysForWorkspace(wsId, Array.from(hiddenSelection))
      await applyHiddenSectionsForCurrentWorkspace()
      closeSectionsModal()
    })

    actions.appendChild(cancelBtn)
    actions.appendChild(applyBtn)
    panel.appendChild(list)
    panel.appendChild(actions)
    overlay.appendChild(panel)

    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) closeSectionsModal()
    })

    document.body.appendChild(overlay)
  }

  function cleanup(): void {
    hiddenSectionsSuspendedForSearch = false
    stopSectionVisibilityApplyTimer()
    stopSectionVisibilityObserver()
    resetSectionVisibility()
    closeSectionsModal()
  }

  return {
    applyHiddenSectionsForCurrentWorkspace,
    scheduleApplySectionVisibility,
    ensureSectionVisibilityObserver,
    suspendForSearch,
    resumeFromSearch,
    openSectionsModal,
    closeSectionsModal,
    resetSectionVisibility,
    cleanup
  }
}
