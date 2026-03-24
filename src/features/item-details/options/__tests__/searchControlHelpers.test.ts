// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'
import {
  buildDomSectionLookups,
  collectFieldSearchCandidates,
  collectMatchedJsonFieldTitlesBySection,
  getMatrixHeaderLabels,
  resolveDomSectionForJsonMatch,
  titleMatchesJsonSearch,
  toSearchableText
} from '../searchControlHelpers'

describe('item-details options/searchControlHelpers', () => {
  it('normalizes field text into a searchable format', () => {
    expect(toSearchableText('  Part   Number  ')).toBe('part number')
  })

  it('collects matched field titles by section from cached item data', () => {
    const result = collectMatchedJsonFieldTitlesBySection(
      {
        sections: [
          {
            link: '/api/v3/workspaces/57/items/123/sections/10',
            title: 'Mechanical',
            fields: [
              { title: 'Part Number *' },
              { title: 'Description' }
            ]
          }
        ]
      },
      'part'
    )

    expect(result).toEqual([
      {
        matchedTitleKeys: new Set(['part number']),
        sectionId: 10,
        sectionIndex: 0,
        sectionTitle: 'mechanical'
      }
    ])
  })

  it('matches DOM titles against normalized JSON title keys', () => {
    const matchedTitleKeys = new Set(['part number'])
    expect(titleMatchesJsonSearch('Part Number', matchedTitleKeys)).toBe(true)
    expect(titleMatchesJsonSearch('Description', matchedTitleKeys)).toBe(false)
  })

  it('builds DOM section lookups and resolves matches by id or title', () => {
    document.body.innerHTML = `
      <div class="MuiExpansionPanel-root" id="section_10" name="section-10">
        <div name="section-header"><span title="Mechanical"></span></div>
      </div>
      <div class="MuiExpansionPanel-root" id="section_11" name="section-11">
        <div name="section-header"><span title="Electrical"></span></div>
      </div>
    `

    const lookups = buildDomSectionLookups()
    expect(lookups.byId.get(10)?.id).toBe('section_10')
    expect(lookups.byTitle.get('electrical')?.id).toBe('section_11')
    expect(resolveDomSectionForJsonMatch({
      sectionId: 10,
      sectionTitle: 'mechanical',
      sectionIndex: 0,
      matchedTitleKeys: new Set()
    }, lookups)?.id).toBe('section_10')
    expect(resolveDomSectionForJsonMatch({
      sectionId: null,
      sectionTitle: 'electrical',
      sectionIndex: 1,
      matchedTitleKeys: new Set()
    }, lookups)?.id).toBe('section_11')
  })

  it('collects searchable field candidates and matrix header labels from the DOM', () => {
    document.body.innerHTML = `
      <table>
        <tr>
          <td class="plm-item-detail-field-title" title="Part Number">Ignored</td>
        </tr>
        <tr>
          <td class="plm-item-detail-field-title">Description</td>
        </tr>
        <tr>
          <td>No label cell</td>
        </tr>
      </table>
      <table id="matrix">
        <thead>
          <tr>
            <th><span title="Operation"></span></th>
            <th>Work Center</th>
          </tr>
        </thead>
      </table>
    `

    const rows = Array.from(document.querySelectorAll('tr')) as HTMLElement[]
    const candidates = collectFieldSearchCandidates(rows)
    const matrix = document.getElementById('matrix') as HTMLElement

    expect(candidates.map((candidate) => candidate.searchableText)).toEqual(['part number', 'description'])
    expect(getMatrixHeaderLabels(matrix)).toEqual(['operation', 'work center'])
  })
})
