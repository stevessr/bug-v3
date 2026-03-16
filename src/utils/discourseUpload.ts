export interface DiscourseUploadResponse {
  id: number
  url: string
  original_filename: string
  filesize: number
  width: number
  height: number
  thumbnail_width: number
  thumbnail_height: number
  extension: string
  short_url: string
  short_path: string
  retain_hours: null
  human_filesize: string
  dominant_color: string
  thumbnail: null
}

export interface DiscourseUploadErrorDetails {
  errors?: string[]
  error?: string
  message?: string
  error_type?: string
  extras?: {
    wait_seconds?: number
    time_left?: string
  }
}

export type DiscourseUploadFailure = Error &
  DiscourseUploadErrorDetails & {
    status?: number
    details?: DiscourseUploadErrorDetails | { message: string }
    isRateLimitError?: boolean
    waitTime?: number
    shouldTerminateUploadFlow?: boolean
  }

type UploadResponseBody = Record<string, unknown>

interface LinuxDoMultipartCreateResponse {
  external_upload_identifier: string
  key: string
  unique_identifier: string
}

interface LinuxDoMultipartPresignResponse {
  presigned_urls: Record<string, string>
}

interface LinuxDoMultipartPart {
  part_number: number
  etag: string
}

interface UploadLinuxDoMultipartOptions {
  baseUrl: string
  file: Blob
  fileName: string
  mimeType?: string
  csrfToken?: string
  headers?: Record<string, string>
  credentials?: RequestCredentials
  fetchImpl?: typeof fetch
  sha1?: string | null
  pasted?: boolean
}

const LINUX_DO_MULTIPART_CHUNK_SIZE = 15 * 1024 * 1024

function extractCsrfFromCookie(cookie: string): string {
  if (!cookie) return ''
  const match = cookie.match(/(?:^|;\s*)(csrf_token|XSRF-TOKEN|_csrf)=([^;]+)/i)
  if (!match) return ''
  try {
    return decodeURIComponent(match[2])
  } catch {
    return match[2]
  }
}

function normalizeCsrfToken(token: string): string {
  if (!token) return ''
  const trimmed = token.trim()
  if (!trimmed) return ''
  return trimmed.split(',')[0]?.trim() || ''
}

function resolveCsrfToken(options: UploadLinuxDoMultipartOptions): string {
  if (options.csrfToken) return normalizeCsrfToken(options.csrfToken)

  const headers = options.headers || {}
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === 'x-csrf-token' && value) {
      return normalizeCsrfToken(value)
    }
  }

  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === 'cookie' && value) {
      const token = extractCsrfFromCookie(value)
      if (token) return normalizeCsrfToken(token)
    }
  }

  if (typeof document !== 'undefined') {
    const metaToken = document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement | null
    if (metaToken?.content) return normalizeCsrfToken(metaToken.content)

    const tokenFromCookie = extractCsrfFromCookie(document.cookie || '')
    if (tokenFromCookie) return normalizeCsrfToken(tokenFromCookie)

    const hiddenInput = document.querySelector(
      'input[name="authenticity_token"]'
    ) as HTMLInputElement | null
    if (hiddenInput?.value) return normalizeCsrfToken(hiddenInput.value)
  }

  return ''
}

function getUrlBase(): string {
  if (typeof globalThis.location?.href === 'string' && globalThis.location.href) {
    return globalThis.location.href
  }
  return 'https://linux.do/'
}

function createUploadError(
  status: number,
  details: unknown,
  fallbackMessage: string
): DiscourseUploadFailure {
  const detailObject =
    details && typeof details === 'object' ? (details as UploadResponseBody) : null
  const errors = Array.isArray(detailObject?.errors)
    ? detailObject.errors.filter((item): item is string => typeof item === 'string')
    : []
  const detailError = typeof detailObject?.error === 'string' ? detailObject.error : ''
  const detailMessage = typeof detailObject?.message === 'string' ? detailObject.message : ''

  const message =
    errors.length > 0
      ? errors.join(', ')
      : detailError
        ? detailError
        : detailMessage
          ? detailMessage
          : fallbackMessage

  const error = new Error(message) as DiscourseUploadFailure
  error.status = status
  error.details = (detailObject as DiscourseUploadFailure['details']) || {
    message: fallbackMessage
  }

  if (typeof detailObject?.error_type === 'string') {
    error.error_type = detailObject.error_type
  }

  if (detailObject?.extras && typeof detailObject.extras === 'object') {
    error.extras = detailObject.extras as DiscourseUploadErrorDetails['extras']
  }

  if (status === 429 && error.extras?.wait_seconds) {
    error.isRateLimitError = true
    error.waitTime = error.extras.wait_seconds * 1000
  } else if (status === 429) {
    error.shouldTerminateUploadFlow = true
  }

  return error
}

