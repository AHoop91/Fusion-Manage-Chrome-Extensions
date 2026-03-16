import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { TEMP_OPERATION_NAME_FIELD_ID, type BomCloneStateSnapshot } from '../../clone.types'
import {
  buildEditPanelViewModel,
  computeRequiredFieldCompletion
} from '../../services/viewModel.service'
import { findNode } from '../../services/structure/tree.service'
import { isManufacturingProcessNodeId } from '../../services/structure/structure.service'
import { UnsavedEditDialog } from '../dialogs/UnsavedEditDialog'
import { syncCloneFormQtyInput, syncCloneFormRequiredIndicator } from '../form/adapters/hostDomSync'
import { CloneFormRenderer } from '../form/FormRenderer'
import { EDIT_PANEL_FORM_FIELDS_ROOT_ID } from '../form/form.constants'
import { useCloneForm } from '../form/hooks/useCloneForm'
import { useFieldVisibility } from '../form/hooks/useFieldVisibility'
import { mapEditPanelModelToFormSchema } from '../form/model/form.mappers'
import { Loader } from '../shell/Loader'

export const EDIT_PANEL_FIELDS_ROOT_ID = EDIT_PANEL_FORM_FIELDS_ROOT_ID
const editPanelDraftCache = new Map<string, Record<string, string>>()
const editPanelBaselineSignatureCache = new Map<string, string>()

const EMPTY_FORM_VALUES: Record<string, string> = Object.freeze({})

export type CloneEditPanelHandlers = {
  onCloseEditPanel: (options?: { discardDraft?: boolean }) => void
  onSaveEditPanel: (nodeId: string, values: Record<string, string>) => void
  onToggleEditPanelRequiredOnly: (value: boolean) => void
}

export type CloneEditPanelRenderOptions = {
  modalRoot: HTMLDivElement
  snapshot: BomCloneStateSnapshot
  handlers: CloneEditPanelHandlers
  applyRequiredIndicator: (
    indicator: HTMLSpanElement,
    completion: ReturnType<typeof computeRequiredFieldCompletion>
  ) => void
}

function buildEditPanelDraftCacheKey(nodeId: string, mode: BomCloneStateSnapshot['editingPanelMode']): string {
  return `${mode}:${nodeId}`
}

function toValueSignature(values: Record<string, string>): string {
  const entries = Object.entries(values).sort(([a], [b]) => a.localeCompare(b))
  return JSON.stringify(entries)
}

function hasTemporaryOperationName(values: Record<string, string>, isOperationItemDetailsMode: boolean): boolean {
  if (!isOperationItemDetailsMode) return true
  return String(values[TEMP_OPERATION_NAME_FIELD_ID] || '').trim().length > 0
}

