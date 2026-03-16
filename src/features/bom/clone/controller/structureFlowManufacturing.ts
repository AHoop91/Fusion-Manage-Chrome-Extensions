import { isManufacturingProcessNodeId } from '../services/structure/structure.service'
import type { CloneState } from './types'
import type { CloneStructureModeFlow } from './structureMode'

type ManufacturingStructureModeFlowOptions = {
  state: CloneState
  render: () => void
}

export function createManufacturingStructureModeFlow(
  options: ManufacturingStructureModeFlowOptions
): CloneStructureModeFlow {
  const { state, render } = options

  return {
    onSelectOperation(nodeId: string) {
      state.setManufacturingSelectedOperationNodeId(nodeId)
      render()
    },
    beforeStageSourceNode(snapshot, nodeId) {
      const selectedOperationId = snapshot.manufacturingSelectedOperationNodeId || null
      const operationId = isManufacturingProcessNodeId(snapshot, selectedOperationId)
        ? selectedOperationId
        : null
      if (selectedOperationId && !operationId) state.setManufacturingSelectedOperationNodeId(null)
      state.setManufacturingSourceOperation(nodeId, operationId)
      return true
    },
    onUnstageNode(nodeId: string) {
      state.setManufacturingSourceOperation(nodeId, null)
    }
  }
}


