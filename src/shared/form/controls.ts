type MaxLengthField = {
  fieldLength: number | null
}

export function applyMaxLength(
  control: HTMLInputElement | HTMLTextAreaElement,
  field: MaxLengthField
): void {
  if (typeof field.fieldLength === 'number' && field.fieldLength > 0) {
    control.maxLength = field.fieldLength
  }
}
