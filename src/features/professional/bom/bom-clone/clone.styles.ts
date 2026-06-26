/**
 * Builds BOM clone feature styles scoped by runtime modal/button ids.
 */
import { buildCloneButtonStyles } from './styles/clone-button.styles'
import { buildCloneEditPanelStyles } from './styles/clone-edit-panel.styles'
import { buildCloneLinkableStyles } from './styles/clone-linkable.styles'
import { buildCloneStructureStyles } from './styles/clone-structure.styles'

export function buildCloneStyles(cloneButtonId: string, structureModalId: string): string {
  return [
    buildCloneButtonStyles(cloneButtonId),
    buildCloneEditPanelStyles(structureModalId),
    buildCloneLinkableStyles(structureModalId),
    buildCloneStructureStyles(structureModalId),
  ].join('\n')
}
