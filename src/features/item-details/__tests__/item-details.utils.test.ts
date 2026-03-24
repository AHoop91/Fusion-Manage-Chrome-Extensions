// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import {
  getAllSectionMeta,
  getSectionMeta,
  getWorkspaceIdFromUrl,
  isItemDetailsEditMode,
  normalizeText
} from '../item-details.utils'

describe('item-details utils', () => {
  it('normalizes visible text and nbsp spacing', () => {
    expect(normalizeText('  Alpha\u00A0\u00A0Beta   Gamma  ')).toBe('Alpha Beta Gamma')
  })

  it('extracts workspace id from item-details URLs', () => {
    expect(getWorkspaceIdFromUrl('https://tenant.autodeskplm360.net/plm/workspaces/57/items/itemDetails')).toBe(57)
    expect(getWorkspaceIdFromUrl('https://tenant.autodeskplm360.net/plm/nope')).toBeNull()
  })

  it('detects edit mode from the URL', () => {
    expect(isItemDetailsEditMode('https://tenant.autodeskplm360.net/plm/workspaces/57/items/itemDetails?mode=edit')).toBe(true)
    expect(isItemDetailsEditMode('https://tenant.autodeskplm360.net/plm/workspaces/57/items/itemDetails?mode=view')).toBe(false)
    expect(isItemDetailsEditMode('not-a-url')).toBe(false)
  })

  it('builds section metadata from title carriers and stable ids', () => {
    document.body.innerHTML = `
      <div class="MuiExpansionPanel-root" name="section-general">
        <div name="section-header">
          <span id="section-general-header" title="  General   Information  ">ignored</span>
        </div>
      </div>
    `

    const section = document.querySelector('.MuiExpansionPanel-root') as HTMLElement
    expect(getSectionMeta(section)).toMatchObject({
      key: 'id:section-general-header',
      label: 'General Information'
    })
  })

  it('falls back to header text or unnamed sections when title carriers are missing', () => {
    document.body.innerHTML = `
      <div class="MuiExpansionPanel-root" name="section-fallback">
        <div name="section-header">  Custom   Header  </div>
      </div>
      <div class="MuiExpansionPanel-root"></div>
    `

    const sections = Array.from(document.querySelectorAll('.MuiExpansionPanel-root')) as HTMLElement[]
    expect(getSectionMeta(sections[0])).toMatchObject({
      key: 'id:section-fallback',
      label: 'Custom Header'
    })
    expect(getSectionMeta(sections[1])).toMatchObject({
      key: 'label:unnamed section',
      label: 'Unnamed section'
    })
  })

  it('collects all section metadata from the current document', () => {
    document.body.innerHTML = `
      <div class="MuiExpansionPanel-root" name="section-alpha">
        <div name="section-header"><span title="Alpha">Alpha</span></div>
      </div>
      <div class="MuiExpansionPanel-root" name="section-beta">
        <div name="section-header"><span title="Beta">Beta</span></div>
      </div>
    `

    expect(getAllSectionMeta().map((entry) => entry.label)).toEqual(['Alpha', 'Beta'])
  })
})
