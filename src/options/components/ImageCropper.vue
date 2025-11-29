<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import {
  CloseOutlined,
  CheckOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
  UndoOutlined
} from '@ant-design/icons-vue'
import { theme } from 'ant-design-vue'

import type { AppSettings } from '@/types/type'

interface CroppedEmoji {
  id: string
  name: string
  imageUrl: string
  x: number
  y: number
  width: number
  height: number
}

interface Props {
  imageFile: File
  aiSettings?: AppSettings
}

const props = defineProps<Props>()

const emit = defineEmits<{
  close: []
  upload: [emojis: CroppedEmoji[]]
}>()

// 状态管理
const activeTab = ref<'manual' | 'ai' | 'custom'>('manual')
const gridCols = ref(2)
const gridRows = ref(2)
const isLoading = ref(false)
const isProcessing = ref(false)
const showCropper = ref(false)
const uploadedImageUrl = ref('')

// 主题相关
const { useToken } = theme
const { token } = useToken()

// Canvas 相关
const canvasRef = ref<HTMLCanvasElement>()
const containerRef = ref<HTMLDivElement>()
const imageElement = ref<HTMLImageElement>()
const baseScale = ref(1) // 基础缩放比例（适应容器）
const zoomLevel = ref(1) // 用户缩放级别
const minZoom = 0.1
const maxZoom = 5
const containerSize = ref({ width: 0, height: 0 })

// 实际显示缩放比例
const displayScale = computed(() => baseScale.value * zoomLevel.value)

// 切割结果
const croppedEmojis = ref<CroppedEmoji[]>([])
const selectedEmojis = ref<Set<string>>(new Set())

// Resize state
const resizingId = ref<string | null>(null)
const resizeHandle = ref<'tl' | 'tr' | 'bl' | 'br' | null>(null)
const startPos = ref({ x: 0, y: 0 })
const startRect = ref({ x: 0, y: 0, width: 0, height: 0 })

const startResize = (e: MouseEvent, id: string, handle: 'tl' | 'tr' | 'bl' | 'br') => {
  e.stopPropagation()
  e.preventDefault()

  const emoji = croppedEmojis.value.find(e => e.id === id)
  if (!emoji) return

  resizingId.value = id
  resizeHandle.value = handle
  startPos.value = { x: e.clientX, y: e.clientY }
  startRect.value = {
    x: emoji.x,
    y: emoji.y,
    width: emoji.width,
    height: emoji.height
  }

  window.addEventListener('mousemove', handleResize)
  window.addEventListener('mouseup', stopResize)
}

const handleResize = (e: MouseEvent) => {
  if (!resizingId.value || !resizeHandle.value) return

  const emoji = croppedEmojis.value.find(e => e.id === resizingId.value)
  if (!emoji) return

  const deltaX =
    ((e.clientX - startPos.value.x) / ((imageElement.value?.width || 1) * displayScale.value)) * 100
  const deltaY =
    ((e.clientY - startPos.value.y) / ((imageElement.value?.height || 1) * displayScale.value)) *
    100

  let newX = startRect.value.x
  let newY = startRect.value.y
  let newWidth = startRect.value.width
  let newHeight = startRect.value.height

  if (resizeHandle.value.includes('l')) {
    newX = Math.min(startRect.value.x + deltaX, startRect.value.x + startRect.value.width - 5)
    newWidth = startRect.value.width + (startRect.value.x - newX)
  }
  if (resizeHandle.value.includes('r')) {
    newWidth = Math.max(5, startRect.value.width + deltaX)
  }
  if (resizeHandle.value.includes('t')) {
    newY = Math.min(startRect.value.y + deltaY, startRect.value.y + startRect.value.height - 5)
    newHeight = startRect.value.height + (startRect.value.y - newY)
  }
  if (resizeHandle.value.includes('b')) {
    newHeight = Math.max(5, startRect.value.height + deltaY)
  }

  // Update emoji position
  emoji.x = Math.max(0, Math.min(100, newX))
  emoji.y = Math.max(0, Math.min(100, newY))
  emoji.width = Math.max(0, Math.min(100 - emoji.x, newWidth))
  emoji.height = Math.max(0, Math.min(100 - emoji.y, newHeight))
}

