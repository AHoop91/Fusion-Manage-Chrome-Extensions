import { readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { transform } from 'esbuild'
import react from '@vitejs/plugin-react'
import { build } from 'vite'

const root = process.cwd()
const outDir = resolve(root, 'dist')

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
          chunkFileNames: 'assets/[name]-[hash].js',
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

  if (normalizedId.includes('/src/features/bom/clone/')) {
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

async function buildPopupBomAndGridModules() {
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
          chunkFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash][extname]'
        }
      }
    }
  })
}

async function minifyBuiltBackgroundScripts() {
  const backgroundDir = resolve(outDir, 'background')
  const entries = await readdir(backgroundDir, { withFileTypes: true })

  await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.js'))
      .map(async (entry) => {
        const filePath = resolve(backgroundDir, entry.name)
        const source = await readFile(filePath, 'utf8')
        const result = await transform(source, {
          loader: 'js',
          format: 'esm',
          minify: true,
          legalComments: 'none',
          target: 'es2020'
        })

        await writeFile(filePath, result.code, 'utf8')
      })
  )
}

async function run() {
  await rm(outDir, { recursive: true, force: true })
  await buildPopupBomAndGridModules()
  await buildContentScript('src/app/sharedRuntimeBootstrap.ts', 'content/shared/index.js')
  await buildContentScript('src/app/itemPagesBootstrap.ts', 'content/item-pages/index.js')
  await buildModuleScript('src/app/item-pages/itemDetailsPageModule.ts', 'content/item-pages/item-details.js')
  await buildContentScript('src/app/securityUsersBootstrap.ts', 'content/security/users-filter.js')
  await minifyBuiltBackgroundScripts()
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
