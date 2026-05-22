import type { DerivativeOutputType } from './components.types'

/**
 * APS GET `/modelderivative/v2/designdata/formats` returns a matrix: each **output** format name
 * maps to **source file extensions** that support translating to that output ([FormatsFormats](https://github.com/Autodesk-Forge/forge-api-nodejs-client/blob/master/docs/FormatsFormats.md)).
 * We intersect that matrix with the design’s extension to build the dropdown.
 */
const CATALOG_OUTPUT_KEY_TO_UI: Record<string, DerivativeOutputType | undefined> = {
  pdf:       'pdf',
  step:      'step',
  stp:       'step',
  stl:       'stl',
  iges:      'iges',
  obj:       'obj',
  dwg:       'dwg',
  thumbnail: 'thumbnail',
  fbx:       'fbx',
  svf:       'svf',
  svf2:      'svf2'
}

const FORMAT_DISPLAY_ORDER: DerivativeOutputType[] = [
  'dwg', 'fbx', 'iges', 'obj', 'pdf', 'step', 'stl', 'svf', 'svf2', 'thumbnail'
]

export function sortDerivativeOutputsForDisplay(types: DerivativeOutputType[]): DerivativeOutputType[] {
  return [...types].sort((a, b) => {
    const ia = FORMAT_DISPLAY_ORDER.indexOf(a)
    const ib = FORMAT_DISPLAY_ORDER.indexOf(b)
    const ra = ia === -1 ? 999 : ia
    const rb = ib === -1 ? 999 : ib
    return ra - rb
  })
}

export function normalizeExtensionToken(ext: string): string {
  return String(ext || '')
    .trim()
    .toLowerCase()
    .replace(/^\./, '')
}

export function extractFormatsMatrix(payload: unknown): Record<string, string[]> | null {
  if (!payload || typeof payload !== 'object') return null
  const root = payload as Record<string, unknown>

  let formatsUnknown: unknown = root.formats
  if (!formatsUnknown || typeof formatsUnknown !== 'object' || Array.isArray(formatsUnknown)) {
    const data = root.data as Record<string, unknown> | undefined
    if (data?.formats && typeof data.formats === 'object' && !Array.isArray(data.formats)) {
      formatsUnknown = data.formats
    }
  }

  if (!formatsUnknown || typeof formatsUnknown !== 'object' || Array.isArray(formatsUnknown)) {
    return null
  }

  const matrix: Record<string, string[]> = {}
  for (const [key, val] of Object.entries(formatsUnknown)) {
    if (!Array.isArray(val)) continue
    matrix[String(key).toLowerCase()] = val.map((entry) => String(entry))
  }
  return Object.keys(matrix).length > 0 ? matrix : null
}

/**
 * Extensions listed for each probe are tried when `sourceExtension` is unknown (Components workspace default).
 */
const EXTENSION_FALLBACK_ORDER = ['f3d'] as const

export function derivativeOutputsForSourceExtension(
  matrix: Record<string, string[]>,
  sourceExtension: string
): DerivativeOutputType[] {
  const normalized = normalizeExtensionToken(sourceExtension)
  const probes = normalized ? [normalized] : [...EXTENSION_FALLBACK_ORDER]

  const ordered: DerivativeOutputType[] = []
  const seen = new Set<DerivativeOutputType>()

  const catalogKeysOrdered = Object.keys(matrix).sort()

  for (const catalogKey of catalogKeysOrdered) {
    const ui = CATALOG_OUTPUT_KEY_TO_UI[catalogKey.toLowerCase()]
    if (!ui) continue
    const inputs = matrix[catalogKey]
    if (!inputs) continue
    const hit = probes.some((probe) =>
      inputs.some((raw) => normalizeExtensionToken(raw) === probe)
    )
    if (!hit) continue
    if (!seen.has(ui)) {
      seen.add(ui)
      ordered.push(ui)
    }
  }

  return sortDerivativeOutputsForDisplay(ordered)
}