const stopResize = async () => {
  if (resizingId.value) {
    const emoji = croppedEmojis.value.find(e => e.id === resizingId.value)
    if (emoji) {
      // Re-generate the cropped image
      const newImageUrl = cropImage({
        x: emoji.x,
        y: emoji.y,
        width: emoji.width,
        height: emoji.height
      })
      if (newImageUrl) {
        emoji.imageUrl = newImageUrl
      }
    }
  }

  resizingId.value = null
  resizeHandle.value = null
  window.removeEventListener('mousemove', handleResize)
  window.removeEventListener('mouseup', stopResize)
}

// Drawing state
const isDrawing = ref(false)
const drawingStart = ref({ x: 0, y: 0 })

// Moving state
const isMoving = ref(false)
const movingId = ref<string | null>(null)
const moveStartPos = ref({ x: 0, y: 0 })
const moveStartRect = ref({ x: 0, y: 0 })
const hasMoved = ref(false)

// Drawing functions
const startDraw = (e: MouseEvent) => {
  // Only start drawing if clicking on the background (not on an existing box)
  // and we are in AI mode (since manual mode uses grid)
  if (activeTab.value !== 'custom' || (e.target as HTMLElement).closest('.ai-box')) return

  e.preventDefault()
  isDrawing.value = true
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()

  // Calculate relative position in percentage
  const x = ((e.clientX - rect.left) / rect.width) * 100
  const y = ((e.clientY - rect.top) / rect.height) * 100

  drawingStart.value = { x, y }

  // Create a new temporary emoji box
  const newId = `manual-${Date.now()}`
  const newEmoji: CroppedEmoji = {
    id: newId,
    name: `表情_${croppedEmojis.value.length + 1}`,
    imageUrl: '', // Will be generated on stop
    x: x,
    y: y,
    width: 0,
    height: 0
  }

  croppedEmojis.value.push(newEmoji)
  resizingId.value = newId // Reuse resizing logic effectively by tracking this ID

  window.addEventListener('mousemove', handleDraw)
  window.addEventListener('mouseup', stopDraw)
}

const handleDraw = (e: MouseEvent) => {
  if (!isDrawing.value || !resizingId.value) return

  const container = containerRef.value
  if (!container) return

  // Find the emoji we are currently drawing
  const emoji = croppedEmojis.value.find(e => e.id === resizingId.value)
  if (!emoji) return

  // We need to calculate position relative to the container image
  const imageRect = imageElement.value ? {
    width: imageElement.value.width * displayScale.value,
    height: imageElement.value.height * displayScale.value,
    left: container.getBoundingClientRect().left + (container.offsetWidth - imageElement.value.width * displayScale.value) / 2,
    top: container.getBoundingClientRect().top + (container.offsetHeight - imageElement.value.height * displayScale.value) / 2
  } : container.getBoundingClientRect()

  // Wait, the previous logic used event delta on window, but for drawing we want relative to container
  // Let's reuse the logic from the image-display element
  // Actually, the `image-display` element is the container for the boxes.
  // We can just use the bounding client rect of the image-display

  const displayEl = container.querySelector('.image-display')
  if (!displayEl) return
  const rect = displayEl.getBoundingClientRect()

  const currentX = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100))
  const currentY = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100))

  const startX = drawingStart.value.x
  const startY = drawingStart.value.y

  const newX = Math.min(startX, currentX)
  const newY = Math.min(startY, currentY)
  const newWidth = Math.abs(currentX - startX)
  const newHeight = Math.abs(currentY - startY)

  emoji.x = newX
  emoji.y = newY
  emoji.width = newWidth
  emoji.height = newHeight
}

