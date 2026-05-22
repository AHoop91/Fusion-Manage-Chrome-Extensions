import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { buildFeatureFlagDefine, loadFeatureFlags, resolveFeaturesFile } from './scripts/loadFeatureFlags.mjs'

const root = dirname(fileURLToPath(import.meta.url))

export default defineConfig(async () => {
  const featureFlagsPath = resolveFeaturesFile(root, process.argv)
  const featureFlags = await loadFeatureFlags(root, featureFlagsPath)
  const featureDefine = buildFeatureFlagDefine(featureFlags)

  return {
    base: './',
    plugins: [react()],
    define: featureDefine
  }
})
