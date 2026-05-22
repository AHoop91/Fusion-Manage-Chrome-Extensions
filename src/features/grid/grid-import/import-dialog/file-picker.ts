/** Opens the native CSV file picker. Resolves null when the user cancels. */
export function promptForGridImportCsvFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.csv,text/csv'
    input.style.cssText = 'position:fixed;left:-9999px;top:-9999px;opacity:0;pointer-events:none;'
    let settled = false

    const finish = (file: File | null): void => {
      if (settled) return
      settled = true
      input.remove()
      window.removeEventListener('focus', onWindowFocus)
      resolve(file)
    }

    input.addEventListener('change', () => {
      finish(input.files?.[0] ?? null)
    })

    const onWindowFocus = (): void => {
      window.setTimeout(() => {
        if (!settled && !input.files?.length) finish(null)
      }, 500)
    }

    document.body.appendChild(input)
    input.click()
    window.addEventListener('focus', onWindowFocus, { once: true })
  })
}
