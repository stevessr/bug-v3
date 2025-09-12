import type { AddEmojiButtonData } from './types'
import { ButtonState } from './types'
import { BUTTON_CONFIG, CONSTANTS, generateButtonId } from './config'
import { performPixivAddEmojiFlow } from './helpers'
import { logger, safeExecuteSync } from './utils'

/**
 * 按钮状态管理类
 */
class EmojiButtonManager {
  private button: HTMLElement
  private data: AddEmojiButtonData
  private isRunning: boolean = false
  private originalContent: string = ''
  private originalStyle: string = ''
  private timeoutId: NodeJS.Timeout | null = null

  constructor(button: HTMLElement, data: AddEmojiButtonData) {
    this.button = button
    this.data = data
    this.originalContent = button.innerHTML
    this.originalStyle = button.style.cssText
  }

  // 设置按钮状态
  private setState(state: ButtonState): void {
    const config = BUTTON_CONFIG

    switch (state) {
      case ButtonState.LOADING:
        this.button.innerHTML = `${config.icons.loading}${config.texts.loading}`
        this.button.style.cssText = this.originalStyle + ';' + config.styles.loading
        break

      case ButtonState.SUCCESS:
        this.button.innerHTML = `${config.icons.success}${config.texts.success}`
        this.button.style.cssText = this.originalStyle + ';' + config.styles.success
        break

      case ButtonState.ERROR:
        this.button.innerHTML = `${config.icons.error}${config.texts.error}`
        this.button.style.cssText = this.originalStyle + ';' + config.styles.error
        break

      case ButtonState.OPENED:
        this.button.innerHTML = `${config.icons.opened}${config.texts.opened}`
        this.button.style.cssText = this.originalStyle + ';' + config.styles.opened
        break

      default:
        this.button.innerHTML = this.originalContent
        this.button.style.cssText = this.originalStyle
    }
  }

  // 重置按钮状态
  private resetState(): void {
    this.setState(ButtonState.NORMAL)
    this.button.style.pointerEvents = 'auto'
    this.isRunning = false
  }

  // 处理点击事件
  public async handleClick(event: Event): Promise<void> {
    // 阻止事件传播
    safeExecuteSync(() => {
      event.preventDefault()
      event.stopPropagation()
    }, '事件阻止')

    if (this.isRunning) return

    this.isRunning = true
    this.button.style.pointerEvents = 'none'
    this.setState(ButtonState.LOADING)

    try {
      const response = await performPixivAddEmojiFlow(this.data)

      if (response && response.success) {
        logger.info('表情添加成功:', response)

        if (response.source === 'opened') {
          this.setState(ButtonState.OPENED)
        } else {
          this.setState(ButtonState.SUCCESS)
        }
      } else {
        const errorMessage =
          typeof response === 'object' && response !== null
            ? (response as any).error || (response as any).message || '添加表情失败'
            : '添加表情失败'
        throw new Error(String(errorMessage))
      }

      // 设置自动重置
      this.scheduleReset()
    } catch (error) {
      logger.error('添加表情失败:', error)
      this.setState(ButtonState.ERROR)
      this.scheduleReset()
    }
  }

  // 安排自动重置
  private scheduleReset(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId)
    }

    this.timeoutId = setTimeout(() => {
      this.resetState()
    }, CONSTANTS.DEFAULTS.BUTTON_TIMEOUT)
  }

  // 清理资源
  public destroy(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId)
      this.timeoutId = null
    }
  }
}

// 设置按钮点击处理器
export function setupButtonClickHandler(button: HTMLElement, data: AddEmojiButtonData): void {
  const manager = new EmojiButtonManager(button, data)

  const handleClick = (event: Event) => manager.handleClick(event)

  button.addEventListener('pointerdown', handleClick)
  button.addEventListener('click', handleClick)

  // 存储管理器引用以便后续清理
  ;(button as any).__emojiButtonManager = manager
}

// 创建Pixiv表情按钮
export function createPixivEmojiButton(data: AddEmojiButtonData): HTMLElement {
  const button = document.createElement('button')
  const config = BUTTON_CONFIG
  const buttonId = generateButtonId()

  // 设置基本属性
  button.type = 'button'
  button.className = config.className
  button.id = buttonId
  button.style.cssText = config.styles.base
  button.innerHTML = `${config.icons.normal}${config.texts.normal}`
  button.title = '添加表情到收藏'

  // 设置数据属性
  safeExecuteSync(() => {
    button.dataset.emojiName = data.name
    button.dataset.emojiUrl = data.url
  }, '设置数据属性')

  // 设置事件处理器
  setupButtonClickHandler(button, data)

  return button
}
