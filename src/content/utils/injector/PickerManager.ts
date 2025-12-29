/**
 * PickerManager - 管理 Emoji Picker 的生命周期
 * 负责创建、显示、隐藏和清理 Picker
 */

import { createEmojiPicker } from '../../discourse/utils/picker'
import { createE, DQS } from '../createEl'
import { animateEnter, animateExit, ANIMATION_DURATION } from '../animation'

export class PickerManager {
  private currentPicker: HTMLElement | null = null
  private clickOutsideController: AbortController | null = null
  private isAnimating = false

  /**
   * 清理点击外部监听器
   */
  private cleanupClickOutsideListener() {
    if (this.clickOutsideController) {
      this.clickOutsideController.abort()
      this.clickOutsideController = null
    }
  }

  /**
   * 创建点击外部处理器
   */
  private createClickOutsideHandler(button: HTMLElement) {
    return (e: Event) => {
      if (
        this.currentPicker &&
        !this.currentPicker.contains(e.target as Node) &&
        e.target !== button
      ) {
        this.closeDesktopPicker()
      }
    }
  }

  /**
   * 关闭桌面端 Picker
   */
  closeDesktopPicker(onComplete?: () => void) {
    if (!this.currentPicker || this.isAnimating) return

    this.isAnimating = true
    const pickerToClose = this.currentPicker
    this.currentPicker = null
    this.cleanupClickOutsideListener()

    // 调用 picker 的 cleanup 方法清理资源
    if (typeof (pickerToClose as any).__cleanup === 'function') {
      ;(pickerToClose as any).__cleanup()
    }

    animateExit(pickerToClose, 'picker', () => {
      this.isAnimating = false
      onComplete?.()
    })
  }

  /**
   * 关闭移动端 Picker
   */
  closeMobilePicker(onComplete?: () => void) {
    if (!this.currentPicker || this.isAnimating) return

    this.isAnimating = true
    const pickerToClose = this.currentPicker
    this.currentPicker = null

    const modalContainer = DQS('.modal-container')
    if (modalContainer) {
      const backdrop = modalContainer.querySelector('.d-modal__backdrop') as HTMLElement | null
      if (backdrop) {
        animateExit(backdrop, 'backdrop')
      }
    }

    animateExit(pickerToClose, 'modal', () => {
      this.isAnimating = false
      onComplete?.()
    })
  }

  /**
   * 注入桌面端 Picker
   */
  async injectDesktopPicker(button: HTMLElement) {
    if (this.isAnimating) return

    this.currentPicker = await createEmojiPicker(false)
    const buttonRect = button.getBoundingClientRect()
    const pickerElement = this.currentPicker

    if (!pickerElement) return

    document.body.appendChild(pickerElement)

    // 自适应定位
    pickerElement.style.position = 'fixed'
    const margin = 8
    const vpWidth = window.innerWidth
    const vpHeight = window.innerHeight

    pickerElement.style.top = buttonRect.bottom + margin + 'px'
    pickerElement.style.left = buttonRect.left + 'px'

    const pickerRect = pickerElement.getBoundingClientRect()
    const spaceBelow = vpHeight - buttonRect.bottom
    const neededHeight = pickerRect.height + margin
    let top = buttonRect.bottom + margin

    if (spaceBelow < neededHeight) {
      top = Math.max(margin, buttonRect.top - pickerRect.height - margin)
    }

    let left = buttonRect.left
    if (left + pickerRect.width + margin > vpWidth) {
      left = Math.max(margin, vpWidth - pickerRect.width - margin)
    }
    if (left < margin) left = margin

    pickerElement.style.top = top + 'px'
    pickerElement.style.left = left + 'px'

    animateEnter(pickerElement, 'picker')

    // 使用 AbortController 管理事件监听器
    this.cleanupClickOutsideListener()
    this.clickOutsideController = new AbortController()
    const handler = this.createClickOutsideHandler(button)

    setTimeout(() => {
      document.addEventListener('click', handler, { signal: this.clickOutsideController?.signal })
    }, 100)
  }

  /**
   * 注入移动端 Picker
   */
  async injectMobilePicker() {
    if (this.isAnimating) return

    const picker = await createEmojiPicker(true)

    let modalContainer = DQS('.modal-container')
    if (!modalContainer) {
      modalContainer = createE('div', { class: 'modal-container' })
      document.body.appendChild(modalContainer)
    }

    modalContainer.innerHTML = ''

    const backdrop = createE('div', { class: 'd-modal__backdrop emoji-backdrop-enter' })
    backdrop.addEventListener('click', () => {
      this.closeMobilePicker()
    })

    modalContainer.appendChild(picker)
    modalContainer.appendChild(backdrop)

    requestAnimationFrame(() => {
      void (backdrop as HTMLElement).offsetHeight
      backdrop.classList.remove('emoji-backdrop-enter')
      backdrop.classList.add('emoji-backdrop-enter-active')
      setTimeout(() => {
        backdrop.classList.remove('emoji-backdrop-enter-active')
      }, ANIMATION_DURATION)
    })

    this.currentPicker = picker as HTMLElement
  }

  /**
   * 切换 Picker 显示状态
   */
  async togglePicker(button: HTMLElement, isMobile: boolean) {
    if (this.currentPicker) {
      if (isMobile) {
        this.closeMobilePicker()
      } else {
        this.closeDesktopPicker()
      }
    } else {
      if (isMobile) {
        await this.injectMobilePicker()
      } else {
        await this.injectDesktopPicker(button)
      }
    }
  }

  /**
   * 清理所有资源
   */
  cleanup() {
    if (this.currentPicker) {
      this.closeDesktopPicker()
      this.closeMobilePicker()
    }
    this.cleanupClickOutsideListener()
  }
}

// 导出单例
export const pickerManager = new PickerManager()
