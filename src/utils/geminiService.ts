/**
 * Gemini API Service
 * Provides integration with Google Gemini API for image analysis and naming
 */

export interface GeminiConfig {
  apiKey: string
  model?: string
  language?: string
  useCustomOpenAI?: boolean
  customOpenAIEndpoint?: string
  customOpenAIKey?: string
  customOpenAIModel?: string
}

export interface ImageAnalysisResult {
  suggestedNames: string[]
  description?: string
  tags?: string[]
}

const DEFAULT_MODEL = 'gemini-2.5-flash-latest'
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta'
const MAX_RETRIES = 3
const INITIAL_RETRY_DELAY = 1000

/**
 * Helper to fetch with retry on 429
 */
async function fetchWithRetry(url: string, options: RequestInit): Promise<Response> {
  let retries = 0
  let delay = INITIAL_RETRY_DELAY

  while (true) {
    const response = await fetch(url, options)

    if (response.status === 429) {
      if (retries >= MAX_RETRIES) {
        throw new Error('Max retries exceeded for 429 (Too Many Requests)')
      }

      console.warn(
        `Encountered 429, retrying in ${delay}ms... (Attempt ${retries + 1}/${MAX_RETRIES})`
      )
      await new Promise(resolve => setTimeout(resolve, delay))

      retries++
      delay *= 2 // Exponential backoff
      continue
    }

    return response
  }
}

function getGeminiModelName(model?: string): string {
  return model || DEFAULT_MODEL
}

/**
 * Analyze an image using Gemini API or OpenAI-compatible API and suggest names
 */
export async function analyzeImageForNaming(
  imageUrl: string,
  config: GeminiConfig
): Promise<ImageAnalysisResult> {
  // Use custom OpenAI if configured
  if (config.useCustomOpenAI && config.customOpenAIEndpoint && config.customOpenAIKey) {
    return analyzeImageWithOpenAI(imageUrl, config)
  }

  const apiKey = config.apiKey
  const model = getGeminiModelName(config.model)
  const language = config.language || 'Chinese'

  if (!apiKey) {
    throw new Error('Gemini API key is required')
  }

  try {
    // Fetch the image as base64
    const imageBase64 = await fetchImageAsBase64(imageUrl)

    // Prepare the request
    const endpoint = `${GEMINI_API_BASE}/models/${model}:generateContent?key=${apiKey}`

    const requestBody = {
      contents: [
        {
          parts: [
            {
              text: `Analyze this image and suggest 5 short, descriptive names suitable for an emoji or sticker. 
The names should be:
- Short (1-3 words)
- Descriptive of the main subject or emotion
- Easy to remember and search for
- In ${language}

Also provide a brief description of the image and relevant tags (in ${language}).

Format your response as JSON with this structure:
{
  "names": ["name1", "name2", "name3", "name4", "name5"],
  "description": "Brief description of the image",
  "tags": ["tag1", "tag2", "tag3"]
}`
            },
            {
              inline_data: {
                mime_type: getMimeType(imageUrl),
                data: imageBase64
              }
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.4,
        topK: 32,
        topP: 1,
        maxOutputTokens: 1024
      }
    }

    const response = await fetchWithRetry(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Gemini API error: ${response.status} - ${errorText}`)
    }

    const data = await response.json()

    // Extract the response text
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''

    // Try to parse as JSON
    const result = parseGeminiResponse(text)

    return {
      suggestedNames: result.names || [],
      description: result.description,
      tags: result.tags
    }
  } catch (error) {
    console.error('Error analyzing image with Gemini:', error)
    throw error
  }
}

/**
 * Analyze an image using OpenAI-compatible API
 */
async function analyzeImageWithOpenAI(
  imageUrl: string,
  config: GeminiConfig
): Promise<ImageAnalysisResult> {
  if (!config.customOpenAIEndpoint || !config.customOpenAIKey) {
    throw new Error('Custom OpenAI endpoint and API key are required')
  }
  const endpoint = config.customOpenAIEndpoint
  const apiKey = config.customOpenAIKey
  const model = config.customOpenAIModel || 'gpt-4o-mini'
  const language = config.language || 'Chinese'

  try {
    // For OpenAI vision API, we can pass the image URL directly
    const response = await fetchWithRetry(`${endpoint}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Analyze this image and suggest 5 short, descriptive names suitable for an emoji or sticker. 
The names should be:
- Short (1-3 words)
- Descriptive of the main subject or emotion
- Easy to remember and search for
- In ${language}

Also provide a brief description of the image and relevant tags (in ${language}).

Format your response as JSON with this structure:
{
  "names": ["name1", "name2", "name3", "name4", "name5"],
  "description": "Brief description of the image",
  "tags": ["tag1", "tag2", "tag3"]
}`
              },
              {
                type: 'image_url',
                image_url: {
                  url: imageUrl
                }
              }
            ]
          }
        ],
        temperature: 0.4
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    const text = data.choices?.[0]?.message?.content || ''

    // Try to parse as JSON
    const result = parseGeminiResponse(text)

    return {
      suggestedNames: result.names || [],
      description: result.description,
      tags: result.tags
    }
  } catch (error) {
    console.error('Error analyzing image with OpenAI:', error)
    throw error
  }
}

/**
 * Fetch an image and convert it to base64
 * @deprecated Use resizeImage instead for better performance
 */
async function fetchImageAsBase64(imageUrl: string): Promise<string> {
  try {
    const response = await fetch(imageUrl)
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`)
    }

    const blob = await response.blob()
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        const base64 = reader.result as string
        // Remove the data URL prefix (e.g., "data:image/png;base64,")
        const base64Data = base64.split(',')[1] || base64
        resolve(base64Data)
      }
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch (error) {
    console.error('Error fetching image:', error)
    throw error
  }
}

/**
 * Get MIME type from image URL
 */
function getMimeType(imageUrl: string): string {
  const ext = imageUrl.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg'
    case 'png':
      return 'image/png'
    case 'gif':
      return 'image/gif'
    case 'webp':
      return 'image/webp'
    default:
      return 'image/jpeg'
  }
}

/**
 * Parse Gemini response text to extract JSON
 */
function parseGeminiResponse(text: string): any {
  try {
    // Try to find JSON in the response
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }

    // If no JSON found, try to parse the whole text
    return JSON.parse(text)
  } catch (error) {
    console.error('Failed to parse Gemini response as JSON:', error)
    // Return a fallback structure
    return {
      names: [],
      description: text
    }
  }
}