const stopDraw = async () => {
  isDrawing.value = false
  window.removeEventListener('mousemove', handleDraw)
  window.removeEventListener('mouseup', stopDraw)

  if (resizingId.value) {
    const emoji = croppedEmojis.value.find(e => e.id === resizingId.value)
    if (emoji) {
      // If box is too small, remove it
      if (emoji.width < 1 || emoji.height < 1) {
        croppedEmojis.value = croppedEmojis.value.filter(e => e.id !== resizingId.value)
      } else {
        // Generate image
        const newImageUrl = cropImage({
          x: emoji.x,
          y: emoji.y,
          width: emoji.width,
          height: emoji.height
        })
        if (newImageUrl) {
          emoji.imageUrl = newImageUrl
          selectedEmojis.value.add(emoji.id)
          selectedEmojis.value = new Set(selectedEmojis.value)
        }
      }
    }
  }
  resizingId.value = null
}

// Moving functions
const startMove = (e: MouseEvent, id: string) => {
  // Don't start move if we clicked on a resize handle
  if ((e.target as HTMLElement).classList.contains('resize-handle')) return

  // Only allow moving in AI or Custom mode
  if (activeTab.value !== 'ai' && activeTab.value !== 'custom') return

  e.preventDefault()
  e.stopPropagation()

  const emoji = croppedEmojis.value.find(e => e.id === id)
  if (!emoji) return

  isMoving.value = true
  hasMoved.value = false
  movingId.value = id
  moveStartPos.value = { x: e.clientX, y: e.clientY }
  moveStartRect.value = { x: emoji.x, y: emoji.y }

  window.addEventListener('mousemove', handleMove)
  window.addEventListener('mouseup', stopMove)
}

const handleMove = (e: MouseEvent) => {
  if (!isMoving.value || !movingId.value) return

  hasMoved.value = true

  const emoji = croppedEmojis.value.find(e => e.id === movingId.value)
  if (!emoji) return

  const deltaX = (e.clientX - moveStartPos.value.x) / ((imageElement.value?.width || 1) * displayScale.value) * 100
  const deltaY = (e.clientY - moveStartPos.value.y) / ((imageElement.value?.height || 1) * displayScale.value) * 100

  const newX = Math.max(0, Math.min(100 - emoji.width, moveStartRect.value.x + deltaX))
  const newY = Math.max(0, Math.min(100 - emoji.height, moveStartRect.value.y + deltaY))

  emoji.x = newX
  emoji.y = newY
}

const stopMove = async () => {
  if (movingId.value) {
    if (!hasMoved.value) {
       toggleSelection(movingId.value)
    } else {
      const emoji = croppedEmojis.value.find(e => e.id === movingId.value)
      if (emoji) {
        // Re-generate the cropped image
        const newImageUrl = cropImage({
          x: emoji.x,
          y: emoji.y,
          width: emoji.width,
          height: emoji.height
        })
        if (newImageUrl) {
          emoji.imageUrl = newImageUrl
        }
      }
    }
  }

  isMoving.value = false
  movingId.value = null
  window.removeEventListener('mousemove', handleMove)
  window.removeEventListener('mouseup', stopMove)
}
// 计算属性
const gridPositions = computed(() => {
  const positions = []
  const cellWidth = 100 / gridCols.value
  const cellHeight = 100 / gridRows.value

  for (let row = 0; row < gridRows.value; row++) {
    for (let col = 0; col < gridCols.value; col++) {
      positions.push({
        x: col * cellWidth,
        y: row * cellHeight,
        width: cellWidth,
        height: cellHeight,
        id: `${row}-${col}`,
        isSelected: selectedEmojis.value.has(`${row}-${col}`)
      })
    }
  }

  return positions
})

const canProcess = computed(() => {
  return (
    activeTab.value === 'manual' ||
    activeTab.value === 'custom' ||
    (activeTab.value === 'ai' && props.aiSettings?.geminiApiKey)
  )
})

