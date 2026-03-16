import type { BomCloneContext } from '../../clone.types'
import { uniquePositiveIntegers } from './viewDefIds'

export type ViewDefResolution = {
  combinedViewDefIds: number[]
  sourceViewDefIds: number[]
  targetViewDefIds: number[]
  sourceContext: BomCloneContext
  targetContext: BomCloneContext
  sourceResolvedViewDefId: number | null
  targetResolvedViewDefId: number | null
}

export function resolveViewDefResolution(
  activeContext: BomCloneContext,
  fieldViewDefIds: number[],
  workspaceViewDefIds: number[]
): ViewDefResolution {
  const combinedViewDefIds = uniquePositiveIntegers([
    ...fieldViewDefIds,
    ...workspaceViewDefIds,
    activeContext.viewDefId
  ])

  const sourceViewDefIds = [...combinedViewDefIds]
  const targetViewDefIds = [...combinedViewDefIds]
  const sourceResolvedViewDefId = sourceViewDefIds[0] ?? activeContext.viewDefId
  const targetResolvedViewDefId = targetViewDefIds[0] ?? activeContext.viewDefId
  const sourceContext: BomCloneContext = sourceResolvedViewDefId !== null
    ? { ...activeContext, viewDefId: sourceResolvedViewDefId }
    : activeContext
  const targetContext: BomCloneContext = targetResolvedViewDefId !== null
    ? { ...activeContext, viewDefId: targetResolvedViewDefId }
    : activeContext

  return {
    combinedViewDefIds,
    sourceViewDefIds,
    targetViewDefIds,
    sourceContext,
    targetContext,
    sourceResolvedViewDefId,
    targetResolvedViewDefId
  }
}


