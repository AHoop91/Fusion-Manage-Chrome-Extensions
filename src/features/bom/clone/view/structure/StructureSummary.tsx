import React from 'react'
import type { BomCloneStateSnapshot } from '../../clone.types'
import type { CloneStructureViewModel } from '../../services/viewModel.service'
import { buildCommitProgressBreakdown, buildOperationCounts } from '../../services/viewModel.service'

type OperationPillTone = 'delete' | 'update' | 'new' | 'add'

type OperationPill = {
  label: string
  count: number
  tone: OperationPillTone
}

type CommitCategory = {
  label: string
  done: number
  total: number
  tone: OperationPillTone
}

function buildOperationPills(
  snapshot: BomCloneStateSnapshot,
  structureContext: CloneStructureViewModel
): OperationPill[] {
  const { deleteCount, updateCount, addCount, createCount, newCount } = buildOperationCounts(snapshot, structureContext)
  const pills: OperationPill[] = []
  if (createCount > 0) pills.push({ label: 'New', count: createCount, tone: 'new' })
  if (deleteCount > 0) pills.push({ label: 'Remove', count: deleteCount, tone: 'delete' })
  if (snapshot.cloneLaunchMode === 'manufacturing') {
    if (addCount > 0) pills.push({ label: 'Add', count: addCount, tone: 'add' })
  } else if (newCount > 0) {
    pills.push({ label: 'Add', count: newCount, tone: 'add' })
  }
  if (updateCount > 0) pills.push({ label: 'Update', count: updateCount, tone: 'update' })
  return pills
}

function buildCommitCategories(
  snapshot: BomCloneStateSnapshot,
  structureContext: CloneStructureViewModel
): CommitCategory[] {
  const counts = buildOperationCounts(snapshot, structureContext)
  const { deleteCount, updateCount, addCount, createCount, newCount } = counts
  const {
    createDone,
    deleteDone,
    addDone,
    updateDone,
    newDone
  } = buildCommitProgressBreakdown(snapshot, counts)

  const categories: CommitCategory[] = []
  if (createCount > 0) categories.push({ label: 'New', done: createDone, total: createCount, tone: 'new' })
  if (deleteCount > 0) categories.push({ label: 'Remove', done: deleteDone, total: deleteCount, tone: 'delete' })
  if (snapshot.cloneLaunchMode === 'manufacturing') {
    if (addCount > 0) categories.push({ label: 'Add', done: addDone, total: addCount, tone: 'add' })
  } else if (newCount > 0) {
    categories.push({ label: 'Add', done: newDone, total: newCount, tone: 'add' })
  }
  if (updateCount > 0) categories.push({ label: 'Update', done: updateDone, total: updateCount, tone: 'update' })
  return categories
}

export function CloneOperationSummary(props: {
  snapshot: BomCloneStateSnapshot
  structureContext: CloneStructureViewModel
}): React.JSX.Element | null {
  const { snapshot, structureContext } = props
  const pills = buildOperationPills(snapshot, structureContext)
  if (pills.length === 0) return null

  return (
    <div className="plm-extension-bom-structure-summary">
      <div className="plm-extension-bom-structure-summary-pills">
        {pills.map((pill) => (
          <span
            key={`${pill.tone}:${pill.label}`}
            className={`plm-extension-bom-structure-summary-pill is-${pill.tone}`}
          >
            {`${pill.label} (${pill.count})`}
          </span>
        ))}
      </div>
    </div>
  )
}

export function CloneCommitProgressOverlay(props: {
  snapshot: BomCloneStateSnapshot
  structureContext: CloneStructureViewModel
}): React.JSX.Element {
  const { snapshot, structureContext } = props
  const counts = buildOperationCounts(snapshot, structureContext)
  const { overallTotal, overallCurrent } = buildCommitProgressBreakdown(snapshot, counts)
  const categories = buildCommitCategories(snapshot, structureContext)

  return (
    <div className="plm-extension-bom-commit-overlay">
      <div className="plm-extension-bom-commit-panel">
        <h4 className="plm-extension-bom-commit-title">Committing Processes</h4>
        <p className="plm-extension-bom-commit-message">{`Processing ${overallCurrent}/${overallTotal}`}</p>
        <div className="plm-extension-bom-commit-operations-title">Processes</div>
        <div className="plm-extension-bom-commit-rows">
          {categories.map((category) => {
            const percent = category.total > 0
              ? Math.round((Math.max(0, Math.min(category.done, category.total)) / category.total) * 100)
              : 0
            return (
              <div key={`${category.tone}:${category.label}`} className={`plm-extension-bom-commit-row is-${category.tone}`}>
                <span className="plm-extension-bom-commit-row-label">{category.label}</span>
                <span className="plm-extension-bom-commit-row-track">
                  <span className="plm-extension-bom-commit-row-fill" style={{ width: `${percent}%` }} />
                </span>
                <span className="plm-extension-bom-commit-row-value">{`${category.done}/${category.total}`}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