async function parseUploadResponseBody(
  response: Response
): Promise<UploadResponseBody | { message: string } | null> {
  try {
    const text = await response.text()
    if (!text) return null

    try {
      return JSON.parse(text) as UploadResponseBody
    } catch {
      return { message: text }
    }
  } catch {
    return null
  }
}

function buildAjaxHeaders(
  csrfToken?: string,
  headers?: Record<string, string>,
  contentType?: string
): Record<string, string> {
  const result: Record<string, string> = {}
  const setHeader = (name: string, value: string | undefined) => {
    if (!value) return

    const lowerName = name.toLowerCase()
    for (const existingName of Object.keys(result)) {
      if (existingName.toLowerCase() === lowerName) {
        delete result[existingName]
      }
    }

    result[name] = value
  }

  setHeader('accept', '*/*')
  setHeader('x-requested-with', 'XMLHttpRequest')
  setHeader('discourse-logged-in', 'true')
  setHeader('discourse-present', 'true')

  for (const [key, value] of Object.entries(headers || {})) {
    const normalizedValue = key.toLowerCase() === 'x-csrf-token' ? normalizeCsrfToken(value) : value
    setHeader(key, normalizedValue)
  }

  const normalizedCsrfToken = normalizeCsrfToken(csrfToken || '')
  if (normalizedCsrfToken) {
    setHeader('x-csrf-token', normalizedCsrfToken)
  }

  if (contentType) {
    setHeader('content-type', contentType)
  }

  return result
}

function resolveDiscourseBase(baseUrl: string): string {
  try {
    return new URL(baseUrl, getUrlBase()).origin
  } catch {
    return baseUrl.replace(/\/$/, '')
  }
}

export function isLinuxDoDiscourseBase(baseUrl: string): boolean {
  try {
    return new URL(baseUrl, getUrlBase()).hostname === 'linux.do'
  } catch {
    return baseUrl.includes('linux.do')
  }
}

export function normalizeDiscourseUploadUrl(
  baseUrl: string | undefined,
  response:
    | {
        url?: string | null
        short_url?: string | null
      }
    | null
    | undefined
): string {
  const base = baseUrl ? resolveDiscourseBase(baseUrl) : ''
  const candidates = [response?.url, response?.short_url]

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'string') continue
    const raw = candidate.trim()
    if (!raw) continue

    if (raw.startsWith('http://') || raw.startsWith('https://')) {
      return raw
    }

    if (raw.startsWith('//')) {
      return `https:${raw}`
    }

    if (raw.startsWith('/') && base) {
      try {
        return new URL(raw, base).toString()
      } catch {
        return `${base}${raw}`
      }
    }

    if (!raw.startsWith('upload://')) {
      return raw
    }
  }

  return ''
}

export async function computeSHA1Hex(
  input: Blob | ArrayBuffer | Uint8Array
): Promise<string | null> {
  if (typeof crypto === 'undefined' || !crypto.subtle) return null

  try {
    const source =
      input instanceof Blob
        ? new Uint8Array(await input.arrayBuffer())
        : input instanceof Uint8Array
          ? input
          : new Uint8Array(input)
    const data = new Uint8Array(source.byteLength)
    data.set(source)
    const hash = await crypto.subtle.digest('SHA-1', data)
    const hashArray = Array.from(new Uint8Array(hash))
    return hashArray.map(byte => byte.toString(16).padStart(2, '0')).join('')
  } catch {
    return null
  }
}

async function abortLinuxDoMultipartUpload(
  baseUrl: string,
  externalUploadIdentifier: string,
  csrfToken?: string,
  headers?: Record<string, string>,
  credentials: RequestCredentials = 'include',
  fetchImpl: typeof fetch = fetch
) {
  const response = await fetchImpl(
    `${resolveDiscourseBase(baseUrl)}/uploads/abort-multipart.json`,
    {
      method: 'POST',
      headers: buildAjaxHeaders(csrfToken, headers, 'application/json'),
      body: JSON.stringify({
        external_upload_identifier: externalUploadIdentifier
      }),
      credentials
    }
  )

  if (!response.ok) {
    const details = await parseUploadResponseBody(response)
    throw createUploadError(response.status, details, 'Abort multipart upload failed')
  }
}

