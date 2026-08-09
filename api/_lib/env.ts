import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

let cachedFileEnv: Record<string, string> | null = null

function loadFileEnv(): Record<string, string> {
  if (cachedFileEnv) return cachedFileEnv

  cachedFileEnv = {}
  const envPath = join(process.cwd(), '.env.local')

  if (!existsSync(envPath)) return cachedFileEnv

  try {
    for (const rawLine of readFileSync(envPath, 'utf8').split('\n')) {
      const line = rawLine.trim()
      if (!line || line.startsWith('#')) continue

      const separator = line.indexOf('=')
      if (separator < 1) continue

      const key = line.slice(0, separator).trim()
      let value = line.slice(separator + 1).trim()

      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }

      cachedFileEnv[key] = value
    }
  } catch {
    // A malformed .env.local must not take the endpoint down.
  }

  return cachedFileEnv
}

export function readEnvValue(name: string): string | undefined {
  return process.env[name] || loadFileEnv()[name] || undefined
}
