/**
 * Clipboard write with a fallback for insecure contexts and older Safari,
 * where navigator.clipboard is undefined or rejects.
 */
export async function copyText(value: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value)
      return
    } catch {
      // fall through to the legacy path
    }
  }

  if (!legacyCopy(value)) {
    throw new Error('Clipboard is unavailable in this browser context.')
  }
}

function legacyCopy(value: string): boolean {
  try {
    const area = document.createElement('textarea')
    area.value = value
    area.setAttribute('readonly', '')
    area.style.position = 'fixed'
    area.style.top = '-9999px'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    area.setSelectionRange(0, value.length)
    const ok = document.execCommand('copy')
    document.body.removeChild(area)
    return ok
  } catch {
    return false
  }
}