// 方法
const initCanvas = async () => {
  if (!props.imageFile) return

  // 创建上传图片的 URL
  uploadedImageUrl.value = URL.createObjectURL(props.imageFile)

  // 等待容器尺寸确定
  await nextTick()
  if (!containerRef.value) return

  const container = containerRef.value
  const rect = container.getBoundingClientRect()
  containerSize.value = { width: rect.width, height: rect.height }

  // 加载图片
  if (!imageElement.value) {
    imageElement.value = new Image()
    await new Promise((resolve, reject) => {
      imageElement.value!.onload = resolve
      imageElement.value!.onerror = reject
      imageElement.value!.src = uploadedImageUrl.value
    })
  }

  // 计算缩放比例
  const maxWidth = rect.width - 40 // 留出边距
  const maxHeight = rect.height - 40

  const scaleX = maxWidth / imageElement.value.width
  const scaleY = maxHeight / imageElement.value.height
  baseScale.value = Math.min(scaleX, scaleY, 1)
  zoomLevel.value = 1

  showCropper.value = true

  // 等待 canvas 准备就绪
  if (canvasRef.value) {
    canvasRef.value.width = imageElement.value.width
    canvasRef.value.height = imageElement.value.height
    await nextTick()
  }
}

// 缩放控制
const handleZoom = (delta: number) => {
  const newZoom = zoomLevel.value + delta
  if (newZoom >= minZoom && newZoom <= maxZoom) {
    zoomLevel.value = newZoom
  }
}

const resetZoom = () => {
  zoomLevel.value = 1
}

const handleWheel = (e: WheelEvent) => {
  if (e.ctrlKey || e.metaKey) {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.1 : 0.1
    handleZoom(delta)
  }
}

const cropImage = (position: { x: number; y: number; width: number; height: number }) => {
  if (!imageElement.value || !canvasRef.value) return null

  const canvas = canvasRef.value
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  // 计算实际像素位置
  const actualX = (position.x / 100) * imageElement.value.width
  const actualY = (position.y / 100) * imageElement.value.height
  const actualWidth = (position.width / 100) * imageElement.value.width
  const actualHeight = (position.height / 100) * imageElement.value.height

  // 创建临时 canvas 进行切割
  const tempCanvas = document.createElement('canvas')
  tempCanvas.width = actualWidth
  tempCanvas.height = actualHeight
  const tempCtx = tempCanvas.getContext('2d')

  if (!tempCtx) return null

  // 绘制切割区域
  tempCtx.drawImage(
    imageElement.value,
    actualX,
    actualY,
    actualWidth,
    actualHeight,
    0,
    0,
    actualWidth,
    actualHeight
  )

  return tempCanvas.toDataURL('image/png')
}

const cropWithMask = async (
  position: { x: number; y: number; width: number; height: number },
  maskBase64: string
) => {
  if (!imageElement.value) return null

  // Create temporary canvas for the mask
  const maskCanvas = document.createElement('canvas')
  const maskCtx = maskCanvas.getContext('2d')
  if (!maskCtx) return null

  // Decode base64 mask and draw to canvas
  const maskImage = new Image()
  await new Promise(resolve => {
    maskImage.onload = resolve
    maskImage.src = maskBase64.startsWith('data:image')
      ? maskBase64
      : `data:image/png;base64,${maskBase64}`
  })

  // Calculate actual pixel dimensions
  const actualX = (position.x / 100) * imageElement.value.width
  const actualY = (position.y / 100) * imageElement.value.height
  const actualWidth = (position.width / 100) * imageElement.value.width
  const actualHeight = (position.height / 100) * imageElement.value.height

  maskCanvas.width = actualWidth
  maskCanvas.height = actualHeight
  maskCtx.drawImage(maskImage, 0, 0, actualWidth, actualHeight)

  // Create final canvas
  const finalCanvas = document.createElement('canvas')
  finalCanvas.width = actualWidth
  finalCanvas.height = actualHeight
  const finalCtx = finalCanvas.getContext('2d')
  if (!finalCtx) return null

  // Draw original image portion
  finalCtx.drawImage(
    imageElement.value,
    actualX,
    actualY,
    actualWidth,
    actualHeight,
    0,
    0,
    actualWidth,
    actualHeight
  )

  // Apply mask
  finalCtx.globalCompositeOperation = 'destination-in'
  finalCtx.drawImage(maskCanvas, 0, 0)

  return finalCanvas.toDataURL('image/png')
}

