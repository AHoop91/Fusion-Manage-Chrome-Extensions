import type { BomCloneStateSnapshot } from '../clone.types'

export type CloneStructureModeFlow = {
  onSelectOperation: (nodeId: string) => void
  beforeStageSourceNode: (snapshot: BomCloneStateSnapshot, nodeId: string) => boolean
  onUnstageNode: (nodeId: string) => void
}



