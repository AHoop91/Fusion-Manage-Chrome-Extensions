import { defineConfig } from 'vitest/config'

export default defineConfig({
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
        'src/features/search/*.ts',
        'src/features/grid/export/export.feature.ts',
        'src/features/grid/export/export.service.ts',
        'src/features/bom/clone/services/form/fieldTypes.ts',
        'src/features/bom/clone/services/form/filterKind.ts',
        'src/features/bom/clone/services/form/utils.ts',
        'src/test.d.ts',
        'vitest.config.js',
        'vitest.setup.ts'
      ]
    }
  }
})
