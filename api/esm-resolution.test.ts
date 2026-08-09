import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { glob } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

const API_DIR = dirname(fileURLToPath(import.meta.url))

/**
 * package.json sets "type": "module", so Vercel runs these functions as native
 * ESM. Node's ESM resolver does **not** guess file extensions — an import of
 * './_lib/env' fails at runtime with ERR_MODULE_NOT_FOUND even though bundlers
 * and Vitest resolve it happily.
 *
 * That shipped once and took out OAuth login in production. Vitest's own
 * resolution cannot catch it, so this test replicates what Node does: every
 * relative specifier must carry an explicit extension and must point at a file
 * that actually exists.
 */
async function apiSourceFiles(): Promise<string[]> {
  const files: string[] = []
  for await (const entry of glob('**/*.ts', { cwd: API_DIR })) {
    if (!entry.endsWith('.test.ts')) files.push(entry)
  }
  return files.sort()
}

const RELATIVE_IMPORT = /(?:from|import)\s*\(?\s*['"](\.[^'"]*)['"]/g

describe('serverless ESM resolution', () => {
  it('finds source files to check', async () => {
    const files = await apiSourceFiles()
    expect(files.length).toBeGreaterThan(0)
  })

  it('every relative import carries an explicit extension and resolves', async () => {
    const failures: string[] = []

    for (const file of await apiSourceFiles()) {
      const absolute = resolve(API_DIR, file)
      const source = readFileSync(absolute, 'utf8')

      for (const match of source.matchAll(RELATIVE_IMPORT)) {
        const specifier = match[1]

        if (!specifier.endsWith('.js')) {
          failures.push(
            `${file}: "${specifier}" has no .js extension — Node ESM will not resolve it`,
          )
          continue
        }

        // Node loads the compiled .js; the source of truth on disk is the .ts.
        const target = resolve(dirname(absolute), specifier.replace(/\.js$/, '.ts'))
        if (!existsSync(target)) {
          failures.push(`${file}: "${specifier}" points at a file that does not exist`)
        }
      }
    }

    expect(failures).toEqual([])
  })

  it('does not import from src/, which is not bundled into the function', async () => {
    const offenders: string[] = []

    for (const file of await apiSourceFiles()) {
      const source = readFileSync(resolve(API_DIR, file), 'utf8')
      if (/from\s+['"][^'"]*\bsrc\//.test(source)) offenders.push(file)
    }

    expect(offenders).toEqual([])
  })
})
