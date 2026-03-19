import { rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { build } from 'vite'

const root = process.cwd()
const outDir = resolve(root, 'dist')
const contentChunkDir = 'content/item-pages/chunks'

const baseConfig = {
  configFile: false,
  base: './',
  plugins: [react()]
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

function createSharedModuleManualChunks(id) {
  const normalizedId = String(id || '').replace(/\\/g, '/')

  if (
    normalizedId.includes('/node_modules/react/') ||
    normalizedId.includes('/node_modules/react-dom/') ||
    normalizedId.includes('/node_modules/scheduler/')
  ) {
    return 'react-vendor'
  }

  if (normalizedId.includes('/src/platform/permissions/')) {
    return 'platform-permissions'
  }

  if (normalizedId.includes('/src/dom/styles.ts')) {
    return 'dom-styles'
  }

  if (
    normalizedId.includes('/src/shared/form/') ||
    normalizedId.includes('/src/ui/formPanel/formPanel.styles.ts') ||
    normalizedId.includes('/src/shared/utils/text.ts') ||
    normalizedId.includes('/src/shared/utils/html.ts') ||
    normalizedId.includes('/src/shared/url/parse.ts')
  ) {
    return 'form-shared'
  }

  if (
    normalizedId.includes('/src/features/bom/clone/') ||
    normalizedId.includes('/src/features/bom/downloader/')
  ) {
    return 'bom-clone'
  }

  if (normalizedId.includes('/src/features/grid/advanced-view/')) {
    return 'grid-advanced-view'
  }

  if (normalizedId.includes('/src/features/grid/')) {
    return 'grid-core'
  }

  return undefined
}

async function buildPopupAndLazyItemPageModules() {
  await build({
    ...baseConfig,
    build: {
      outDir,
      emptyOutDir: false,
      rollupOptions: {
        input: {
          popup: resolve(root, 'popup.html'),
          bom: resolve(root, 'src/app/item-pages/bomPageModule.ts'),
          grid: resolve(root, 'src/app/item-pages/gridPageModule.ts')
        },
        preserveEntrySignatures: 'strict',
        output: {
          manualChunks: createSharedModuleManualChunks,
          entryFileNames: (chunkInfo) => (
            chunkInfo.name === 'bom'
              ? 'content/item-pages/bom.js'
              : chunkInfo.name === 'grid'
                ? 'content/item-pages/grid.js'
                : 'assets/[name]-[hash].js'
          ),
          chunkFileNames: `${contentChunkDir}/[name]-[hash].js`,
          assetFileNames: 'assets/[name]-[hash][extname]'
        }
      }
    }
  })
}

async function run() {
  await rm(outDir, { recursive: true, force: true })
  await buildPopupAndLazyItemPageModules()
  await buildContentScript('src/app/sharedRuntimeBootstrap.ts', 'content/shared/index.js')
  await buildContentScript('src/app/itemPagesBootstrap.ts', 'content/item-pages/index.js')
  await buildModuleScript('src/app/item-pages/itemDetailsPageModule.ts', 'content/item-pages/item-details.js')
  await buildContentScript('src/app/securityUsersBootstrap.ts', 'content/security/users-filter.js')
  await buildBackgroundScript('src/background/index.ts', 'background/index.js')
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