const toggleSelection = (id: string) => {
  if (selectedEmojis.value.has(id)) {
    selectedEmojis.value.delete(id)
  } else {
    selectedEmojis.value.add(id)
  }
  selectedEmojis.value = new Set(selectedEmojis.value)
}

const selectAll = () => {
  const allIds = gridPositions.value.map(pos => pos.id)
  selectedEmojis.value = new Set(allIds)
}

const deselectAll = () => {
  selectedEmojis.value.clear()
  selectedEmojis.value = new Set()
}

// 手动切割处理
const processManualCrop = async () => {
  if (!imageElement.value || selectedEmojis.value.size === 0) return

  isProcessing.value = true
  croppedEmojis.value = []

  try {
    const results: CroppedEmoji[] = []

    for (const id of selectedEmojis.value) {
      const [row, col] = id.split('-').map(Number)
      const position = gridPositions.value.find(pos => pos.id === id)

      if (position) {
        const croppedImageUrl = cropImage(position)
        if (croppedImageUrl) {
          results.push({
            id,
            name: `表情_${row + 1}_${col + 1}`,
            imageUrl: croppedImageUrl,
            x: position.x,
            y: position.y,
            width: position.width,
            height: position.height
          })
        }
      }
    }

    croppedEmojis.value = results
  } finally {
    isProcessing.value = false
  }
}

// AI 自动识别处理
const processAICrop = async () => {
  if (!props.aiSettings?.geminiApiKey) {
    throw new Error('需要配置 Gemini API 密钥')
  }

  isProcessing.value = true

  try {
    // 将图片转换为 base64
    const base64Image = await new Promise<string>(resolve => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.readAsDataURL(props.imageFile)
    })

    // 调用 Gemini API 进行图片分析
    const modelName = props.aiSettings.geminiModel
    const isRobotics = modelName === 'gemini-robotics-er-1.5-preview'
    const language = props.aiSettings.geminiLanguage || 'Chinese'

    let prompt = ''
    if (isRobotics) {
      prompt = `Return bounding boxes as a JSON array with labels. Never return masks or code fencing. Limit to 25 objects. Include as many objects as you can identify. The format should be as follows: [{"box_2d": [ymin, xmin, ymax, xmax], "label": <label for the object>}] normalized to 0-1000. The values in box_2d must only be integers.`
    } else {
      prompt =
        language === 'Chinese'
          ? `请为图中的表情符号或图标提供分割蒙版。输出一个 JSON 列表，其中每个条目包含一个 2D 边界框（"box_2d"）、一个分割蒙版（"mask"）和一个文本标签（"label"）。`
          : `Give the segmentation masks for the emojis or icons in this image. Output a JSON list of segmentation masks where each entry contains the 2D bounding box in the key "box_2d", the segmentation mask in key "mask", and the text label in the key "label".`
    }

    const schemaProperties: any = {
      label: {
        type: 'string',
        description: 'The text label for the detected object (e.g., emoji name).'
      },
      box_2d: {
        type: 'array',
        items: { type: 'integer' },
        minItems: 4,
        maxItems: 4,
        description:
          'Bounding box coordinates [y_min, x_min, y_max, x_max], normalized to [0, 1000].'
      }
    }

    const requiredFields = ['label', 'box_2d']
    if (!isRobotics) {
      schemaProperties.mask = {
        type: 'string',
        description: 'Base64 encoded PNG segmentation mask.'
      }
      requiredFields.push('mask')
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${props.aiSettings.geminiApiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt
                },
                {
                  inline_data: {
                    mime_type: props.imageFile.type,
                    data: base64Image.split(',')[1]
                  }
                }
              ]
            }
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            responseJsonSchema: {
              type: 'array',
              items: {
                type: 'object',
                properties: schemaProperties,
                required: requiredFields
              }
            }
          }
        })
      }
    )

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(`Gemini API error: ${errorData.error?.message || response.statusText}`)
    }

    const data = await response.json()
    const fullText = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
    if (fullText) {
      try {
        const aiResult = JSON.parse(fullText)

        if (Array.isArray(aiResult)) {
          const results: CroppedEmoji[] = []

          for (const item of aiResult) {
            const [y0, x0, y1, x1] = item.box_2d

            // De-normalize from [0, 1000] to [0, 100]
            const x = x0 / 10
            const y = y0 / 10
            const width = (x1 - x0) / 10
            const height = (y1 - y0) / 10

            // Clamp values to ensure they are within the 0-100 range
            const clampedX = Math.max(0, Math.min(100, x))
            const clampedY = Math.max(0, Math.min(100, y))
            const clampedWidth = Math.max(0, Math.min(100 - clampedX, width))
            const clampedHeight = Math.max(0, Math.min(100 - clampedY, height))

            if (clampedWidth <= 0 || clampedHeight <= 0) {
              continue
            }

            let croppedImageUrl = ''
            if (item.mask) {
              croppedImageUrl =
                (await cropWithMask(
                  { x: clampedX, y: clampedY, width: clampedWidth, height: clampedHeight },
                  item.mask
                )) || ''
            } else {
              croppedImageUrl =
                cropImage({
                  x: clampedX,
                  y: clampedY,
                  width: clampedWidth,
                  height: clampedHeight
                }) || ''
            }

            if (croppedImageUrl) {
              results.push({
                id: `ai-${results.length}`,
                name: item.label || `表情_${results.length + 1}`,
                imageUrl: croppedImageUrl,
                x: clampedX,
                y: clampedY,
                width: clampedWidth,
                height: clampedHeight
              })
            }
          }

          croppedEmojis.value = results

          // 自动选择所有 AI 识别的结果
          selectedEmojis.value = new Set(results.map(e => e.id))
        } else {
          throw new Error('AI 识别结果格式不正确')
        }
      } catch (parseError) {
        console.error('解析 AI 结果失败：', parseError)
        console.log('AI 响应文本：', fullText)
        throw new Error('AI 识别结果解析失败，请重试')
      }
    } else {
      throw new Error('AI 识别失败，未返回有效结果')
    }
  } finally {
    isProcessing.value = false
  }
}

