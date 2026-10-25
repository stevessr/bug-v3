export const CLOUDFLARE_WALL_BRIDGE_SOURCE = 'emoji-extension-cloudflare-wall-main'

export function publishCloudflareWallEnabled(enabled: boolean): void {
  if (window.location.hostname !== 'linux.do') return

  window.postMessage(
    {
      source: CLOUDFLARE_WALL_BRIDGE_SOURCE,
      type: 'settings-updated',
      enabled
    },
    window.location.origin
  )
}
