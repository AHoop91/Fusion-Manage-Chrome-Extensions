import type { AttachmentDownloadBomRow } from '../../../downloader'
import type { BomCloneContext, BomCloneLinkableItem, BomCloneNode } from '../../clone.types'
import { buildOperationFormModel } from '../form/operationForm.service'
import { dedupePositiveInts, parsePositiveInt } from '../normalize.service'
import type { AttachmentPreviewConfig, CloneService } from '../service.contract'
import { collectTopLevelChildItemIdsFromTree, mergeBomNodeCollections } from '../structure/tree.service'
import { parseViewDefIdFromLink } from '../form/viewDefLinks'
import { asDisplayString, extractArray, readNodeId, readNodeLabel, toBomTree } from './parseTree'
import { toBomTreeV1 } from './parseTreeV1'
import type { ApiClient } from './client'

type ReadApi = Pick<
  CloneService,
  | 'validateLinkableItem'
  | 'fetchWorkspaceBomViewDefIds'
  | 'fetchSourceBomStructure'
  | 'fetchSourceBomStructureAcrossViews'
  | 'fetchSourceBomFlatList'
  | 'fetchAttachmentPreviewConfig'
  | 'fetchTargetBomChildItemIds'
  | 'fetchTargetBomChildItemIdsAcrossViews'
  | 'fetchLinkableItems'
  | 'fetchOperationFormDefinition'
>

function extractBomViewDefIds(response: unknown): number[] {
  const record = response && typeof response === 'object' ? (response as Record<string, unknown>) : {}
  const data = record.data && typeof record.data === 'object' ? (record.data as Record<string, unknown>) : {}
  const bomViews = Array.isArray(data.bomViews) ? (data.bomViews as Record<string, unknown>[]) : []
  const parsed: number[] = []
  for (const view of bomViews) {
    const direct = parsePositiveInt(view.id)
    if (direct !== null) {
      parsed.push(direct)
      continue
    }
    const linked = parseViewDefIdFromLink(String(view.link || ''))
    if (linked !== null && linked > 0) parsed.push(linked)
  }
  return dedupePositiveInts(parsed)
}

async function mapWithConcurrency<TInput, TOutput>(
  values: readonly TInput[],
  concurrency: number,
  iteratee: (value: TInput, index: number) => Promise<TOutput>
): Promise<TOutput[]> {
  const size = Math.max(1, Math.floor(concurrency))
  const results = new Array<TOutput>(values.length)
  let nextIndex = 0

  async function worker(): Promise<void> {
    while (nextIndex < values.length) {
      const current = nextIndex
      nextIndex += 1
      results[current] = await iteratee(values[current], current)
    }
  }

  await Promise.all(Array.from({ length: Math.min(size, values.length) }, () => worker()))
  return results
}

function createViewReader(client: ApiClient, fetchConcurrency: number) {
  const fetchByViewDef = async (
    context: BomCloneContext,
    dmsId: number,
    viewDefId: number | null,
    options?: { depth?: number }
  ): Promise<BomCloneNode[]> => {
    const effectiveDate = new Date().toISOString().slice(0, 10)
    const depth = Number.isFinite(options?.depth) ? Math.max(1, Math.floor(Number(options?.depth))) : 1
    const sourceBom = await client.getBom({
      tenant: context.tenant,
      wsId: context.workspaceId,
      dmsId,
      rootId: dmsId,
      depth,
      effectiveDate,
      revisionBias: 'release',
      headers: { Accept: 'application/vnd.autodesk.plm.bom.bulk+json' },
      ...(viewDefId !== null ? { viewId: viewDefId } : {})
    })
    return toBomTree(sourceBom)
  }

  return {
    fetchByViewDef,
    async fetchWorkspaceBomViewDefIds(context: Pick<BomCloneContext, 'tenant' | 'workspaceId' | 'viewDefId'>) {
      const ids: number[] = []
      if (context.viewDefId !== null) ids.push(context.viewDefId)
      try {
        const response = await client.getBomViews({
          tenant: context.tenant,
          wsId: context.workspaceId
        })
        ids.push(...extractBomViewDefIds(response))
      } catch {
        // Allow fallback to URL context viewDef only.
      }
      return dedupePositiveInts(ids)
    },
    async fetchAcrossViews(
      context: BomCloneContext,
      dmsId: number,
      viewDefIds: number[],
      onViewLoad?: (viewDefId: number) => void
    ): Promise<BomCloneNode[]> {
      const resolvedViewDefIds = dedupePositiveInts([
        ...viewDefIds,
        ...(context.viewDefId !== null ? [context.viewDefId] : [])
      ])

      if (resolvedViewDefIds.length === 0) {
        return fetchByViewDef(context, dmsId, context.viewDefId)
      }

      const trees = await mapWithConcurrency(
        resolvedViewDefIds,
        fetchConcurrency,
        async (viewDefId) => {
          try {
            return await fetchByViewDef(context, dmsId, viewDefId)
          } catch {
            return [] as BomCloneNode[]
          } finally {
            onViewLoad?.(viewDefId)
          }
        }
      )

      return trees.reduce((merged, tree) => mergeBomNodeCollections(merged, tree), [] as BomCloneNode[])
    }
  }
}

