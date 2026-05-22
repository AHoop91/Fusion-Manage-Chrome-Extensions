import type { ConversionJobManifest, DerivativeOutputType } from './components.types'

export type ManifestNode = Record<string, unknown> & {
  type?: string
  status?: string
  role?: string
  urn?: string
  derivatives?: unknown[]
  children?: unknown[]
}

/**
 * Maps viewer output types to manifest resource roles.
 * File exports (STEP, STL, etc.) use `outputType` on the derivative node instead — see FILE_EXPORT_TYPES.
 */
// Only formats NOT in FILE_EXPORT_TYPES reach this path (thumbnail, svf, svf2).
const FORMAT_TO_ROLES: Partial<Record<DerivativeOutputType, string[]>> = {
  thumbnail: ['thumbnail', 'graphics'],
  svf:       ['svf', 'graphics'],
  svf2:      ['svf2', 'graphics']
}

function toLower(value: unknown): string {
  return String(value ?? '').toLowerCase()
}

function isUsableResource(node: ManifestNode): boolean {
  return (
    toLower(node.type) === 'resource'
    && toLower(node.status) === 'success'
    && typeof node.urn === 'string'
    && node.urn.length > 0
  )
}

function findDerivativeResource(manifestJson: ConversionJobManifest | null | undefined, targetRole: string): ManifestNode | null {
  if (!manifestJson || typeof manifestJson !== 'object') return null
  const wanted = targetRole.trim().toLowerCase()

  function searchNode(node: unknown): ManifestNode | null {
    if (!node || typeof node !== 'object') return null
    const n = node as ManifestNode
    if (isUsableResource(n) && typeof n.role === 'string' && n.role.trim().toLowerCase() === wanted) {
      return n
    }
    for (const key of ['derivatives', 'children'] as const) {
      const arr = n[key]
      if (Array.isArray(arr)) {
        for (const child of arr) {
          const found = searchNode(child)
          if (found) return found
        }
      }
    }
    return null
  }

  return searchNode(manifestJson)
}

/**
 * APS file exports set `outputType` on the derivative node (not `role` on the resource).
 * Finds the first successful resource child of the matching derivative.
 */
function findDerivativeByOutputType(
  manifestJson: ConversionJobManifest | null | undefined,
  outputType: DerivativeOutputType
): ManifestNode | null {
  if (!manifestJson || typeof manifestJson !== 'object') return null
  const derivatives = (manifestJson as Record<string, unknown>).derivatives
  if (!Array.isArray(derivatives)) return null

  for (const deriv of derivatives) {
    if (!deriv || typeof deriv !== 'object') continue
    const d = deriv as ManifestNode
    if (toLower((d as Record<string, unknown>).outputType) !== outputType) continue
    if (toLower(d.status) !== 'success') continue
    const children = d.children
    if (!Array.isArray(children)) continue
    for (const child of children) {
      const c = child as ManifestNode
      if (isUsableResource(c)) return c
    }
  }
  return null
}

const FILE_EXPORT_TYPES = new Set<DerivativeOutputType>(['pdf', 'step', 'stl', 'iges', 'obj', 'dwg', 'fbx'])

export function findDerivativeForFormat(
  manifestJson: ConversionJobManifest | null | undefined,
  outputFormat: DerivativeOutputType
): ManifestNode | null {
  if (FILE_EXPORT_TYPES.has(outputFormat)) {
    return findDerivativeByOutputType(manifestJson, outputFormat)
  }
  const roles = FORMAT_TO_ROLES[outputFormat] || [outputFormat]
  for (const role of roles) {
    const d = findDerivativeResource(manifestJson, role)
    if (d) return d
  }
  return null
}

export function getManifestStatusLower(manifest: ConversionJobManifest | null | undefined): string {
  return String(manifest?.status ?? '').toLowerCase()
}

export function isManifestSuccess(manifest: ConversionJobManifest | null | undefined): boolean {
  return getManifestStatusLower(manifest) === 'success'
}

export function isManifestTerminal(manifest: ConversionJobManifest | null | undefined): boolean {
  const status = getManifestStatusLower(manifest)
  return status === 'success' || status === 'failed' || status === 'timeout'
}
