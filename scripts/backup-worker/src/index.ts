export interface Env {
  EMOJI_BACKUP: KVNamespace
  AUTH_SECRET: string
  AUTH_SECRET_READONLY: string
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, DELETE',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
}

type AccessLevel = 'readonly' | 'readwrite' | 'none'

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders })
    }

    const authHeader = request.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response('Unauthorized: Missing or invalid Authorization header', {
        status: 401,
        headers: corsHeaders
      })
    }

    const token = authHeader.substring('Bearer '.length)
    let accessLevel: AccessLevel = 'none'
    if (token === env.AUTH_SECRET) {
      accessLevel = 'readwrite'
    } else if (token === env.AUTH_SECRET_READONLY) {
      accessLevel = 'readonly'
    }

    if (accessLevel === 'none') {
      return new Response('Unauthorized: Invalid token', { status: 401, headers: corsHeaders })
    }

    const url = new URL(request.url)
    const key = url.pathname.substring(1)

    try {
      if (request.method === 'POST' || request.method === 'DELETE') {
        if (accessLevel === 'readonly') {
          return new Response('Forbidden: This key only has read-only access.', {
            status: 403,
            headers: corsHeaders
          })
        }

        if (!key) {
          return new Response('No key provided in URL path', { status: 400, headers: corsHeaders })
        }

        if (request.method === 'POST') {
          const data = await request.text()
          if (!data) {
            return new Response('No data provided', { status: 400, headers: corsHeaders })
          }
          await env.EMOJI_BACKUP.put(key, data)
          return new Response(`Backup successful for key: ${key}`, {
            status: 200,
            headers: corsHeaders
          })
        } else {
          // DELETE
          await env.EMOJI_BACKUP.delete(key)
          return new Response(`Deleted key: ${key}`, { status: 200, headers: corsHeaders })
        }
      } else if (request.method === 'GET') {
        if (!key) {
          // List all keys
          const list = await env.EMOJI_BACKUP.list()
          // 返回键列表（JSON），并包含 CORS 与 Content-Type 头
          return new Response(JSON.stringify(list.keys), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=UTF-8' }
          })
        } else {
          // Get a specific key
          const data = await env.EMOJI_BACKUP.get(key)
          if (data === null) {
            return new Response('No backup found for this key', {
              status: 404,
              headers: corsHeaders
            })
          }
          return new Response(data, {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=UTF-8' }
          })
        }
      } else {
        return new Response('Method Not Allowed', { status: 405, headers: corsHeaders })
      }
    } catch (error) {
      console.error(`Error during ${request.method} for key "${key}":`, error)
      return new Response('Internal Server Error', { status: 500, headers: corsHeaders })
    }
  }
}