/**
 * Streaming callback for batch name generation
 */
export type StreamingCallback = (
  chunkResults: Record<string, string>,
  progress: { current: number; total: number; groupIndex?: number }
) => void

/**
 * Resize image to specific dimensions and return base64
 */
async function resizeImage(
  url: string,
  maxDimension: number = 512,
  quality: number = 0.8
): Promise<string> {
  try {
    const response = await fetch(url)
    if (!response.ok) throw new Error('Failed to fetch image')
    const blob = await response.blob()

    // Create bitmap from blob
    const bitmap = await createImageBitmap(blob)

    // Calculate new dimensions
    let { width, height } = bitmap
    if (width > maxDimension || height > maxDimension) {
      const ratio = width / height
      if (width > height) {
        width = maxDimension
        height = Math.round(maxDimension / ratio)
      } else {
        height = maxDimension
        width = Math.round(maxDimension * ratio)
      }
    }

    // Use OffscreenCanvas if available (works in workers)
    if (typeof OffscreenCanvas !== 'undefined') {
      const canvas = new OffscreenCanvas(width, height)
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Failed to get canvas context')

      ctx.drawImage(bitmap, 0, 0, width, height)
      const resizedBlob = await canvas.convertToBlob({
        type: 'image/jpeg',
        quality
      })

      // Convert blob to base64
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => {
          const base64 = reader.result as string
          resolve(base64.split(',')[1])
        }
        reader.onerror = reject
        reader.readAsDataURL(resizedBlob)
      })
    } else {
      // Fallback to DOM Canvas element
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Failed to get canvas context')

      ctx.drawImage(bitmap, 0, 0, width, height)
      const dataUrl = canvas.toDataURL('image/jpeg', quality)
      return dataUrl.split(',')[1]
    }
  } catch (error) {
    console.warn('Image resizing failed, falling back to original:', error)
    return fetchImageAsBase64(url)
  }
}

/**
 * Generate names for a batch of emojis with streaming support
 * Supports both Gemini and OpenAI-compatible APIs
 */
