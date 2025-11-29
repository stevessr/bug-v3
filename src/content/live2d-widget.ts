/**
 * Live2D Widget Content Script
 * 独立运行的 Live2D 小部件，自动注入到网页中
 */

import { init } from 'l2d'
import type { L2D, Model } from 'l2d'
import './live2d-widget.css'

// 配置选项
interface Live2DConfig {
  modelPath: string
  position: [number, number]
  scale: number | 'auto'
  canvasWidth: number
  canvasHeight: number
  enabled: boolean
}

// 默认配置
const DEFAULT_CONFIG: Live2DConfig = {
  modelPath: 'https://model.hacxy.cn/cat-black/model.json',
  position: [0, 10],
  scale: 0.15,
  canvasWidth: 300,
  canvasHeight: 400,
  enabled: true
}

class Live2DWidget {
  private canvas: HTMLCanvasElement | null = null
  private container: HTMLDivElement | null = null
  private l2d: L2D | null = null
  private model: Model | null = null
  private config: Live2DConfig
  private isDragging = false
  private dragOffset = { x: 0, y: 0 }

  constructor(config: Partial<Live2DConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.init()
  }

  /**
   * 初始化 Live2D Widget
   */
  private async init(): Promise<void> {
    if (!this.config.enabled) {
      console.log('[Live2D] Widget is disabled')
      return
    }

    // 检查是否已经存在 Live2D Widget
    if (document.getElementById('live2d-widget-container')) {
      console.log('[Live2D] Widget already exists')
      return
    }

    try {
      // 创建容器和 canvas
      this.createElements()

      // 等待 DOM 完全加载
      if (document.readyState === 'loading') {
        await new Promise(resolve => {
          document.addEventListener('DOMContentLoaded', resolve, { once: true })
        })
      }

      // 初始化 Live2D
      await this.initLive2D()

      // 添加交互功能
      this.addInteractions()

      console.log('[Live2D] Widget initialized successfully')
    } catch (error) {
      console.error('[Live2D] Failed to initialize widget:', error)
    }
  }

  /**
   * 创建 DOM 元素
   */
  private createElements(): void {
    // 创建容器
    this.container = document.createElement('div')
    this.container.id = 'live2d-widget-container'
    this.container.className = 'live2d-widget-container'

    // 创建 canvas
    this.canvas = document.createElement('canvas')
    this.canvas.id = 'live2d-widget-canvas'
    this.canvas.className = 'live2d-widget-canvas'
    this.canvas.width = this.config.canvasWidth
    this.canvas.height = this.config.canvasHeight

    // 创建控制按钮容器
    const controls = document.createElement('div')
    controls.className = 'live2d-widget-controls'

    // 关闭按钮
    const closeBtn = document.createElement('button')
    closeBtn.className = 'live2d-widget-btn live2d-widget-close'
    closeBtn.innerHTML = '×'
    closeBtn.title = '关闭 Live2D'
    closeBtn.onclick = () => this.hide()

    // 最小化按钮
    const minimizeBtn = document.createElement('button')
    minimizeBtn.className = 'live2d-widget-btn live2d-widget-minimize'
    minimizeBtn.innerHTML = '−'
    minimizeBtn.title = '最小化'
    minimizeBtn.onclick = () => this.toggleMinimize()

    controls.appendChild(minimizeBtn)
    controls.appendChild(closeBtn)

    // 组装元素
    this.container.appendChild(this.canvas)
    this.container.appendChild(controls)

    // 添加到页面
    document.body.appendChild(this.container)
  }

  /**
   * 初始化 Live2D 模型
   */
  private async initLive2D(): Promise<void> {
    if (!this.canvas) {
      throw new Error('Canvas element not found')
    }

    try {
      // 初始化 L2D 画布
      this.l2d = init(this.canvas)

      // 加载模型
      console.log('[Live2D] Loading model from:', this.config.modelPath)
      
      this.model = await this.l2d.create({
        path: this.config.modelPath,
        position: this.config.position,
        scale: this.config.scale
      })

      console.log('[Live2D] Model loaded successfully')

      // 添加模型事件监听
      this.model.on('ready', () => {
        console.log('[Live2D] Model is ready')
      })

      // 点击模型时触发动作
      if (this.canvas) {
        this.canvas.addEventListener('click', (e) => {
          if (!this.isDragging && this.model) {
            // 触发随机动作或表情
            console.log('[Live2D] Model clicked')
          }
        })
      }
    } catch (error) {
      console.error('[Live2D] Failed to load model:', error)
      throw error
    }
  }

