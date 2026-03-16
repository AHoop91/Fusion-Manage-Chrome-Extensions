import type { PlmExtRuntime } from '../../shared/runtime/types'
import type { FormColumnKind } from '../../shared/form/fieldTypes'

export type GridFeatureLifecycle = {
  mount: () => void
  update: () => void
  unmount: () => void
}

export type GridStateSnapshot = {
  mounted: boolean
}

export type GridColumnDef = {
  key: string
  title: string
  index: number
  kind: GridColumnKind
  fieldId?: string
}

export type GridColumnKind = FormColumnKind

export type GridFilterOperator =
  | 'contains'
  | 'equals'
  | 'starts_with'
  | 'is_empty'
  | 'not_empty'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'between'
  | 'before'
  | 'after'
export type GridFilterJoinMode = 'and' | 'or'

export type IndexedGridRow = {
  row: HTMLTableRowElement
  searchableText: string
  values: string[]
  visible: boolean
}

export type GridPageRuntime = Pick<PlmExtRuntime, 'registerPage' | 'requestPlmAction'>
