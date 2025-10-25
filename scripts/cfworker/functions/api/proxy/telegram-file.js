// Cloudflare Pages Function to proxy Telegram API file requests
// This helps avoid CORS issues and rate limiting when downloading stickers

export async function onRequestGet(context) {
  const { request } = context;
  const url = new URL(request.url);
  
  // Extract token and path from query parameters
  const token = url.searchParams.get('token');
  const path = url.searchParams.get('path');
  
  // Validate parameters
  if (!token || !path) {
    return new Response('Missing token or path parameters', {
      status: 400,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
  
  // Construct the target Telegram API URL
  const telegramUrl = `https://api.telegram.org/file/bot${token}/${path}`;
  
  try {
    // Fetch the file from Telegram API
    const response = await fetch(telegramUrl);
    
    if (!response.ok) {
      return new Response(`Telegram API error: ${response.status} ${response.statusText}`, {
        status: response.status,
        headers: { 'Content-Type': 'text/plain' }
      });
    }
    
    // Get the content type from the response
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const contentLength = response.headers.get('content-length');
    
    // Create a new response with the appropriate headers
    const proxyResponse = new Response(response.body, {
      status: response.status,
      headers: {
        'Content-Type': contentType,
        'Content-Length': contentLength || '',
        'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': '*',
      }
    });
    
    return proxyResponse;
  } catch (error) {
    console.error('Proxy error:', error);
    return new Response(`Proxy error: ${error.message}`, {
      status: 500,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}

// Handle preflight requests (CORS)
export async function onRequestOptions(context) {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': '*',
    }
  });
}