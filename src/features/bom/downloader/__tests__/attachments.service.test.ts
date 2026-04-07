import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BomCloneStructureRow } from '../../clone/services/structure/tree.service'
import type { AttachmentDownloadRowResult } from '../models'
import {
  buildAttachmentDownloadRowRequests,
  buildAttachmentDownloadSummary,
  buildResolvedAttachmentDownloadSummary,
  filterResolvedAttachmentDownloadRows,
  matchesAttachmentFileName,
  matchesAttachmentModifiedDate,
  parseAttachmentNames
} from '../services/attachments.service'

function createRow(params: {
  id: string
  level: number
  label: string
  attachmentCount?: number
  attachmentNames?: string[]
  nodeId?: string
  splitSourceNodeId?: string
  itemLink?: string
  revision?: string
}): BomCloneStructureRow {
  const attachmentFieldId = 'attachmentField'
  return {
    id: params.id,
    level: params.level,
    hasChildren: false,
    expanded: false,
    node: {
      id: params.nodeId ?? params.id,
      label: params.label,
      number: params.id,
      itemNumber: params.id,
      iconHtml: '',
      revision: params.revision ?? 'A',
      status: '',
      quantity: '1',
      unitOfMeasure: 'EA',
      hasExpandableChildren: false,
      childrenLoaded: true,
      children: [],
      itemLink: params.itemLink,
      splitSourceNodeId: params.splitSourceNodeId,
      bomFieldValues: params.attachmentCount !== undefined ? { [attachmentFieldId]: String(params.attachmentCount) } : {},
      bomFieldContents: params.attachmentNames ? { [attachmentFieldId]: JSON.stringify(params.attachmentNames) } : {}
    }
  }
}

function normalizeExtension(value: string): string {
  const trimmed = String(value || '').trim().toLowerCase()
  return trimmed.startsWith('.') ? trimmed : trimmed ? `.${trimmed}` : ''
}

