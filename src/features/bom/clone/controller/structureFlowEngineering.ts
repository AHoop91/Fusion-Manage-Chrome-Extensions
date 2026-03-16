import type { BomCloneStateSnapshot } from '../clone.types'
import type { CloneStructureModeFlow } from './structureMode'

export function createEngineeringStructureModeFlow(): CloneStructureModeFlow {
  return {
    onSelectOperation() {
      // Engineering mode has no operation selection workflow.
    },
    beforeStageSourceNode(_snapshot: BomCloneStateSnapshot, _nodeId: string): boolean {
      return true
    },
    onUnstageNode(_nodeId: string) {
      // Engineering mode has no operation assignment mapping.
    }
  }
}



