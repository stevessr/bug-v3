// @ts-nocheck
// Deno Deploy compatible proxy for Pixiv images
// Usage: https://<your-deno-deploy>.deno.dev/?url=<ENCODED_URL>&pw=<PASSWORD>
// Expects environment variable PROXY_PASSWORD to be set in the Deno Deploy project settings.

import { serve } from 'https://deno.land/std@0.201.0/http/server.ts'

const ALLOWED_HOSTS = new Set(['i.pximg.net'])

function corsHeaders(request: Request) {
  const origin = request.headers.get('origin') || '*'
  return new Headers({
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET,HEAD,OPTIONS',
    'Access-Control-Allow-Headers': 'Range,Content-Type'
  })
}

const handler = async (req: Request) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(req) })
    }

    const urlObj = new URL(req.url)
    const urlParam = urlObj.searchParams.get('url')
    const pw = urlObj.searchParams.get('pw') || req.headers.get('x-proxy-auth')

    if (!urlParam) return new Response('missing url param', { status: 400 })
    if (!pw) return new Response('missing pw', { status: 401 })

    const secret = Deno.env.get('PROXY_PASSWORD')
    if (!secret) return new Response('server not configured', { status: 500 })
    if (pw !== secret) return new Response('invalid password', { status: 403 })

    let target: URL
    try {
      target = new URL(urlParam)
    } catch (_e) {
      return new Response('invalid url', { status: 400 })
    }

    if (!ALLOWED_HOSTS.has(target.hostname))
      return new Response('host not allowed', { status: 403 })

    // Forward request to upstream with Referer header for Pixiv
    const upstreamHeaders = new Headers()
    upstreamHeaders.set('Referer', 'https://www.pixiv.net/')

    const resp = await fetch(target.toString(), { method: 'GET', headers: upstreamHeaders })
    if (!resp.ok) return new Response(`upstream fetch failed: ${resp.status}`, { status: 502 })

    const headers = new Headers(resp.headers)
    const origin = req.headers.get('origin') || '*'
    headers.set('Access-Control-Allow-Origin', origin)
    headers.set('Access-Control-Allow-Methods', 'GET,HEAD,OPTIONS')
    headers.set('Access-Control-Allow-Headers', 'Range,Content-Type')
    headers.set('Vary', 'Origin')

    return new Response(resp.body, { status: resp.status, headers })
  } catch (err) {
    console.error('proxy error', err)
    return new Response('proxy error', { status: 500 })
  }
}

// Allow configuration of host/port via env for local testing; defaults to 127.0.0.1:8000
const HOST = Deno.env.get('HOST') || '127.0.0.1'
const PORT = Number(Deno.env.get('PORT') || '8000')

serve(handler, { hostname: HOST, port: PORT })
