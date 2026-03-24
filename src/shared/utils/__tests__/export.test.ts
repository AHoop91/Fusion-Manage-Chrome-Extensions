// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  csvEscape,
  downloadCsv,
  makeTimestamp,
  nextTick,
  setExportButtonLabel,
  setExportProgress
} from '../export'

describe('shared export utils', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    document.body.innerHTML = ''
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('escapes csv values only when required', () => {
    expect(csvEscape('plain')).toBe('plain')
    expect(csvEscape('a,b')).toBe('"a,b"')
    expect(csvEscape('a"b')).toBe('"a""b"')
    expect(csvEscape(null)).toBe('')
  })

  it('formats timestamps as YYYYMMDD-HHMM', () => {
    vi.setSystemTime(new Date('2026-03-23T14:05:00'))
    expect(makeTimestamp()).toBe('20260323-1405')
  })

  it('resolves nextTick on a timer boundary', async () => {
    let resolved = false
    const pending = nextTick().then(() => {
      resolved = true
    })

    expect(resolved).toBe(false)
    await vi.runAllTimersAsync()
    await pending
    expect(resolved).toBe(true)
  })

  it('downloads csv content through a temporary anchor', () => {
    const createObjectURL = vi.fn(() => 'blob:test')
    const revokeObjectURL = vi.fn()
    const click = vi.fn()
    const appendSpy = vi.spyOn(document.body, 'appendChild')

    vi.stubGlobal('URL', {
      createObjectURL,
      revokeObjectURL
    })

    const anchorFactory = vi.spyOn(document, 'createElement')
    anchorFactory.mockImplementation(((tagName: string) => {
      const element = document.createElementNS('http://www.w3.org/1999/xhtml', tagName)
      if (tagName.toLowerCase() === 'a') {
        Object.defineProperty(element, 'click', {
          value: click
        })
      }
      return element
    }) as typeof document.createElement)

    downloadCsv('report.csv', 'a,b')

    expect(createObjectURL).toHaveBeenCalledTimes(1)
    expect(appendSpy).toHaveBeenCalledTimes(1)
    expect(click).toHaveBeenCalledTimes(1)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:test')
  })

  it('updates export button label and progress state', () => {
    const button = document.createElement('button')
    const textNode = document.createElement('span')
    textNode.className = 'label'
    button.appendChild(textNode)

    setExportButtonLabel({
      button,
      textSelector: '.label',
      isExporting: true,
      idleLabel: 'Export CSV',
      activeLabel: 'Exporting...'
    })
    expect(textNode.textContent).toBe('Exporting...')

    const container = document.createElement('div')
    const text = document.createElement('span')
    const fill = document.createElement('div')

    setExportProgress({
      container,
      text,
      fill,
      state: {
        isExporting: true,
        processed: 3,
        total: 5
      },
      labelPrefix: 'Saving'
    })

    expect(container.style.display).toBe('flex')
    expect(text.textContent).toBe('Saving 3 of 5 (60%)')
    expect(fill.style.width).toBe('60%')

    setExportProgress({
      container,
      text,
      fill,
      state: {
        isExporting: false,
        processed: 0,
        total: 0
      }
    })

    expect(container.style.display).toBe('none')
    expect(text.textContent).toBe('')
    expect(fill.style.width).toBe('0%')
  })
})
