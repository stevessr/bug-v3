// Cloudflare Pages Function to proxy video requests with content type validation
// This helps avoid CORS issues and validates video content types

export async function onRequestGet(context) {
  const { request } = context
  const url = new URL(request.url)

  // Extract target URL from query parameter
  const targetUrl = url.searchParams.get('url')

  // Validate parameters
  if (!targetUrl) {
    return new Response('Missing url parameter', {
      status: 400,
      headers: { 'Content-Type': 'text/plain; charset=UTF-8' }
    })
  }

  // Validate that the target URL is a proper URL
  try {
    new URL(targetUrl)
  } catch (error) {
    return new Response('Invalid target URL', {
      status: 400,
      headers: { 'Content-Type': 'text/plain; charset=UTF-8' }
    })
  }

  try {
    // Fetch the file from the target URL
    const response = await fetch(targetUrl)

    if (!response.ok) {
      return new Response(`Remote server error: ${response.status} ${response.statusText}`, {
              status: response.status,
              headers: { 'Content-Type': 'text/plain; charset=UTF-8' }
            })    }

    // Get the content type from the response
    let contentType = response.headers.get('content-type') || ''
    const contentLength = response.headers.get('content-length')

    // Validate that the content is a video type
    const validVideoTypes = [
      'video/mp4',
      'video/webm',
      'video/ogg',
      'video/quicktime',
      'video/x-msvideo',
      'video/x-matroska',
      'video/avi',
      'video/mpeg',
      'video/x-flv',
      'application/octet-stream' // For cases where the content-type is unknown but might be a video
    ]

    // Check if the content type is a valid video type
    const isVideoType = validVideoTypes.some(videoType =>
      contentType.toLowerCase().includes(videoType)
    )

    // If content-type is not available or doesn't match valid types,
    // we'll try to infer from the URL
    if (!isVideoType) {
      const urlLower = targetUrl.toLowerCase()
      const hasVideoExtension = /\.(mp4|webm|ogg|mov|avi|mkv|flv|m4v|3gp|wmv|mpg|mpeg|qt)$/i.test(
        urlLower
      )

      if (!hasVideoExtension) {
        return new Response('Content is not a recognized video type', {
          status: 400,
          headers: { 'Content-Type': 'text/plain; charset=UTF-8' }
        })
      }
    }

    // Create a new response with the appropriate headers
    const proxyResponse = new Response(response.body, {
      status: response.status,
      headers: {
        'Content-Type': contentType || 'application/octet-stream',
        'Content-Length': contentLength || '',
        'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': '*',
        'Content-Disposition': 'inline' // Ensure the content is treated as inline for video
      }
    })

    return proxyResponse
  } catch (error) {
    console.error('Video proxy error:', error)
    return new Response(`Proxy error: ${error.message}`, {
      status: 500,
      headers: { 'Content-Type': 'text/plain; charset=UTF-8' }
    })
  }
}

// Handle preflight requests (CORS)
export async function onRequestOptions(context) {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': '*'
    }
  })
}
