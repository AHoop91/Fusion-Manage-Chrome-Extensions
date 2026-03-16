import type { FormFieldDefinition } from '../../../services/form/types'
import {
  buildQtyInputViewModel,
  computeRequiredFieldCompletion
} from '../../../services/viewModel.service'

export function syncCloneFormRequiredIndicator(options: {
  modalRoot: HTMLDivElement
  nodeId: string
  requiredFields: FormFieldDefinition[]
  values: Record<string, string>
  applyRequiredIndicator: (
    indicator: HTMLSpanElement,
    completion: ReturnType<typeof computeRequiredFieldCompletion>
  ) => void
}): void {
  const indicator = options.modalRoot.querySelector(
    `[data-plm-required-indicator-node-id="${options.nodeId}"]`
  ) as HTMLSpanElement | null
  if (!indicator) return
  options.applyRequiredIndicator(
    indicator,
    computeRequiredFieldCompletion(options.requiredFields, options.values)
  )
}

export function syncCloneFormQtyInput(options: {
  modalRoot: HTMLDivElement
  nodeId: string
  values: Record<string, string>
  quantityFieldId: string | null
  fallbackQuantity: string
}): void {
  const qtyInputModel = buildQtyInputViewModel(
    options.values,
    options.quantityFieldId,
    options.fallbackQuantity
  )
  if (!qtyInputModel) return
  const qtyInput = options.modalRoot.querySelector(
    `[data-plm-focus-key="target-qty-${options.nodeId}"]`
  ) as HTMLInputElement | null
  if (!qtyInput) return
  qtyInput.value = qtyInputModel.nextQuantity
  qtyInput.classList.toggle('is-qty-modified', qtyInputModel.isModified)
}
