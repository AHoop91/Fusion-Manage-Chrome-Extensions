import { resolveContentPlmRuntime } from '../../extension/runtime/contentPlmRuntime'
import type { PlmExtRuntime } from './types'

export function getPlmRuntime(): PlmExtRuntime {
  const runtime = resolveContentPlmRuntime()
  if (!runtime) {
    throw new Error('PLM extension runtime is unavailable')
  }
  return runtime
}

export function getPlmRuntimeOptional(): PlmExtRuntime | null {
  return resolveContentPlmRuntime()
}
