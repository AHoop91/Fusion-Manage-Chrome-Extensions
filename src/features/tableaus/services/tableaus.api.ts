import type { PlmExtRuntime } from '../../../shared/runtime/types'
import type {
  TableauExport,
  TableauListResponse,
  TableauListMetaResponse
} from '../tableaus.types'
import { extractTenant } from './tableaus.service'

function getTableauIdFromSelf(self: string): string | null {
  return /\/tableaus\/(\d+)/.exec(self)?.[1] ?? null
}

export type TableausApi = {
  fetchTableauList: (wsId: string) => Promise<TableauListResponse>
  fetchTableauListMeta: (wsId: string) => Promise<TableauListMetaResponse>
  fetchTableau: (wsId: string, tableauId: string) => Promise<TableauExport>
  createTableau: (wsId: string, body: Record<string, unknown>) => Promise<TableauExport>
  updateTableau: (wsId: string, tableauId: string, body: Record<string, unknown>) => Promise<TableauExport>
  deleteTableau: (wsId: string, tableauId: string) => Promise<void>
  getTableauIdFromSelf: (self: string) => string | null
}

export function createTableausApi(
  requestPlmAction: PlmExtRuntime['requestPlmAction']
): TableausApi {
  function getTenant(): string {
    const tenant = extractTenant(window.location.href)
    if (!tenant) throw new Error('Cannot determine tenant from current URL')
    return tenant
  }

  return {
    getTableauIdFromSelf,

    async fetchTableauList(wsId: string): Promise<TableauListResponse> {
      return requestPlmAction<TableauListResponse>('getTableauList', {
        tenant: getTenant(),
        wsId
      })
    },

    async fetchTableauListMeta(wsId: string): Promise<TableauListMetaResponse> {
      return requestPlmAction<TableauListMetaResponse>('getTableauListMeta', {
        tenant: getTenant(),
        wsId
      })
    },

    async fetchTableau(wsId: string, tableauId: string): Promise<TableauExport> {
      return requestPlmAction<TableauExport>('getTableau', {
        tenant: getTenant(),
        wsId,
        tableauId
      })
    },

    async createTableau(wsId: string, body: Record<string, unknown>): Promise<TableauExport> {
      return requestPlmAction<TableauExport>('createTableau', {
        tenant: getTenant(),
        wsId,
        body
      })
    },

    async updateTableau(
      wsId: string,
      tableauId: string,
      body: Record<string, unknown>
    ): Promise<TableauExport> {
      return requestPlmAction<TableauExport>('updateTableau', {
        tenant: getTenant(),
        wsId,
        tableauId,
        body
      })
    },

    async deleteTableau(wsId: string, tableauId: string): Promise<void> {
      await requestPlmAction<void>('deleteTableau', {
        tenant: getTenant(),
        wsId,
        tableauId
      })
    }
  }
}
