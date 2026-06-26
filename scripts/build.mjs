import { rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { build } from 'vite'
import { buildFeatureFlagDefine, loadFeatureFlags, resolveFeaturesFile } from './loadFeatureFlags.mjs'
import { isBomLazyBundleEnabled, isGridLazyBundleEnabled } from './lazyPageBundleGates.mjs'
import { patchDistManifest } from './patchDistManifest.mjs'
import { logBuildPlan, logBuildSuccess, printBuildHelp, writeDistBuildProfile } from './buildUserFeedback.mjs'

const root = process.cwd()
const outDir = resolve(root, 'dist')
const contentChunkDir = 'content/item-pages/chunks'

function createSharedModuleManualChunks(id) {
  const normalizedId = String(id || '').replace(/\\/g, '/')

  if (
    normalizedId.includes('/node_modules/react/') ||
    normalizedId.includes('/node_modules/react-dom/') ||
    normalizedId.includes('/node_modules/scheduler/')
  ) {
    return 'react-vendor'
  }

  if (normalizedId.includes('/src/extension/permissions/')) {
    return 'extension-permissions'
  }

  if (normalizedId.includes('/src/shared/dom/styles.ts')) {
    return 'dom-styles'
  }

  if (
    normalizedId.includes('/src/shared/form/') ||
    normalizedId.includes('/src/shared/ui/formPanel/formPanel.styles.ts') ||
    normalizedId.includes('/src/shared/utils/text.ts') ||
    normalizedId.includes('/src/shared/utils/html.ts') ||
    normalizedId.includes('/src/shared/url/parse.ts')
  ) {
    return 'form-shared'
  }

  // Clone and downloader import each other (shared tree types); one manual chunk avoids Rollup circular-chunk warnings.
  if (
    normalizedId.includes('/src/features/professional/bom/bom-clone/') ||
    normalizedId.includes('/src/features/professional/bom/bom-downloader/')
  ) {
    return 'bom-clone'
  }

  if (normalizedId.includes('/src/features/grid/grid-advanced-editor/')) {
    return 'grid-advanced-editor'
  }

  if (normalizedId.includes('/src/features/grid/')) {
    return 'grid-core'
  }

  return undefined
}

async function run() {
  if (process.argv.some((a) => a === '--help' || a === '-h')) {
    printBuildHelp()
    return
  }

  const featureFlagsPath = resolveFeaturesFile(root, process.argv)
  const featureFlags = await loadFeatureFlags(root, featureFlagsPath)
  logBuildPlan(featureFlags, root, featureFlagsPath)
  const featureDefine = buildFeatureFlagDefine(featureFlags)

  const baseConfig = {
    configFile: false,
    base: './',
    plugins: [react()],
    define: featureDefine
  }

  async function buildContentScript(input, entryFileName) {
    await build({
      ...baseConfig,
      build: {
        outDir,
        emptyOutDir: false,
        rollupOptions: {
          input: resolve(root, input),
          output: {
            // Manifest content scripts are classic scripts; keep bundle self-contained.
            format: 'iife',
            inlineDynamicImports: true,
            entryFileNames: entryFileName,
            assetFileNames: 'assets/[name]-[hash][extname]'
          }
        }
      }
    })
  }

  async function buildModuleScript(input, entryFileName) {
    await build({
      ...baseConfig,
      build: {
        outDir,
        emptyOutDir: false,
        lib: {
          entry: resolve(root, input),
          formats: ['es'],
          fileName: () => entryFileName
        },
        rollupOptions: {
          preserveEntrySignatures: 'strict',
          output: {
            chunkFileNames: `${contentChunkDir}/[name]-[hash].js`,
            assetFileNames: 'assets/[name]-[hash][extname]'
          }
        }
      }
    })
  }

  async function buildBackgroundScript(input, entryFileName) {
    await build({
      ...baseConfig,
      build: {
        outDir,
        emptyOutDir: false,
        lib: {
          entry: resolve(root, input),
          formats: ['es'],
          fileName: () => entryFileName
        },
        rollupOptions: {
          output: {
            inlineDynamicImports: true,
            assetFileNames: 'assets/[name]-[hash][extname]'
          }
        }
      }
    })
  }

  function getPopupAndItemPageRollupInput() {
    const input = {
      popup: resolve(root, 'popup.html')
    }
    if (isBomLazyBundleEnabled(featureFlags)) {
      input.bom = resolve(root, 'src/app/item-pages/bomPageModule.ts')
    }
    if (isGridLazyBundleEnabled(featureFlags)) {
      input.grid = resolve(root, 'src/app/item-pages/gridPageModule.ts')
    }
    if (featureFlags.enableDesignComponents) {
      input.designComponents = resolve(root, 'src/app/item-pages/designComponentsPageModule.ts')
    }
    return input
  }

  async function buildPopupAndLazyItemPageModules() {
    await build({
      ...baseConfig,
      build: {
        outDir,
        emptyOutDir: false,
        rollupOptions: {
          input: getPopupAndItemPageRollupInput(),
          preserveEntrySignatures: 'strict',
          output: {
            manualChunks: createSharedModuleManualChunks,
            entryFileNames: (chunkInfo) =>
              chunkInfo.name === 'bom'
                ? 'content/item-pages/bom.js'
                : chunkInfo.name === 'grid'
                  ? 'content/item-pages/grid.js'
                  : chunkInfo.name === 'designComponents'
                    ? 'content/item-pages/design-components.js'
                    : 'assets/[name]-[hash].js',
            chunkFileNames: `${contentChunkDir}/[name]-[hash].js`,
            assetFileNames: 'assets/[name]-[hash][extname]'
          }
        }
      }
    })
  }

  await rm(outDir, { recursive: true, force: true })
  await buildPopupAndLazyItemPageModules()
  await buildContentScript('src/app/navigationBridge.ts', 'content/navigation-bridge.js')
  await buildContentScript('src/app/sharedRuntimeBootstrap.ts', 'content/shared/index.js')
  await buildContentScript('src/app/itemPagesBootstrap.ts', 'content/item-pages/index.js')
  if (featureFlags.enableItemDetails) {
    await buildModuleScript('src/app/item-pages/itemDetailsPageModule.ts', 'content/item-pages/item-details.js')
  }
  if (featureFlags.enableTableaus) {
    await buildModuleScript('src/app/item-pages/tableausPageModule.ts', 'content/item-pages/tableaus.js')
  }
  await buildBackgroundScript('src/background/index.ts', 'background/index.js')
  patchDistManifest(outDir, featureFlags)
  writeDistBuildProfile(outDir, featureFlags, root, featureFlagsPath)
  logBuildSuccess(root, outDir)
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
