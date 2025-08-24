class ImageEditor {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private currentImage: HTMLImageElement | null = null
  private history: ImageData[] = []
  private isDrawing = false
  private currentTool = 'select'
  private brushSize = 5
  private brushColor = '#000000'

  constructor() {
    this.canvas = document.getElementById('editor-canvas') as HTMLCanvasElement
    this.ctx = this.canvas.getContext('2d')!
    this.setupCanvas()
    this.setupEventListeners()
  }

  private setupCanvas() {
    this.canvas.width = 800
    this.canvas.height = 600
    this.ctx.fillStyle = '#ffffff'
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)
    this.saveState()
  }

  private setupEventListeners() {
    // Tool selection
    document.querySelectorAll('.tool-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tool = (e.target as HTMLElement).dataset.tool
        if (tool) {
          this.setTool(tool)
        }
      })
    })

    // Canvas events
    this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this))
    this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this))
    this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this))
    this.canvas.addEventListener('mouseleave', this.handleMouseUp.bind(this))

    // File input
    const fileInput = document.getElementById('file-input') as HTMLInputElement
    fileInput?.addEventListener('change', this.handleFileLoad.bind(this))

    // Adjustment controls
    this.setupAdjustmentControls()

    // Action buttons
    document.getElementById('undo-btn')?.addEventListener('click', this.undo.bind(this))
    document.getElementById('reset-btn')?.addEventListener('click', this.reset.bind(this))
    document.getElementById('save-btn')?.addEventListener('click', this.save.bind(this))

    // Brush controls
    const brushSizeInput = document.getElementById('brush-size') as HTMLInputElement
    brushSizeInput?.addEventListener('input', (e) => {
      this.brushSize = parseInt((e.target as HTMLInputElement).value)
    })

    const brushColorInput = document.getElementById('brush-color') as HTMLInputElement
    brushColorInput?.addEventListener('input', (e) => {
      this.brushColor = (e.target as HTMLInputElement).value
    })

    // Zoom controls
    document.getElementById('zoom-in')?.addEventListener('click', () => this.zoom(1.2))
    document.getElementById('zoom-out')?.addEventListener('click', () => this.zoom(0.8))
    document.getElementById('zoom-reset')?.addEventListener('click', () => this.resetZoom())
    document.getElementById('zoom-fit')?.addEventListener('click', () => this.fitToScreen())
  }

  private setTool(tool: string) {
    this.currentTool = tool
    document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'))
    document.querySelector(`[data-tool="${tool}"]`)?.classList.add('active')
    
    // Update cursor
    switch (tool) {
      case 'brush':
        this.canvas.style.cursor = 'crosshair'
        break
      case 'eraser':
        this.canvas.style.cursor = 'crosshair'
        break
      case 'crop':
        this.canvas.style.cursor = 'crosshair'
        break
      default:
        this.canvas.style.cursor = 'default'
    }
  }

  private handleMouseDown(e: MouseEvent) {
    const rect = this.canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    this.isDrawing = true

    switch (this.currentTool) {
      case 'brush':
        this.startDrawing(x, y)
        break
      case 'eraser':
        this.startErasing(x, y)
        break
    }
  }

  private handleMouseMove(e: MouseEvent) {
    if (!this.isDrawing) return

    const rect = this.canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    switch (this.currentTool) {
      case 'brush':
        this.draw(x, y)
        break
      case 'eraser':
        this.erase(x, y)
        break
    }
  }

  private handleMouseUp() {
    if (this.isDrawing) {
      this.isDrawing = false
      this.saveState()
    }
  }

  private startDrawing(x: number, y: number) {
    this.ctx.beginPath()
    this.ctx.moveTo(x, y)
    this.ctx.lineWidth = this.brushSize
    this.ctx.lineCap = 'round'
    this.ctx.strokeStyle = this.brushColor
    this.ctx.globalCompositeOperation = 'source-over'
  }

  private draw(x: number, y: number) {
    this.ctx.lineTo(x, y)
    this.ctx.stroke()
  }

  private startErasing(x: number, y: number) {
    this.ctx.globalCompositeOperation = 'destination-out'
    this.ctx.beginPath()
    this.ctx.arc(x, y, this.brushSize / 2, 0, Math.PI * 2)
    this.ctx.fill()
  }

  private erase(x: number, y: number) {
    this.ctx.beginPath()
    this.ctx.arc(x, y, this.brushSize / 2, 0, Math.PI * 2)
    this.ctx.fill()
  }

  private handleFileLoad(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const img = new Image()
      img.onload = () => {
        this.currentImage = img
        this.canvas.width = img.width
        this.canvas.height = img.height
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
        this.ctx.drawImage(img, 0, 0)
        this.saveState()
      }
      img.src = event.target?.result as string
    }
    reader.readAsDataURL(file)
  }

  private setupAdjustmentControls() {
    const adjustments = ['brightness', 'contrast', 'saturation', 'hue']
    
    adjustments.forEach(adjustment => {
      const slider = document.getElementById(`${adjustment}-slider`) as HTMLInputElement
      slider?.addEventListener('input', () => {
        this.applyAdjustments()
      })
    })

    // Filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const filter = (e.target as HTMLElement).dataset.filter
        if (filter) {
          this.applyFilter(filter)
        }
      })
    })
  }

  private applyAdjustments() {
    if (!this.currentImage) return

    const brightness = (document.getElementById('brightness-slider') as HTMLInputElement)?.value || '0'
    const contrast = (document.getElementById('contrast-slider') as HTMLInputElement)?.value || '0'
    const saturation = (document.getElementById('saturation-slider') as HTMLInputElement)?.value || '0'
    const hue = (document.getElementById('hue-slider') as HTMLInputElement)?.value || '0'

    this.ctx.filter = `brightness(${100 + parseInt(brightness)}%) contrast(${100 + parseInt(contrast)}%) saturate(${100 + parseInt(saturation)}%) hue-rotate(${hue}deg)`
    
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    this.ctx.drawImage(this.currentImage, 0, 0)
    
    this.ctx.filter = 'none'
  }

  private applyFilter(filter: string) {
    if (!this.currentImage) return

    let filterValue = ''
    switch (filter) {
      case 'grayscale':
        filterValue = 'grayscale(100%)'
        break
      case 'sepia':
        filterValue = 'sepia(100%)'
        break
      case 'blur':
        filterValue = 'blur(2px)'
        break
      case 'sharpen':
        // Sharpen effect using convolution
        this.applySharpenFilter()
        return
      case 'vintage':
        filterValue = 'sepia(50%) contrast(120%) brightness(110%)'
        break
    }

    this.ctx.filter = filterValue
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    this.ctx.drawImage(this.currentImage, 0, 0)
    this.ctx.filter = 'none'
    this.saveState()
  }

  private applySharpenFilter() {
    const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height)
    const data = imageData.data
    const width = imageData.width
    const height = imageData.height

    // Sharpen kernel
    const kernel = [
      0, -1, 0,
      -1, 5, -1,
      0, -1, 0
    ]

    const newData = new Uint8ClampedArray(data)

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        for (let c = 0; c < 3; c++) {
          let sum = 0
          for (let ky = -1; ky <= 1; ky++) {
            for (let kx = -1; kx <= 1; kx++) {
              const idx = ((y + ky) * width + (x + kx)) * 4 + c
              sum += data[idx] * kernel[(ky + 1) * 3 + (kx + 1)]
            }
          }
          newData[(y * width + x) * 4 + c] = Math.max(0, Math.min(255, sum))
        }
      }
    }

    const newImageData = new ImageData(newData, width, height)
    this.ctx.putImageData(newImageData, 0, 0)
    this.saveState()
  }

  private saveState() {
    const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height)
    this.history.push(imageData)
    if (this.history.length > 20) {
      this.history.shift()
    }
  }

  private undo() {
    if (this.history.length > 1) {
      this.history.pop()
      const previousState = this.history[this.history.length - 1]
      this.ctx.putImageData(previousState, 0, 0)
    }
  }

  private reset() {
    if (this.currentImage) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
      this.ctx.drawImage(this.currentImage, 0, 0)
      this.saveState()
    }
  }

  private save() {
    const link = document.createElement('a')
    link.download = 'edited-image.png'
    link.href = this.canvas.toDataURL()
    link.click()
  }

  private zoom(factor: number) {
    const rect = this.canvas.getBoundingClientRect()
    const newWidth = rect.width * factor
    const newHeight = rect.height * factor
    
    this.canvas.style.width = newWidth + 'px'
    this.canvas.style.height = newHeight + 'px'
  }

  private resetZoom() {
    this.canvas.style.width = this.canvas.width + 'px'
    this.canvas.style.height = this.canvas.height + 'px'
  }

  private fitToScreen() {
    const container = document.getElementById('canvas-container')
    if (!container) return

    const containerRect = container.getBoundingClientRect()
    const scaleX = (containerRect.width - 40) / this.canvas.width
    const scaleY = (containerRect.height - 40) / this.canvas.height
    const scale = Math.min(scaleX, scaleY)
    
    this.canvas.style.width = (this.canvas.width * scale) + 'px'
    this.canvas.style.height = (this.canvas.height * scale) + 'px'
  }
}

// Initialize the image editor when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new ImageEditor()
})