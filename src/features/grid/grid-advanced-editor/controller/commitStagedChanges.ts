import type { StagingManager } from '../services/staging.service'
import type { CommitProgress } from './commitHandler'
import {
  buildOriginalRowCommitEntry,
  isGridLookupSanitizePayloadType,
  normalizePayloadValue,
  resolveGridLookupValueToApiPath,
  sanitizeLookupPayloadValue,
  type CommitContext,
  type CommitFailure,
  type CommitResult,
  type GridCommitDataEntry
} from './commitPayload.helpers'

export async function commitStagedChanges(
  staging: StagingManager,
  context: CommitContext,
  onProgress: (progress: CommitProgress) => void
): Promise<CommitResult> {
  let successCount = 0
  const failures: CommitFailure[] = []

  const snapshot = staging.getSnapshot()
  const removals = [...snapshot.removals]
  const updates = [...snapshot.updates]
  const inserts = [...snapshot.inserts]
  const totalOps = removals.length + updates.length + inserts.length
  let completedOps = 0
  let removeCompleted = 0
  let updateCompleted = 0
  let insertCompleted = 0

  const emitProgress = (message: string, phase: CommitProgress['phase']): void => {
    if (phase === 'remove' || phase === 'complete') {
      onProgress({
        message,
        completed: Math.min(completedOps, totalOps),
        total: totalOps,
        phase,
        phaseCurrent: removeCompleted,
        phaseTotal: removals.length
      })
      return
    }
    if (phase === 'update') {
      onProgress({
        message,
        completed: Math.min(completedOps, totalOps),
        total: totalOps,
        phase,
        phaseCurrent: updateCompleted,
        phaseTotal: updates.length
      })
      return
    }
    onProgress({
      message,
      completed: Math.min(completedOps, totalOps),
      total: totalOps,
      phase,
      phaseCurrent: insertCompleted,
      phaseTotal: inserts.length
    })
  }

  emitProgress('Committing removals...', 'remove')
  await Promise.all(
    removals.map(async (domRowIndex) => {
      const model = context.modelByDomRowIndex.get(domRowIndex)
      const rowId = context.rowIdByDomRowIndex.get(domRowIndex) || model?.apiRow?.rowId || null
      const rowLabel = `Row ${domRowIndex + 1}`
      if (!model || !rowId) {
        failures.push({
          kind: 'remove',
          rowLabel,
          message: 'Missing row identifier for delete.',
          domRowIndex
        })
      } else {
        try {
          await context.ext.requestPlmAction('removeItemGridRow', {
            tenant: context.tenant,
            link: `/api/v3/workspaces/${context.workspaceId}/items/${context.dmsId}/views/${context.viewId}/rows/${rowId}`
          })
          staging.revertForDomRows([domRowIndex])
          successCount += 1
        } catch (error) {
          failures.push({
            kind: 'remove',
            rowLabel,
            message: error instanceof Error ? error.message : 'Delete request failed.',
            domRowIndex
          })
        }
      }
      removeCompleted += 1
      completedOps += 1
      emitProgress('Committing removals...', 'remove')
    })
  )

  emitProgress('Committing updates...', 'update')
  await Promise.all(
    updates.map(async (update) => {
      const domRowIndex = update.domRowIndex
      const model = context.modelByDomRowIndex.get(domRowIndex)
      const rowId = context.rowIdByDomRowIndex.get(domRowIndex) || model?.apiRow?.rowId || null
      const rowLabel = `Row ${domRowIndex + 1}`
      if (!model || !rowId) {
        failures.push({
          kind: 'update',
          rowLabel,
          message: 'Missing row identifier for update.',
          domRowIndex
        })
      } else {
        const rowChanges = new Map(update.payload.map((v) => [v.fieldId, v.value]))
        const rowDisplay = new Map(update.display.map((v) => [v.fieldId, v.value]))
        const basePayload = context.fullRowPayloadByDomRowIndex?.get(domRowIndex) || new Map<string, string>()
        const baseDisplay = context.fullRowDisplayByDomRowIndex?.get(domRowIndex) || new Map<string, string>()
        const mergedPayload = new Map<string, string>(basePayload)
        const mergedDisplay = new Map<string, string>(baseDisplay)
        for (const [fieldId, value] of rowChanges.entries()) {
          mergedPayload.set(fieldId, value)
          const nextDisplay = rowDisplay.get(fieldId)
          if (typeof nextDisplay === 'string') mergedDisplay.set(fieldId, nextDisplay)
        }

        const data: GridCommitDataEntry[] = []
        const fieldIds = new Set<string>([
          ...Array.from(model.apiRow?.rawByFieldId.keys() || []),
          ...Array.from(mergedPayload.keys())
        ])
        for (const fieldId of fieldIds) {
          const field = context.fieldById.get(fieldId)
          const payloadType = field ? context.toGridPayloadType(field) : ''
          if (!rowChanges.has(fieldId)) {
            const originalEntry = buildOriginalRowCommitEntry(fieldId, field, model)
            if (originalEntry) {
              data.push({
                ...originalEntry,
                type: payloadType
              })
            }
            continue
          }
          if (!field) continue
          const value = mergedPayload.get(fieldId) || ''
          const sanitizedValue = sanitizeLookupPayloadValue(payloadType, value, basePayload.get(fieldId) || '')
          let commitValueStr = sanitizedValue
          if (isGridLookupSanitizePayloadType(payloadType)) {
            commitValueStr = await resolveGridLookupValueToApiPath(
              field,
              payloadType,
              sanitizedValue,
              String(mergedDisplay.get(fieldId) || '')
            )
          }
          data.push({
            fieldId,
            type: payloadType,
            value: normalizePayloadValue(payloadType, commitValueStr),
            display: String(mergedDisplay.get(fieldId) || ''),
            title: String(field.title || ''),
            typeId: field.typeId ?? null,
            typeLink: field.typeLink ?? null,
            typeUrn: field.typeUrn ?? null,
            typeTitle: field.typeTitle ?? null,
            fieldSelf: field.fieldSelf ?? null,
            fieldUrn: field.fieldUrn ?? null
          })
        }

        if (data.length === 0) {
          completedOps += 1
          emitProgress('Committing updates...', 'update')
          return
        }

        try {
          await context.ext.requestPlmAction('updateItemGridRow', {
            tenant: context.tenant,
            workspaceId: context.workspaceId,
            dmsId: context.dmsId,
            viewId: context.viewId,
            rowId,
            data
          })
          staging.revertForDomRows([domRowIndex])
          successCount += 1
        } catch (error) {
          failures.push({
            kind: 'update',
            rowLabel,
            message: error instanceof Error ? error.message : 'Update request failed.',
            domRowIndex
          })
        }
      }
      updateCompleted += 1
      completedOps += 1
      emitProgress('Committing updates...', 'update')
    })
  )

  emitProgress('Committing inserts...', 'insert')
  const failedInsertIndexes = new Set<number>()
  await Promise.all(
    inserts.map(async (insert, index) => {
      const data: GridCommitDataEntry[] = []
      for (const { fieldId, value } of insert.payload) {
        const field = context.fieldById.get(fieldId)
        if (!field) continue
        const payloadType = context.toGridPayloadType(field)
        const sanitizedValue = sanitizeLookupPayloadValue(payloadType, value)
        const displayStr = String(insert.display.find((d) => d.fieldId === fieldId)?.value || '')
        let commitValueStr = sanitizedValue
        if (isGridLookupSanitizePayloadType(payloadType)) {
          commitValueStr = await resolveGridLookupValueToApiPath(field, payloadType, sanitizedValue, displayStr)
        }
        data.push({
          fieldId,
          type: payloadType,
          value: normalizePayloadValue(payloadType, commitValueStr),
          display: displayStr,
          title: String(field.title || ''),
          typeId: field.typeId ?? null,
          typeLink: field.typeLink ?? null,
          typeUrn: field.typeUrn ?? null,
          typeTitle: field.typeTitle ?? null,
          fieldSelf: field.fieldSelf ?? null,
          fieldUrn: field.fieldUrn ?? null
        })
      }

      if (data.length === 0) {
        completedOps += 1
        emitProgress('Committing inserts...', 'insert')
        return
      }

      try {
        await context.ext.requestPlmAction('addItemGridRow', {
          tenant: context.tenant,
          workspaceId: context.workspaceId,
          dmsId: context.dmsId,
          viewId: context.viewId,
          data
        })
        successCount += 1
      } catch (error) {
        failures.push({
          kind: 'insert',
          rowLabel: `New Row ${index + 1}`,
          message: error instanceof Error ? error.message : 'Insert request failed.',
          insertIndex: index
        })
        failedInsertIndexes.add(index)
      }

      insertCompleted += 1
      completedOps += 1
      emitProgress('Committing inserts...', 'insert')
    })
  )

  if (failedInsertIndexes.size > 0) {
    const removeIndexes: number[] = []
    for (let index = 0; index < inserts.length; index += 1) {
      if (!failedInsertIndexes.has(index)) removeIndexes.push(index)
    }
    staging.removeInsertDrafts(removeIndexes)
    const failedIndexOrder = Array.from(failedInsertIndexes.values()).sort((a, b) => a - b)
    for (const failure of failures) {
      if (failure.kind !== 'insert' || !Number.isFinite(failure.insertIndex)) continue
      const normalized = failedIndexOrder.indexOf(Number(failure.insertIndex))
      if (normalized >= 0) failure.insertIndex = normalized
    }
  } else if (inserts.length > 0) {
    staging.removeInsertDrafts(inserts.map((_, index) => index))
  }

  completedOps = totalOps
  emitProgress('Commit finished.', 'complete')
  return { successCount, failures }
}

/**
 * Binds add/edit/clone/remove/revert/commit handlers for current modal session.
 */
