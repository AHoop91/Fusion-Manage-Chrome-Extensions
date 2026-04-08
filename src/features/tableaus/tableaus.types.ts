// src/features/tableaus/tableaus.types.ts
import type { PlmExtRuntime } from '../../shared/runtime/types'

export type TableauColumn = {
  field: {
    __self__: string
    [key: string]: unknown
  }
  displayOrder: number
  [key: string]: unknown
}

export type TableauExport = {
  __self__: string
  name: string
  title?: string
  columns: TableauColumn[]
  [key: string]: unknown
}

export type TableauListResponse = {
  tableaus: Array<{
    link: string
    title: string
    deleted: boolean
    [key: string]: unknown
  }>
}

export type TableauListMetaResponse = {
  tableaus: Array<{
    link: string
    title?: string
    deleted?: boolean
    columns?: Array<{
      field?: { __self__?: string; [key: string]: unknown }
      group?: { displayName?: string; [key: string]: unknown }
      [key: string]: unknown
    }>
    [key: string]: unknown
  }>
}

export type WorkspaceFieldDefinition = {
  __self__: string
  name: string
  displayOrder?: number
  editability?: string
  visibility?: string
  label?: string | null
  type?: { title?: string; link?: string }
  picklist?: string | null
  [key: string]: unknown
}

export type WorkspaceFieldsResponse = {
  fields: WorkspaceFieldDefinition[]
}

export type TableausRuntime = Pick<PlmExtRuntime, 'requestPlmAction'>
