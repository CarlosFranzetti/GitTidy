/**
 * localStorage access that never throws.
 *
 * Safari private mode, locked-down webviews, and quota exhaustion all make
 * localStorage throw on read or write. An uncaught throw inside a React state
 * initializer or effect takes the whole app down, so every access goes here.
 */

function storage(): Storage | null {
  try {
    if (typeof window === 'undefined') return null
    return window.localStorage
  } catch {
    return null
  }
}

export function readStored(key: string): string | null {
  try {
    return storage()?.getItem(key) ?? null
  } catch {
    return null
  }
}

export function writeStored(key: string, value: string): boolean {
  try {
    storage()?.setItem(key, value)
    return true
  } catch {
    return false
  }
}

export function removeStored(key: string): boolean {
  try {
    storage()?.removeItem(key)
    return true
  } catch {
    return false
  }
}