export async function generateBatchNamesStreaming(
  emojis: { id: string; url: string; name: string; groupId?: string }[],
  prompt: string,
  config: GeminiConfig,
  onProgress: StreamingCallback,
  concurrency: number = 5,
  groupByGroupId: boolean = false
): Promise<Record<string, string>> {
  // Use OpenAI if configured
  if (config.useCustomOpenAI && config.customOpenAIEndpoint && config.customOpenAIKey) {
    return generateBatchNamesWithOpenAIStreaming(
      emojis,
      prompt,
      config,
      onProgress,
      concurrency,
      groupByGroupId
    )
  }

  const apiKey = config.apiKey
  const model = getGeminiModelName(config.model)
  const language = config.language || 'Chinese'

  if (!apiKey) {
    throw new Error('Gemini API key is required')
  }

  const results: Record<string, string> = {}

  // Group emojis if requested
  if (groupByGroupId) {
    const groupedEmojis = new Map<string, typeof emojis>()
    for (const emoji of emojis) {
      const groupId = emoji.groupId || 'ungrouped'
      if (!groupedEmojis.has(groupId)) {
        groupedEmojis.set(groupId, [])
      }
      const group = groupedEmojis.get(groupId)
      if (group) {
        group.push(emoji)
      }
    }

    let groupIndex = 0
    for (const [_groupId, groupEmojis] of groupedEmojis.entries()) {
      const chunkSize = 10
      const chunks: Array<typeof groupEmojis> = []
      for (let i = 0; i < groupEmojis.length; i += chunkSize) {
        chunks.push(groupEmojis.slice(i, i + chunkSize))
      }

      // Process chunks serially to minimize RAM usage
      for (const chunk of chunks) {
        try {
          const chunkResults = await processGeminiChunk(chunk, prompt, language, apiKey, model)

          // Fill missing items with original name to prevent UI from being stuck in "Waiting..."
          for (const emoji of chunk) {
            if (!chunkResults[emoji.id]) {
              chunkResults[emoji.id] = emoji.name
            }
          }

          Object.assign(results, chunkResults)

          // Report progress for this group with only incremental results
          onProgress(chunkResults, {
            current: Object.keys(results).length,
            total: emojis.length,
            groupIndex
          })
        } catch (error) {
          console.error('Error processing batch chunk:', error)
          // Fallback for strict error cases
          const fallbackResults: Record<string, string> = {}
          for (const emoji of chunk) {
            fallbackResults[emoji.id] = emoji.name
            results[emoji.id] = emoji.name
          }
          onProgress(fallbackResults, {
            current: Object.keys(results).length,
            total: emojis.length,
            groupIndex
          })
        }
      }
      groupIndex++
    }
  } else {
    // Process all emojis in chunks without grouping
    const chunkSize = 10
    const chunks: Array<typeof emojis> = []
    for (let i = 0; i < emojis.length; i += chunkSize) {
      chunks.push(emojis.slice(i, i + chunkSize))
    }

    // Process chunks serially
    for (const chunk of chunks) {
      try {
        const chunkResults = await processGeminiChunk(chunk, prompt, language, apiKey, model)

        // Fill missing items with original name to prevent UI from being stuck in "Waiting..."
        for (const emoji of chunk) {
          if (!chunkResults[emoji.id]) {
            chunkResults[emoji.id] = emoji.name
          }
        }

        Object.assign(results, chunkResults)

        // Report progress with only incremental results
        onProgress(chunkResults, {
          current: Object.keys(results).length,
          total: emojis.length
        })
      } catch (error) {
        console.error('Error processing batch chunk:', error)
        // Fallback for strict error cases
        const fallbackResults: Record<string, string> = {}
        for (const emoji of chunk) {
          fallbackResults[emoji.id] = emoji.name
          results[emoji.id] = emoji.name
        }
        onProgress(fallbackResults, {
          current: Object.keys(results).length,
          total: emojis.length
        })
      }
    }
  }

  return results
}

/**
 * Generate names for a batch of emojis using concurrent API calls
 * Supports both Gemini and OpenAI-compatible APIs
 */
