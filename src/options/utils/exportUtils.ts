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