function createBomReader(client: ApiClient, fetchByViewDef: ReturnType<typeof createViewReader>['fetchByViewDef']) {
  return async (context: BomCloneContext, dmsId: number, options?: { depth?: number }): Promise<BomCloneNode[]> => {
    const depth = Number.isFinite(options?.depth) ? Math.max(1, Math.floor(Number(options?.depth))) : 1

    try {
      const tree = await fetchByViewDef(context, dmsId, context.viewDefId, { depth })
      if (tree.length > 0) return tree
    } catch {
      // Fall back to the legacy reader if the viewdef-backed bulk response is unavailable.
    }

    try {
      const response = await client.getBomV1({
        tenant: context.tenant,
        wsId: context.workspaceId,
        dmsId,
        depth
      })
      const tree = toBomTreeV1(response, {
        workspaceId: context.workspaceId,
        rootItemId: dmsId,
        depth
      })
      if (tree.length > 0) return tree
    } catch {
      // Allow a final retry through the viewdef-backed path below.
    }

    return fetchByViewDef(context, dmsId, context.viewDefId, options)
  }
}

function extractBomFlatEntries(response: unknown): Record<string, unknown>[] {
  const payload =
    response && typeof response === 'object' && 'data' in (response as Record<string, unknown>)
      ? (response as Record<string, unknown>).data
      : response

  if (Array.isArray(payload)) return payload.filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object')
  if (!payload || typeof payload !== 'object') return []

  const record = payload as Record<string, unknown>
  const collectionCandidates = [record.flatItems, record.items, record.bomItems, record.rows, record.data]
  for (const candidate of collectionCandidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object')
    }
  }

  return [record]
}

function asFlatBomRow(entry: Record<string, unknown>, index: number): AttachmentDownloadBomRow {
  const item = entry.item && typeof entry.item === 'object' ? (entry.item as Record<string, unknown>) : {}
  const idCandidate =
    String(item.urn || item.link || entry.__self__ || entry.link || entry.id || '').trim()
  const description = String(item.title || entry.description || entry.title || `BOM Item ${index + 1}`).trim()
  return {
    id: idCandidate || `bom-flat-${index + 1}`,
    description,
    title: String(item.title || entry.title || description).trim(),
    revision: String(entry.revision || item.version || '').trim(),
    lifecycle: String(entry.lifecycle || entry.status || '').trim(),
    itemLink: String(item.link || entry.link || '').trim()
  }
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
      warningMessage: 'Preview attachments is disabled because the default view is missing the SYSTEM field ATTACHMENTS.',
      attachmentFieldViewDefId: null
    }
  }

  const directId = Number(attachmentField.viewDefFieldId)
  const attachmentFieldViewDefId =
    Number.isFinite(directId) && directId > 0
      ? String(Math.floor(directId))
      : null

  return {
    enabled: Boolean(attachmentFieldViewDefId),
    warningMessage: attachmentFieldViewDefId
      ? null
      : 'Preview attachments is disabled because the default view ATTACHMENTS field could not be resolved.',
    attachmentFieldViewDefId
  }
}

