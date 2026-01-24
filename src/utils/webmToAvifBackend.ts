export interface WebmToAvifBackendOptions {
  backendUrl: string
  signal?: AbortSignal
}

const normalizeBackendUrl = (backendUrl: string): string => {
  return backendUrl.trim()
}

const isJsonResponse = (contentType: string) =>
  contentType.includes('application/json') || contentType.includes('text/json')

const fetchAvifFromJsonResponse = async (response: Response): Promise<Blob> => {
  const payload = (await response.json()) as { url?: string; error?: string }
  if (payload?.url) {
    const fileResponse = await fetch(payload.url)
    if (!fileResponse.ok) {
      throw new Error(`Failed to fetch converted AVIF: ${fileResponse.status}`)
    }
    return await fileResponse.blob()
  }
  throw new Error(payload?.error || 'Backend returned JSON without url')
}

export const convertWebmToAvifViaBackend = async (
  webmBlob: Blob,
  options: WebmToAvifBackendOptions
): Promise<Blob> => {
  const backendUrl = normalizeBackendUrl(options.backendUrl)
  if (!backendUrl) throw new Error('WebM to AVIF backend URL is required')

  const response = await fetch(backendUrl, {
    method: 'POST',
    headers: {
      'Content-Type': webmBlob.type || 'video/webm'
    },
    body: webmBlob,
    signal: options.signal
  })

  if (!response.ok) {
    throw new Error(`WebM conversion failed: ${response.status} ${response.statusText}`)
  }

  const contentType = response.headers.get('content-type') || ''
  const resultBlob = isJsonResponse(contentType)
    ? await fetchAvifFromJsonResponse(response)
    : await response.blob()

  if (!resultBlob || resultBlob.size === 0) {
    throw new Error('WebM conversion returned empty result')
  }

  if (!resultBlob.type || resultBlob.type === 'application/octet-stream') {
    return new Blob([resultBlob], { type: 'image/avif' })
  }

  return resultBlob
}
