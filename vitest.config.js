import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import { buildFeatureFlagDefine, loadFeatureFlags, resolveFeaturesFile } from './scripts/loadFeatureFlags.mjs'

const root = dirname(fileURLToPath(import.meta.url))

export default defineConfig(async () => {
  const featureFlagsPath = resolveFeaturesFile(root, process.argv)
  const featureFlags = await loadFeatureFlags(root, featureFlagsPath)
  const featureDefine = buildFeatureFlagDefine(featureFlags)

  return {
    define: featureDefine,
    test: {
      environment: 'node',
      globals: true,
      include: ['src/**/__tests__/**/*.test.ts', 'src/**/__tests__/**/*.test.tsx'],
      setupFiles: ['./vitest.setup.ts'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'html', 'json-summary'],
        exclude: [
          'dist/**',
          'node_modules/**',
          'src/**/__tests__/**',
          'src/features/shared/grid/grid-export/export.feature.ts',
          'src/features/shared/grid/grid-export/export.service.ts',
          'src/features/professional/bom/bom-clone/services/form/fieldTypes.ts',
          'src/features/professional/bom/bom-clone/services/form/filterKind.ts',
          'src/features/professional/bom/bom-clone/services/form/utils.ts',
          'src/test.d.ts',
          'vitest.config.js',
          'vitest.setup.ts'
        ]
      }
    }
  }
})
