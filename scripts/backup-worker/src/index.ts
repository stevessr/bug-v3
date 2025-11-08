export interface Env {
  EMOJI_BACKUP: KVNamespace;
  AUTH_SECRET: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response('Unauthorized: Missing or invalid Authorization header', {
        status: 401,
        headers: corsHeaders,
      });
    }

    const token = authHeader.substring('Bearer '.length);
    if (token !== env.AUTH_SECRET) {
      return new Response('Unauthorized: Invalid token', { status: 401, headers: corsHeaders });
    }

    if (request.method === 'POST') {
      // Backup data
      try {
        const data = await request.text();
        if (!data) {
          return new Response('No data provided', { status: 400, headers: corsHeaders });
        }
        await env.EMOJI_BACKUP.put('backup', data);
        return new Response('Backup successful', { status: 200, headers: corsHeaders });
      } catch (error) {
        console.error('Error during backup:', error);
        return new Response('Internal Server Error', { status: 500, headers: corsHeaders });
      }
    } else if (request.method === 'GET') {
      // Restore data
      try {
        const data = await env.EMOJI_BACKUP.get('backup');
        if (data === null) {
          return new Response('No backup found', { status: 404, headers: corsHeaders });
        }
        return new Response(data, {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (error) {
        console.error('Error during restore:', error);
        return new Response('Internal Server Error', { status: 500, headers: corsHeaders });
      }
    } else {
      return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
    }
  },
};
