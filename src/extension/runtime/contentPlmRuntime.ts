import { requestPlmAction } from '../background/actions'
import type { PlmExtPublicRuntime, PlmExtRuntime } from '../../shared/runtime/types'

/** Merges the public page runtime with the content-script-only PLM proxy. */
export function resolveContentPlmRuntime(publicRuntime?: PlmExtPublicRuntime | null): PlmExtRuntime | null {
  const base = publicRuntime ?? window.__plmExt
  if (!base) return null
  return {
    ...base,
    requestPlmAction
  }
}
