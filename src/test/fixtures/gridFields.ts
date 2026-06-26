import type { CapturedGridFieldDefinition, FormFieldDefinition } from '../../features/grid/grid-advanced-editor/types'

export function rawField(
  id: string,
  name: string,
  overrides: Partial<CapturedGridFieldDefinition> = {}
): CapturedGridFieldDefinition {
  return {
    __self__: `/api/v3/workspaces/1/views/2/fields/${id}`,
    name,
    type: { link: '/api/v3/field-types/4', title: 'Single Line Text' },
    displayOrder: 0,
    editability: 'ALWAYS',
    visibility: 'ALWAYS',
    derived: false,
    ...overrides
  }
}

export function formField(
  fieldId: string,
  title: string,
  overrides: Partial<FormFieldDefinition> = {}
): FormFieldDefinition {
  return {
    fieldId,
    title,
    description: null,
    kind: 'text',
    typeId: null,
    picklistPath: null,
    defaultValue: null,
    defaultPayloadValue: null,
    fieldLength: null,
    fieldPrecision: null,
    unitOfMeasure: null,
    required: false,
    editable: true,
    visible: true,
    displayOrder: 0,
    fieldSelf: `/api/v3/workspaces/1/views/2/fields/${fieldId}`,
    fieldUrn: `urn:test:${fieldId}`,
    ...overrides
  }
}
