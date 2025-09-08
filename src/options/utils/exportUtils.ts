/* eslint-disable @typescript-eslint/no-explicit-any */
export function downloadJson(filename: string, payload: any) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function exportConfigurationFile(store: any) {
  const config = {
    version: '1.0',
    exportDate: new Date().toISOString(),
    settings: store.settings,
    groups: store.groups
  }
  const filename = `emoji-config-${new Date().toISOString().split('T')[0]}.json`
  downloadJson(filename, config)
}

export function exportGroupFile(group: any) {
  const emojis = (group.emojis || []).map((e: any) => ({
    id: e.id,
    packet: e.packet,
    name: e.name,
    url: e.url,
    width: e.width,
    height: e.height,
    groupId: group.name || group.id
  }))
  const filename = `emoji-group-${group.id}-${group.name || 'group'}.json`
  downloadJson(filename, emojis)
}

// Zip and download all emoji images in a group
export async function exportGroupZip(group: any) {
  // Lazy import JSZip to avoid bundling issues in environments without the package
  let JSZip: any
  try {
    // @ts-ignore - dynamic import of optional dependency
    JSZip = (await import('jszip')).default
  } catch (e) {
    // Fallback: try global require (unlikely in browser)
    // If JSZip is not available, fallback to exporting JSON only
    downloadJson(`emoji-group-${group.id}-${group.name || 'group'}.json`, group.emojis || [])
    return
  }

  const zip = new JSZip()
  const folder = zip.folder(group.name || group.id || 'emojis')

  const emojis = group.emojis || []

  // Helper to fetch and normalize data
  const fetchAsBlob = async (url: string) => {
    if (!url) return null
    // Data URL
    if (url.startsWith('data:')) {
      // Convert data URL to blob
      const res = await fetch(url)
      return res.blob()
    }
    try {
      const res = await fetch(url, { mode: 'cors' })
      if (!res.ok) return null
      return await res.blob()
    } catch (e) {
      return null
    }
  }

  const tasks = emojis.map(async (e: any, idx: number) => {
    const url = e.url || e.src || e.icon
    const name = (e.name || `emoji-${idx}`).replace(/[^a-zA-Z0-9-_.]/g, '_')
    const extMatch = (url || '').match(/\.([a-zA-Z0-9]{1,5})(?:\?|$)/)
    const ext = extMatch ? extMatch[1] : 'png'
    const blob = await fetchAsBlob(url)
    if (blob && folder) {
      folder.file(`${name}.${ext}`, blob)
    }
  })

  await Promise.all(tasks)

  try {
    const content = await zip.generateAsync({ type: 'blob' })
    const url = URL.createObjectURL(content)
    const a = document.createElement('a')
    a.href = url
    a.download = `emoji-group-${group.id}-${group.name || 'group'}.zip`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  } catch (e) {
    // If zip generation fails, fallback to JSON export
    downloadJson(`emoji-group-${group.id}-${group.name || 'group'}.json`, group.emojis || [])
  }
}
