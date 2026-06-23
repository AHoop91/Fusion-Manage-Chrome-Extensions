// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  parseBooleanLike,
  remapBomFieldValuesByFieldId,
  resolvePinnedFieldId,
  resolveQuantityFieldId
} from '../services/field.service'
import type { BomCloneNode } from '../clone.types'

function createNode(overrides: Partial<BomCloneNode> & Pick<BomCloneNode, 'id' | 'label'>): BomCloneNode {
  return {
    id: overrides.id,
    label: overrides.label,
    number: overrides.number || overrides.id,
    itemNumber: overrides.itemNumber || overrides.id,
    iconHtml: overrides.iconHtml || '',
    revision: overrides.revision || '',
    status: overrides.status || '',
    quantity: overrides.quantity || '',
    unitOfMeasure: overrides.unitOfMeasure || '',
    hasExpandableChildren: overrides.hasExpandableChildren ?? false,
    childrenLoaded: overrides.childrenLoaded ?? true,
    children: overrides.children || [],
    bomFieldValues: overrides.bomFieldValues
  }
}

describe('bom/field.service', () => {
  it('resolves quantity and pinned field ids by exact id or title fallback', () => {
    expect(resolveQuantityFieldId({
      bomViewFields: [{ fieldId: '103', title: 'Something else' }]
    } as never)).toBe('103')

    expect(resolveQuantityFieldId({
      bomViewFields: [{ fieldId: 'QTY_CUSTOM', title: 'Quantity Required' }]
    } as never)).toBe('QTY_CUSTOM')

    expect(resolvePinnedFieldId({
      bomViewFields: [{ fieldId: '302', title: 'Ignore title' }]
    } as never)).toBe('302')

    expect(resolvePinnedFieldId({
      bomViewFields: [{ fieldId: 'PIN_CUSTOM', title: 'Pinned To Top' }]
    } as never)).toBe('PIN_CUSTOM')
  })

  it('parses boolean-like values consistently', () => {
    expect(parseBooleanLike(true)).toBe(true)
    expect(parseBooleanLike(0)).toBe(false)
    expect(parseBooleanLike(' YES ')).toBe(true)
    expect(parseBooleanLike('off')).toBe(false)
    expect(parseBooleanLike('', true)).toBe(true)
    expect(parseBooleanLike('maybe', true)).toBe(true)
  })

  it('remaps BOM field values recursively by resolved field id', () => {
    const nodes = [
      createNode({
        id: 'root',
        label: 'Root',
        bomFieldValues: {
          VIEW_DEF_QTY: '',
          VIEW_DEF_NOTE: 'Hello'
        },
        children: [
          createNode({
            id: 'child',
            label: 'Child',
            bomFieldValues: {
              VIEW_DEF_QTY: '2',
              VIEW_DEF_ALT_QTY: '3'
            }
          })
        ]
      })
    ]

    expect(remapBomFieldValuesByFieldId(nodes, {
      VIEW_DEF_QTY: '103',
      VIEW_DEF_ALT_QTY: '103',
      VIEW_DEF_NOTE: 'NOTE'
    })).toEqual([
      createNode({
        id: 'root',
        label: 'Root',
        bomFieldValues: {
          NOTE: 'Hello',
          '103': ''
        },
        children: [
          createNode({
            id: 'child',
            label: 'Child',
            bomFieldValues: {
              '103': '3'
            }
          })
        ]
      })
    ])
  })
})
