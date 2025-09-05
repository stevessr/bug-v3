// Cloudflare Worker (module syntax)
// Expects environment binding PROXY_PASSWORD to be set via Wrangler secrets or dashboard.
// Usage: https://<your-worker>.workers.dev/?url=<ENCODED_TARGET_URL>&pw=<PASSWORD>

export default {
  async fetch(request, env) {
    try {
      const { searchParams } = new URL(request.url)
      const urlParam = searchParams.get('url')
      const pw = searchParams.get('pw') || request.headers.get('x-proxy-auth')

      if (!urlParam) return new Response('missing url param', { status: 400 })
      if (!pw) return new Response('missing pw', { status: 401 })

      const secret = env.PROXY_PASSWORD
      if (!secret) {
        return new Response('server not configured', { status: 500 })
      }

      if (pw !== secret) return new Response('invalid password', { status: 403 })

      const target = new URL(urlParam)

      // Only allow specific host(s)
      const ALLOWED = new Set(['i.pximg.net'])
      if (!ALLOWED.has(target.hostname)) return new Response('host not allowed', { status: 403 })

      // Forward request to upstream with Referer header for Pixiv
      const upstreamHeaders = new Headers()
      upstreamHeaders.set('Referer', 'https://www.pixiv.net/')

      const resp = await fetch(target.toString(), {
        method: 'GET',
        headers: upstreamHeaders,
        cf: { cacheTtl: 3600 }
      })

      if (!resp.ok) return new Response(`upstream fetch failed: ${resp.status}`, { status: 502 })

      // Copy and adjust headers for CORS
      const newHeaders = new Headers(resp.headers)
      const origin = request.headers.get('Origin') || '*'
      newHeaders.set('Access-Control-Allow-Origin', origin)
      newHeaders.set('Access-Control-Allow-Methods', 'GET,HEAD,OPTIONS')
      newHeaders.set('Access-Control-Allow-Headers', 'Range,Content-Type')
      newHeaders.set('Vary', 'Origin')

      return new Response(resp.body, { status: resp.status, headers: newHeaders })
    } catch (err) {
      return new Response('proxy error', { status: 500 })
    }
  }
}
