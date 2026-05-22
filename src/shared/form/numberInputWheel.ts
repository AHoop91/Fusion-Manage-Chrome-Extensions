const WHEEL_BOUND_ATTR = 'data-plm-number-wheel-bound'

function parseOptionalWheelStep(input: HTMLInputElement): number | null {
  const raw = input.dataset.plmWheelStep
  if (raw === undefined || raw === '') return null
  const n = parseFloat(raw)
  return Number.isFinite(n) && n > 0 ? n : null
}

function parseStepAttribute(input: HTMLInputElement): number {
  const s = input.getAttribute('step')
  if (!s || s.trim().toLowerCase() === 'any') return 1
  const n = parseFloat(s)
  return Number.isFinite(n) && n > 0 ? n : 1
}

function effectiveWheelStep(input: HTMLInputElement): number {
  return parseOptionalWheelStep(input) ?? parseStepAttribute(input)
}

function parseCurrentNumericValue(raw: string): number {
  const t = String(raw || '').trim()
  if (!t || t === '-' || t === '.' || t === '-.') return 0
  const n = Number(t)
  return Number.isFinite(n) ? n : 0
}

function clampToMinMax(input: HTMLInputElement, value: number): number {
  let next = value
  if (input.min !== '') {
    const min = parseFloat(input.min)
    if (Number.isFinite(min)) next = Math.max(min, next)
  }
  if (input.max !== '') {
    const max = parseFloat(input.max)
    if (Number.isFinite(max)) next = Math.min(max, next)
  }
  return next
}

function decimalPlacesForStep(step: number): number {
  if (!Number.isFinite(step) || step <= 0) return 0
  const s = step.toString()
  if (s.includes('e') || s.includes('E')) {
    const fixed = step.toFixed(20).replace(/\.?0+$/, '')
    const idx = fixed.indexOf('.')
    return idx >= 0 ? fixed.length - idx - 1 : 0
  }
  if (!s.includes('.')) return 0
  return s.split('.')[1].length
}

function snapAndFormat(next: number, step: number): string {
  const inv = 1 / step
  const snapped = Math.round(next * inv) / inv
  const decimals = decimalPlacesForStep(step)
  if (decimals > 0) return snapped.toFixed(decimals)
  return String(Math.round(snapped))
}

/**
 * Wheel events on `<input type="number">` often bubble and scroll the page or outer panels.
 * Capture wheel here so only the value steps (same direction as typical native spin).
 *
 * Optional `data-plm-wheel-step` overrides `step` when the attribute is `any` but metadata
 * defines a fractional increment (e.g. BOM / Fusion precision).
 */
export function attachNumberInputWheelCapture(input: HTMLInputElement): void {
  if (input.type !== 'number') return
  if (input.getAttribute(WHEEL_BOUND_ATTR) === 'true') return
  input.setAttribute(WHEEL_BOUND_ATTR, 'true')

  input.addEventListener(
    'wheel',
    (event: WheelEvent) => {
      if (input.disabled || input.readOnly) return
      event.preventDefault()
      event.stopPropagation()

      if (event.deltaY === 0) return

      const step = effectiveWheelStep(input)
      const direction = event.deltaY < 0 ? 1 : -1
      const current = parseCurrentNumericValue(input.value)
      let next = current + direction * step
      next = clampToMinMax(input, next)
      const formatted = snapAndFormat(next, step)

      if (formatted !== input.value) {
        input.value = formatted
        input.dispatchEvent(new Event('input', { bubbles: true }))
        input.dispatchEvent(new Event('change', { bubbles: true }))
      }
    },
    { passive: false }
  )
}