export async function generateBatchNames(
  emojis: { id: string; url: string; name: string }[],
  prompt: string,
  config: GeminiConfig,
  concurrency: number = 5
): Promise<Record<string, string>> {
  // Use OpenAI if configured
  if (config.useCustomOpenAI && config.customOpenAIEndpoint && config.customOpenAIKey) {
    return generateBatchNamesWithOpenAI(emojis, prompt, config, concurrency)
  }

  const apiKey = config.apiKey
  const model = getGeminiModelName(config.model)
  const language = config.language || 'Chinese'

  if (!apiKey) {
    throw new Error('Gemini API key is required')
  }

  // For Gemini, process in chunks with concurrency control
  const chunkSize = 10 // Gemini can handle multiple images in one request
  const results: Record<string, string> = {}

  // Split emojis into chunks
  const chunks: Array<typeof emojis> = []
  for (let i = 0; i < emojis.length; i += chunkSize) {
    chunks.push(emojis.slice(i, i + chunkSize))
  }

  // Process chunks with concurrency control
  const processingQueue: Promise<void>[] = []
  let activeRequests = 0

  for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
    // Wait if we've reached the concurrency limit
    while (activeRequests >= concurrency) {
      await Promise.race(processingQueue)
    }

    const chunk = chunks[chunkIndex]
    activeRequests++

    const chunkPromise = (async () => {
      try {
        const chunkResults = await processGeminiChunk(chunk, prompt, language, apiKey, model)
        Object.assign(results, chunkResults)
      } finally {
        activeRequests--
      }
    })()

    processingQueue.push(chunkPromise)
  }

  // Wait for all chunks to complete
  await Promise.all(processingQueue)

  return results
}

/**
 * Process a chunk of emojis with Gemini API
 */
