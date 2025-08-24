/**
 * Enhanced Image Editor with proper canvas positioning and extended functionality
 */

export interface ImageEditorTool {
  id: string
  name: string
  icon: string
  cursor?: string
  options?: Record<string, any>
}

export interface ImageEditorState {
  tool: string
  brushSize: number
  brushColor: string
  fontSize: number
  textInput: string
  opacity: number
  crop: {
    x: number
    y: number
    width: number
    height: number
  } | null
}

export interface TransformState {
  scale: number
  rotation: number
  flipX: boolean
  flipY: boolean
  x: number
  y: number
}

export class EnhancedImageEditor {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private originalImage: HTMLImageElement | null = null
  private currentImage: ImageData | null = null
  private history: ImageData[] = []
  private historyIndex = -1
  private state: ImageEditorState
  private transform: TransformState
  private isDrawing = false
  private lastPoint: { x: number; y: number } | null = null
  private cropOverlay: HTMLDivElement | null = null

  // Available tools
  public readonly tools: ImageEditorTool[] = [
    { id: 'select', name: '选择', icon: '👆', cursor: 'default' },
    { id: 'move', name: '移动', icon: '✋', cursor: 'grab' },
    { id: 'crop', name: '裁剪', icon: '✂️', cursor: 'crosshair' },
    { id: 'brush', name: '画笔', icon: '🖌️', cursor: 'crosshair' },
    { id: 'eraser', name: '橡皮擦', icon: '🧽', cursor: 'crosshair' },
    { id: 'text', name: '文本', icon: '📝', cursor: 'text' },
    { id: 'rectangle', name: '矩形', icon: '⬜', cursor: 'crosshair' },
    { id: 'circle', name: '圆形', icon: '⭕', cursor: 'crosshair' },
    { id: 'line', name: '直线', icon: '📏', cursor: 'crosshair' },
    { id: 'blur', name: '模糊', icon: '🌫️', cursor: 'crosshair' },
    { id: 'sharpen', name: '锐化', icon: '🔍', cursor: 'crosshair' },
    { id: 'clone', name: '克隆', icon: '📋', cursor: 'crosshair' }
  ]

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')!
    
    this.state = {
      tool: 'select',
      brushSize: 5,
      brushColor: '#000000',
      fontSize: 16,
      textInput: '',
      opacity: 1,
      crop: null
    }

    this.transform = {
      scale: 1,
      rotation: 0,
      flipX: false,
      flipY: false,
      x: 0,
      y: 0
    }