export function CloneEditPanel(props: CloneEditPanelRenderOptions): React.JSX.Element | null {
  const { modalRoot, snapshot, handlers, applyRequiredIndicator } = props
  const nodeId = snapshot.editingNodeId
  const baselineSignatureRef = useRef('')

  const panelState = useMemo(() => {
    if (!nodeId) return null
    const draftCacheKey = buildEditPanelDraftCacheKey(nodeId, snapshot.editingPanelMode)
    const cachedDraftValues = editPanelDraftCache.get(draftCacheKey) || null
    const editingTargetNode = findNode(snapshot.targetBomTree, nodeId)
    const isOperationDraft = Boolean(
      editingTargetNode?.stagedOperationDraft
      && String(editingTargetNode?.id || '').startsWith('staged-operation:')
    )
    const isBomDetailsMode = snapshot.editingPanelMode === 'bom'
    const isProcessNode = snapshot.cloneLaunchMode === 'manufacturing'
      && isManufacturingProcessNodeId(snapshot, nodeId)
    const isOperationItemDetailsMode = !isBomDetailsMode && (isOperationDraft || isProcessNode)
    const usesExplicitSave = isOperationItemDetailsMode || isBomDetailsMode || snapshot.cloneLaunchMode === 'engineering'
    const editPanelModel = buildEditPanelViewModel(snapshot, nodeId)
    const operationTitleFieldId = isOperationItemDetailsMode
      ? (
          editPanelModel.fields.find((field) => String(field.fieldId || '').trim().toUpperCase() === 'TITLE')?.fieldId
          || editPanelModel.fields.find((field) => String(field.title || '').trim().toLowerCase() === 'title')?.fieldId
          || null
        )
      : null
    const initialTemporaryOperationName = isOperationItemDetailsMode
      ? String(
          cachedDraftValues?.[TEMP_OPERATION_NAME_FIELD_ID]
          || editingTargetNode?.label
          || (operationTitleFieldId ? editPanelModel.activeInsertDraft.display.get(operationTitleFieldId) : '')
          || ''
        ).trim()
      : ''

    if (cachedDraftValues) {
      for (const [fieldId, fieldValue] of Object.entries(cachedDraftValues)) {
        if (fieldId === TEMP_OPERATION_NAME_FIELD_ID) continue
        editPanelModel.activeInsertDraft.payload.set(fieldId, fieldValue)
        editPanelModel.activeInsertDraft.display.set(fieldId, fieldValue)
      }
    }

    return {
      nodeId,
      draftCacheKey,
      editingTargetNode,
      editPanelModel,
      isOperationDraft,
      isBomDetailsMode,
      isOperationItemDetailsMode,
      usesExplicitSave,
      fieldsLoading: isOperationItemDetailsMode ? snapshot.operationFormFieldsLoading : snapshot.bomViewFieldsLoading,
      fieldsError: isOperationItemDetailsMode ? snapshot.operationFormFieldsError : null,
      initialTemporaryOperationName,
      initialValues: Object.fromEntries(editPanelModel.activeInsertDraft.payload.entries()),
      initialDisplayValues: Object.fromEntries(editPanelModel.activeInsertDraft.display.entries())
    }
  }, [nodeId, snapshot])

  const initialFieldValues = panelState?.initialValues || EMPTY_FORM_VALUES
  const initialFieldDisplayValues = panelState?.initialDisplayValues || EMPTY_FORM_VALUES
  const { values: fieldValues, displayValues: fieldDisplayValues, updateField } = useCloneForm({
    initialValues: initialFieldValues,
    initialDisplayValues: initialFieldDisplayValues
  })
  const [temporaryOperationName, setTemporaryOperationName] = useState('')
  const [isDirty, setIsDirty] = useState(false)
  const [isTempNamePresent, setIsTempNamePresent] = useState(true)
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false)
  const [pendingDiscardDraft, setPendingDiscardDraft] = useState(false)
  const formSchema = useMemo(
    () => (panelState ? mapEditPanelModelToFormSchema(panelState.editPanelModel, panelState.isOperationItemDetailsMode) : null),
    [panelState]
  )
  const {
    visibleFields,
    visibleSections,
    showNoFilteredFields
  } = useFieldVisibility(formSchema, snapshot.editPanelRequiredOnly)

  useEffect(() => {
    if (!panelState) return
    setTemporaryOperationName(panelState.initialTemporaryOperationName)
    baselineSignatureRef.current = ''
    setIsDirty(false)
    setIsTempNamePresent(!panelState.isOperationItemDetailsMode || Boolean(panelState.initialTemporaryOperationName))
    setShowUnsavedDialog(false)
    setPendingDiscardDraft(false)
  }, [panelState])

  const collectValues = useCallback((temporaryNameOverride?: string, nextFieldValues?: Record<string, string>) => {
    if (!panelState) return {}
    const values = {
      ...(nextFieldValues || fieldValues),
      ...(panelState.isOperationItemDetailsMode ? { [TEMP_OPERATION_NAME_FIELD_ID]: String(temporaryNameOverride ?? temporaryOperationName).trim() } : {})
    }
    return values
  }, [panelState, fieldValues, temporaryOperationName])

  const updateEditingRowRequiredIndicator = useCallback((values: Record<string, string>) => {
    if (!panelState) return
    syncCloneFormRequiredIndicator({
      modalRoot,
      nodeId: panelState.nodeId,
      requiredFields: panelState.editPanelModel.requiredEditableFields,
      values,
      applyRequiredIndicator
    })
  }, [panelState, modalRoot, applyRequiredIndicator])

  const syncQtyInputFromValues = useCallback((values: Record<string, string>) => {
    if (!panelState) return
    syncCloneFormQtyInput({
      modalRoot,
      nodeId: panelState.nodeId,
      values,
      quantityFieldId: panelState.editPanelModel.quantityFieldId,
      fallbackQuantity: panelState.editPanelModel.fallbackQuantity
    })
  }, [panelState, modalRoot])

  const cacheValues = useCallback((nextFieldValues?: Record<string, string>, temporaryNameOverride?: string): Record<string, string> => {
    if (!panelState) return {}
    const currentValues = collectValues(temporaryNameOverride, nextFieldValues)
    const previous = editPanelDraftCache.get(panelState.draftCacheKey) || {}
    const merged = { ...previous, ...currentValues }
    editPanelDraftCache.set(panelState.draftCacheKey, merged)
    return merged
  }, [panelState, collectValues])

  const refreshDirtyState = useCallback((temporaryNameOverride?: string, nextFieldValues?: Record<string, string>) => {
    if (!panelState || !panelState.usesExplicitSave) return
    const values = cacheValues(nextFieldValues, temporaryNameOverride)
    const tempNamePresent = hasTemporaryOperationName(values, panelState.isOperationItemDetailsMode)
    setIsTempNamePresent(tempNamePresent)
    setIsDirty(toValueSignature(values) !== baselineSignatureRef.current)
  }, [panelState, cacheValues])

  const persistDraft = useCallback((temporaryNameOverride?: string, nextFieldValues?: Record<string, string>) => {
    if (!panelState) return
    const values = collectValues(temporaryNameOverride, nextFieldValues)
    const tempNamePresent = hasTemporaryOperationName(values, panelState.isOperationItemDetailsMode)
    setIsTempNamePresent(tempNamePresent)
    if (panelState.isOperationDraft && !tempNamePresent) {
      cacheValues(nextFieldValues, temporaryNameOverride)
      if (panelState.usesExplicitSave) setIsDirty(true)
      return
    }
    if (panelState.usesExplicitSave) {
      baselineSignatureRef.current = toValueSignature(values)
      editPanelBaselineSignatureCache.set(panelState.draftCacheKey, baselineSignatureRef.current)
      editPanelDraftCache.delete(panelState.draftCacheKey)
      setIsDirty(false)
    }
    handlers.onSaveEditPanel(panelState.nodeId, values)
    updateEditingRowRequiredIndicator(values)
    syncQtyInputFromValues(values)
  }, [panelState, collectValues, cacheValues, handlers, updateEditingRowRequiredIndicator, syncQtyInputFromValues])

  useEffect(() => {
    if (!panelState || !panelState.usesExplicitSave) return
    const initialValues = collectValues()
    const baseline = editPanelBaselineSignatureCache.get(panelState.draftCacheKey) || toValueSignature(initialValues)
    baselineSignatureRef.current = baseline
    if (!editPanelBaselineSignatureCache.has(panelState.draftCacheKey)) {
      editPanelBaselineSignatureCache.set(panelState.draftCacheKey, baseline)
    }
    const tempNamePresent = hasTemporaryOperationName(initialValues, panelState.isOperationItemDetailsMode)
    setIsTempNamePresent(tempNamePresent)
    const initialSignature = toValueSignature(initialValues)
    setIsDirty(initialSignature !== baseline)
    if (initialSignature === baseline) editPanelDraftCache.delete(panelState.draftCacheKey)
  }, [panelState, collectValues])

  const closePanel = useCallback((shouldDiscardDraft: boolean) => {
    if (!panelState) return
    editPanelDraftCache.delete(panelState.draftCacheKey)
    editPanelBaselineSignatureCache.delete(panelState.draftCacheKey)
    handlers.onCloseEditPanel(shouldDiscardDraft ? { discardDraft: true } : undefined)
  }, [panelState, handlers])

  if (!nodeId || !panelState) return null

  const title = panelState.isOperationDraft
    ? `${panelState.isBomDetailsMode ? 'BOM Details' : 'Item Details'}: ${panelState.editingTargetNode?.label || 'New Process'}`
    : 'Edit BOM Fields'
  const tempNameValidationMessage = panelState.isOperationItemDetailsMode && !isTempNamePresent
    ? 'Temporary Process Name is required before Save.'
    : ''
  const hasEditableFields = panelState.editPanelModel.fields.length > 0

  return (
    <aside className={['plm-extension-bom-clone-edit-panel', panelState.isOperationDraft ? 'is-operation-create plm-extension-bom-clone-details' : ''].filter(Boolean).join(' ')}>
      <div className={panelState.isOperationDraft ? 'plm-extension-bom-clone-details-header plm-extension-grid-form-fields-header' : 'plm-extension-grid-form-fields-header'}>
        <h4 className={panelState.isOperationDraft ? 'plm-extension-bom-clone-details-title plm-extension-grid-form-fields-title' : 'plm-extension-grid-form-fields-title'}>
          {title}
        </h4>
        {panelState.usesExplicitSave ? (
          <div className="plm-extension-bom-clone-edit-header-actions">
            <span className={`plm-extension-bom-clone-edit-dirty-indicator${isDirty ? ' is-visible' : ''}`}>{isDirty ? 'Unsaved changes' : ''}</span>
            <button type="button" className="plm-extension-bom-clone-details-cancel plm-extension-btn plm-extension-btn--secondary" onClick={() => {
              const currentValues = collectValues()
              const shouldDiscardDraft = panelState.isOperationDraft && !hasTemporaryOperationName(currentValues, panelState.isOperationItemDetailsMode)
              const hasUnsavedChanges = panelState.usesExplicitSave && toValueSignature(currentValues) !== baselineSignatureRef.current
              if (!hasUnsavedChanges) {
                closePanel(shouldDiscardDraft)
                return
              }
              setPendingDiscardDraft(shouldDiscardDraft)
              setShowUnsavedDialog(true)
            }}>Cancel</button>
            <button
              type="button"
              className="plm-extension-bom-clone-details-save plm-extension-btn plm-extension-btn--primary"
              disabled={panelState.isOperationItemDetailsMode && !isTempNamePresent}
              title={panelState.isOperationItemDetailsMode && !isTempNamePresent ? 'Temporary Process Name is required before Save.' : 'Save changes'}
              onClick={() => persistDraft()}
            >
              Save
            </button>
          </div>
        ) : (
          <button type="button" className="plm-extension-grid-form-fields-close plm-extension-btn plm-extension-btn--secondary" onClick={() => {
            editPanelDraftCache.delete(panelState.draftCacheKey)
            editPanelBaselineSignatureCache.delete(panelState.draftCacheKey)
            handlers.onCloseEditPanel()
          }}>Close</button>
        )}
      </div>

      <div className={panelState.isOperationDraft ? 'plm-extension-bom-clone-details-body plm-extension-bom-clone-edit-details-body' : 'plm-extension-bom-clone-edit-details-body'}>
        {panelState.fieldsLoading ? (
          <Loader label="Loading fields..." />
        ) : panelState.fieldsError ? (
          <p className="plm-extension-bom-clone-error">{panelState.fieldsError.replace(/operation/gi, 'process')}</p>
        ) : (
          <>
            {hasEditableFields ? (
              <div className="plm-extension-grid-form-fields-controls">
                <label className="plm-extension-bom-clone-edit-filter">
                  <input
                    type="checkbox"
                    checked={snapshot.editPanelRequiredOnly}
                    onChange={(event) => {
                      if (panelState.usesExplicitSave) {
                        const currentValues = collectValues()
                        if (toValueSignature(currentValues) !== baselineSignatureRef.current) cacheValues(currentValues)
                      }
                      handlers.onToggleEditPanelRequiredOnly(event.target.checked)
                    }}
                  />
                  <span>Required Only</span>
                </label>
              </div>
            ) : null}

            {panelState.isOperationItemDetailsMode ? (
              <>
                <p className="plm-extension-bom-clone-operation-temp-name-note">
                  Please assign Temporary Process Name. This is only temporary and will be updated once the process is committed with the correct Descriptor.
                </p>
                <p className={`plm-extension-bom-clone-operation-temp-name-validation${tempNameValidationMessage ? ' is-visible' : ''}`}>
                  {tempNameValidationMessage}
                </p>
                <div className="plm-extension-grid-form-main">
                  <div className="plm-extension-grid-form-row plm-extension-bom-clone-temp-name-row">
                    <div className="plm-extension-grid-form-label">
                      <div className="plm-extension-grid-form-label-main">
                        <span className="plm-extension-grid-form-label-text" title="Temporary Process Name">Temporary Process Name</span>
                        <span className="plm-extension-grid-form-required-mark" title="Required">*</span>
                      </div>
                    </div>
                    <div className="plm-extension-grid-form-value">
                      <input
                        type="text"
                        className="plm-extension-grid-form-control"
                        placeholder="Enter temporary process name..."
                        value={temporaryOperationName}
                        aria-label="Temporary Process Name"
                        onChange={(event) => {
                          const nextValue = event.target.value
                          setTemporaryOperationName(nextValue)
                          if (panelState.usesExplicitSave) refreshDirtyState(nextValue)
                        }}
                      />
                    </div>
                  </div>
                </div>
              </>
            ) : null}

            {hasEditableFields ? (
              <>
                <div className="plm-extension-bom-clone-edit-filters-divider" />

                {showNoFilteredFields ? (
                  <p style={{ margin: '12px 0', color: '#5a7088', fontSize: '13px' }}>No fields match the current filters.</p>
                ) : (
                  formSchema ? (
                    <CloneFormRenderer
                      schema={{
                        ...formSchema,
                        fields: visibleFields,
                        sections: visibleSections
                      }}
                      values={fieldValues}
                      displayValues={fieldDisplayValues}
                      onFieldChange={(fieldId, next) => {
                        const nextState = updateField(fieldId, next)
                        if (panelState.usesExplicitSave) refreshDirtyState(undefined, nextState.values)
                        else window.setTimeout(() => persistDraft(undefined, nextState.values), 0)
                      }}
                    />
                  ) : null
                )}
              </>
            ) : (
              <p style={{ margin: '12px 18px', color: '#5a7088', fontSize: '13px' }}>
                {panelState.isOperationItemDetailsMode ? 'No additional process item fields available.' : 'No BOM fields available.'}
              </p>
            )}
          </>
        )}
      </div>
      <UnsavedEditDialog
        open={showUnsavedDialog}
        onKeepEditing={() => {
          setShowUnsavedDialog(false)
          setPendingDiscardDraft(false)
        }}
        onDiscard={() => {
          setShowUnsavedDialog(false)
          closePanel(pendingDiscardDraft)
          setPendingDiscardDraft(false)
        }}
      />
    </aside>
  )
}
