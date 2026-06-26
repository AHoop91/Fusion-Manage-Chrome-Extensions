import type { PlmExtRuntime } from './types'

export function getPlmRuntime(): PlmExtRuntime {
  const runtime = window.__plmExt
  if (!runtime?.requestPlmAction) {
    throw new Error('PLM extension runtime is unavailable')
  }
  return runtime
}

export function getPlmRuntimeOptional(): PlmExtRuntime | null {
  const runtime = window.__plmExt
  if (!runtime?.requestPlmAction) return null
  return runtime
}
