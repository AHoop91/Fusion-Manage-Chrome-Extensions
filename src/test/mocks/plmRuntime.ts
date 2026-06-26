import { vi } from 'vitest'
import type { PlmExtRuntime } from '../../shared/runtime/types'

export function createMockPlmRuntime(
  responses: Record<string, unknown> = {}
): Pick<PlmExtRuntime, 'requestPlmAction'> {
  const requestPlmAction = async <T = unknown>(action: string): Promise<T> => {
    if (Object.prototype.hasOwnProperty.call(responses, action)) {
      return responses[action] as T
    }
    throw new Error(`Unexpected PLM action: ${action}`)
  }

  return {
    requestPlmAction: vi.fn(requestPlmAction) as PlmExtRuntime['requestPlmAction']
  }
}