async function processGeminiChunk(
  emojis: { id: string; url: string; name: string }[],
  prompt: string,
  language: string,
  apiKey: string,
  model: string
): Promise<Record<string, string>> {
  try {
    // 1. Construct the text part of the prompt
    const textPrompt = `You are an expert in naming things. I have a list of emojis that I want to rename based on my instructions.

My instruction is: "${prompt}"
The language for the new names is: ${language}.

Following this text are ${emojis.length} images. I will refer to them as Image 1, Image 2, and so on.

Please generate a new name for each emoji.

Return the result as a single JSON object where keys are the image index (e.g., "image_1", "image_2") and values are the new names. For example:
{
  "image_1": "new name for first image",
  "image_2": "new name for second image"
}
`

    // 2. Prepare images sequentially to save memory
    // Processing images one by one prevents memory spikes from multiple high-res base64 strings
    const imageParts = []
    for (const emoji of emojis) {
      const base64 = await resizeImage(emoji.url)
      imageParts.push({
        inline_data: {
          mime_type: 'image/jpeg',
          data: base64
        }
      })
    }

    // 3. Combine text and image parts
    const requestBody = {
      contents: [
        {
          parts: [{ text: textPrompt }, ...imageParts]
        }
      ],
      generationConfig: {
        temperature: 0.5,
        topK: 32,
        topP: 1,
        maxOutputTokens: 2048,
        response_mime_type: 'application/json'
      }
    }

    // 4. Make the API call
    const endpoint = `${GEMINI_API_BASE}/models/${model}:generateContent?key=${apiKey}`
    const response = await fetchWithRetry(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Gemini API error: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
    const parsedResponse = parseGeminiResponse(responseText)

    // 5. Map the results back to emoji IDs
    const newNames: Record<string, string> = {}
    for (let i = 0; i < emojis.length; i++) {
      const emojiId = emojis[i].id
      const responseKey = `image_${i + 1}`
      if (parsedResponse[responseKey]) {
        newNames[emojiId] = parsedResponse[responseKey]
      }
    }

    return newNames
  } catch (error) {
    console.error('Error in processGeminiChunk:', error)
    // Return empty object for failed chunks
    return {}
  }
}

/**
 * Generate names for a batch of emojis using OpenAI-compatible API with concurrency
 */
async function generateBatchNamesWithOpenAI(
  emojis: { id: string; url: string; name: string }[],
  prompt: string,
  config: GeminiConfig,
  _concurrency: number = 5
): Promise<Record<string, string>> {
  if (!config.customOpenAIEndpoint || !config.customOpenAIKey) {
    throw new Error('Custom OpenAI endpoint and API key are required')
  }
  const endpoint = config.customOpenAIEndpoint
  const apiKey = config.customOpenAIKey
  const model = config.customOpenAIModel || 'gpt-4o-mini'
  const language = config.language || 'Chinese'

  const results: Record<string, string> = {}

  // Process each emoji serially
  for (const emoji of emojis) {
    try {
      // Resize image to save bandwidth and token usage
      const base64 = await resizeImage(emoji.url)
      const dataUri = `data:image/jpeg;base64,${base64}`

      const response = await fetchWithRetry(`${endpoint}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: model,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: `Based on this instruction: "${prompt}"

Generate a new name for this emoji in ${language}. Return only the name, nothing else.`
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: dataUri
                  }
                }
              ]
            }
          ],
          temperature: 0.5
        })
      })

      if (response.ok) {
        const data = await response.json()
        const newName = data.choices?.[0]?.message?.content?.trim() || emoji.name
        results[emoji.id] = newName
      }
    } catch (error) {
      console.error(`Error processing emoji ${emoji.id}:`, error)
      // Keep original name on error
      results[emoji.id] = emoji.name
    }
  }

  return results
}

/**
 * Generate names with OpenAI API and streaming support
 */
async function generateBatchNamesWithOpenAIStreaming(
  emojis: { id: string; url: string; name: string; groupId?: string }[],
  prompt: string,
  config: GeminiConfig,
  onProgress: StreamingCallback,
  _concurrency: number = 5,
  groupByGroupId: boolean = false
): Promise<Record<string, string>> {
  if (!config.customOpenAIEndpoint) {
    throw new Error('OpenAI endpoint is required')
  }
  if (!config.customOpenAIKey) {
    throw new Error('OpenAI API key is required')
  }

  const endpoint = config.customOpenAIEndpoint.replace(/\/$/, '')
  const apiKey = config.customOpenAIKey
  const model = config.customOpenAIModel || 'gpt-4o-mini'
  const language = config.language || 'Chinese'

  const results: Record<string, string> = {}

  if (groupByGroupId) {
    // Group emojis by groupId
    const groupedEmojis = new Map<string, typeof emojis>()
    for (const emoji of emojis) {
      const groupId = emoji.groupId || 'ungrouped'
      if (!groupedEmojis.has(groupId)) {
        groupedEmojis.set(groupId, [])
      }
      const group = groupedEmojis.get(groupId)
      if (group) {
        group.push(emoji)
      }
    }

    let groupIndex = 0
    for (const [_groupId, groupEmojis] of groupedEmojis.entries()) {
      // Process group items serially
      for (const emoji of groupEmojis) {
        try {
          // Resize image
          const base64 = await resizeImage(emoji.url)
          const dataUri = `data:image/jpeg;base64,${base64}`

          const response = await fetchWithRetry(`${endpoint}/chat/completions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${apiKey}`
            },
            body: JSON.stringify({
              model: model,
              messages: [
                {
                  role: 'user',
                  content: [
                    {
                      type: 'text',
                      text: `Based on this instruction: "${prompt}"

Generate a new name for this emoji in ${language}. Return only the name, nothing else.`
                    },
                    {
                      type: 'image_url',
                      image_url: {
                        url: dataUri
                      }
                    }
                  ]
                }
              ],
              temperature: 0.5
            })
          })

          if (response.ok) {
            const data = await response.json()
            const newName = data.choices?.[0]?.message?.content?.trim() || emoji.name
            results[emoji.id] = newName

            // Report progress with incremental result
            onProgress(
              { [emoji.id]: newName },
              {
                current: Object.keys(results).length,
                total: emojis.length,
                groupIndex
              }
            )
          }
        } catch (error) {
          console.error(`Error processing emoji ${emoji.id}:`, error)
          results[emoji.id] = emoji.name
        }
      }
      groupIndex++
    }
  } else {
    // Process all emojis serially without grouping
    for (const emoji of emojis) {
      try {
        // Resize image
        const base64 = await resizeImage(emoji.url)
        const dataUri = `data:image/jpeg;base64,${base64}`

        const response = await fetchWithRetry(`${endpoint}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: model,
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'text',
                    text: `Based on this instruction: "${prompt}"

Generate a new name for this emoji in ${language}. Return only the name, nothing else.`
                  },
                  {
                    type: 'image_url',
                    image_url: {
                      url: dataUri
                    }
                  }
                ]
              }
            ],
            temperature: 0.5
          })
        })

        if (response.ok) {
          const data = await response.json()
          const newName = data.choices?.[0]?.message?.content?.trim() || emoji.name
          results[emoji.id] = newName

          // Report progress with incremental result
          onProgress(
            { [emoji.id]: newName },
            {
              current: Object.keys(results).length,
              total: emojis.length
            }
          )
        }
      } catch (error) {
        console.error(`Error processing emoji ${emoji.id}:`, error)
        results[emoji.id] = emoji.name
      }
    }
  }

  return results
}
