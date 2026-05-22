import React from 'react'
import { SearchDialogModal, type ItemSelectorSearchHandlers } from '../../../../../shared'
import type { BomCloneStateSnapshot } from '../../clone.types'

/** BOM clone search phase — delegates to shared `SearchDialogModal`. */
export function CloneSearchPhaseContent(props: {
  snapshot: BomCloneStateSnapshot
  handlers: ItemSelectorSearchHandlers
}): React.JSX.Element {
  return <SearchDialogModal snapshot={props.snapshot} handlers={props.handlers} />
}
