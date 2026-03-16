import { applyMaxLength } from '../../../../shared/form/controls'
import { el } from '../view/domBuilder'
import {
  isBooleanFieldType,
  isDateFieldType,
  isDecimalFieldType,
  isEmailFieldType,
  isIntegerFieldType,
  isLookupFieldType,
  isMoneyFieldType,
  isMultiLookupFieldType,
  isParagraphFieldType,
  isRadioFieldType,
  shouldPreloadLookupOptions,
  isUrlFieldType
} from './fieldTypes'
import type { GridService } from './gridService'
import type { FormFieldDefinition } from '../types'
import { fetchLookupOptionsByQuery } from '../../../../shared/form/lookupOptions'

/**
 * Strategy contract for creating a form control for a given field type.
 */
export type ControlStrategy = {
  /**
   * Returns true when this strategy handles the field.
   */
  matches: (field: FormFieldDefinition) => boolean
  /**
   * Builds the control element for the field value.
   */
  create: (
    field: FormFieldDefinition,
    value: string,
    gridService: GridService
  ) => HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | HTMLFieldSetElement
}

function normalizeNumericInputValue(rawValue: string, precision: number | null, integerDigits: number | null): string {
  let next = String(rawValue || '').trim()
  if (!next) return ''

  // Normalize common money/number display formats into a numeric input-safe value.
  next = next.replace(/[^\d,.\-]/g, '')
  if (next.includes(',') && next.includes('.')) {
    next = next.replace(/,/g, '')
  } else if (next.includes(',') && !next.includes('.')) {
    next = next.replace(/,/g, '.')
  }

  const parsed = Number(next)
  if (!Number.isFinite(parsed)) return ''

  const negative = parsed < 0
  const absolute = Math.abs(parsed)
  const fixed = typeof precision === 'number' && precision > 0 ? absolute.toFixed(precision) : String(Math.trunc(absolute))
  const [rawInteger = '', rawDecimal = ''] = fixed.split('.')
  const boundedInteger =
    typeof integerDigits === 'number' && integerDigits > 0
      ? rawInteger.slice(0, integerDigits)
      : rawInteger
  const integerPart = boundedInteger || '0'
  if (typeof precision === 'number' && precision > 0) {
    return `${negative ? '-' : ''}${integerPart}.${rawDecimal}`
  }
  return `${negative ? '-' : ''}${integerPart}`
}

type LookupOption = {
  label: string
  value: string
}

function syncRadioFieldsetDataset(fieldset: HTMLFieldSetElement, trigger: HTMLInputElement, wrap: HTMLDivElement): void {
  const selected = fieldset.querySelector<HTMLInputElement>('input[type="radio"]:checked')
  const label = String(selected?.dataset.plmLookupLabel || '').trim()
  const value = String(selected?.value || '').trim()
  fieldset.dataset.plmLookupCurrentLabel = label
  fieldset.dataset.plmLookupCurrentValue = value
  fieldset.dataset.plmLookupCurrentLink = value.startsWith('/api/v3/') ? value : ''
  trigger.value = label || ''
  wrap.classList.toggle('has-value', Boolean(label || value))
}

function loadRadioOptions(fieldset: HTMLFieldSetElement, field: FormFieldDefinition): Promise<LookupOption[]> {
  const picklistPath = String(field.picklistPath || '').trim()
  if (!picklistPath) return Promise.resolve([])

  return fetchLookupOptionsByQuery(picklistPath, '', 250, 0, { useCache: true })
    .then((page) => page.options)
    .catch(() => [])
}

const booleanStrategy: ControlStrategy = {
  matches: (field) => field.kind === 'boolean' || isBooleanFieldType(field.typeId),
  create: (_field, value) => {
    const checkbox = el('input').cls('plm-extension-grid-form-control--checkbox').type('checkbox').build() as HTMLInputElement
    const normalized = String(value || '').trim().toLowerCase()
    checkbox.checked = normalized === 'true' || normalized === '1' || normalized === 'yes'
    checkbox.value = checkbox.checked ? 'true' : 'false'
    checkbox.addEventListener('change', () => {
      checkbox.value = checkbox.checked ? 'true' : 'false'
    })
    return checkbox
  }
}