  /**
   * 添加交互功能（拖拽）
   */
  private addInteractions(): void {
    if (!this.container) return

    // 拖拽功能
    this.container.addEventListener('mousedown', (e) => {
      // 只在点击容器顶部时才允许拖拽
      const target = e.target as HTMLElement
      if (target.className.includes('live2d-widget-canvas') || 
          target.className.includes('live2d-widget-controls')) {
        this.isDragging = true
        this.dragOffset.x = e.clientX - this.container!.offsetLeft
        this.dragOffset.y = e.clientY - this.container!.offsetTop
        this.container!.style.cursor = 'grabbing'
      }
    })

    document.addEventListener('mousemove', (e) => {
      if (this.isDragging && this.container) {
        const x = e.clientX - this.dragOffset.x
        const y = e.clientY - this.dragOffset.y
        
        // 限制在视口内
        const maxX = window.innerWidth - this.container.offsetWidth
        const maxY = window.innerHeight - this.container.offsetHeight
        
        this.container.style.left = Math.max(0, Math.min(x, maxX)) + 'px'
        this.container.style.top = Math.max(0, Math.min(y, maxY)) + 'px'
      }
    })

    document.addEventListener('mouseup', () => {
      if (this.isDragging) {
        this.isDragging = false
        if (this.container) {
          this.container.style.cursor = 'grab'
        }
      }
    })

    // 触摸设备支持
    this.container.addEventListener('touchstart', (e) => {
      const touch = e.touches[0]
      this.isDragging = true
      this.dragOffset.x = touch.clientX - this.container!.offsetLeft
      this.dragOffset.y = touch.clientY - this.container!.offsetTop
    })

    document.addEventListener('touchmove', (e) => {
      if (this.isDragging && this.container) {
        const touch = e.touches[0]
        const x = touch.clientX - this.dragOffset.x
        const y = touch.clientY - this.dragOffset.y
        
        const maxX = window.innerWidth - this.container.offsetWidth
        const maxY = window.innerHeight - this.container.offsetHeight
        
        this.container.style.left = Math.max(0, Math.min(x, maxX)) + 'px'
        this.container.style.top = Math.max(0, Math.min(y, maxY)) + 'px'
      }
    })

    document.addEventListener('touchend', () => {
      this.isDragging = false
    })
  }

  /**
   * 隐藏 Widget
   */
  private hide(): void {
    if (this.container) {
      this.container.style.display = 'none'
      console.log('[Live2D] Widget hidden')
    }
  }

  /**
   * 显示 Widget
   */
  public show(): void {
    if (this.container) {
      this.container.style.display = 'block'
      console.log('[Live2D] Widget shown')
    }
  }

  /**
   * 切换最小化状态
   */
  private toggleMinimize(): void {
    if (this.container) {
      this.container.classList.toggle('minimized')
    }
  }

  /**
   * 销毁 Widget
   */
  public destroy(): void {
    if (this.container) {
      this.container.remove()
      this.container = null
    }
    this.canvas = null
    this.l2d = null
    this.model = null
    console.log('[Live2D] Widget destroyed')
  }

  /**
   * 更新配置
   */
  public updateConfig(newConfig: Partial<Live2DConfig>): void {
    this.config = { ...this.config, ...newConfig }
    // 重新初始化
    this.destroy()
    this.init()
  }
}

// 自动初始化
let widget: Live2DWidget | null = null

// 等待页面加载完成后初始化
const initWidget = () => {
  try {
    // 检查是否应该在当前页面启用
    const shouldEnable = checkIfShouldEnable()
    
    if (shouldEnable) {
      widget = new Live2DWidget()
      console.log('[Live2D] Widget auto-initialized')
    }
  } catch (error) {
    console.error('[Live2D] Failed to auto-initialize:', error)
  }
}

/**
 * 检查是否应该在当前页面启用 Live2D
 */
function checkIfShouldEnable(): boolean {
  // 默认启用
  // 可以添加黑名单或白名单逻辑
  const blacklist = ['localhost', '127.0.0.1']
  const hostname = window.location.hostname
  
  // 如果在黑名单中，不启用
  if (blacklist.some(domain => hostname.includes(domain))) {
    console.log('[Live2D] Disabled on:', hostname)
    return false
  }

  return true
}

// 页面加载完成后自动初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initWidget)
} else {
  initWidget()
}

// 导出供外部调用
export { Live2DWidget, widget }
