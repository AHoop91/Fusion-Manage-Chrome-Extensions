import React, { useEffect, useId, useMemo, useRef, useState } from 'react'
import { normalizeText } from '../../../../../../shared/utils/text'
import { shouldPreloadLookupOptions } from '../../../services/form/fieldTypes'
import type { FormFieldDefinition, LookupOption } from '../../../services/form/types'
import { loadRadioFieldOptions } from './lookupField.helpers'
import { positionFloatingMenu, resetFloatingMenuPosition } from './menuPosition'

type FieldChange = {
  value: string
  displayValue?: string
}

type RadioFieldProps = {
  field: FormFieldDefinition
  value: string
  displayValue: string
  onChange: (next: FieldChange) => void
}

function hasMatchingRadioOption(option: LookupOption, currentValue: string, currentLabel: string): boolean {
  const normalizedValue = String(currentValue || '').trim()
  const normalizedLabel = String(currentLabel || '').trim()
  if (normalizedValue && option.value === normalizedValue) return true
  return Boolean(normalizedLabel) && normalizeText(option.label) === normalizeText(normalizedLabel)
}

export function RadioField(props: RadioFieldProps): React.JSX.Element {
  const { field, value, displayValue, onChange } = props
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const triggerRef = useRef<HTMLInputElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [options, setOptions] = useState<LookupOption[]>([])
  const [selectedLabel, setSelectedLabel] = useState(displayValue)
  const [selectedValue, setSelectedValue] = useState(value)
  const groupName = useId().replace(/:/g, '-')

  useEffect(() => {
    setSelectedLabel(displayValue)
    setSelectedValue(value)
  }, [displayValue, value])

  useEffect(() => {
    if (!field.picklistPath || !shouldPreloadLookupOptions(field.typeId)) return
    void loadRadioFieldOptions(field.picklistPath)
  }, [field.picklistPath, field.typeId])

  useEffect(() => {
    if (!isOpen) return
    const trigger = triggerRef.current
    const menu = menuRef.current
    if (!(trigger instanceof HTMLElement) || !(menu instanceof HTMLElement)) return
    positionFloatingMenu({
      anchor: trigger,
      menu,
      minWidth: 160,
      constrainToEditPanel: true
    })
    const onViewportChange = (): void => {
      const nextTrigger = triggerRef.current
      const nextMenu = menuRef.current
      if (!(nextTrigger instanceof HTMLElement) || !(nextMenu instanceof HTMLElement)) return
      positionFloatingMenu({
        anchor: nextTrigger,
        menu: nextMenu,
        minWidth: 160,
        constrainToEditPanel: true
      })
    }
    window.addEventListener('resize', onViewportChange)
    window.addEventListener('scroll', onViewportChange, true)
    return () => {
      window.removeEventListener('resize', onViewportChange)
      window.removeEventListener('scroll', onViewportChange, true)
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const onPointerDown = (event: PointerEvent): void => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (wrapRef.current?.contains(target) || menuRef.current?.contains(target)) return
      setIsOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
    }
  }, [isOpen])

  useEffect(() => {
    if (isOpen) return
    const menu = menuRef.current
    if (menu) resetFloatingMenuPosition(menu)
  }, [isOpen])

  const visibleOptions = useMemo(() => {
    const normalizedValue = String(selectedValue || '').trim()
    const normalizedLabel = String(selectedLabel || '').trim()
    if (!normalizedLabel) return options
    const hasMatch = options.some((option) => hasMatchingRadioOption(option, normalizedValue, normalizedLabel))
    if (hasMatch) return options
    return [{ label: normalizedLabel, value: normalizedValue || normalizedLabel }, ...options]
  }, [options, selectedLabel, selectedValue])

  const ensureOptionsLoaded = async (): Promise<void> => {
    if (loading || options.length > 0 || !field.picklistPath) return
    setLoading(true)
    const nextOptions = await loadRadioFieldOptions(field.picklistPath)
    setOptions(nextOptions)
    setLoading(false)
  }

  const openMenu = (): void => {
    if (!field.editable) return
    setIsOpen(true)
    void ensureOptionsLoaded()
  }

  return (
    <fieldset className="plm-extension-grid-form-radio-dropdown">
      <div
        ref={wrapRef}
        className={[
          'plm-extension-grid-form-lookup-wrap',
          'plm-extension-grid-form-radio-dropdown-wrap',
          'has-clear',
          selectedLabel || selectedValue ? 'has-value' : '',
          isOpen ? 'is-open' : ''
        ].filter(Boolean).join(' ')}
      >
        <input
          ref={triggerRef}
          type="text"
          className="plm-extension-grid-form-control plm-extension-grid-form-control--lookup plm-extension-grid-form-radio-dropdown-trigger"
          value={selectedLabel}
          readOnly={true}
          disabled={!field.editable}
          placeholder="Select..."
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            if (isOpen) {
              setIsOpen(false)
              return
            }
            openMenu()
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setIsOpen(false)
              return
            }
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              if (isOpen) {
                setIsOpen(false)
                return
              }
              openMenu()
            }
          }}
        />
        <button
          type="button"
          className="plm-extension-grid-form-lookup-clear"
          aria-label={`Clear ${field.title}`}
          disabled={!field.editable}
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            setSelectedLabel('')
            setSelectedValue('')
            setIsOpen(false)
            onChange({ value: '', displayValue: '' })
          }}
        >
          x
        </button>
        <div
          ref={menuRef}
          className={`plm-extension-grid-form-lookup-menu plm-extension-grid-form-radio-dropdown-menu${isOpen ? ' is-open' : ''}`}
          role="listbox"
          onMouseDown={(event) => event.preventDefault()}
        >
          {loading ? (
            <div className="plm-extension-grid-form-radio-loading">Loading options...</div>
          ) : visibleOptions.length === 0 ? (
            <div className="plm-extension-grid-form-radio-loading">No options</div>
          ) : (
            visibleOptions.map((option) => {
              const checked = hasMatchingRadioOption(option, selectedValue, selectedLabel)
              return (
                <label key={`${normalizeText(option.label)}::${option.value}`} className="plm-extension-grid-form-radio-dropdown-option">
                  <input
                    type="radio"
                    name={`plm-grid-radio-${groupName}`}
                    value={option.value}
                    checked={checked}
                    onChange={() => {
                      setSelectedLabel(option.label)
                      setSelectedValue(option.value)
                      setIsOpen(false)
                      onChange({ value: option.value, displayValue: option.label })
                    }}
                  />
                  <span>{option.label}</span>
                </label>
              )
            })
          )}
        </div>
      </div>
    </fieldset>
  )
}