export async function uploadLinuxDoMultipart(
  options: UploadLinuxDoMultipartOptions
): Promise<DiscourseUploadResponse> {
  const fetchImpl = options.fetchImpl || fetch
  const credentials = options.credentials || 'include'
  const baseUrl = resolveDiscourseBase(options.baseUrl)
  const sha1 = options.sha1 === undefined ? await computeSHA1Hex(options.file) : options.sha1
  const resolvedCsrfToken = resolveCsrfToken(options)

  let externalUploadIdentifier = ''
  let completed = false

  try {
    const createBody = new URLSearchParams()
    createBody.append('file_name', options.fileName)
    createBody.append('file_size', String(options.file.size))
    createBody.append('upload_type', 'composer')
    if (sha1) {
      createBody.append('metadata[sha1-checksum]', sha1)
    }

    const createResponse = await fetchImpl(`${baseUrl}/uploads/create-multipart.json`, {
      method: 'POST',
      headers: buildAjaxHeaders(
        resolvedCsrfToken,
        options.headers,
        'application/x-www-form-urlencoded; charset=UTF-8'
      ),
      body: createBody.toString(),
      credentials
    })
    const createData = (await parseUploadResponseBody(
      createResponse
    )) as LinuxDoMultipartCreateResponse | null

    if (!createResponse.ok) {
      throw createUploadError(createResponse.status, createData, 'Create multipart upload failed')
    }

    if (!createData?.external_upload_identifier || !createData.unique_identifier) {
      throw createUploadError(
        createResponse.status,
        createData,
        'Create multipart upload returned incomplete data'
      )
    }

    externalUploadIdentifier = createData.external_upload_identifier

    const partCount = Math.max(1, Math.ceil(options.file.size / LINUX_DO_MULTIPART_CHUNK_SIZE))
    const presignBody = new URLSearchParams()
    presignBody.append('unique_identifier', createData.unique_identifier)
    for (let partNumber = 1; partNumber <= partCount; partNumber++) {
      presignBody.append('part_numbers[]', String(partNumber))
    }

    const presignResponse = await fetchImpl(
      `${baseUrl}/uploads/batch-presign-multipart-parts.json`,
      {
        method: 'POST',
        headers: buildAjaxHeaders(
          resolvedCsrfToken,
          options.headers,
          'application/x-www-form-urlencoded; charset=UTF-8'
        ),
        body: presignBody.toString(),
        credentials
      }
    )
    const presignData = (await parseUploadResponseBody(
      presignResponse
    )) as LinuxDoMultipartPresignResponse | null

    if (!presignResponse.ok) {
      throw createUploadError(presignResponse.status, presignData, 'Presign multipart parts failed')
    }

    const parts: LinuxDoMultipartPart[] = []

    for (let partNumber = 1; partNumber <= partCount; partNumber++) {
      const presignedUrl = presignData?.presigned_urls?.[String(partNumber)]
      if (!presignedUrl) {
        throw new Error(`Missing presigned URL for part ${partNumber}`)
      }

      const start = (partNumber - 1) * LINUX_DO_MULTIPART_CHUNK_SIZE
      const end = Math.min(start + LINUX_DO_MULTIPART_CHUNK_SIZE, options.file.size)
      const chunk = options.file.slice(start, end, options.mimeType)

      const uploadResponse = await fetchImpl(presignedUrl, {
        method: 'PUT',
        body: chunk
      })

      if (!uploadResponse.ok) {
        const details = await parseUploadResponseBody(uploadResponse)
        throw createUploadError(uploadResponse.status, details, `Upload part ${partNumber} failed`)
      }

      const etag = uploadResponse.headers.get('etag') || uploadResponse.headers.get('ETag')
      if (!etag) {
        throw new Error(`Missing ETag for part ${partNumber}`)
      }

      parts.push({
        part_number: partNumber,
        etag
      })
    }

    const completeResponse = await fetchImpl(`${baseUrl}/uploads/complete-multipart.json`, {
      method: 'POST',
      headers: buildAjaxHeaders(resolvedCsrfToken, options.headers, 'application/json'),
      body: JSON.stringify({
        parts,
        unique_identifier: createData.unique_identifier,
        pasted: options.pasted ?? options.mimeType?.startsWith('image/') ?? true
      }),
      credentials
    })
    const completeData = (await parseUploadResponseBody(
      completeResponse
    )) as DiscourseUploadResponse | null

    if (!completeResponse.ok) {
      throw createUploadError(
        completeResponse.status,
        completeData,
        'Complete multipart upload failed'
      )
    }

    if (!completeData?.url) {
      throw createUploadError(
        completeResponse.status,
        completeData,
        'Complete multipart upload returned no URL'
      )
    }

    completed = true

    return {
      ...completeData,
      url: normalizeDiscourseUploadUrl(baseUrl, completeData) || completeData.url
    }
  } catch (error) {
    if (externalUploadIdentifier && !completed) {
      try {
        await abortLinuxDoMultipartUpload(
          baseUrl,
          externalUploadIdentifier,
          resolvedCsrfToken,
          options.headers,
          credentials,
          fetchImpl
        )
      } catch (abortError) {
        console.warn('[DiscourseUpload] Failed to abort multipart upload', abortError)
      }
    }

    throw error
  }
}