const lookupStrategy: ControlStrategy = {
  matches: (field) => (isLookupFieldType(field.typeId) || Boolean(field.picklistPath)) && Boolean(field.picklistPath),
  create: (field, value) => {
    const input = el('input').cls('plm-extension-grid-form-control', 'plm-extension-grid-form-control--lookup').type('text').build() as HTMLInputElement
    input.value = String(value || '')
    input.placeholder = isMultiLookupFieldType(field.typeId) ? 'Type to search and select multiple...' : 'Type to search...'
    applyMaxLength(input, field)
    return input
  }
}

const radioStrategy: ControlStrategy = {
  matches: (field) => isRadioFieldType(field.typeId),
  create: (field, value) => {
    const select = el('fieldset').cls('plm-extension-grid-form-radio-dropdown').build() as HTMLFieldSetElement
    const wrap = el('div')
      .cls('plm-extension-grid-form-lookup-wrap', 'plm-extension-grid-form-radio-dropdown-wrap', 'has-clear')
      .build()
    const menu = el('div').cls('plm-extension-grid-form-lookup-menu', 'plm-extension-grid-form-radio-dropdown-menu').build() as HTMLDivElement
    const clearButton = el('button')
      .type('button')
      .cls('plm-extension-grid-form-lookup-clear')
      .attr('aria-label', `Clear ${field.title}`)
      .text('×')
      .build() as HTMLButtonElement
    const trigger = el('input')
      .cls('plm-extension-grid-form-control', 'plm-extension-grid-form-control--lookup', 'plm-extension-grid-form-radio-dropdown-trigger')
      .type('text')
      .build() as HTMLInputElement
    trigger.readOnly = true
    trigger.placeholder = 'Select...'
    wrap.appendChild(trigger)
    wrap.appendChild(clearButton)
    wrap.appendChild(menu)
    select.appendChild(wrap)

    const initial = String(value || '').trim()
    const defaultLabel = String(field.defaultValue || '').trim()
    const defaultLink = String(field.defaultPayloadValue || '').trim()
    select.dataset.plmLookupCurrentLabel = initial
    select.dataset.plmLookupCurrentValue = initial
    select.dataset.plmLookupCurrentLink = initial.startsWith('/api/v3/') ? initial : ''
    select.dataset.plmLookupDefaultLabel = defaultLabel
    select.dataset.plmLookupDefaultLink = defaultLink
    trigger.value = initial

    let options: LookupOption[] = []
    let isOpen = false
    let isLoaded = false
    let isLoading = false
    const groupName = `plm-grid-radio-${Date.now()}-${Math.round(Math.random() * 1e6)}`

    const closeMenu = (): void => {
      isOpen = false
      menu.classList.remove('is-open')
      wrap.classList.remove('is-open')
    }

    const renderOptions = (): void => {
      menu.textContent = ''
      if (isLoading) {
        menu.appendChild(el('div').cls('plm-extension-grid-form-radio-loading').text('Loading options...').build())
        return
      }

      const currentValue = String(select.dataset.plmLookupCurrentValue || '').trim()
      const currentLabel = String(select.dataset.plmLookupCurrentLabel || '').trim()
      const normalizedCurrentLabel = currentLabel.toLowerCase()

      let hasSelected = false
      for (const option of options) {
        const input = el('input').type('radio').attr('name', groupName).attr('value', option.value).build() as HTMLInputElement
        input.dataset.plmLookupLabel = option.label
        if (
          currentValue &&
          (option.value === currentValue || option.label.trim().toLowerCase() === normalizedCurrentLabel)
        ) {
          input.checked = true
          hasSelected = true
        }
        input.addEventListener('change', () => {
          syncRadioFieldsetDataset(select, trigger, wrap)
          closeMenu()
          select.dispatchEvent(new Event('change', { bubbles: true }))
        })

        const label = el('label').cls('plm-extension-grid-form-radio-dropdown-option').append(input, el('span').text(option.label)).build()
        menu.appendChild(label)
      }

      if (!hasSelected && currentLabel && options.length > 0) {
        const fallbackInput = el('input').type('radio').attr('name', groupName).attr('value', currentValue || currentLabel).build() as HTMLInputElement
        fallbackInput.dataset.plmLookupLabel = currentLabel
        fallbackInput.checked = true
        fallbackInput.addEventListener('change', () => {
          syncRadioFieldsetDataset(select, trigger, wrap)
          closeMenu()
          select.dispatchEvent(new Event('change', { bubbles: true }))
        })
        const fallback = el('label')
          .cls('plm-extension-grid-form-radio-dropdown-option')
          .append(fallbackInput, el('span').text(currentLabel))
          .build()
        menu.insertBefore(fallback, menu.firstChild)
      }

      if (menu.childElementCount === 0) {
        menu.appendChild(el('div').cls('plm-extension-grid-form-radio-loading').text('No options').build())
      }
      syncRadioFieldsetDataset(select, trigger, wrap)
    }

    const ensureOptionsLoaded = (): void => {
      if (isLoaded || isLoading) return
      isLoading = true
      renderOptions()
      void loadRadioOptions(select, field).then((next) => {
        options = next
        isLoaded = true
        isLoading = false
        renderOptions()
      })
    }

    const openMenu = (): void => {
      if (select.disabled) return
      ensureOptionsLoaded()
      isOpen = true
      menu.classList.add('is-open')
      wrap.classList.add('is-open')
    }

    trigger.addEventListener('click', (event) => {
      event.preventDefault()
      event.stopPropagation()
      if (isOpen) closeMenu()
      else openMenu()
    })
    trigger.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        closeMenu()
        return
      }
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        if (isOpen) closeMenu()
        else openMenu()
      }
    })
    clearButton.addEventListener('click', (event) => {
      event.preventDefault()
      event.stopPropagation()
      if (select.disabled) return
      const selected = select.querySelector<HTMLInputElement>('input[type="radio"]:checked')
      if (selected) selected.checked = false
      const defaultLabelValue = String(select.dataset.plmLookupDefaultLabel || '').trim()
      const defaultLinkValue = String(select.dataset.plmLookupDefaultLink || '').trim()
      select.dataset.plmLookupCurrentLabel = defaultLabelValue
      select.dataset.plmLookupCurrentValue = defaultLabelValue
      select.dataset.plmLookupCurrentLink = defaultLinkValue
      trigger.value = defaultLabelValue
      wrap.classList.toggle('has-value', Boolean(defaultLabelValue || defaultLinkValue))
      if (isLoaded) renderOptions()
      closeMenu()
      select.dispatchEvent(new Event('change', { bubbles: true }))
    })

    document.addEventListener(
      'pointerdown',
      (event) => {
        if (!select.isConnected) return
        const target = event.target
        if (!(target instanceof Node)) return
        if (!select.contains(target)) closeMenu()
      },
      true
    )

    if (shouldPreloadLookupOptions(field.typeId)) {
      ensureOptionsLoaded()
    }

    wrap.classList.toggle('has-value', Boolean(initial))

    return select
  }
}

