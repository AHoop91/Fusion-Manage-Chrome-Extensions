import React from 'react'
import { SearchDialogModal, type ItemSelectorSearchHandlers } from '../../../../../cross-feature-ui'
import type { BomCloneStateSnapshot } from '../../clone.types'

/** BOM clone search phase — delegates to `SearchDialogModal` from `cross-feature-ui`. */
export function CloneSearchPhaseContent(props: {
  snapshot: BomCloneStateSnapshot
  handlers: ItemSelectorSearchHandlers
}): React.JSX.Element {
  return <SearchDialogModal snapshot={props.snapshot} handlers={props.handlers} />
}