export function createReadApi(params: {
  client: ApiClient
  fetchConcurrency?: number
}): ReadApi {
  const { client, fetchConcurrency = 10 } = params
  const viewReader = createViewReader(client, fetchConcurrency)
  const readBomTree = createBomReader(client, viewReader.fetchByViewDef)

  return {
    async validateLinkableItem(context, sourceItemId) {
      const response = await client.fetchBomLinkableItems({
        tenant: context.tenant,
        workspaceId: context.workspaceId,
        currentItemId: context.currentItemId,
        viewId: context.viewId
      }) as { data?: unknown; items?: unknown[] }

      const fromData = extractArray((response?.data as Record<string, unknown> | undefined)?.items)
      const rootArray = extractArray((response as { items?: unknown[] })?.items)
      const candidates = fromData.length > 0 ? fromData : rootArray
      if (candidates.length === 0) return true
      return candidates.some((item) => Number(item.dmsId || item.itemId || item.id) === sourceItemId)
    },

    fetchWorkspaceBomViewDefIds: viewReader.fetchWorkspaceBomViewDefIds,
    fetchSourceBomStructure: readBomTree,
    fetchSourceBomStructureAcrossViews: viewReader.fetchAcrossViews,
    async fetchSourceBomFlatList(context, sourceItemId) {
      const effectiveDate = new Date().toISOString().slice(0, 10)
      const response = await client.getBomFlat({
        tenant: context.tenant,
        wsId: context.workspaceId,
        dmsId: sourceItemId,
        rootId: sourceItemId,
        effectiveDate,
        revisionBias: 'release',
        ...(context.viewDefId !== null ? { viewId: context.viewDefId } : {})
      })

      return extractBomFlatEntries(response).map((entry, index) => asFlatBomRow(entry, index))
    },
    async fetchAttachmentPreviewConfig(context, sourceItemId) {
      const effectiveDate = new Date().toISOString().slice(0, 10)
      const bomResponse = await client.getBom({
        tenant: context.tenant,
        wsId: context.workspaceId,
        dmsId: sourceItemId,
        rootId: sourceItemId,
        depth: 100,
        effectiveDate,
        revisionBias: 'release',
        ...(context.viewDefId !== null ? { viewId: context.viewDefId } : {})
      })

      const bomPayload = resolveAttachmentPreviewPayload(bomResponse)
      const viewDefLink = String((bomPayload.config as Record<string, unknown> | undefined)?.viewDef && typeof (bomPayload.config as Record<string, unknown>).viewDef === 'object'
        ? ((bomPayload.config as Record<string, unknown>).viewDef as Record<string, unknown>).link || ''
        : '')
      const resolvedViewDefId = parseViewDefIdFromLink(viewDefLink)

      if (!resolvedViewDefId) {
        return {
          enabled: false,
          warningMessage: 'Preview attachments is disabled because the default BOM view definition could not be resolved.',
          attachmentFieldViewDefId: null
        } satisfies AttachmentPreviewConfig
      }

      const fieldsPayload = await client.getBomViewFields({
        tenant: context.tenant,
        wsId: context.workspaceId,
        viewId: resolvedViewDefId
      })

      return extractAttachmentFieldConfig(fieldsPayload)
    },

    async fetchTargetBomChildItemIds(context) {
      const tree = await readBomTree(context, context.currentItemId, { depth: 1 })
      return collectTopLevelChildItemIdsFromTree(tree, context.currentItemId)
    },

    async fetchTargetBomChildItemIdsAcrossViews(context) {
      const tree = await readBomTree(context, context.currentItemId, { depth: 1 })
      return collectTopLevelChildItemIdsFromTree(tree, context.currentItemId)
    },

    async fetchLinkableItems(context, options) {
      const response = await client.fetchBomLinkableItems({
        tenant: context.tenant,
        workspaceId: context.workspaceId,
        currentItemId: context.currentItemId,
        viewId: context.viewId,
        relatedWorkspaceId: context.workspaceId,
        search: options.search || '',
        sort: 'item.title desc',
        limit: options.limit,
        offset: options.offset
      }) as { data?: unknown }

      const data =
        response?.data && typeof response.data === 'object'
          ? (response.data as Record<string, unknown>)
          : (response as unknown as Record<string, unknown>)
      const items = extractArray(data.items).map((entry) => {
        const itemRaw = entry.item
        const item = itemRaw && typeof itemRaw === 'object' ? (itemRaw as Record<string, unknown>) : {}
        const workspaceRaw = entry.workspace
        const workspace = workspaceRaw && typeof workspaceRaw === 'object' ? (workspaceRaw as Record<string, unknown>) : {}
        const lifecycleRaw = entry.lifecycle
        const lifecycle = lifecycleRaw && typeof lifecycleRaw === 'object' ? (lifecycleRaw as Record<string, unknown>) : {}
        const id = Number(readNodeId(item, '0'))
        return {
          id,
          label: readNodeLabel(item, `Item ${id}`),
          workspace: asDisplayString(workspace.title) || '',
          lifecycle: asDisplayString(lifecycle.title) || ''
        } satisfies BomCloneLinkableItem
      }).filter((entry) => Number.isFinite(entry.id) && entry.id > 0)

      return {
        items,
        totalCount: Number(data.totalCount) || items.length,
        offset: Number(data.offset) || options.offset || 0,
        limit: Number(data.limit) || options.limit || 100
      }
    },

    async fetchOperationFormDefinition(context) {
      const [fieldsPayload, sectionsPayload] = await Promise.all([
        client.fetchFields({
          tenant: context.tenant,
          workspaceId: context.workspaceId
        }),
        client.fetchSections({
          tenant: context.tenant,
          workspaceId: context.workspaceId
        })
      ])

      return buildOperationFormModel(fieldsPayload, sectionsPayload)
    }
  }
}