    this.setupEventListeners()
    this.updateCanvasSize()
  }

  private setupEventListeners(): void {
    // Mouse events
    this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this))
    this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this))
    this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this))
    this.canvas.addEventListener('wheel', this.handleWheel.bind(this))

    // Touch events for mobile support
    this.canvas.addEventListener('touchstart', this.handleTouchStart.bind(this))
    this.canvas.addEventListener('touchmove', this.handleTouchMove.bind(this))
    this.canvas.addEventListener('touchend', this.handleTouchEnd.bind(this))

    // Keyboard events
    document.addEventListener('keydown', this.handleKeyDown.bind(this))

    // Window resize
    window.addEventListener('resize', this.updateCanvasSize.bind(this))
  }

  private updateCanvasSize(): void {
    const container = this.canvas.parentElement
    if (!container) return

    const rect = container.getBoundingClientRect()
    const devicePixelRatio = window.devicePixelRatio || 1

    // Set canvas size to match container
    this.canvas.width = rect.width * devicePixelRatio
    this.canvas.height = rect.height * devicePixelRatio

    // Scale context to ensure correct drawing operations
    this.ctx.scale(devicePixelRatio, devicePixelRatio)

    // Set CSS size
    this.canvas.style.width = rect.width + 'px'
    this.canvas.style.height = rect.height + 'px'

    this.redraw()
  }

  private getCanvasCoordinates(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect()
    const scaleX = this.canvas.width / rect.width
    const scaleY = this.canvas.height / rect.height

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    }
  }

  private handleMouseDown(event: MouseEvent): void {
    event.preventDefault()
    const coords = this.getCanvasCoordinates(event.clientX, event.clientY)
    this.startDrawing(coords.x, coords.y)
  }

  private handleMouseMove(event: MouseEvent): void {
    if (!this.isDrawing) return
    event.preventDefault()
    const coords = this.getCanvasCoordinates(event.clientX, event.clientY)
    this.continueDrawing(coords.x, coords.y)
  }

  private handleMouseUp(event: MouseEvent): void {
    if (!this.isDrawing) return
    event.preventDefault()
    const coords = this.getCanvasCoordinates(event.clientX, event.clientY)
    this.stopDrawing(coords.x, coords.y)
  }

  private handleTouchStart(event: TouchEvent): void {
    event.preventDefault()
    const touch = event.touches[0]
    const coords = this.getCanvasCoordinates(touch.clientX, touch.clientY)
    this.startDrawing(coords.x, coords.y)
  }

  private handleTouchMove(event: TouchEvent): void {
    if (!this.isDrawing) return
    event.preventDefault()
    const touch = event.touches[0]
    const coords = this.getCanvasCoordinates(touch.clientX, touch.clientY)
    this.continueDrawing(coords.x, coords.y)
  }

  private handleTouchEnd(event: TouchEvent): void {
    if (!this.isDrawing) return
    event.preventDefault()
    this.stopDrawing(0, 0) // Touch coordinates not needed for end
  }

  private handleWheel(event: WheelEvent): void {
    if (event.ctrlKey || event.metaKey) {
      // Zoom with Ctrl+wheel
      event.preventDefault()
      const delta = event.deltaY > 0 ? 0.9 : 1.1
      this.zoom(delta, event.clientX, event.clientY)
    }
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (event.ctrlKey || event.metaKey) {
      switch (event.key.toLowerCase()) {
        case 'z':
          event.preventDefault()
          if (event.shiftKey) {
            this.redo()
          } else {
            this.undo()
          }
          break
        case 'y':
          event.preventDefault()
          this.redo()
          break
        case '+':
        case '=':
          event.preventDefault()
          this.zoom(1.1)
          break
        case '-':
          event.preventDefault()
          this.zoom(0.9)
          break
        case '0':
          event.preventDefault()
          this.resetZoom()
          break
      }
    }
  }

  private startDrawing(x: number, y: number): void {
    this.isDrawing = true
    this.lastPoint = { x, y }

    // Save state for undo
    this.saveState()

    switch (this.state.tool) {
      case 'brush':
        this.startBrush(x, y)
        break
      case 'eraser':
        this.startEraser(x, y)
        break
      case 'crop':
        this.startCrop(x, y)
        break
      case 'text':
        this.placeText(x, y)
        break
      case 'move':
        this.startMove(x, y)
        break
    }
  }

  private continueDrawing(x: number, y: number): void {
    if (!this.isDrawing || !this.lastPoint) return

    switch (this.state.tool) {
      case 'brush':
        this.continueBrush(x, y)
        break
      case 'eraser':
        this.continueEraser(x, y)
        break
      case 'crop':
        this.updateCrop(x, y)
        break
      case 'move':
        this.continueMove(x, y)
        break
      case 'line':
        this.previewLine(x, y)
        break
      case 'rectangle':
        this.previewRectangle(x, y)
        break
      case 'circle':
        this.previewCircle(x, y)
        break
    }

    this.lastPoint = { x, y }
  }

  private stopDrawing(x: number, y: number): void {
    if (!this.isDrawing) return
    this.isDrawing = false

    switch (this.state.tool) {
      case 'line':
        this.drawLine(x, y)
        break
      case 'rectangle':
        this.drawRectangle(x, y)
        break
      case 'circle':
        this.drawCircle(x, y)
        break
      case 'crop':
        this.finalizeCrop()
        break
    }

    this.lastPoint = null
  }

  // Tool implementations
  private startBrush(x: number, y: number): void {
    this.ctx.globalCompositeOperation = 'source-over'
    this.ctx.globalAlpha = this.state.opacity
    this.ctx.strokeStyle = this.state.brushColor
    this.ctx.lineWidth = this.state.brushSize
    this.ctx.lineCap = 'round'
    this.ctx.lineJoin = 'round'
    
    this.ctx.beginPath()
    this.ctx.moveTo(x, y)
  }

  private continueBrush(x: number, y: number): void {
    this.ctx.lineTo(x, y)
    this.ctx.stroke()
  }

  private startEraser(x: number, y: number): void {
    this.ctx.globalCompositeOperation = 'destination-out'
    this.ctx.globalAlpha = this.state.opacity
    this.ctx.lineWidth = this.state.brushSize
    this.ctx.lineCap = 'round'
    this.ctx.lineJoin = 'round'
    
    this.ctx.beginPath()
    this.ctx.moveTo(x, y)
  }

  private continueEraser(x: number, y: number): void {
    this.ctx.lineTo(x, y)
    this.ctx.stroke()
  }

  private startCrop(x: number, y: number): void {
    this.state.crop = { x, y, width: 0, height: 0 }
    this.showCropOverlay()
  }

  private updateCrop(x: number, y: number): void {
    if (!this.state.crop || !this.lastPoint) return
    
    this.state.crop.width = x - this.state.crop.x
    this.state.crop.height = y - this.state.crop.y
    this.updateCropOverlay()
  }

  private finalizeCrop(): void {
    if (!this.state.crop) return

    const { x, y, width, height } = this.state.crop
    
    // Ensure positive dimensions
    const cropX = Math.min(x, x + width)
    const cropY = Math.min(y, y + height)
    const cropWidth = Math.abs(width)
    const cropHeight = Math.abs(height)

    if (cropWidth > 10 && cropHeight > 10) {
      this.applyCrop(cropX, cropY, cropWidth, cropHeight)
    }

    this.hideCropOverlay()
    this.state.crop = null
  }

  private applyCrop(x: number, y: number, width: number, height: number): void {
    const imageData = this.ctx.getImageData(x, y, width, height)
    
    // Resize canvas to crop dimensions
    this.canvas.width = width
    this.canvas.height = height
    
    // Clear and draw cropped content
    this.ctx.clearRect(0, 0, width, height)
    this.ctx.putImageData(imageData, 0, 0)
    
    this.saveState()
  }

  private placeText(x: number, y: number): void {
    if (!this.state.textInput.trim()) return

    this.ctx.globalCompositeOperation = 'source-over'
    this.ctx.globalAlpha = this.state.opacity
    this.ctx.fillStyle = this.state.brushColor
    this.ctx.font = `${this.state.fontSize}px Arial`
    this.ctx.textAlign = 'left'
    this.ctx.textBaseline = 'top'
    
    this.ctx.fillText(this.state.textInput, x, y)
    this.saveState()
  }

  private drawLine(x: number, y: number): void {
    if (!this.lastPoint) return

    this.ctx.globalCompositeOperation = 'source-over'
    this.ctx.globalAlpha = this.state.opacity
    this.ctx.strokeStyle = this.state.brushColor
    this.ctx.lineWidth = this.state.brushSize
    this.ctx.lineCap = 'round'
    
    this.ctx.beginPath()
    this.ctx.moveTo(this.lastPoint.x, this.lastPoint.y)
    this.ctx.lineTo(x, y)
    this.ctx.stroke()
  }

  private drawRectangle(x: number, y: number): void {
    if (!this.lastPoint) return

    const width = x - this.lastPoint.x
    const height = y - this.lastPoint.y

    this.ctx.globalCompositeOperation = 'source-over'
    this.ctx.globalAlpha = this.state.opacity
    this.ctx.strokeStyle = this.state.brushColor
    this.ctx.lineWidth = this.state.brushSize
    
    this.ctx.strokeRect(this.lastPoint.x, this.lastPoint.y, width, height)
  }

  private drawCircle(x: number, y: number): void {
    if (!this.lastPoint) return

    const radius = Math.sqrt(
      Math.pow(x - this.lastPoint.x, 2) + Math.pow(y - this.lastPoint.y, 2)
    )

    this.ctx.globalCompositeOperation = 'source-over'
    this.ctx.globalAlpha = this.state.opacity
    this.ctx.strokeStyle = this.state.brushColor
    this.ctx.lineWidth = this.state.brushSize
    
    this.ctx.beginPath()
    this.ctx.arc(this.lastPoint.x, this.lastPoint.y, radius, 0, 2 * Math.PI)
    this.ctx.stroke()
  }

  private previewLine(x: number, y: number): void {
    this.redraw()
    this.drawLine(x, y)
  }

  private previewRectangle(x: number, y: number): void {
    this.redraw()
    this.drawRectangle(x, y)
  }

  private previewCircle(x: number, y: number): void {
    this.redraw()
    this.drawCircle(x, y)
  }

  private startMove(x: number, y: number): void {
    // Store the current transform for relative movement
  }

  private continueMove(x: number, y: number): void {
    if (!this.lastPoint) return
    
    const deltaX = x - this.lastPoint.x
    const deltaY = y - this.lastPoint.y
    
    this.transform.x += deltaX
    this.transform.y += deltaY
    
    this.redraw()
  }

  // Crop overlay management
  private showCropOverlay(): void {
    if (this.cropOverlay) return

    this.cropOverlay = document.createElement('div')
    this.cropOverlay.className = 'crop-overlay'
    this.cropOverlay.style.cssText = `
      position: absolute;
      border: 2px dashed #fff;
      background: rgba(0,0,0,0.3);
      pointer-events: none;
      z-index: 10;
    `
    
    this.canvas.parentElement?.appendChild(this.cropOverlay)
  }

  private updateCropOverlay(): void {
    if (!this.cropOverlay || !this.state.crop) return

    const rect = this.canvas.getBoundingClientRect()
    const scaleX = rect.width / this.canvas.width
    const scaleY = rect.height / this.canvas.height

    const x = Math.min(this.state.crop.x, this.state.crop.x + this.state.crop.width) * scaleX
    const y = Math.min(this.state.crop.y, this.state.crop.y + this.state.crop.height) * scaleY
    const width = Math.abs(this.state.crop.width) * scaleX
    const height = Math.abs(this.state.crop.height) * scaleY

    this.cropOverlay.style.left = x + 'px'
    this.cropOverlay.style.top = y + 'px'
    this.cropOverlay.style.width = width + 'px'
    this.cropOverlay.style.height = height + 'px'
  }

  private hideCropOverlay(): void {
    if (this.cropOverlay) {
      this.cropOverlay.remove()
      this.cropOverlay = null
    }
  }

  // Transform operations
  public zoom(factor: number, centerX?: number, centerY?: number): void {
    const newScale = Math.max(0.1, Math.min(10, this.transform.scale * factor))
    
    if (centerX !== undefined && centerY !== undefined) {
      // Zoom towards point
      const coords = this.getCanvasCoordinates(centerX, centerY)
      this.transform.x = coords.x - (coords.x - this.transform.x) * (newScale / this.transform.scale)
      this.transform.y = coords.y - (coords.y - this.transform.y) * (newScale / this.transform.scale)
    }
    
    this.transform.scale = newScale
    this.redraw()
  }

  public resetZoom(): void {
    this.transform.scale = 1
    this.transform.x = 0
    this.transform.y = 0
    this.redraw()
  }

  public rotate(degrees: number): void {
    this.transform.rotation = (this.transform.rotation + degrees) % 360
    this.redraw()
  }

  public flip(direction: 'horizontal' | 'vertical'): void {
    if (direction === 'horizontal') {
      this.transform.flipX = !this.transform.flipX
    } else {
      this.transform.flipY = !this.transform.flipY
    }
    this.redraw()
  }

  // State management
  private saveState(): void {
    const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height)
    
    // Remove any states after current index (for branching history)
    this.history = this.history.slice(0, this.historyIndex + 1)
    
    // Add new state
    this.history.push(imageData)
    this.historyIndex = this.history.length - 1
    
    // Limit history size to prevent memory issues
    if (this.history.length > 50) {
      this.history.shift()
      this.historyIndex--
    }
  }

  public undo(): boolean {
    if (this.historyIndex > 0) {
      this.historyIndex--
      const imageData = this.history[this.historyIndex]
      this.ctx.putImageData(imageData, 0, 0)
      return true
    }
    return false
  }

  public redo(): boolean {
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++
      const imageData = this.history[this.historyIndex]
      this.ctx.putImageData(imageData, 0, 0)
      return true
    }
    return false
  }

  public canUndo(): boolean {
    return this.historyIndex > 0
  }

  public canRedo(): boolean {
    return this.historyIndex < this.history.length - 1
  }

  // Image management
  public loadImage(imageFile: File): Promise<void> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const img = new Image()
        img.onload = () => {
          this.originalImage = img
          
          // Resize canvas to fit image
          this.canvas.width = img.width
          this.canvas.height = img.height
          
          // Draw image
          this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
          this.ctx.drawImage(img, 0, 0)
          
          // Reset transform
          this.transform = {
            scale: 1,
            rotation: 0,
            flipX: false,
            flipY: false,
            x: 0,
            y: 0
          }
          
          // Save initial state
          this.history = []
          this.historyIndex = -1
          this.saveState()
          
          resolve()
        }
        img.onerror = () => reject(new Error('Failed to load image'))
        img.src = e.target?.result as string
      }
      reader.onerror = () => reject(new Error('Failed to read file'))
      reader.readAsDataURL(imageFile)
    })
  }

  public exportImage(format: 'png' | 'jpeg' | 'webp' = 'png', quality = 0.9): string {
    return this.canvas.toDataURL(`image/${format}`, quality)
  }

  public exportBlob(format: 'png' | 'jpeg' | 'webp' = 'png', quality = 0.9): Promise<Blob | null> {
    return new Promise(resolve => {
      this.canvas.toBlob(resolve, `image/${format}`, quality)
    })
  }

  private redraw(): void {
    if (!this.originalImage || this.history.length === 0) return

    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    
    // Apply transforms
    this.ctx.save()
    
    // Apply zoom and pan
    this.ctx.scale(this.transform.scale, this.transform.scale)
    this.ctx.translate(this.transform.x, this.transform.y)
    
    // Apply rotation
    if (this.transform.rotation !== 0) {
      this.ctx.translate(this.canvas.width / 2, this.canvas.height / 2)
      this.ctx.rotate((this.transform.rotation * Math.PI) / 180)
      this.ctx.translate(-this.canvas.width / 2, -this.canvas.height / 2)
    }
    
    // Apply flips
    if (this.transform.flipX || this.transform.flipY) {
      this.ctx.scale(
        this.transform.flipX ? -1 : 1,
        this.transform.flipY ? -1 : 1
      )
      this.ctx.translate(
        this.transform.flipX ? -this.canvas.width : 0,
        this.transform.flipY ? -this.canvas.height : 0
      )
    }
    
    // Draw current state
    const currentImageData = this.history[this.historyIndex]
    if (currentImageData) {
      this.ctx.putImageData(currentImageData, 0, 0)
    }
    
    this.ctx.restore()
  }

  // Tool and state management
  public setTool(tool: string): void {
    this.state.tool = tool
    this.hideCropOverlay()
    this.updateCursor()
  }

  public setState(newState: Partial<ImageEditorState>): void {
    this.state = { ...this.state, ...newState }
  }

  public getState(): ImageEditorState {
    return { ...this.state }
  }

  public getTransform(): TransformState {
    return { ...this.transform }
  }

  private updateCursor(): void {
    const tool = this.tools.find(t => t.id === this.state.tool)
    this.canvas.style.cursor = tool?.cursor || 'default'
  }

  // Filters and effects
  public applyFilter(filter: string, intensity = 1): void {
    const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height)
    const data = imageData.data

    switch (filter) {
      case 'grayscale':
        this.applyGrayscale(data, intensity)
        break
      case 'sepia':
        this.applySepia(data, intensity)
        break
      case 'invert':
        this.applyInvert(data, intensity)
        break
      case 'brightness':
        this.applyBrightness(data, intensity)
        break
      case 'contrast':
        this.applyContrast(data, intensity)
        break
      case 'saturation':
        this.applySaturation(data, intensity)
        break
    }

    this.ctx.putImageData(imageData, 0, 0)
    this.saveState()
  }

  private applyGrayscale(data: Uint8ClampedArray, intensity: number): void {
    for (let i = 0; i < data.length; i += 4) {
      const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114
      data[i] = data[i] + (gray - data[i]) * intensity     // Red
      data[i + 1] = data[i + 1] + (gray - data[i + 1]) * intensity // Green
      data[i + 2] = data[i + 2] + (gray - data[i + 2]) * intensity // Blue
    }
  }

  private applySepia(data: Uint8ClampedArray, intensity: number): void {
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      
      const sepiaR = Math.min(255, (r * 0.393) + (g * 0.769) + (b * 0.189))
      const sepiaG = Math.min(255, (r * 0.349) + (g * 0.686) + (b * 0.168))
      const sepiaB = Math.min(255, (r * 0.272) + (g * 0.534) + (b * 0.131))
      
      data[i] = r + (sepiaR - r) * intensity
      data[i + 1] = g + (sepiaG - g) * intensity
      data[i + 2] = b + (sepiaB - b) * intensity
    }
  }

  private applyInvert(data: Uint8ClampedArray, intensity: number): void {
    for (let i = 0; i < data.length; i += 4) {
      data[i] = data[i] + (255 - data[i]) * intensity         // Red
      data[i + 1] = data[i + 1] + (255 - data[i + 1]) * intensity // Green
      data[i + 2] = data[i + 2] + (255 - data[i + 2]) * intensity // Blue
    }
  }

  private applyBrightness(data: Uint8ClampedArray, intensity: number): void {
    const adjustment = intensity * 50 // -50 to +50
    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.max(0, Math.min(255, data[i] + adjustment))     // Red
      data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + adjustment)) // Green
      data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + adjustment)) // Blue
    }
  }

  private applyContrast(data: Uint8ClampedArray, intensity: number): void {
    const factor = (259 * (intensity * 255 + 255)) / (255 * (259 - intensity * 255))
    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.max(0, Math.min(255, factor * (data[i] - 128) + 128))     // Red
      data[i + 1] = Math.max(0, Math.min(255, factor * (data[i + 1] - 128) + 128)) // Green
      data[i + 2] = Math.max(0, Math.min(255, factor * (data[i + 2] - 128) + 128)) // Blue
    }
  }

  private applySaturation(data: Uint8ClampedArray, intensity: number): void {
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      
      const gray = r * 0.299 + g * 0.587 + b * 0.114
      
      data[i] = Math.max(0, Math.min(255, gray + (r - gray) * intensity))
      data[i + 1] = Math.max(0, Math.min(255, gray + (g - gray) * intensity))
      data[i + 2] = Math.max(0, Math.min(255, gray + (b - gray) * intensity))
    }
  }

  public clear(): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    this.saveState()
  }

  public dispose(): void {
    this.hideCropOverlay()
    // Remove event listeners
    this.canvas.removeEventListener('mousedown', this.handleMouseDown)
    this.canvas.removeEventListener('mousemove', this.handleMouseMove)
    this.canvas.removeEventListener('mouseup', this.handleMouseUp)
    this.canvas.removeEventListener('wheel', this.handleWheel)
    this.canvas.removeEventListener('touchstart', this.handleTouchStart)
    this.canvas.removeEventListener('touchmove', this.handleTouchMove)
    this.canvas.removeEventListener('touchend', this.handleTouchEnd)
    document.removeEventListener('keydown', this.handleKeyDown)
    window.removeEventListener('resize', this.updateCanvasSize)
  }
}