import type { CloneEditPanelViewModel } from '../../../services/viewModel.service'
import { createCloneFormSchema } from './form.schema'
import type { CloneFormSchema } from './form.types'

export function mapEditPanelModelToFormSchema(
  editPanelModel: CloneEditPanelViewModel,
  sectioned: boolean
): CloneFormSchema {
  return createCloneFormSchema({
    fields: editPanelModel.fields,
    sections: editPanelModel.sections,
    sectioned
  })
}
