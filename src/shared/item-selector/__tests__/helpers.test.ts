// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  formatAttachmentSize,
  groupRefFromIndex,
  normalizeItemDetailsFieldId,
  normalizeRevisionToken,
  splitDescriptorAndRevision
} from '../helpers'

describe('item-selector helpers', () => {
  it('normalizes item details field ids and spreadsheet-like refs', () => {
    expect(normalizeItemDetailsFieldId(' item_details:part_number ')).toBe('PART_NUMBER')
    expect(groupRefFromIndex(0)).toBe('A')
    expect(groupRefFromIndex(27)).toBe('AB')
  })

  it('formats attachment sizes for display', () => {
    expect(formatAttachmentSize(null)).toBe('-')
    expect(formatAttachmentSize(512)).toBe('512 B')
    expect(formatAttachmentSize(2048)).toBe('2.0 KB')
    expect(formatAttachmentSize(3 * 1024 * 1024)).toBe('3.0 MB')
  })

  it('splits descriptor and revision tokens cleanly', () => {
    expect(normalizeRevisionToken('[REV:A]')).toBe('REV:A')
    expect(normalizeRevisionToken('-')).toBe('')
    expect(splitDescriptorAndRevision('Widget Bracket [A]', '')).toEqual({
      baseDescriptor: 'Widget Bracket',
      revisionToken: 'A'
    })
    expect(splitDescriptorAndRevision('Widget Bracket', 'B')).toEqual({
      baseDescriptor: 'Widget Bracket',
      revisionToken: 'B'
    })
  })
})
