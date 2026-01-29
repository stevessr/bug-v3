/**
 * Proxy image requests through background service worker
 * to bypass CORP (Cross-Origin-Resource-Policy) restrictions
 */

export async function handleProxyImageRequest(
  opts: { url: string },
  sendResponse: (resp: any) => void
) {
  try {
    const response = await fetch(opts.url, {
      method: 'GET',
      mode: 'cors',
      credentials: 'omit',
      headers: {
        Accept: 'image/*,*/*'
      }
    })

    if (!response.ok) {
      sendResponse({
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`
      })
      return
    }

    const blob = await response.blob()
    const arrayBuffer = await blob.arrayBuffer()

    sendResponse({
      success: true,
      data: Array.from(new Uint8Array(arrayBuffer)),
      mimeType: blob.type,
      size: blob.size
    })
  } catch (error: any) {
    console.error('Proxy image request failed:', error)
    sendResponse({
      success: false,
      error: error?.message || 'Unknown error'
    })
  }
}
