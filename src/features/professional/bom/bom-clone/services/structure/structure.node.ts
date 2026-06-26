import type { BomCloneNode } from '../../clone.types'

export function isComponentNode(node: BomCloneNode): boolean {
  return !node.hasExpandableChildren && node.children.length === 0
}
