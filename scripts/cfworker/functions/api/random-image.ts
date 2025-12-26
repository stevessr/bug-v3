/**
 * Cloudflare Pages Function for Random Image API
 *
 * Route: /api/random-image
 *
 * Features:
 * - GET /api/random-image - Get a random emoji image from all groups
 * - GET /api/random-image?group=GROUP_ID - Get a random emoji from specific group
 * - GET /api/random-image?count=N - Get N random images (max 10)
 *
 * Query Parameters:
 * - group: (optional) Filter by group ID
 * - count: (optional) Number of random images to return (1-10, default: 1)
 * - format: (optional) 'json' (default) or 'redirect'
 *   - json: Return emoji metadata as JSON
 *   - redirect: HTTP redirect to the image URL
 */

export interface Env {}

interface EmojiData {
  id: string
  name: string
  url: string
  groupId: string
  width: number
  height: number
  packet?: number
}

interface GroupData {
  id: string
  name: string
  icon: string
  order: number
  emojis: EmojiData[]
}

interface ManifestGroup {
  id: string
  name: string
  order: number
  icon: string
  emojiCount: number
}

interface Manifest {
  groups: ManifestGroup[]
  version: string
  exportDate: string
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
}

// Helper function to get random item from array
function getRandomItem<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)]
}

// Helper function to get N random items from array
function getRandomItems<T>(array: T[], count: number): T[] {
  const shuffled = [...array].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, Math.min(count, array.length))
}

export const onRequest: PagesFunction<Env> = async context => {
  const { request } = context

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (request.method !== 'GET') {
    return new Response('Method Not Allowed', { status: 405, headers: corsHeaders })
  }

  try {
    // Parse query parameters
    const url = new URL(request.url)
    const groupId = url.searchParams.get('group')
    const countParam = url.searchParams.get('count')
    const format = url.searchParams.get('format') || 'json'

    const count = countParam ? Math.min(Math.max(1, parseInt(countParam, 10)), 10) : 1

    // Load manifest
    const manifestUrl = new URL('/assets/json/manifest.json', request.url)
    const manifestResponse = await fetch(manifestUrl.toString())

    if (!manifestResponse.ok) {
      return new Response('Failed to load emoji manifest', {
        status: 500,
        headers: corsHeaders
      })
    }

    const manifest: Manifest = await manifestResponse.json()

    // Filter groups
    let targetGroups = manifest.groups.filter(
      g => g.emojiCount > 0 && g.id !== 'favorites' && g.id !== 'buffer'
    )

    if (groupId) {
      targetGroups = targetGroups.filter(g => g.id === groupId)
      if (targetGroups.length === 0) {
        return new Response(JSON.stringify({ error: 'Group not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=UTF-8' }
        })
      }
    }

    // OPTIMIZATION: Instead of loading all groups, randomly select a few groups first
    // This avoids hitting the subrequest limit (50 per request)
    // For general random image, just picking 1 group is enough and most efficient
    // If a specific groupId is requested, targetGroups already contains only that 1 group
    const maxGroupsToLoad = 1
    const selectedGroups = getRandomItems(targetGroups, maxGroupsToLoad)

    // Collect all emojis from selected groups
    const allEmojis: EmojiData[] = []

    for (const group of selectedGroups) {
      const groupUrl = new URL(`/assets/json/${group.id}.json`, request.url)
      const groupResponse = await fetch(groupUrl.toString())

      if (groupResponse.ok) {
        const groupData: GroupData = await groupResponse.json()
        if (groupData.emojis && Array.isArray(groupData.emojis)) {
          allEmojis.push(...groupData.emojis)
        }
      }
    }

    if (allEmojis.length === 0) {
      return new Response(JSON.stringify({ error: 'No emojis found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=UTF-8' }
      })
    }

    // Get random emoji(s)
    const randomEmojis = count === 1 ? [getRandomItem(allEmojis)] : getRandomItems(allEmojis, count)

    // Handle redirect format (only for single image)
    if (format === 'redirect' && count === 1) {
      return Response.redirect(randomEmojis[0].url, 302)
    }

    // Return JSON
    const response = count === 1 ? randomEmojis[0] : randomEmojis

    return new Response(JSON.stringify(response, null, 2), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json; charset=UTF-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    })
  } catch (error) {
    console.error('[RandomImage] Error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal Server Error', details: String(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=UTF-8' }
      }
    )
  }
}
