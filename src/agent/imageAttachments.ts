export const MAX_AGENT_IMAGE_ATTACHMENTS = 4
export const MAX_AGENT_IMAGE_INPUT_BYTES = 12 * 1024 * 1024
export const MAX_AGENT_IMAGE_OUTPUT_BYTES = 6 * 1024 * 1024
export const MAX_AGENT_IMAGE_DIMENSION = 2048

export type AgentImageSource = 'upload' | 'screenshot' | 'region'

export type AgentImageAttachment = {
  id: string
  name: string
  mimeType: string
  size: number
  width: number
  height: number
  source: AgentImageSource
  dataUrl: string
}

export type AgentImageAttachmentSummary = Omit<AgentImageAttachment, 'dataUrl'>

const SUPPORTED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif'])

const makeId = () =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `image-${Date.now()}-${Math.random().toString(16).slice(2)}`

const cleanName = (value: unknown, fallback: string): string => {
  if (typeof value !== 'string') return fallback
  const cleaned = Array.from(value)
    .filter(character => {
      const code = character.charCodeAt(0)
      return code >= 32 && code !== 127
    })
    .join('')
    .trim()
    .slice(0, 120)
  return cleaned || fallback
}

export function parseAgentImageDataUrl(value: unknown): {
  mimeType: string
  base64: string
  estimatedBytes: number
} | null {
  if (typeof value !== 'string') return null
  const match = /^data:(image\/[a-z0-9.+-]+);base64,([a-z0-9+/=\s]+)$/i.exec(value)
  if (!match) return null
  const mimeType = match[1].toLocaleLowerCase()
  if (!SUPPORTED_IMAGE_TYPES.has(mimeType)) return null
  const base64 = match[2].replace(/\s+/g, '')
  if (!base64) return null
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0
  const estimatedBytes = Math.max(0, Math.floor((base64.length * 3) / 4) - padding)
  if (estimatedBytes <= 0 || estimatedBytes > MAX_AGENT_IMAGE_INPUT_BYTES) return null
  return { mimeType, base64, estimatedBytes }
}

const readFileAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '')
    reader.onerror = () => reject(reader.error || new Error('读取图片失败'))
    reader.readAsDataURL(file)
  })

const loadImage = (dataUrl: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('无法解码图片'))
    image.src = dataUrl
  })

const estimateDataUrlBytes = (dataUrl: string): number =>
  parseAgentImageDataUrl(dataUrl)?.estimatedBytes || Number.POSITIVE_INFINITY

const resizeImage = (
  image: HTMLImageElement,
  sourceMimeType: string
): { dataUrl: string; width: number; height: number } => {
  const scale = Math.min(
    1,
    MAX_AGENT_IMAGE_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight)
  )
  const width = Math.max(1, Math.round(image.naturalWidth * scale))
  const height = Math.max(1, Math.round(image.naturalHeight * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('图片处理不可用')
  context.drawImage(image, 0, 0, width, height)
  const outputType = sourceMimeType === 'image/png' ? 'image/png' : 'image/jpeg'
  return {
    dataUrl: canvas.toDataURL(outputType, outputType === 'image/jpeg' ? 0.88 : undefined),
    width,
    height
  }
}

export async function createAgentImageAttachmentFromDataUrl(
  dataUrl: string,
  options: { name?: string; source: AgentImageSource }
): Promise<AgentImageAttachment> {
  const parsed = parseAgentImageDataUrl(dataUrl)
  if (!parsed) throw new Error('图片格式不受支持或文件超过 12 MB')
  const image = await loadImage(dataUrl)
  if (!image.naturalWidth || !image.naturalHeight) throw new Error('图片尺寸无效')

  let output = {
    dataUrl,
    width: image.naturalWidth,
    height: image.naturalHeight
  }
  if (
    Math.max(image.naturalWidth, image.naturalHeight) > MAX_AGENT_IMAGE_DIMENSION ||
    parsed.estimatedBytes > MAX_AGENT_IMAGE_OUTPUT_BYTES
  ) {
    output = resizeImage(image, parsed.mimeType)
  }

  const outputParsed = parseAgentImageDataUrl(output.dataUrl)
  if (!outputParsed || estimateDataUrlBytes(output.dataUrl) > MAX_AGENT_IMAGE_OUTPUT_BYTES) {
    throw new Error('图片压缩后仍超过 6 MB')
  }

  const extension = outputParsed.mimeType === 'image/png' ? 'png' : 'jpg'
  return {
    id: makeId(),
    name: cleanName(options.name, `${options.source}-${Date.now()}.${extension}`),
    mimeType: outputParsed.mimeType,
    size: outputParsed.estimatedBytes,
    width: output.width,
    height: output.height,
    source: options.source,
    dataUrl: output.dataUrl
  }
}

export async function createAgentImageAttachmentFromFile(
  file: File
): Promise<AgentImageAttachment> {
  if (!SUPPORTED_IMAGE_TYPES.has(file.type.toLocaleLowerCase())) {
    throw new Error(`不支持的图片类型：${file.type || file.name}`)
  }
  if (file.size <= 0 || file.size > MAX_AGENT_IMAGE_INPUT_BYTES) {
    throw new Error(`${file.name} 超过 12 MB 或内容为空`)
  }
  return createAgentImageAttachmentFromDataUrl(await readFileAsDataUrl(file), {
    name: file.name,
    source: 'upload'
  })
}

export const summarizeAgentImageAttachment = (
  attachment: AgentImageAttachment
): AgentImageAttachmentSummary => {
  const { dataUrl: _dataUrl, ...summary } = attachment
  return summary
}
