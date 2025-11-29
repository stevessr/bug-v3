import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import type { Ref } from 'vue'

import type { AppSettings } from '@/types/type'

export interface CroppedEmoji {
  id: string
  name: string
  imageUrl: string
  x: number
  y: number
  width: number
  height: number
}

export function useImageCropper(
  props: {
    imageFile: Ref<File | undefined>
    aiSettings: Ref<AppSettings | undefined>
  },
  emit: (event: 'upload' | 'close', ...args: any[]) => void,
  refs: {
    canvasRef: Ref<HTMLCanvasElement | undefined>
    containerRef: Ref<HTMLDivElement | undefined>
    imageElement: Ref<HTMLImageElement | undefined>
  }
) {
  // State
  const activeTab = ref<'manual' | 'ai' | 'custom'>('manual')
  const gridCols = ref(2)
  const gridRows = ref(2)
  const isLoading = ref(false)
  const isProcessing = ref(false)
  const showCropper = ref(false)
  const uploadedImageUrl = ref('')

  const baseScale = ref(1)
  const zoomLevel = ref(1)
  const minZoom = 0.1
  const maxZoom = 5
  const containerSize = ref({ width: 0, height: 0 })

  const croppedEmojis = ref<CroppedEmoji[]>([])
  const selectedEmojis = ref<Set<string>>(new Set())
  const activeResultKey = ref(['1'])

  // Resize state
  const resizingId = ref<string | null>(null)
  const resizeHandle = ref<'tl' | 'tr' | 'bl' | 'br' | null>(null)
  const startPos = ref({ x: 0, y: 0 })
  const startRect = ref({ x: 0, y: 0, width: 0, height: 0 })

  // Drawing state
  const isDrawing = ref(false)
  const drawingStart = ref({ x: 0, y: 0 })

  // Moving state
  const isMoving = ref(false)
  const movingId = ref<string | null>(null)
  const moveStartPos = ref({ x: 0, y: 0 })
  const moveStartRect = ref({ x: 0, y: 0 })
  const hasMoved = ref(false)

  // Computed
  const displayScale = computed(() => baseScale.value * zoomLevel.value)

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
      (activeTab.value === 'ai' && props.aiSettings.value?.geminiApiKey)
    )
  })

  // Core functions
  const cropImage = (position: { x: number; y: number; width: number; height: number }) => {
    if (!refs.imageElement.value || !refs.canvasRef.value) return null

    const canvas = refs.canvasRef.value
    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    const actualX = (position.x / 100) * refs.imageElement.value.width
    const actualY = (position.y / 100) * refs.imageElement.value.height
    const actualWidth = (position.width / 100) * refs.imageElement.value.width
    const actualHeight = (position.height / 100) * refs.imageElement.value.height

    const tempCanvas = document.createElement('canvas')
    tempCanvas.width = actualWidth
    tempCanvas.height = actualHeight
    const tempCtx = tempCanvas.getContext('2d')

    if (!tempCtx) return null

    tempCtx.drawImage(
      refs.imageElement.value,
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
    if (!refs.imageElement.value) return null

    const maskCanvas = document.createElement('canvas')
    const maskCtx = maskCanvas.getContext('2d')
    if (!maskCtx) return null

    const maskImage = new Image()
    await new Promise(resolve => {
      maskImage.onload = resolve
      maskImage.src = maskBase64.startsWith('data:image')
        ? maskBase64
        : `data:image/png;base64,${maskBase64}`
    })

    const actualX = (position.x / 100) * refs.imageElement.value.width
    const actualY = (position.y / 100) * refs.imageElement.value.height
    const actualWidth = (position.width / 100) * refs.imageElement.value.width
    const actualHeight = (position.height / 100) * refs.imageElement.value.height

    maskCanvas.width = actualWidth
    maskCanvas.height = actualHeight
    maskCtx.drawImage(maskImage, 0, 0, actualWidth, actualHeight)

    const finalCanvas = document.createElement('canvas')
    finalCanvas.width = actualWidth
    finalCanvas.height = actualHeight
    const finalCtx = finalCanvas.getContext('2d')
    if (!finalCtx) return null

    finalCtx.drawImage(
      refs.imageElement.value,
      actualX,
      actualY,
      actualWidth,
      actualHeight,
      0,
      0,
      actualWidth,
      actualHeight
    )

    finalCtx.globalCompositeOperation = 'destination-in'
    finalCtx.drawImage(maskCanvas, 0, 0)

    return finalCanvas.toDataURL('image/png')
  }

  const initCanvas = async () => {
    if (!props.imageFile.value) return

    uploadedImageUrl.value = URL.createObjectURL(props.imageFile.value)

    await nextTick()
    if (!refs.containerRef.value) return

    const container = refs.containerRef.value
    const rect = container.getBoundingClientRect()
    containerSize.value = { width: rect.width, height: rect.height }

    if (!refs.imageElement.value) {
      refs.imageElement.value = new Image()
      await new Promise((resolve, reject) => {
        refs.imageElement.value!.onload = resolve
        refs.imageElement.value!.onerror = reject
        refs.imageElement.value!.src = uploadedImageUrl.value
      })
    }

    const maxWidth = rect.width - 40
    const maxHeight = rect.height - 40

    const scaleX = maxWidth / refs.imageElement.value.width
    const scaleY = maxHeight / refs.imageElement.value.height
    baseScale.value = Math.min(scaleX, scaleY, 1)
    zoomLevel.value = 1

    showCropper.value = true

    if (refs.canvasRef.value) {
      refs.canvasRef.value.width = refs.imageElement.value.width
      refs.canvasRef.value.height = refs.imageElement.value.height
      await nextTick()
    }
  }

  // Interaction functions
  const toggleSelection = (id: string) => {
    if (selectedEmojis.value.has(id)) {
      selectedEmojis.value.delete(id)
      // Custom mode self-destruct logic: if deselected, remove it
      if (activeTab.value === 'custom') {
        croppedEmojis.value = croppedEmojis.value.filter(e => e.id !== id)
      }
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

  // Resize Logic
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
      ((e.clientX - startPos.value.x) /
        ((refs.imageElement.value?.width || 1) * displayScale.value)) *
      100
    const deltaY =
      ((e.clientY - startPos.value.y) /
        ((refs.imageElement.value?.height || 1) * displayScale.value)) *
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

    emoji.x = Math.max(0, Math.min(100, newX))
    emoji.y = Math.max(0, Math.min(100, newY))
    emoji.width = Math.max(0, Math.min(100 - emoji.x, newWidth))
    emoji.height = Math.max(0, Math.min(100 - emoji.y, newHeight))
  }

  const stopResize = async () => {
    if (resizingId.value) {
      const emoji = croppedEmojis.value.find(e => e.id === resizingId.value)
      if (emoji) {
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

  // Drawing functions
  const startDraw = (e: MouseEvent) => {
    // Only start drawing if clicking on the background (not on an existing box)
    // AND in custom mode. AI mode drawing is forbidden.
    if (activeTab.value !== 'custom' || (e.target as HTMLElement).closest('.ai-box')) return

    e.preventDefault()
    isDrawing.value = true
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()

    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100

    drawingStart.value = { x, y }

    const newId = `manual-${Date.now()}`
    const newEmoji: CroppedEmoji = {
      id: newId,
      name: `表情_${croppedEmojis.value.length + 1}`,
      imageUrl: '',
      x: x,
      y: y,
      width: 0,
      height: 0
    }

    croppedEmojis.value.push(newEmoji)
    resizingId.value = newId

    window.addEventListener('mousemove', handleDraw)
    window.addEventListener('mouseup', stopDraw)
  }

  const handleDraw = (e: MouseEvent) => {
    if (!isDrawing.value || !resizingId.value) return

    const container = refs.containerRef.value
    if (!container) return

    const emoji = croppedEmojis.value.find(e => e.id === resizingId.value)
    if (!emoji) return

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
        if (emoji.width < 1 || emoji.height < 1) {
          croppedEmojis.value = croppedEmojis.value.filter(e => e.id !== resizingId.value)
        } else {
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
    if ((e.target as HTMLElement).classList.contains('resize-handle')) return

    // Allow moving in AI or Custom mode
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

    const deltaX =
      ((e.clientX - moveStartPos.value.x) /
        ((refs.imageElement.value?.width || 1) * displayScale.value)) *
      100
    const deltaY =
      ((e.clientY - moveStartPos.value.y) /
        ((refs.imageElement.value?.height || 1) * displayScale.value)) *
      100

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

  // Process functions
  const processManualCrop = async () => {
    if (!refs.imageElement.value || selectedEmojis.value.size === 0) return

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

  const processAICrop = async () => {
    if (!props.aiSettings.value?.geminiApiKey) {
      throw new Error('需要配置 Gemini API 密钥')
    }

    isProcessing.value = true

    try {
      const base64Image = await new Promise<string>(resolve => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        if (props.imageFile.value) {
          reader.readAsDataURL(props.imageFile.value)
        }
      })

      const modelName = props.aiSettings.value.geminiModel
      const isRobotics = modelName === 'gemini-robotics-er-1.5-preview'
      const language = props.aiSettings.value.geminiLanguage || 'Chinese'

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
        `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${props.aiSettings.value.geminiApiKey}`,
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
                      mime_type: props.imageFile.value!.type,
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

              const x = x0 / 10
              const y = y0 / 10
              const width = (x1 - x0) / 10
              const height = (y1 - y0) / 10

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
    if (uploadedImageUrl.value) {
      URL.revokeObjectURL(uploadedImageUrl.value)
    }
    emit('close')
  }

  // Watchers & Hooks
  onMounted(() => {
    initCanvas()
  })

  watch(
    () => props.imageFile.value,
    () => {
      initCanvas()
    }
  )

  return {
    activeTab,
    gridCols,
    gridRows,
    isLoading,
    isProcessing,
    showCropper,
    uploadedImageUrl,
    baseScale,
    zoomLevel,
    minZoom,
    maxZoom,
    containerSize,
    croppedEmojis,
    selectedEmojis,
    activeResultKey,
    displayScale,
    gridPositions,
    canProcess,
    handleZoom,
    resetZoom,
    handleWheel,
    toggleSelection,
    selectAll,
    deselectAll,
    processImage,
    updateEmojiName,
    confirmUpload,
    close,
    startDraw,
    startResize,
    startMove
  }
}
