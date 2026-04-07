import type { PlmExtRuntime } from '../../../../shared/runtime/types'
import { toBomTree } from '../../clone/services/api/parseTree'
import type { AttachmentDownloadBomNode, AttachmentPreviewConfig } from '../types'
import type { BomPageContext } from '../../shared/page'
import { parseViewDefIdFromLink } from '../../shared/viewDef'

type Runtime = Pick<PlmExtRuntime, 'requestPlmAction'>

function extractArray(value: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === 'object'))
  }
  return []
}

function resolveAttachmentPreviewPayload(response: unknown): Record<string, unknown> {
  const record = response && typeof response === 'object' ? (response as Record<string, unknown>) : null
  if (record?.data && typeof record.data === 'object') {
    return record.data as Record<string, unknown>
  }
  return record || {}
}

function extractAttachmentFieldConfig(fieldsPayload: unknown): AttachmentPreviewConfig {
  const fields = extractArray(
    fieldsPayload && typeof fieldsPayload === 'object' && 'data' in (fieldsPayload as Record<string, unknown>)
      ? (fieldsPayload as Record<string, unknown>).data
      : fieldsPayload
  )

  const attachmentField = fields.find((field) => {
    const fieldId = String(field.fieldId || '').trim().toUpperCase()
    const fieldTab = String(field.fieldTab || '').trim().toUpperCase()
    return fieldId === 'ATTACHMENTS' && fieldTab === 'SYSTEM'
  })

  if (!attachmentField) {
    return {
      enabled: false,
      warningMessage:
        'Attachment Field is not available in the default view. Preview attachments are unavailable. This is degraded functionality and will still function, but will not be as performant.',
      attachmentFieldViewDefId: null
    }
  }

  const directId = Number(attachmentField.viewDefFieldId)
  const attachmentFieldViewDefId = Number.isFinite(directId) && directId > 0 ? String(Math.floor(directId)) : null

  return {
    enabled: Boolean(attachmentFieldViewDefId),
    warningMessage: attachmentFieldViewDefId
      ? null
      : 'Preview attachments are unavailable because the default view ATTACHMENTS field could not be resolved. This is degraded functionality and will still function, but will not be as performant.',
    attachmentFieldViewDefId
  }
}

export async function loadAttachmentDownloadPreview(
  runtime: Runtime,
  context: BomPageContext
): Promise<{ bomNodes: AttachmentDownloadBomNode[]; attachmentPreviewConfig: AttachmentPreviewConfig }> {
  const effectiveDate = new Date().toISOString().slice(0, 10)

  const bomResponse = await runtime.requestPlmAction('getBom', {
    tenant: context.tenant,
    wsId: context.workspaceId,
    dmsId: context.currentItemId,
    rootId: context.currentItemId,
    depth: 100,
    effectiveDate,
    revisionBias: 'release',
    ...(context.viewDefId !== null ? { viewId: context.viewDefId } : {})
  })

  const bomNodes = toBomTree(bomResponse)
  const bomPayload = resolveAttachmentPreviewPayload(bomResponse)
  const viewDefLink = String(
    (bomPayload.config as Record<string, unknown> | undefined)?.viewDef
      && typeof (bomPayload.config as Record<string, unknown>).viewDef === 'object'
      ? ((bomPayload.config as Record<string, unknown>).viewDef as Record<string, unknown>).link || ''
      : ''
  )
  const resolvedViewDefId = parseViewDefIdFromLink(viewDefLink)

  if (!resolvedViewDefId) {
    return {
      bomNodes,
      attachmentPreviewConfig: {
        enabled: false,
        warningMessage: 'Preview attachments is disabled because the default BOM view definition could not be resolved.',
        attachmentFieldViewDefId: null
      }
    }
  }

  const fieldsPayload = await runtime.requestPlmAction('getBomViewFields', {
    tenant: context.tenant,
    wsId: context.workspaceId,
    viewId: resolvedViewDefId
  })

  return {
    bomNodes,
    attachmentPreviewConfig: extractAttachmentFieldConfig(fieldsPayload)
  }
}
