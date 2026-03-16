import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { normalizeText } from '../../../../../../shared/utils/text'
import { isMultiLookupFieldType } from '../../../services/form/fieldTypes'
import { fetchLookupOptionsByQuery } from '../../../services/form/lookupManagers'
import type { FormFieldDefinition, LookupOption } from '../../../services/form/types'
import {
  hydrateLookupLinksForLabels,
  joinLookupValues,
  resolveLookupPayloadValueFromState,
  seedLookupLabelLinkMap,
  splitLookupDisplayValue
} from './lookupField.helpers'
import { positionFloatingMenu, resetFloatingMenuPosition } from './menuPosition'

type FieldChange = {
  value: string
  displayValue?: string
}

type LookupFieldProps = {
  field: FormFieldDefinition
  value: string
  displayValue: string
  onChange: (next: FieldChange) => void
}

const LOOKUP_PAGE_SIZE = 100
const LOOKUP_SCROLL_THRESHOLD_PX = 28

function getLookupOpenQuery(inputValue: string, currentLabel: string): string {
  const normalizedInput = String(inputValue || '').trim()
  if (!normalizedInput) return ''
  const normalizedCurrentLabel = String(currentLabel || '').trim()
  if (normalizedCurrentLabel && normalizedCurrentLabel.toLowerCase() === normalizedInput.toLowerCase()) return ''
  return normalizedInput
}

function mergeLookupOptions(existing: LookupOption[], nextPage: LookupOption[]): LookupOption[] {
  const merged = [...existing]
  const seen = new Set(existing.map((option) => `${normalizeText(option.label)}::${option.value}`))
  for (const option of nextPage) {
    const key = `${normalizeText(option.label)}::${option.value}`
    if (seen.has(key)) continue
    seen.add(key)
    merged.push(option)
  }
  return merged
}