const processImage = async () => {
  try {
    if (activeTab.value === 'manual') {
      await processManualCrop()
    } else if (activeTab.value === 'ai') {
      await processAICrop()
    }
  } catch (error) {
    console.error('处理图片时出错：', error)
    // 可以在这里添加错误提示
    throw error
  }
}

const updateEmojiName = (id: string, newName: string) => {
  const emoji = croppedEmojis.value.find(e => e.id === id)
  if (emoji) {
    emoji.name = newName
  }
}

const confirmUpload = () => {
  const selectedResults = croppedEmojis.value.filter(emoji => selectedEmojis.value.has(emoji.id))

  if (selectedResults.length > 0) {
    emit('upload', selectedResults)
  }
}

const close = () => {
  // 清理资源
  if (uploadedImageUrl.value) {
    URL.revokeObjectURL(uploadedImageUrl.value)
  }
  emit('close')
}

// 生命周期
onMounted(() => {
  initCanvas()
})

// 监听图片文件变化
watch(
  () => props.imageFile,
  () => {
    initCanvas()
  }
)
</script>

<template>
  <div class="image-cropper-overlay">
    <div
      class="image-cropper-modal"
      :style="{ background: token.colorBgContainer, color: token.colorText }"
    >
      <!-- 头部 -->
      <div class="cropper-header" :style="{ borderColor: token.colorBorderSecondary }">
        <h3 :style="{ color: token.colorTextHeading }">图片切割</h3>
        <a-button type="text" @click="close">
          <CloseOutlined />
        </a-button>
      </div>

      <!-- 标签页 -->
      <div class="cropper-tabs" :style="{ borderColor: token.colorBorderSecondary }">
        <a-radio-group v-model:value="activeTab" button-style="solid">
          <a-radio-button value="manual">手动切割</a-radio-button>
          <a-radio-button value="custom">手动标注</a-radio-button>
          <a-radio-button value="ai" :disabled="!props.aiSettings?.geminiApiKey">
            AI 自动识别
          </a-radio-button>
        </a-radio-group>
      </div>

      <!-- 手动切割设置 -->
      <div
        v-if="activeTab === 'manual'"
        class="cropper-settings"
        :style="{ borderColor: token.colorBorderSecondary }"
      >
        <div class="setting-item">
          <label :style="{ color: token.colorText }">水平切割：</label>
          <a-input-number v-model:value="gridCols" :min="1" :max="100" />
          <label :style="{ color: token.colorText, marginLeft: '20px' }">垂直切割：</label>
          <a-input-number v-model:value="gridRows" :min="1" :max="100" />
        </div>

        <div class="setting-item">
          <label :style="{ color: token.colorText }">图片缩放：</label>
          <div class="zoom-controls">
            <a-space>
              <a-button
                shape="circle"
                size="small"
                @click="handleZoom(-0.1)"
                :disabled="zoomLevel <= minZoom"
              >
                <template #icon><ZoomOutOutlined /></template>
              </a-button>
              <span class="zoom-text">{{ Math.round(zoomLevel * 100) }}%</span>
              <a-button
                shape="circle"
                size="small"
                @click="handleZoom(0.1)"
                :disabled="zoomLevel >= maxZoom"
              >
                <template #icon><ZoomInOutlined /></template>
              </a-button>
              <a-button
                shape="circle"
                size="small"
                @click="resetZoom"
                v-if="zoomLevel !== 1"
                title="重置缩放"
              >
                <template #icon><UndoOutlined /></template>
              </a-button>
            </a-space>
          </div>
        </div>

        <div class="setting-item">
          <a-button @click="selectAll">全选</a-button>
          <a-button @click="deselectAll" class="ml-2">取消全选</a-button>
          <span class="selection-count" :style="{ color: token.colorTextSecondary }">
            已选择 {{ selectedEmojis.size }} / {{ gridPositions.length }} 个区域
          </span>
        </div>
      </div>

      <!-- AI 识别提示 -->
      <div
        v-if="activeTab === 'ai'"
        class="ai-notice"
        :style="{ borderColor: token.colorBorderSecondary }"
      >
        <a-alert
          v-if="!props.aiSettings?.geminiApiKey"
          message="需要配置 Gemini API 密钥"
          description="请在设置页面配置 AI 功能中的 Gemini API 密钥"
          type="warning"
          show-icon
        />
        <div v-else class="ai-info">
          <p :style="{ color: token.colorTextSecondary }">
            AI 将自动识别图片中的表情符号并生成名称
          </p>
        </div>
      </div>

      <!-- 图片展示区域 -->
      <div class="cropper-main">
        <div class="cropper-container" ref="containerRef">
          <div v-if="isLoading" class="loading-overlay">
            <a-spin size="large" />
          </div>

          <div v-if="showCropper" class="image-display" @wheel="handleWheel" @mousedown="startDraw">
            <img
              :src="uploadedImageUrl"
              :style="{
                width: (imageElement?.width || 0) * displayScale + 'px',
                height: (imageElement?.height || 0) * displayScale + 'px'
              }"
              class="main-image"
            />

            <!-- 网格覆盖层（手动模式） -->
            <div v-if="activeTab === 'manual'" class="grid-overlay">
              <div
                v-for="position in gridPositions"
                :key="position.id"
                class="grid-cell"
                :class="{ selected: position.isSelected }"
                :style="{
                  left: position.x + '%',
                  top: position.y + '%',
                  width: position.width + '%',
                  height: position.height + '%'
                }"
                @click="toggleSelection(position.id)"
              >
                <div v-if="position.isSelected" class="selection-mark">
                  <CheckOutlined />
                </div>
              </div>
            </div>

            <!-- AI 识别结果覆盖层 -->
            <div v-if="(activeTab === 'ai' || activeTab === 'custom') && croppedEmojis.length > 0" class="ai-overlay">
              <div
                v-for="emoji in croppedEmojis"
                :key="emoji.id"
                class="ai-box"
                :class="{ selected: selectedEmojis.has(emoji.id) }"
                :style="{
                  left: emoji.x + '%',
                  top: emoji.y + '%',
                  width: emoji.width + '%',
                  height: emoji.height + '%'
                }"
                @click.stop="toggleSelection(emoji.id)"
              >
                <div class="ai-box-name">
                  <span>{{ emoji.name }}</span>
                </div>
                <div v-if="selectedEmojis.has(emoji.id)" class="selection-mark">
                  <CheckOutlined />
                </div>

                <!-- Resize handles -->
                <div
                  v-if="selectedEmojis.has(emoji.id)"
                  class="resize-handle handle-tl"
                  @mousedown="startResize($event, emoji.id, 'tl')"
                ></div>
                <div
                  v-if="selectedEmojis.has(emoji.id)"
                  class="resize-handle handle-tr"
                  @mousedown="startResize($event, emoji.id, 'tr')"
                ></div>
                <div
                  v-if="selectedEmojis.has(emoji.id)"
                  class="resize-handle handle-bl"
                  @mousedown="startResize($event, emoji.id, 'bl')"
                ></div>
                <div
                  v-if="selectedEmojis.has(emoji.id)"
                  class="resize-handle handle-br"
                  @mousedown="startResize($event, emoji.id, 'br')"
                ></div>
              </div>
            </div>
          </div>
        </div>

        <!-- 隐藏的 canvas 用于图片处理 -->
        <canvas ref="canvasRef" style="display: none" />
      </div>

      <!-- 处理按钮 -->
      <div class="cropper-actions" :style="{ borderColor: token.colorBorderSecondary }">
        <div v-if="activeTab === 'custom'" class="custom-tip" :style="{ color: token.colorTextSecondary }">
          在图片空白处拖拽以创建选区，点击选区可调整大小
        </div>
        <a-button
          v-else
          type="primary"
          @click="processImage"
          :loading="isProcessing"
          :disabled="!canProcess || (activeTab === 'manual' && selectedEmojis.size === 0)"
        >
          {{ activeTab === 'manual' ? '切割选中区域' : 'AI 识别' }}
        </a-button>
      </div>

      <!-- 切割结果 -->
      <div
        v-if="croppedEmojis.length > 0"
        class="cropper-results"
        :style="{ borderColor: token.colorBorderSecondary }"
      >
        <h4 :style="{ color: token.colorTextHeading }">
          切割结果（{{ croppedEmojis.length }} 个表情）
        </h4>

        <div class="results-grid">
          <div
            v-for="emoji in croppedEmojis"
            :key="emoji.id"
            class="result-item"
            :class="{ selected: selectedEmojis.has(emoji.id) }"
            :style="{
              borderColor: selectedEmojis.has(emoji.id)
                ? token.colorPrimary
                : token.colorBorderSecondary,
              background: selectedEmojis.has(emoji.id)
                ? token.controlItemBgActive
                : token.colorBgContainer
            }"
          >
            <div class="result-image">
              <img :src="emoji.imageUrl" :alt="emoji.name" />
              <a-checkbox
                :checked="selectedEmojis.has(emoji.id)"
                @change="() => toggleSelection(emoji.id)"
                class="result-checkbox"
              />
            </div>

            <a-input
              :value="emoji.name"
              @change="(e: any) => updateEmojiName(emoji.id, e.target.value)"
              placeholder="输入表情名称"
              size="small"
              class="result-name"
            />
          </div>
        </div>

        <div class="results-actions">
          <span class="selected-count" :style="{ color: token.colorTextSecondary }">
            已选择 {{ croppedEmojis.filter(e => selectedEmojis.has(e.id)).length }} 个表情
          </span>

          <a-button
            type="primary"
            @click="confirmUpload"
            :disabled="croppedEmojis.filter(e => selectedEmojis.has(e.id)).length === 0"
          >
            上传到缓冲区
          </a-button>
        </div>
      </div>
    </div>
  </div>
</template>

<style src="./ImageCropper.css"/>
