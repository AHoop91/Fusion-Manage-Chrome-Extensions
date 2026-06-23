// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { buildOperationFormModel, inferDescriptorFieldsFromSelectedItem } from '../services/form/operationForm.service'

describe('bom clone operationForm.service', () => {
  it('builds ordered form fields, meta links, and section layouts', () => {
    const model = buildOperationFormModel(
      {
        fields: [
          {
            __self__: '/api/v3/workspaces/57/fields/part_number',
            urn: 'urn:adsk.plm:tenant.workspace.field:TEST.57.part_number',
            name: 'PART_NUMBER',
            label: 'Part Number',
            displayOrder: 2,
            visibility: 'ALWAYS',
            editability: 'always',
            fieldValidators: [{ validatorName: 'required' }],
            type: { id: 4, title: 'Single Line Text' }
          },
          {
            __self__: '/api/v3/workspaces/57/fields/description',
            urn: 'urn:adsk.plm:tenant.workspace.field:TEST.57.description',
            name: 'DESCRIPTION',
            label: 'Description',
            displayOrder: 1,
            visibility: 'ALWAYS',
            editability: 'always',
            type: { id: 4, title: 'Single Line Text' },
            defaultValue: 'Default Description'
          }
        ]
      },
      {
        sections: [
          {
            title: 'General',
            displayOrder: 1,
            fields: [
              { type: 'FIELD', link: '/api/v3/workspaces/57/fields/description' },
              { type: 'FIELD', link: '/api/v3/workspaces/57/fields/part_number' }
            ]
          }
        ]
      }
    )

    expect(model.fields.map((field) => field.fieldId)).toEqual(['description', 'part_number'])
    expect(model.fields[0]!.defaultValue).toBe('Default Description')
    expect(model.fields[1]!.required).toBe(true)
    expect(model.metaLinks).toEqual({
      description: '/api/v3/workspaces/57/fields/description',
      part_number: '/api/v3/workspaces/57/fields/part_number'
    })
    expect(model.sections).toEqual([
      {
        title: 'General',
        expandedByDefault: true,
        fieldIds: ['description', 'part_number']
      }
    ])
  })

  it('infers descriptor field candidates from selected item details', () => {
    const inferred = inferDescriptorFieldsFromSelectedItem({
      descriptorTitle: 'Widget Base Assembly [REV:A]',
      detailSections: [
        {
          title: 'General',
          rows: [
            { label: 'Description', value: 'Base Assembly' },
            { label: 'Part Number', value: 'Widget' },
            { label: 'Ignored', value: '-' }
          ]
        }
      ],
      fields: [
        {
          fieldId: 'DESCRIPTION',
          title: 'Description',
          description: null,
          formulaField: false,
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
          displayOrder: 1,
          fieldSelf: null,
          fieldUrn: null,
          typeLink: null,
          typeUrn: null,
          typeTitle: null
        },
        {
          fieldId: 'PART_NUMBER',
          title: 'Part Number',
          description: null,
          formulaField: false,
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
          displayOrder: 2,
          fieldSelf: null,
          fieldUrn: null,
          typeLink: null,
          typeUrn: null,
          typeTitle: null
        }
      ]
    })

    expect(inferred).toEqual([
      {
        fieldId: 'PART_NUMBER',
        fieldTitle: 'Part Number',
        sampleValue: 'Widget',
        position: 0
      },
      {
        fieldId: 'DESCRIPTION',
        fieldTitle: 'Description',
        sampleValue: 'Base Assembly',
        position: 7
      }
    ])
  })

  it('handles matrices, payload defaults, and editability/visibility flags', () => {
    const model = buildOperationFormModel(
      {
        fields: [
          {
            __self__: '/api/v3/workspaces/57/fields/process_code',
            urn: 'urn:adsk.plm:tenant.workspace.field:TEST.57.process_code',
            name: 'Process Code',
            label: 'Process Code',
            displayOrder: 5,
            visibility: 'ALWAYS',
            editability: 'read_only',
            picklist: '/api/v3/workspaces/57/picklists/process-code',
            defaultValue: { title: 'Laser' },
            type: { link: '/api/v3/field-types/4', title: 'Single Line Text' }
          },
          {
            __self__: '/api/v3/workspaces/57/fields/resource',
            urn: 'urn:adsk.plm:tenant.workspace.field:TEST.57.resource',
            name: 'RESOURCE',
            label: 'Resource',
            displayOrder: 6,
            visibility: 'NEVER',
            editability: 'always',
            defaultValue: { link: '/api/v3/workspaces/57/picklists/resources/11' },
            type: { id: 4, title: 'Single Line Text' }
          }
        ]
      },
      {
        sections: [
          {
            title: 'Matrix Section',
            displayOrder: 1,
            fields: [{ type: 'MATRIX', link: '/api/v3/workspaces/57/sections/1/matrices/general' }],
            matrices: [
              {
                __self__: '/api/v3/workspaces/57/sections/1/matrices/general',
                fields: [
                  [
                    { link: '/api/v3/workspaces/57/fields/process_code' },
                    { urn: 'urn:adsk.plm:tenant.workspace.field:TEST.57.resource' }
                  ]
                ]
              }
            ]
          }
        ]
      }
    )

    expect(model.fields).toHaveLength(2)
    expect(model.fields[0]).toMatchObject({
      fieldId: 'process_code',
      defaultValue: 'Laser',
      defaultPayloadValue: null,
      picklistPath: '/api/v3/workspaces/57/picklists/process-code',
      editable: false,
      visible: true
    })
    expect(model.fields[1]).toMatchObject({
      fieldId: 'resource',
      defaultPayloadValue: '/api/v3/workspaces/57/picklists/resources/11',
      visible: false
    })
    expect(model.sections).toEqual([
      {
        title: 'Matrix Section',
        expandedByDefault: true,
        fieldIds: ['process_code', 'resource']
      }
    ])
  })
})
