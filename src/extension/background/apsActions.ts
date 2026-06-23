/** PLM background actions that call Autodesk Platform Services (require bearer token). */
export const APS_PLM_ACTIONS = new Set<string>([
  'downloadModelDerivativeAsset',
  'downloadModelDerivativeThumbnail',
  'fetchMfgGraphQL',
  'getModelDerivativeFormats',
  'getModelDerivativeManifest',
  'getModelDerivativeMetadata',
  'submitModelDerivativeJob'
])

export function isApsPlmAction(action: string): boolean {
  return APS_PLM_ACTIONS.has(action)
}
