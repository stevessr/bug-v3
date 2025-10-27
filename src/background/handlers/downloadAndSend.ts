/**
 * Download a remote image (with Referer) and upload it directly to a Discourse instance.
 * Returns parsed upload response or throws on error.
 */
export async function downloadAndUploadDirect(
  url: string,
  filename: string,
  opts: { discourseBase: string; cookie?: string; csrf?: string; mimeType?: string }
) {
  const { discourseBase, cookie, csrf, mimeType } = opts
  // download
  const defaultHeaders: Record<string, string> = {
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6',
    'Cache-Control': 'max-age=0'
  }

  const resp = await fetch(url, {
    method: 'GET',
    headers: defaultHeaders,
    referrer: 'https://www.pixiv.net/',
    referrerPolicy: 'no-referrer',
    cache: 'no-cache',
    redirect: 'follow'
  })

  if (!resp.ok) throw new Error(`failed to download image: ${resp.status}`)
  const arrayBuffer = await resp.arrayBuffer()
  const blob = new Blob([new Uint8Array(arrayBuffer)], { type: mimeType || 'image/png' })

  // prepare form
  const form = new FormData()
  form.append('upload_type', 'composer')
  form.append('relativePath', 'null')
  form.append('name', filename)
  form.append('type', blob.type)
  form.append('file', blob, filename)

  const uploadUrl = `${discourseBase.replace(/\/$/, '')}/uploads.json?client_id=f06cb5577ba9410d94b9faf94e48c2d8`

  const headers: Record<string, string> = {}
  if (csrf) headers['X-Csrf-Token'] = csrf
  if (cookie) headers['Cookie'] = cookie

  const uploadResp = await fetch(uploadUrl, {
    method: 'POST',
    headers,
    body: form,
    credentials: 'include'
  })
  if (!uploadResp.ok) {
    const data = await uploadResp.json().catch(() => null)
    const err = new Error('upload failed') as any
    err.details = data
    throw err
  }

  const data = await uploadResp.json()
  return data
}