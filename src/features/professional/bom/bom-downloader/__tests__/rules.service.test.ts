// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  applyCustomModifiedFrom,
  applyCustomModifiedTo,
  createDefaultAttachmentDownloadRules,
  isValidCustomExtensionToken,
  normalizeCustomExtensionToken,
  toggleExtensionGroup
} from '../services/rules.service'

describe('bom/downloader rules.service', () => {
  it('creates the expected default downloader rules', () => {
    expect(createDefaultAttachmentDownloadRules()).toMatchObject({
      includeAllFiles: false,
      selectedExtensions: ['.pdf', '.docx', '.xlsx', '.ppt', '.pptx', '.step', '.stp'],
      lastModifiedRange: 'anytime',
      createSubFolders: 'per-item',
      renameFiles: 'none'
    })
  })

  it('normalizes custom extension tokens and validates supported formats', () => {
    expect(normalizeCustomExtensionToken(' dwf,')).toBe('.dwf')
    expect(normalizeCustomExtensionToken('.STEP')).toBe('.step')
    expect(normalizeCustomExtensionToken('')).toBe('')

    expect(isValidCustomExtensionToken('dwf')).toBe(true)
    expect(isValidCustomExtensionToken('.stp')).toBe(true)
    expect(isValidCustomExtensionToken('.tar.gz')).toBe(false)
    expect(isValidCustomExtensionToken('.')).toBe(false)
    expect(isValidCustomExtensionToken('')).toBe(false)
  })

  it('adds and removes grouped extensions without duplicating entries', () => {
    expect(toggleExtensionGroup(['.pdf'], ['.step', '.stp'], true)).toEqual(['.pdf', '.step', '.stp'])
    expect(toggleExtensionGroup(['.pdf', '.step', '.stp'], ['.step', '.stp'], false)).toEqual(['.pdf'])
  })

  it('keeps custom modified dates internally ordered when users move one side past the other', () => {
    const rules = createDefaultAttachmentDownloadRules()

    expect(applyCustomModifiedFrom({
      ...rules,
      customModifiedFrom: '2026-03-01',
      customModifiedTo: '2026-03-10'
    }, '2026-03-12')).toMatchObject({
      customModifiedFrom: '2026-03-12',
      customModifiedTo: '2026-03-12'
    })

    expect(applyCustomModifiedTo({
      ...rules,
      customModifiedFrom: '2026-03-10',
      customModifiedTo: '2026-03-20'
    }, '2026-03-05')).toMatchObject({
      customModifiedFrom: '2026-03-05',
      customModifiedTo: '2026-03-05'
    })
  })
})
