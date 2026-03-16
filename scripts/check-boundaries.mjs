import { readdir, readFile } from 'node:fs/promises'
import { extname, join, normalize, relative, resolve } from 'node:path'

const root = process.cwd()
const srcRoot = resolve(root, 'src')

const allowedChromePrefixes = ['platform', 'popup']
const codeExtensions = new Set(['.ts', '.tsx', '.js', '.jsx'])

function normalizePosixPath(value) {
  return value.replaceAll('\\', '/')
}

async function walkFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await walkFiles(fullPath)))
      continue
    }
    if (codeExtensions.has(extname(entry.name))) {
      files.push(fullPath)
    }
  }
  return files
}

function resolveImportPath(filePath, specifier) {
  if (specifier.startsWith('.')) {
    return normalize(resolve(filePath, '..', specifier))
  }
  if (specifier.startsWith('src/')) {
    return normalize(resolve(root, specifier))
  }
  return null
}

function toSrcRelative(filePath) {
  return normalizePosixPath(relative(srcRoot, filePath))
}

function hasAllowedChromePath(srcRelativePath) {
  return allowedChromePrefixes.some((prefix) => srcRelativePath.startsWith(`${prefix}/`))
}

function collectImports(content) {
  const imports = []
  const staticImportRe = /\bfrom\s+['"]([^'"]+)['"]/g
  const bareImportRe = /\bimport\s+['"]([^'"]+)['"]/g

  let match = staticImportRe.exec(content)
  while (match) {
    imports.push(match[1])
    match = staticImportRe.exec(content)
  }

  match = bareImportRe.exec(content)
  while (match) {
    imports.push(match[1])
    match = bareImportRe.exec(content)
  }

  return imports
}

async function main() {
  const files = await walkFiles(srcRoot)
  const violations = []

  for (const filePath of files) {
    const srcRelativePath = toSrcRelative(filePath)
    const content = await readFile(filePath, 'utf8')

    if (/\bchrome\./.test(content) && !hasAllowedChromePath(srcRelativePath)) {
      violations.push({
        file: srcRelativePath,
        rule: 'chrome-outside-platform',
        detail: 'Direct chrome.* usage is only allowed under src/platform or src/popup.'
      })
    }

    const imports = collectImports(content)
    for (const specifier of imports) {
      const resolved = resolveImportPath(filePath, specifier)
      if (!resolved) continue
      if (!resolved.startsWith(srcRoot)) continue

      const targetRelativePath = toSrcRelative(resolved)

      if (srcRelativePath.startsWith('core/') && targetRelativePath.startsWith('features/')) {
        violations.push({
          file: srcRelativePath,
          rule: 'core-to-features',
          detail: `core must not depend on features (${specifier}).`
        })
      }

      if (srcRelativePath.startsWith('features/') && targetRelativePath.startsWith('popup/')) {
        violations.push({
          file: srcRelativePath,
          rule: 'features-to-popup',
          detail: `features must not depend on popup (${specifier}).`
        })
      }
    }
  }

  if (violations.length === 0) {
    console.log('Boundary checks passed.')
    return
  }

  console.error('Boundary check violations found:')
  for (const violation of violations) {
    console.error(`- [${violation.rule}] ${violation.file}: ${violation.detail}`)
  }
  process.exitCode = 1
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})