const paragraphStrategy: ControlStrategy = {
  matches: (field) => isParagraphFieldType(field.typeId),
  create: (field, value) => {
    const textarea = el('textarea').cls('plm-extension-grid-form-control', 'plm-extension-grid-form-control--textarea').build() as HTMLTextAreaElement
    textarea.value = String(value || '')
    textarea.placeholder = 'Enter text...'
    applyMaxLength(textarea, field)
    return textarea
  }
}

const dateStrategy: ControlStrategy = {
  matches: (field) => field.kind === 'date' || isDateFieldType(field.typeId),
  create: (_field, value, gridService) => {
    const input = el('input').cls('plm-extension-grid-form-control').type('date').build() as HTMLInputElement
    input.value = gridService.parseDateToInputValue(value)
    return input
  }
}

const numberStrategy: ControlStrategy = {
  matches: (field) =>
    field.kind === 'number' ||
    isIntegerFieldType(field.typeId) ||
    isDecimalFieldType(field.typeId) ||
    isMoneyFieldType(field.typeId),
  create: (field, value) => {
    const input = el('input').cls('plm-extension-grid-form-control').type('number').build() as HTMLInputElement
    const precision = typeof field.fieldPrecision === 'number' ? field.fieldPrecision : null
    const integerDigits = typeof field.fieldLength === 'number' ? field.fieldLength : null

    if (isIntegerFieldType(field.typeId)) {
      input.step = '1'
    } else {
      input.step = precision && precision > 0 ? `${1 / Math.pow(10, precision)}` : 'any'
    }

    input.inputMode = 'decimal'
    input.value = normalizeNumericInputValue(String(value || ''), precision, integerDigits)
    input.addEventListener('input', () => {
      let next = String(input.value || '')
      if (!next) return
      const negative = next.startsWith('-')
      next = next.replace(/-/g, '')
      next = next.replace(/[^\d.]/g, '')
      const firstDot = next.indexOf('.')
      const integerPart = firstDot >= 0 ? next.slice(0, firstDot) : next
      let decimalPart = firstDot >= 0 ? next.slice(firstDot + 1).replace(/\./g, '') : ''
      if (typeof precision === 'number') {
        if (precision <= 0) decimalPart = ''
        else decimalPart = decimalPart.slice(0, precision)
      }
      const boundedIntegerPart =
        typeof integerDigits === 'number' && integerDigits > 0
          ? integerPart.slice(0, integerDigits)
          : integerPart
      let normalized = `${negative ? '-' : ''}${boundedIntegerPart}`
      if (decimalPart) normalized += `.${decimalPart}`
      if (normalized !== input.value) input.value = normalized
    })

    const applyFixedPrecision = (): void => {
      if (typeof precision !== 'number' || precision <= 0) return
      const raw = String(input.value || '').trim()
      if (!raw || raw === '-' || raw === '.' || raw === '-.') return
      const parsed = Number(raw)
      if (!Number.isFinite(parsed)) return
      const negative = parsed < 0
      const absolute = Math.abs(parsed)
      const fixed = absolute.toFixed(precision)
      const [rawInteger = '', rawDecimal = ''] = fixed.split('.')
      const boundedInteger =
        typeof integerDigits === 'number' && integerDigits > 0
          ? rawInteger.slice(0, integerDigits)
          : rawInteger
      const integerPart = boundedInteger || '0'
      input.value = `${negative ? '-' : ''}${integerPart}.${rawDecimal}`
    }

    input.addEventListener('blur', applyFixedPrecision)
    return input
  }
}

