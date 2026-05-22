import { writeFileSync } from 'node:fs'
import { relative, resolve } from 'node:path'
import { isBomLazyBundleEnabled, isGridLazyBundleEnabled } from './lazyPageBundleGates.mjs'

/**
 * @param {Record<string, boolean>} featureFlags
 * @param {string} root
 * @param {string} featuresFilePath Absolute path to the resolved features module.
 */
export function logBuildPlan(featureFlags, root, featuresFilePath) {
  const rel = relative(root, featuresFilePath) || featuresFilePath
  const gridOn = isGridLazyBundleEnabled(featureFlags)
  const bomOn = isBomLazyBundleEnabled(featureFlags)

  const rows = [
    ['Popup, background, navigation', 'included'],
    ['content/item-pages/item-details.js', featureFlags.enableItemDetails ? 'included' : 'skipped'],
    ['content/item-pages/tableaus.js', featureFlags.enableTableaus ? 'included' : 'skipped'],
    ['content/item-pages/grid.js', gridOn ? 'included' : 'skipped'],
    ['content/item-pages/bom.js', bomOn ? 'included' : 'skipped'],
    ['content/item-pages/design-components.js', featureFlags.enableDesignComponents ? 'included' : 'skipped']
  ]

  const labelW = Math.max(...rows.map((r) => r[0].length))

  console.log('')
  console.log('Feature profile (this build)')
  console.log(`  File: ${rel}`)
  console.log('')
  for (const [label, state] of rows) {
    const mark = state === 'skipped' ? '-' : '+'
    console.log(`  [${mark}] ${label.padEnd(labelW)}  ${state}`)
  }

  if (!gridOn) {
    console.log('')
    console.log('  Grid bundle skipped (enableGridFilters, enableGridAdvancedEditor,')
    console.log('  enableGridExport, and enableGridImport are all false). See README: Feature configuration.')
  }
  console.log('')
}

/**
 * @param {string} outDir Absolute dist/
 * @param {Record<string, boolean>} featureFlags
 * @param {string} root
 * @param {string} featuresFilePath Absolute path to features module.
 */
export function writeDistBuildProfile(outDir, featureFlags, root, featuresFilePath) {
  const rel = relative(root, featuresFilePath) || featuresFilePath
  const gridOn = isGridLazyBundleEnabled(featureFlags)
  const bomOn = isBomLazyBundleEnabled(featureFlags)
  const when = new Date().toISOString()

  const lines = [
    'Fusion Manage Chromium Extensions — build profile',
    `Generated (UTC): ${when}`,
    `Features module: ${rel}`,
    '',
    'Lazy / optional page bundles:',
    `  item-details.js:        ${featureFlags.enableItemDetails ? 'included' : 'skipped'}`,
    `  tableaus.js:            ${featureFlags.enableTableaus ? 'included' : 'skipped'}`,
    `  grid.js:                ${gridOn ? 'included' : 'skipped'}`,
    `  bom.js:                 ${bomOn ? 'included' : 'skipped'}`,
    `  design-components.js:   ${featureFlags.enableDesignComponents ? 'included' : 'skipped'}`,
    '',
    'Granular flags (normalized from your features file):',
    ...Object.keys(featureFlags)
      .sort()
      .map((k) => `  ${k}: ${featureFlags[k]}`),
    '',
    'Reload the unpacked extension in chrome://extensions after replacing dist/.',
    ''
  ]

  writeFileSync(resolve(outDir, 'BUILD-PROFILE.txt'), lines.join('\n'), 'utf8')
}

export function logBuildSuccess(root, outDir) {
  const relDist = relative(root, outDir) || outDir
  console.log(`Done. Output: ${relDist}/`)
  console.log('  Next: chrome://extensions → Load unpacked → select the dist folder, or refresh the extension after a rebuild.')
  console.log('  Build profile summary: dist/BUILD-PROFILE.txt')
  console.log('')
}

/**
 * CLI help for `node scripts/build.mjs` (also: `npm run build -- --help`).
 */
export function printBuildHelp() {
  console.log(`
Fusion Manage Chromium Extensions — production build

Usage:
  npm run build
  npm run build -- --features=./path/to/features.js

Defaults:
  Features file   ./features.js (repo root) unless you pass --features=
  Output folder   ./dist/

Tips:
  The build prints which lazy bundles (grid, bom, etc.) are included or skipped.
  After a successful build, see dist/BUILD-PROFILE.txt for a plain-text summary you
  can ship with a zip to admins or testers.

Docs:
  README.md → Feature configuration
`)
}
