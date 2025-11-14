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

const DEFAULT_MODEL = 'gemini-1.5-flash-latest'
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta'

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

    const response = await fetch(endpoint, {
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
  const endpoint = config.customOpenAIEndpoint!
  const apiKey = config.customOpenAIKey!
  const model = config.customOpenAIModel || 'gpt-4o-mini'
  const language = config.language || 'Chinese'

  try {
    // For OpenAI vision API, we can pass the image URL directly
    const response = await fetch(`${endpoint}/chat/completions`, {
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
        temperature: 0.4,
        max_tokens: 1024
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
      description: text,
      tags: []
    }
  }
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

    // 2. Fetch all images as base64 in parallel
    const imageParts = await Promise.all(
      emojis.map(async emoji => {
        const base64 = await fetchImageAsBase64(emoji.url)
        return {
          inline_data: {
            mime_type: getMimeType(emoji.url),
            data: base64
          }
        }
      })
    )

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
    const response = await fetch(endpoint, {
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
  concurrency: number = 5
): Promise<Record<string, string>> {
  const endpoint = config.customOpenAIEndpoint!
  const apiKey = config.customOpenAIKey!
  const model = config.customOpenAIModel || 'gpt-4o-mini'
  const language = config.language || 'Chinese'

  const results: Record<string, string> = {}
  const processingQueue: Promise<void>[] = []
  let activeRequests = 0

  // Process each emoji individually with concurrency control
  for (let i = 0; i < emojis.length; i++) {
    // Wait if we've reached the concurrency limit
    while (activeRequests >= concurrency) {
      await Promise.race(processingQueue)
    }

    const emoji = emojis[i]
    activeRequests++

    const emojiPromise = (async () => {
      try {
        const response = await fetch(`${endpoint}/chat/completions`, {
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
                      url: emoji.url
                    }
                  }
                ]
              }
            ],
            temperature: 0.5,
            max_tokens: 100
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
      } finally {
        activeRequests--
      }
    })()

    processingQueue.push(emojiPromise)
  }

  // Wait for all to complete
  await Promise.all(processingQueue)

  return results
}

/**
 * Calculate perceptual hash for an image (simplified version)
 * This is a placeholder - for production, use a library like pHash
 */
export async function calculatePerceptualHash(imageUrl: string): Promise<string> {
  try {
    // Create an image element
    const img = new Image()
    img.crossOrigin = 'anonymous'

    await new Promise((resolve, reject) => {
      img.onload = resolve
      img.onerror = reject
      img.src = imageUrl
    })

    // Create canvas and get image data
    const canvas = document.createElement('canvas')
    const size = 32 // Small size for hash
    canvas.width = size
    canvas.height = size

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      throw new Error('Failed to get canvas context')
    }

    ctx.drawImage(img, 0, 0, size, size)
    const imageData = ctx.getImageData(0, 0, size, size)

    // Calculate average pixel value
    let sum = 0
    for (let i = 0; i < imageData.data.length; i += 4) {
      const r = imageData.data[i]
      const g = imageData.data[i + 1]
      const b = imageData.data[i + 2]
      sum += (r + g + b) / 3
    }
    const average = sum / (size * size)

    // Create hash based on whether pixels are above or below average
    let hash = ''
    for (let i = 0; i < imageData.data.length; i += 4) {
      const r = imageData.data[i]
      const g = imageData.data[i + 1]
      const b = imageData.data[i + 2]
      const value = (r + g + b) / 3
      hash += value > average ? '1' : '0'
    }

    // Convert binary to hex
    let hexHash = ''
    for (let i = 0; i < hash.length; i += 4) {
      const chunk = hash.slice(i, i + 4)
      hexHash += parseInt(chunk, 2).toString(16)
    }

    return hexHash
  } catch (error) {
    console.error('Error calculating perceptual hash:', error)
    // Return a simple hash based on URL as fallback
    return simpleStringHash(imageUrl)
  }
}

/**
 * Simple string hash as fallback
 */
function simpleStringHash(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16)
}

/**
 * Calculate Hamming distance between two hash strings
 */
export function hammingDistance(hash1: string, hash2: string): number {
  if (hash1.length !== hash2.length) {
    return Infinity
  }

  let distance = 0
  for (let i = 0; i < hash1.length; i++) {
    if (hash1[i] !== hash2[i]) {
      distance++
    }
  }
  return distance
}

/**
 * Check if two images are similar based on their perceptual hashes
 * @param hash1 First image hash
 * @param hash2 Second image hash
 * @param threshold Maximum hamming distance to consider images similar (default: 10)
 * @returns true if images are similar
 */
export function areSimilarImages(hash1: string, hash2: string, threshold = 10): boolean {
  const distance = hammingDistance(hash1, hash2)
  return distance <= threshold
}