const emailStrategy: ControlStrategy = {
  matches: (field) => isEmailFieldType(field.typeId),
  create: (field, value) => {
    const input = el('input').cls('plm-extension-grid-form-control').type('email').build() as HTMLInputElement
    input.value = String(value || '')
    applyMaxLength(input, field)
    return input
  }
}

const urlStrategy: ControlStrategy = {
  matches: (field) => isUrlFieldType(field.typeId),
  create: (field, value) => {
    const input = el('input').cls('plm-extension-grid-form-control').type('url').build() as HTMLInputElement
    input.value = String(value || '')
    applyMaxLength(input, field)
    return input
  }
}

const defaultStrategy: ControlStrategy = {
  matches: () => true,
  create: (field, value) => {
    const input = el('input').cls('plm-extension-grid-form-control').type('text').build() as HTMLInputElement
    input.value = String(value || '')
    applyMaxLength(input, field)
    return input
  }
}

/**
 * Ordered control strategy list used for control creation dispatch.
 */
export const controlStrategies: ControlStrategy[] = [
  booleanStrategy,
  radioStrategy,
  lookupStrategy,
  paragraphStrategy,
  numberStrategy,
  dateStrategy,
  emailStrategy,
  urlStrategy,
  defaultStrategy
]

/**
 * Creates a control using the first matching strategy.
 */
export function createControlFromStrategies(
  field: FormFieldDefinition,
  value: string,
  gridService: GridService
): HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | HTMLFieldSetElement {
  const strategy = controlStrategies.find((candidate) => candidate.matches(field)) || defaultStrategy
  return strategy.create(field, value, gridService)
}