export function LookupField(props: LookupFieldProps): React.JSX.Element {
  const { field, value, displayValue, onChange } = props
  const isMultiSelect = isMultiLookupFieldType(field.typeId)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const labelToLinkRef = useRef<Map<string, string>>(new Map())
  const debounceTimerRef = useRef<number | null>(null)
  const activeRequestIdRef = useRef(0)
  const requestAbortRef = useRef<AbortController | null>(null)
  const loadedOffsetsRef = useRef<Set<number>>(new Set())
  const loadedOptionsRef = useRef<LookupOption[]>([])
  const nextOffsetRef = useRef(0)
  const hasMoreRef = useRef(false)
  const loadingRef = useRef(false)
  const queryRef = useRef('')
  const [inputValue, setInputValue] = useState(isMultiSelect ? '' : displayValue)
  const [currentLabel, setCurrentLabel] = useState(displayValue)
  const [currentLink, setCurrentLink] = useState(value)
  const [selectedLabels, setSelectedLabels] = useState<string[]>(() => splitLookupDisplayValue(displayValue))
  const [selectedLinks, setSelectedLinks] = useState<string[]>(() => splitLookupDisplayValue(value))
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [totalResults, setTotalResults] = useState<number | null>(null)
  const [loadedOptions, setLoadedOptions] = useState<LookupOption[]>([])

  const visibleOptions = useMemo(() => {
    if (!isMultiSelect) return loadedOptions
    const selectedLabelSet = new Set(selectedLabels.map((label) => normalizeText(label)))
    return loadedOptions.filter((option) => !selectedLabelSet.has(normalizeText(option.label)))
  }, [isMultiSelect, loadedOptions, selectedLabels])

  const syncMenuPosition = useCallback(() => {
    const input = inputRef.current
    const menu = menuRef.current
    if (!(input instanceof HTMLElement) || !(menu instanceof HTMLElement) || !isOpen) return
    positionFloatingMenu({
      anchor: input,
      menu,
      minWidth: 220,
      constrainToEditPanel: true
    })
  }, [isOpen])

  const cancelPendingLookupWork = useCallback(() => {
    if (debounceTimerRef.current !== null) {
      window.clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }
    activeRequestIdRef.current += 1
    requestAbortRef.current?.abort()
    requestAbortRef.current = null
    loadingRef.current = false
    setLoading(false)
    setLoadingMore(false)
  }, [])

  const closeMenu = useCallback(() => {
    cancelPendingLookupWork()
    setIsOpen(false)
    const menu = menuRef.current
    if (menu) resetFloatingMenuPosition(menu)
  }, [cancelPendingLookupWork])

  const emitMultiChange = useCallback((nextLabels: string[], nextLinks: string[]) => {
    const display = joinLookupValues(nextLabels)
    const payload = resolveLookupPayloadValueFromState({
      isMultiSelect: true,
      userInputValue: '',
      selectedLabels: nextLabels,
      selectedLinks: nextLinks,
      labelToLink: labelToLinkRef.current
    })
    onChange({ value: payload, displayValue: display })
  }, [onChange])

  const emitSingleInputChange = useCallback((nextInputValue: string, nextLink: string) => {
    const nextValue = resolveLookupPayloadValueFromState({
      isMultiSelect: false,
      userInputValue: nextInputValue,
      currentLabel: nextInputValue,
      currentLink: nextLink,
      labelToLink: labelToLinkRef.current
    })
    onChange({ value: nextValue, displayValue: nextInputValue })
  }, [onChange])

  const loadLookupPage = useCallback(async (offset: number, resetResults: boolean) => {
    const picklistPath = String(field.picklistPath || '').trim()
    if (!picklistPath) return
    if (!resetResults && (loadingRef.current || loadedOffsetsRef.current.has(offset))) return

    loadingRef.current = true
    if (resetResults) {
      setLoading(true)
      setLoadingMore(false)
      loadedOffsetsRef.current = new Set()
      loadedOptionsRef.current = []
      nextOffsetRef.current = 0
      hasMoreRef.current = false
      setLoadedOptions([])
      setTotalResults(null)
    } else {
      setLoadingMore(true)
    }

    const requestId = activeRequestIdRef.current + 1
    activeRequestIdRef.current = requestId
    requestAbortRef.current?.abort()
    const controller = new AbortController()
    requestAbortRef.current = controller

    const page = await fetchLookupOptionsByQuery(
      picklistPath,
      queryRef.current,
      LOOKUP_PAGE_SIZE,
      offset,
      { signal: controller.signal, useCache: false }
    )
    if (requestId !== activeRequestIdRef.current) return

    loadingRef.current = false
    setLoading(false)
    setLoadingMore(false)
    loadedOffsetsRef.current.add(page.offset)
    loadedOptionsRef.current = resetResults
      ? [...page.options]
      : mergeLookupOptions(loadedOptionsRef.current, page.options)
    nextOffsetRef.current = page.offset + page.limit
    hasMoreRef.current = page.total !== null
      ? loadedOptionsRef.current.length < page.total
      : page.options.length >= page.limit
    setLoadedOptions(loadedOptionsRef.current)
    setTotalResults(page.total ?? loadedOptionsRef.current.length)

    window.setTimeout(() => {
      syncMenuPosition()
      const menu = menuRef.current
      if (hasMoreRef.current && menu && menu.scrollHeight <= menu.clientHeight + 6) {
        void loadLookupPage(nextOffsetRef.current, false)
      }
    }, 0)
  }, [field.picklistPath, syncMenuPosition])

  const scheduleLookupQuery = useCallback((query: string) => {
    queryRef.current = query
    if (debounceTimerRef.current !== null) {
      window.clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }
    const delay = loadingRef.current ? 180 : 120
    debounceTimerRef.current = window.setTimeout(() => {
      debounceTimerRef.current = null
      void loadLookupPage(0, true)
    }, delay)
  }, [loadLookupPage])

  useEffect(() => {
    const parsedLabels = splitLookupDisplayValue(displayValue)
    const parsedLinks = splitLookupDisplayValue(value)
    labelToLinkRef.current = seedLookupLabelLinkMap(parsedLabels, parsedLinks)
    setSelectedLabels(parsedLabels)
    setSelectedLinks(parsedLinks)
    setCurrentLabel(displayValue)
    setCurrentLink(value)
    setInputValue(isMultiSelect ? '' : displayValue)
  }, [displayValue, value, isMultiSelect])

  useEffect(() => {
    if (!field.picklistPath || !isMultiSelect || selectedLabels.length === 0) return
    let isDisposed = false
    void hydrateLookupLinksForLabels(field.picklistPath, selectedLabels, selectedLinks).then((result) => {
      if (isDisposed) return
      labelToLinkRef.current = result.labelToLink
      setSelectedLinks((current) => {
        if (joinLookupValues(current) === joinLookupValues(result.links)) return current
        return result.links
      })
    })
    return () => {
      isDisposed = true
    }
  }, [field.picklistPath, isMultiSelect, selectedLabels, selectedLinks])

  useEffect(() => {
    if (!field.picklistPath) return
    void fetchLookupOptionsByQuery(field.picklistPath, '', LOOKUP_PAGE_SIZE, 0, { useCache: true })
  }, [field.picklistPath])

  useEffect(() => {
    if (!isOpen) return
    syncMenuPosition()
    const onViewportChange = (): void => syncMenuPosition()
    window.addEventListener('resize', onViewportChange)
    window.addEventListener('scroll', onViewportChange, true)
    return () => {
      window.removeEventListener('resize', onViewportChange)
      window.removeEventListener('scroll', onViewportChange, true)
    }
  }, [isOpen, syncMenuPosition])

  useEffect(() => {
    if (!isOpen) return
    const onPointerDown = (event: PointerEvent): void => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (wrapRef.current?.contains(target) || menuRef.current?.contains(target)) return
      closeMenu()
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
    }
  }, [isOpen, closeMenu])

  useEffect(() => () => {
    cancelPendingLookupWork()
  }, [cancelPendingLookupWork])

  const selectedLabelSummary = joinLookupValues(selectedLabels)
  const wrapClassName = [
    'plm-extension-grid-form-lookup-wrap',
    isMultiSelect ? 'is-multi' : '',
    isOpen ? 'is-open' : '',
    !isMultiSelect && (String(inputValue || '').trim() || String(currentLink || '').trim()) ? 'has-value' : '',
    !isMultiSelect ? 'has-clear' : ''
  ].filter(Boolean).join(' ')

  const openMenu = (): void => {
    if (!field.editable || !field.picklistPath) return
    setIsOpen(true)
    const nextQuery = isMultiSelect
      ? String(inputValue || '').trim()
      : getLookupOpenQuery(inputValue, currentLabel)
    scheduleLookupQuery(nextQuery)
  }

  const removeChipAt = (index: number): void => {
    if (!field.editable) return
    const nextLabels = selectedLabels.filter((_, currentIndex) => currentIndex !== index)
    const nextLinks = selectedLinks.filter((_, currentIndex) => currentIndex !== index)
    setSelectedLabels(nextLabels)
    setSelectedLinks(nextLinks)
    emitMultiChange(nextLabels, nextLinks)
  }

  return (
    <div ref={wrapRef} className={wrapClassName}>
      {isMultiSelect ? (
        <div className="plm-extension-grid-form-lookup-chips">
          {selectedLabels.map((label, index) => (
            <span key={`${label}:${index}`} className="plm-extension-grid-form-lookup-chip">
              <span className="plm-extension-grid-form-lookup-chip-text">{label}</span>
              <button
                type="button"
                className="plm-extension-grid-form-lookup-chip-remove"
                aria-label={`Remove ${label}`}
                disabled={!field.editable}
                onClick={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  removeChipAt(index)
                }}
              >
                x
              </button>
            </span>
          ))}
        </div>
      ) : null}
      <input
        ref={inputRef}
        type="text"
        className="plm-extension-grid-form-control plm-extension-grid-form-control--lookup"
        value={inputValue}
        disabled={!field.editable}
        placeholder={isMultiSelect ? 'Type to search and select multiple...' : 'Type to search...'}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        onClick={() => openMenu()}
        onChange={(event) => {
          const nextValue = event.target.value
          setInputValue(nextValue)
          if (isMultiSelect) {
            scheduleLookupQuery(String(nextValue || '').trim())
            if (!isOpen) openMenu()
            return
          }
          if (!String(nextValue || '').trim()) {
            setCurrentLabel('')
            setCurrentLink('')
            onChange({ value: '', displayValue: '' })
            scheduleLookupQuery('')
            if (!isOpen) openMenu()
            return
          }
          setCurrentLabel(nextValue)
          emitSingleInputChange(nextValue, currentLink)
          scheduleLookupQuery(nextValue)
          if (!isOpen) openMenu()
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            closeMenu()
            return
          }
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Enter') {
            if (event.key === 'Enter') event.preventDefault()
            openMenu()
          }
        }}
      />
      {!isMultiSelect ? (
        <button
          type="button"
          className="plm-extension-grid-form-lookup-clear"
          aria-label={`Clear ${field.title}`}
          disabled={!field.editable}
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            cancelPendingLookupWork()
            setInputValue('')
            setCurrentLabel('')
            setCurrentLink('')
            closeMenu()
            onChange({ value: '', displayValue: '' })
          }}
        >
          x
        </button>
      ) : null}
      <div
        ref={menuRef}
        className={`plm-extension-grid-form-lookup-menu${isOpen ? ' is-open' : ''}`}
        role="listbox"
        onMouseDown={(event) => event.preventDefault()}
        onScroll={(event) => {
          if (!isOpen || !hasMoreRef.current || loadingRef.current) return
          const menu = event.currentTarget
          const nearBottom = menu.scrollTop + menu.clientHeight >= menu.scrollHeight - LOOKUP_SCROLL_THRESHOLD_PX
          if (!nearBottom) return
          void loadLookupPage(nextOffsetRef.current, false)
        }}
      >
        <div className="plm-extension-grid-form-lookup-summary">
          {totalResults === null
            ? `${visibleOptions.length} result(s) displayed`
            : `${visibleOptions.length} result(s) displayed, out of ${totalResults}`}
        </div>
        <div className="plm-extension-grid-form-lookup-options">
          {loading ? (
            <div className="plm-extension-grid-form-lookup-loading">
              <span className="plm-extension-grid-form-lookup-spinner" />
              <span>Loading...</span>
            </div>
          ) : visibleOptions.length === 0 ? (
            <div className="plm-extension-grid-form-lookup-empty">
              {isMultiSelect && selectedLabelSummary ? 'No additional results' : 'No results'}
            </div>
          ) : (
            visibleOptions.map((option) => (
              <button
                key={`${normalizeText(option.label)}::${option.value}`}
                type="button"
                className="plm-extension-grid-form-lookup-item"
                onClick={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  labelToLinkRef.current.set(normalizeText(option.label), option.value)
                  if (isMultiSelect) {
                    if (selectedLabels.some((entry) => normalizeText(entry) === normalizeText(option.label))) return
                    const nextLabels = [...selectedLabels, option.label]
                    const nextLinks = [...selectedLinks, option.value]
                    setSelectedLabels(nextLabels)
                    setSelectedLinks(nextLinks)
                    setInputValue('')
                    emitMultiChange(nextLabels, nextLinks)
                    scheduleLookupQuery('')
                    return
                  }
                  setCurrentLabel(option.label)
                  setCurrentLink(option.value)
                  setInputValue(option.label)
                  closeMenu()
                  onChange({ value: option.value, displayValue: option.label })
                }}
              >
                {option.label}
              </button>
            ))
          )}
        </div>
        {loadingMore ? (
          <div className="plm-extension-grid-form-lookup-loading-more">
            <span className="plm-extension-grid-form-lookup-spinner" />
            <span>Loading more results...</span>
          </div>
        ) : null}
      </div>
    </div>
  )
}
