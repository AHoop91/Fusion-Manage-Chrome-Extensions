import type { ItemDetailsStateSnapshot } from '../item-details.types'

type ItemDetailsViewDeps = {
  hideEmpty: {
    sync: () => Promise<void>
    scheduleApply: () => void
    cleanup: () => void
  }
  hiddenSections: {
    ensureSectionVisibilityObserver: () => void
    scheduleApplySectionVisibility: () => void
    cleanup: () => void
  }
  requiredOnly: {
    sync: () => Promise<void>
    scheduleApply: () => void
    cleanup: () => void
  }
}

export type ItemDetailsView = {
  render: (snapshot: ItemDetailsStateSnapshot, options: { loading: boolean }) => void
}

export function createItemDetailsView(deps: ItemDetailsViewDeps): ItemDetailsView {
  function applyViewMode(): void {
    deps.requiredOnly.cleanup()
    deps.hiddenSections.ensureSectionVisibilityObserver()
    deps.hiddenSections.scheduleApplySectionVisibility()
    void deps.hideEmpty.sync()
  }

  function applyEditMode(): void {
    deps.hideEmpty.cleanup()
    deps.hiddenSections.cleanup()
    void deps.requiredOnly.sync()
  }

  return {
    render(snapshot, options) {
      if (options.loading) return

      if (snapshot.optionsMode === 'edit') {
        applyEditMode()
        return
      }

      applyViewMode()
    }
  }
}