describe('bom/downloader attachments.service', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-24T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('parses attachment names safely and matches filenames across normalized and wildcard searches', () => {
    expect(parseAttachmentNames('["Rear Connector.dwf","Spec Sheet.pdf"]')).toEqual([
      'Rear Connector.dwf',
      'Spec Sheet.pdf'
    ])
    expect(parseAttachmentNames('not-json')).toEqual([])

    expect(matchesAttachmentFileName('rear connector', 'Rear_Connector(RevA).dwf')).toBe(true)
    expect(matchesAttachmentFileName('rear*.dwf', 'Rear_Connector(RevA).dwf')).toBe(true)
    expect(matchesAttachmentFileName('rear, spec', 'Spec Sheet.pdf')).toBe(true)
    expect(matchesAttachmentFileName('motor', 'Rear Connector.dwf')).toBe(false)
  })

  it('builds preview summaries from attachment names and selected rules', () => {
    const rows = [
      createRow({
        id: '100',
        level: 0,
        label: 'Root Assembly',
        attachmentCount: 2,
        attachmentNames: ['Rear Connector.dwf', 'Spec Sheet.pdf']
      }),
      createRow({
        id: '101',
        level: 1,
        label: 'Child Part',
        attachmentCount: 1,
        attachmentNames: ['Archive.step']
      })
    ]

    expect(buildAttachmentDownloadSummary({
      previewRows: rows,
      attachmentFieldViewDefId: 'attachmentField',
      selectedExtensions: ['.pdf', '.dwf'],
      fileNameSearchText: 'rear, spec',
      normalizeExtension
    })).toEqual({
      matchedCount: 2,
      totalCount: 3
    })
  })

  it('matches modified date ranges and filters resolved rows by extension, search text, and date', () => {
    expect(matchesAttachmentModifiedDate('2026-03-24T08:00:00.000Z', {
      lastModifiedRange: 'today',
      customModifiedFrom: '',
      customModifiedTo: ''
    })).toBe(true)

    expect(matchesAttachmentModifiedDate('2026-03-01T08:00:00.000Z', {
      lastModifiedRange: 'custom',
      customModifiedFrom: '2026-03-05',
      customModifiedTo: '2026-03-10'
    })).toBe(false)

    const rowResults: AttachmentDownloadRowResult[] = [
      {
        rowId: 'row-1',
        rowLabel: 'Root Assembly',
        dmsId: 100,
        rowRevision: 'A',
        rowPathLabels: ['Root Assembly'],
        error: null,
        attachments: [
          {
            id: 1,
            name: 'Rear Connector.dwf',
            url: 'https://bucket.s3.amazonaws.com/rear.dwf',
            description: '',
            version: 1,
            extension: '.dwf',
            resourceName: 'Rear Connector.dwf',
            timestamp: '2026-03-24T08:00:00.000Z',
            size: 10
          },
          {
            id: 2,
            name: 'Archive.step',
            url: 'https://bucket.s3.amazonaws.com/archive.step',
            description: '',
            version: 1,
            extension: '.step',
            resourceName: 'Archive.step',
            timestamp: '2026-03-01T08:00:00.000Z',
            size: 10
          }
        ]
      }
    ]

    expect(filterResolvedAttachmentDownloadRows({
      rowResults,
      selectedExtensions: ['.dwf'],
      fileNameSearchText: 'rear',
      normalizeExtension,
      lastModifiedRange: 'today',
      customModifiedFrom: '',
      customModifiedTo: ''
    })[0].attachments.map((attachment) => attachment.name)).toEqual(['Rear Connector.dwf'])
  })

  it('builds row requests from direct ids, split-source ids, and item links while carrying row path labels', () => {
    const rows = [
      createRow({
        id: '100',
        nodeId: '100',
        level: 0,
        label: 'Root Assembly [REV:A]',
        attachmentCount: 1,
        attachmentNames: ['root.pdf'],
        revision: 'A'
      }),
      createRow({
        id: 'child',
        splitSourceNodeId: '200',
        level: 1,
        label: 'Child Assembly [REV:B]',
        attachmentCount: 1,
        attachmentNames: ['child.dwf'],
        revision: 'B'
      }),
      createRow({
        id: 'linked',
        nodeId: 'not-a-number',
        itemLink: '/api/v3/workspaces/57/items/300',
        level: 2,
        label: 'Linked Part',
        attachmentCount: 2,
        attachmentNames: ['linked.step'],
        revision: 'C'
      }),
      createRow({
        id: 'no-files',
        level: 1,
        label: 'Empty Part',
        attachmentCount: 0,
        attachmentNames: [],
        revision: 'D'
      })
    ]

    expect(buildAttachmentDownloadRowRequests({
      previewRows: rows,
      attachmentFieldViewDefId: 'attachmentField',
      selectedExtensions: ['.pdf'],
      fileNameSearchText: '',
      normalizeExtension
    })).toEqual([
      {
        rowId: '100',
        rowLabel: 'Root Assembly [REV:A]',
        dmsId: 100,
        rowRevision: 'A',
        rowPathLabels: ['Root Assembly [REV:A]']
      },
      {
        rowId: 'child',
        rowLabel: 'Child Assembly [REV:B]',
        dmsId: 200,
        rowRevision: 'B',
        rowPathLabels: ['Root Assembly [REV:A]', 'Child Assembly [REV:B]']
      },
      {
        rowId: 'linked',
        rowLabel: 'Linked Part',
        dmsId: 300,
        rowRevision: 'C',
        rowPathLabels: ['Root Assembly [REV:A]', 'Child Assembly [REV:B]', 'Linked Part']
      }
    ])
  })

  it('summarizes resolved rows by matched files and failed row count', () => {
    expect(buildResolvedAttachmentDownloadSummary([
      {
        rowId: 'ok',
        rowLabel: 'Resolved Row',
        dmsId: 100,
        rowRevision: 'A',
        rowPathLabels: ['Resolved Row'],
        error: null,
        attachments: [
          {
            id: 1,
            name: 'ok.pdf',
            url: 'https://bucket.s3.amazonaws.com/ok.pdf',
            description: '',
            version: 1,
            extension: '.pdf',
            resourceName: 'ok.pdf',
            timestamp: '2026-03-24T08:00:00.000Z',
            size: 10
          }
        ]
      },
      {
        rowId: 'bad',
        rowLabel: 'Failed Row',
        dmsId: 101,
        rowRevision: 'A',
        rowPathLabels: ['Failed Row'],
        error: 'boom',
        attachments: []
      }
    ])).toEqual({
      matchedCount: 1,
      totalCount: 1,
      resolvedRowCount: 1,
      failedRowCount: 1
    })
  })
})
