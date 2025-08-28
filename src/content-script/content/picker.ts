import { cachedState, cacheManager, cacheUtils } from './state'
import { getDefaultEmojis } from './default'
import type { emoji, EmojiGroup } from './types'
import { createContentScriptCommService } from '../../services/communication'
import { performanceMonitor, measureAsync } from './performance'

// 导入后台通信函数
interface BackgroundResponse {
  success: boolean
  data?: {
    groups?: any[]
    settings?: any
    ungroupedEmojis?: any[]
  }
  error?: string
}

function sendMessageToBackground(message: any): Promise<BackgroundResponse> {
  return new Promise((resolve) => {
    try {
      if (
        (window as any).chrome &&
        (window as any).chrome.runtime &&
        (window as any).chrome.runtime.sendMessage
      ) {
        ;(window as any).chrome.runtime.sendMessage(message, (response: BackgroundResponse) => {
          resolve(response)
        })
      } else {
        resolve({ success: false, error: 'chrome.runtime.sendMessage not available' })
      }
    } catch (e) {
      resolve({ success: false, error: e instanceof Error ? e.message : String(e) })
    }
  })
}

// 创建通信服务用于实时通知其他页面
const commService = createContentScriptCommService()

// 组级别加载支持函数
async function loadGroupsFromBackground(): Promise<EmojiGroup[]> {
  try {
    console.log('[组级缓存] 从后台获取表情组数据')
    const response = await sendMessageToBackground({ type: 'GET_EMOJI_DATA' })

    if (response && response.success && response.data && response.data.groups) {
      const freshGroups = response.data.groups.filter(
        (g: any) => g && typeof g.UUID === 'string' && Array.isArray(g.emojis),
      )

      if (freshGroups.length > 0) {
        // 更新组级别缓存
        freshGroups.forEach((group: any) => {
          if (group.UUID === 'common-emoji-group') {
            cacheUtils.updateCommonGroupCache(group)
          } else {
            cacheUtils.updateGroupCache(group.UUID, group)
          }
        })

        // 更新主缓存
        cachedState.emojiGroups = freshGroups
        console.log(`[组级缓存] 成功加载 ${freshGroups.length} 个表情组`)
        return freshGroups
      }
    }

    console.warn('[组级缓存] 后台没有返回有效数据')
    return []
  } catch (error) {
    console.error('[组级缓存] 从后台加载失败:', error)
    return []
  }
}

// 后台异步检查更新
async function checkForUpdatesInBackground(): Promise<void> {
  try {
    console.log('[组级缓存] 后台异步检查更新')

    // 使用较短的超时时间，避免阻塞 UI
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Background check timeout')), 2000)
    })

    const checkPromise = sendMessageToBackground({ type: 'GET_EMOJI_DATA' })

    const response = (await Promise.race([checkPromise, timeoutPromise])) as any

    if (response && response.success && response.data && response.data.groups) {
      const freshGroups = response.data.groups
      let hasUpdates = false

      // 检查是否有组级别更新
      for (const group of freshGroups) {
        if (!group.UUID) continue

        const cachedGroup =
          group.UUID === 'common-emoji-group'
            ? cacheManager.commonGroupCache.data
            : cacheUtils.getGroupCache(group.UUID)

        // 简单的更新检查（比较表情数量和修改时间）
        if (
          !cachedGroup ||
          cachedGroup.emojis?.length !== group.emojis?.length ||
          JSON.stringify(cachedGroup.emojis) !== JSON.stringify(group.emojis)
        ) {
          console.log(`[组级缓存] 检测到组更新: ${group.UUID}`)

          // 更新特定组
          if (group.UUID === 'common-emoji-group') {
            cacheUtils.updateCommonGroupCache(group)
          } else {
            cacheUtils.updateGroupCache(group.UUID, group)
          }

          // 更新主缓存
          const index = cachedState.emojiGroups.findIndex((g) => g.UUID === group.UUID)
          if (index >= 0) {
            cachedState.emojiGroups[index] = group
          }

          hasUpdates = true
        }
      }

      if (hasUpdates) {
        console.log('[组级缓存] 检测到更新，已同步缓存')
      } else {
        console.log('[组级缓存] 未检测到更新')
      }
    }
  } catch (error) {
    // 忙时忽略错误，不影响主流程
    console.debug(
      '[组级缓存] 后台检查更新失败（忽略）:',
      error instanceof Error ? error.message : String(error),
    )
  }
}

// 缓存状态管理
let cacheVersion = 0
let lastDataFetch = 0
const CACHE_EXPIRE_TIME = 600000 // 10分钟缓存过期时间

// 监听数据更新消息
commService.onGroupsChanged(() => {
  console.log('[Emoji Picker] 接收到表情组更新消息，将在下次打开时重新获取数据')
  cacheVersion++ // 增加版本号，标记缓存无效
})

commService.onUsageRecorded(() => {
  console.log('[Emoji Picker] 接收到使用记录更新消息，将在下次打开时重新获取数据')
  cacheVersion++ // 增加版本号，标记缓存无效
})

// 记录表情使用的函数
async function recordEmojiUsage(uuid: string): Promise<boolean> {
  try {
    console.log('[Emoji Usage] 记录表情使用:', uuid)

    // 通过后台通信更新使用计数
    const response = await sendMessageToBackground({
      type: 'RECORD_EMOJI_USAGE',
      uuid: uuid,
    })

    if (response && response.success) {
      console.log('[Emoji Usage] 成功更新使用计数')
      // 通知其他页面使用记录已更新
      commService.sendUsageRecorded(uuid)
      return true
    } else {
      console.warn('[Emoji Usage] 后台更新失败，尝试直接调用 recordUsageByUUID')

      // 回退方案：如果后台通信失败，尝试直接访问存储模块
      try {
        const { recordUsage } = await import('../../data/store/main')
        const result = recordUsage(uuid)
        if (result) {
          console.log('[Emoji Usage] 直接调用成功')
          commService.sendUsageRecorded(uuid)
          return true
        }
      } catch (error) {
        console.error('[Emoji Usage] 直接调用也失败:', error)
      }
    }
  } catch (error) {
    console.error('[Emoji Usage] 记录使用失败:', error)
  }

  return false
}

export function isMobile(): boolean {
  return (
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    window.innerWidth <= 768
  )
}

// 专门处理表情选择器关闭的函数
function closePicker(picker: HTMLElement, isMobilePicker: boolean) {
  if (isMobilePicker) {
    // 移动端模式：保留modal-container但清空其内容
    const modalContainer = picker.closest('.modal-container') as HTMLElement
    if (modalContainer) {
      // 清空modal-container内容，但保留容器本身
      modalContainer.innerHTML = ''
      console.log('[Emoji Picker] 清空移动端模态容器内容')
    } else {
      // 如果找不到modal-container，则使用传统方式
      picker.remove()
    }
  } else {
    // 桌面端模式：直接移除
    picker.remove()
  }
}

export async function createEmojiPicker(isMobilePicker: boolean): Promise<HTMLElement> {
  const measureId = performanceMonitor.startMeasure('emoji-picker-creation', { isMobilePicker })
  const startTime = performance.now()
  console.log('[组级缓存] 开始创建表情选择器')

  let groups: EmojiGroup[] = []

  // 在激进缓存模式下，优先使用缓存数据
  if (cacheManager.isAggressiveMode) {
    console.log('[组级缓存] 激进模式，尝试使用缓存数据')

    const cachedGroups = cacheUtils.getAllCachedGroups()
    if (cachedGroups.length > 0) {
      groups = cachedGroups
      console.log(`[组级缓存] 使用缓存数据：${groups.length} 个组`)

      // 后台异步检查更新（不阻塞 UI 显示）
      checkForUpdatesInBackground()
    } else {
      console.log('[组级缓存] 无缓存数据，从后台加载')
      groups = await loadGroupsFromBackground()
    }
  } else {
    console.log('[组级缓存] 非激进模式，从后台加载')
    groups = await loadGroupsFromBackground()
  }

  // 如果仍然没有数据，使用默认表情
  if (!groups || groups.length === 0) {
    groups = getDefaultEmojis()
    console.log('[组级缓存] 使用默认表情数据')
  }

  // 确保常用表情分组显示在第一位
  const commonGroupIndex = groups.findIndex((g) => g.UUID === 'common-emoji-group')
  if (commonGroupIndex > 0) {
    const commonGroup = groups.splice(commonGroupIndex, 1)[0]
    groups.unshift(commonGroup)
    console.log('[组级缓存] 将常用表情分组移动到第一位')
  }

  const renderStartTime = performance.now()
  const loadTime = renderStartTime - startTime
  console.log(`[组级缓存] 数据加载完成，耗时: ${Math.round(loadTime)}ms`)

  // Generate sections navigation HTML
  let sectionsNavHtml = ''
  let sectionsHtml = ''

  groups.forEach((group, groupIndex) => {
    if (group.emojis && Array.isArray(group.emojis)) {
      const groupId = group.UUID || `group-${groupIndex}`
      const groupIcon = group.icon || '😀'
      const groupName = group.displayName || `分组 ${groupIndex + 1}`
      const isActive = groupIndex === 0 ? 'active' : ''

      // Add navigation button for this group
      sectionsNavHtml += `
        <button class="btn no-text btn-flat emoji-picker__section-btn ${isActive}" tabindex="-1" data-section="${groupId}" type="button">
          <span style="font-size: 20px;">${groupIcon}</span>
        </button>
      `

      // Generate emoji images for this group
      let groupEmojisHtml = ''
      group.emojis.forEach((emojiData: emoji, index: number) => {
        const nameEsc = String(emojiData.displayName || '').replace(/"/g, '&quot;')
        const tabindex = index === 0 && groupIndex === 0 ? '0' : '-1'
        const dataEmoji = nameEsc
        const displayUrl = emojiData.displayUrl || emojiData.realUrl
        const emojiUUID = emojiData.UUID || ''
        // 添加 data-uuid 属性来保留原始 UUID 信息
        groupEmojisHtml += `<img width="32" height="32" class="emoji" src="${displayUrl}" tabindex="${tabindex}" data-emoji="${dataEmoji}" data-uuid="${emojiUUID}" alt="${nameEsc}" title=":${nameEsc}:" loading="lazy" />\n`
      })

      // Check if this is a "frequently used" or "favorite" group that should have delete button
      const isFrequentlyUsedGroup =
        groupName.includes('常用') ||
        groupName.includes('收藏') ||
        groupName.includes('最近') ||
        groupId === 'default-uuid' ||
        groupId.includes('frequent') ||
        groupId.includes('favorite')

      // Generate delete button only for frequently used groups
      const deleteButtonHtml = isFrequentlyUsedGroup
        ? `
        <button class="btn no-text btn-icon btn-transparent" type="button">
          <svg class="fa d-icon d-icon-trash-can svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
            <use href="#trash-can"></use>
          </svg>
          <span aria-hidden="true">&ZeroWidthSpace;</span>
        </button>
      `
        : ''

      // Add section for this group - always visible
      sectionsHtml += `
        <div class="emoji-picker__section" data-section="${groupId}" role="region" aria-label="${groupName}">
          <div class="emoji-picker__section-title-container">
            <h2 class="emoji-picker__section-title">${groupName}</h2>
            ${deleteButtonHtml}
          </div>
          <div class="emoji-picker__section-emojis">
            ${groupEmojisHtml}
          </div>
        </div>
      `
    }
  })

  // Create the picker element matching the target structure
  const picker = document.createElement('div')

  if (isMobilePicker) {
    // 移动端模式：使用modal-container结构
    picker.className = 'modal-container'
    picker.innerHTML = `
      <div class="modal d-modal fk-d-menu-modal emoji-picker-content" data-keyboard="false" aria-modal="true" role="dialog" data-identifier="emoji-picker" data-content="">
        <div class="d-modal__container">
          <div class="d-modal__body" tabindex="-1">
            <div class="emoji-picker">
              <div class="emoji-picker__filter-container">
                <div class="emoji-picker__filter filter-input-container">
                  <input class="filter-input" placeholder="按表情符号名称和别名搜索…" type="text" />
                  <svg class="fa d-icon d-icon-magnifying-glass svg-icon -right svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
                    <use href="#magnifying-glass"></use>
                  </svg>
                </div>
                <button class="btn no-text fk-d-menu__trigger -trigger emoji-picker__diversity-trigger btn-transparent" aria-expanded="false" data-trigger="" type="button" id="ember85">
                  <img width="20" height="20" src="/images/emoji/twemoji/clap.png" title="clap" alt="clap" class="emoji" />
                </button>
                <button class="btn no-text btn-icon btn-transparent emoji-picker__close-btn" type="button">
                  <svg class="fa d-icon d-icon-xmark svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
                    <use href="#xmark"></use>
                  </svg>
                  <span aria-hidden="true">&ZeroWidthSpace;</span>
                </button>
              </div>
              <div class="emoji-picker__content">
                <div class="emoji-picker__sections-nav">
                  ${sectionsNavHtml}
                </div>
                <div class="emoji-picker__scrollable-content">
                  <div class="emoji-picker__sections" role="button">
                    ${sectionsHtml}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="d-modal__backdrop"></div>
    `
  } else {
    // 桌面端模式：使用原有的fk-d-menu结构
    picker.className = 'fk-d-menu -animated -expanded'
    picker.setAttribute('data-identifier', 'emoji-picker')
    picker.setAttribute('data-content', '')
    picker.setAttribute('aria-labelledby', 'ember161')
    picker.setAttribute('aria-expanded', 'true')
    picker.setAttribute('role', 'dialog')

    picker.style.cssText = `
      position: absolute;
      background: white;
      border: 1px solid #ddd;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      z-index: 10000;
      min-width: 320px;
      max-width: 500px;
      max-height: 400px;
      overflow-y: auto;
      visibility: visible;
    `

    picker.innerHTML = `
      <div class="fk-d-menu__inner-content">
        <div class="emoji-picker">
          <div class="emoji-picker__filter-container">
            <div class="emoji-picker__filter filter-input-container">
              <input class="filter-input" placeholder="按表情符号名称和别名搜索…" type="text" />
              <svg class="fa d-icon d-icon-magnifying-glass svg-icon -right svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
                <use href="#magnifying-glass"></use>
              </svg>
            </div>
            <button class="btn no-text fk-d-menu__trigger -trigger emoji-picker__diversity-trigger btn-transparent" aria-expanded="false" data-trigger="" type="button" id="ember162">
              <img width="20" height="20" src="/images/emoji/twemoji/clap.png" title="clap" alt="clap" class="emoji" />
            </button>
          </div>
          <div class="emoji-picker__content">
            <div class="emoji-picker__sections-nav">
              ${sectionsNavHtml}
            </div>
            <div class="emoji-picker__scrollable-content">
              <div class="emoji-picker__sections" role="button">
                ${sectionsHtml}
              </div>
            </div>
          </div>
        </div>
      </div>
    `
  }

  // Add click handlers for emoji images - 优化的异步版本
  const emojiImages = picker.querySelectorAll('.emoji-picker__section-emojis .emoji')
  emojiImages.forEach((img) => {
    img.addEventListener('click', async () => {
      const clickStartTime = performance.now()
      console.log('[异步点击] 表情点击开始')

      // 获取原始 UUID 信息
      const originalUUID = img.getAttribute('data-uuid') || ''

      const emojiData: emoji = {
        id: img.getAttribute('data-emoji') || img.getAttribute('alt') || '',
        displayName: img.getAttribute('data-emoji') || img.getAttribute('alt') || '',
        realUrl: new URL(img.getAttribute('src') || ''),
        displayUrl: new URL(img.getAttribute('src') || ''),
        order: 0,
        UUID: (originalUUID as any) || (crypto.randomUUID() as any),
      }

      // 并行处理：记录使用统计 + 插入表情
      const tasks = []

      // 任务 1: 记录使用统计（如果有 UUID）
      if (originalUUID) {
        const usageTask = recordEmojiUsage(originalUUID)
          .then(() => {
            console.log('[异步点击] 成功记录表情使用:', originalUUID)
            return true
          })
          .catch((error) => {
            console.error('[异步点击] 记录表情使用失败:', error)
            return false
          })
        tasks.push(usageTask)
      } else {
        console.warn('[异步点击] 表情缺少 UUID 信息，无法记录使用统计')
        tasks.push(Promise.resolve(false))
      }

      // 任务 2: 插入表情
      const insertTask = insertEmoji(emojiData)
        .then(() => {
          console.log('[异步点击] 成功插入表情')
          return true
        })
        .catch((error) => {
          console.error('[异步点击] 插入表情失败:', error)
          return false
        })
      tasks.push(insertTask)

      // 等待所有任务完成
      try {
        const results = await Promise.allSettled(tasks)
        const clickDuration = performance.now() - clickStartTime

        console.log(`[异步点击] 所有任务完成，总耗时: ${Math.round(clickDuration)}ms`)
        console.log(
          '[异步点击] 任务结果:',
          results.map((r) => r.status),
        )

        // 只要插入成功就关闭选择器（不等待统计记录）
        const insertResult = results[1] // 插入结果是第二个任务
        if (insertResult.status === 'fulfilled') {
          closePicker(picker, isMobilePicker)
        } else {
          // 即使插入失败也关闭选择器，避免界面卡住
          console.warn('[异步点击] 插入失败，但仍然关闭选择器')
          closePicker(picker, isMobilePicker)
        }
      } catch (error) {
        console.error('[异步点击] 处理表情点击时出错:', error)
        // 即使出错也尝试关闭选择器
        closePicker(picker, isMobilePicker)
      }
    })
  })

  // Add section navigation functionality - scroll to target section
  const sectionButtons = picker.querySelectorAll('.emoji-picker__section-btn')
  const sections = picker.querySelectorAll('.emoji-picker__section')
  const scrollableContent = picker.querySelector('.emoji-picker__scrollable-content') as HTMLElement

  sectionButtons.forEach((button) => {
    button.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()

      const targetSection = button.getAttribute('data-section')
      console.log('[Emoji Picker] Navigation button clicked, target:', targetSection)

      // Remove active class from all buttons
      sectionButtons.forEach((btn) => btn.classList.remove('active'))
      // Add active class to clicked button
      button.classList.add('active')

      // Find target section
      const targetSectionEl = picker.querySelector(
        `[data-section="${targetSection}"].emoji-picker__section`,
      ) as HTMLElement

      if (targetSectionEl && scrollableContent) {
        console.log('[Emoji Picker] Found target section, scrolling...', targetSectionEl)

        // Calculate the position of target section relative to scrollable container
        const containerRect = scrollableContent.getBoundingClientRect()
        const targetRect = targetSectionEl.getBoundingClientRect()
        const scrollTop = scrollableContent.scrollTop

        // Calculate target scroll position
        const targetScrollTop = scrollTop + (targetRect.top - containerRect.top)

        // Smooth scroll to target position
        scrollableContent.scrollTo({
          top: targetScrollTop,
          behavior: 'smooth',
        })

        console.log('[Emoji Picker] Scrolled to position:', targetScrollTop)
      } else {
        console.warn('[Emoji Picker] Target section or scrollable content not found')
      }
    })
  })

  // Add close functionality for delete buttons (only exists in frequently used groups)
  const deleteButtons = picker.querySelectorAll('.emoji-picker__section-title-container button')
  deleteButtons.forEach((deleteBtn) => {
    deleteBtn.addEventListener('click', () => {
      closePicker(picker, isMobilePicker)
    })
  })

  // Add mobile-specific close functionality
  if (isMobilePicker) {
    // Add close button functionality
    const closeButton = picker.querySelector('.emoji-picker__close-btn')
    if (closeButton) {
      closeButton.addEventListener('click', () => {
        closePicker(picker, isMobilePicker)
      })
    }

    // Add backdrop click to close functionality
    const backdrop = picker.querySelector('.d-modal__backdrop')
    if (backdrop) {
      backdrop.addEventListener('click', () => {
        closePicker(picker, isMobilePicker)
      })
    }

    // Prevent modal content clicks from bubbling to backdrop
    const modalContent = picker.querySelector('.d-modal__container')
    if (modalContent) {
      modalContent.addEventListener('click', (e) => {
        e.stopPropagation()
      })
    }
  }

  // Add filter functionality
  const filterInput = picker.querySelector('.filter-input') as HTMLInputElement
  if (filterInput) {
    filterInput.addEventListener('input', (e) => {
      const searchTerm = (e.target as HTMLInputElement).value.toLowerCase()

      if (searchTerm.trim() === '') {
        // If search is empty, show all sections normally
        sections.forEach((section) => {
          const sectionEl = section as HTMLElement
          sectionEl.style.display = 'block'
        })

        // Show all emojis
        emojiImages.forEach((img) => {
          const htmlImg = img as HTMLElement
          htmlImg.style.display = 'block'
        })
      } else {
        // If searching, show all sections and filter emojis
        sections.forEach((section) => {
          const sectionEl = section as HTMLElement
          sectionEl.style.display = 'block'
        })

        emojiImages.forEach((img) => {
          const alt = img.getAttribute('alt') || ''
          const title = img.getAttribute('title') || ''
          const dataEmoji = img.getAttribute('data-emoji') || ''

          const shouldShow =
            alt.toLowerCase().includes(searchTerm) ||
            title.toLowerCase().includes(searchTerm) ||
            dataEmoji.toLowerCase().includes(searchTerm)

          const htmlImg = img as HTMLElement
          htmlImg.style.display = shouldShow ? 'block' : 'none'
        })
      }
    })
  }

  const renderEndTime = performance.now()
  const renderTime = renderEndTime - renderStartTime
  const totalTime = renderEndTime - startTime

  // 性能监控和日志优化
  const performanceStats = {
    loadTime: Math.round(loadTime),
    renderTime: Math.round(renderTime),
    totalTime: Math.round(totalTime),
    groupsCount: groups.length,
    emojisCount: groups.reduce((sum, g) => sum + (g.emojis?.length || 0), 0),
    cacheStats: cacheUtils.getCacheStats(),
    taskStats: taskManager.getTaskStats(),
  }

  console.log('[性能监控] 表情选择器创建完成:', performanceStats)

  // 性能警告
  if (totalTime > 1000) {
    console.warn(`[性能警告] 表情选择器创建耗时过长: ${totalTime}ms`)
  }

  if (loadTime > 500) {
    console.warn(`[性能警告] 数据加载耗时过长: ${loadTime}ms, 建议检查网络或缓存配置`)
  }

  // 将性能统计附加到 picker 元素上，供调试使用
  picker.setAttribute('data-performance', JSON.stringify(performanceStats))

  // 完成性能测量
  performanceMonitor.endMeasure('emoji-picker-creation', measureId)

  return picker
}

// 异步表情插入系统
interface EmojiInsertTask {
  id: string
  emojiData: emoji
  startTime: number
  status: 'pending' | 'processing' | 'completed' | 'failed'
  steps: {
    findElement: boolean
    getSettings: boolean
    generateContent: boolean
    insertContent: boolean
  }
}

// 任务管理器
class EmojiInsertTaskManager {
  private tasks: Map<string, EmojiInsertTask> = new Map()
  private processingQueue: Set<string> = new Set()

  createTask(emojiData: emoji): string {
    const taskId = `emoji-insert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const task: EmojiInsertTask = {
      id: taskId,
      emojiData,
      startTime: Date.now(),
      status: 'pending',
      steps: {
        findElement: false,
        getSettings: false,
        generateContent: false,
        insertContent: false,
      },
    }
    this.tasks.set(taskId, task)
    console.log(`[异步插入] 创建任务: ${taskId}`, emojiData.displayName)
    return taskId
  }

  updateTaskStep(taskId: string, step: keyof EmojiInsertTask['steps'], completed: boolean) {
    const task = this.tasks.get(taskId)
    if (task) {
      task.steps[step] = completed
    }
  }

  completeTask(taskId: string, success: boolean) {
    const task = this.tasks.get(taskId)
    if (task) {
      task.status = success ? 'completed' : 'failed'
      this.processingQueue.delete(taskId)
      const duration = Date.now() - task.startTime
      console.log(`[异步插入] 任务${success ? '完成' : '失败'}: ${taskId}, 耗时: ${duration}ms`)

      // 清理旧任务（保留最近 10 个）
      if (this.tasks.size > 10) {
        const sortedTasks = Array.from(this.tasks.entries()).sort(
          (a, b) => b[1].startTime - a[1].startTime,
        )
        sortedTasks.slice(10).forEach(([id]) => this.tasks.delete(id))
      }
    }
  }

  getTaskStats() {
    const tasks = Array.from(this.tasks.values())
    const completed = tasks.filter((t) => t.status === 'completed').length
    const failed = tasks.filter((t) => t.status === 'failed').length
    const processing = tasks.filter((t) => t.status === 'processing').length
    const avgDuration =
      tasks
        .filter((t) => t.status === 'completed')
        .reduce((sum, t) => sum + (Date.now() - t.startTime), 0) / Math.max(completed, 1)

    return { total: tasks.length, completed, failed, processing, avgDuration }
  }
}

const taskManager = new EmojiInsertTaskManager()

// 异步获取设置
async function getEmojiSettings(): Promise<any> {
  // 先返回缓存设置，然后异步更新
  let settings = { ...cacheManager.settingsCache.data }

  try {
    // 如果激进缓存模式开启且设置缓存还在有效期内，直接使用缓存
    if (cacheManager.isAggressiveMode) {
      const cacheAge = Date.now() - cacheManager.settingsCache.lastUpdate
      if (cacheAge < 5000 && Object.keys(settings).length > 0) {
        // 5秒缓存
        console.log('[异步插入] 使用设置缓存，缓存时间:', cacheAge + 'ms')
        return settings
      }
    }

    // 后台获取设置
    console.log('[异步插入] 实时获取最新设置...')
    const response = await sendMessageToBackground({ type: 'GET_EMOJI_DATA' })
    if (response && response.success && response.data && response.data.settings) {
      settings = { ...settings, ...response.data.settings }
      // 更新缓存
      cacheUtils.updateSettingsCache(response.data.settings)
      console.log('[异步插入] 成功获取最新设置')
    }
  } catch (error) {
    console.warn('[异步插入] 获取设置失败，使用缓存:', error)
  }

  return settings
}

// 异步查找输入元素
async function findInputElement(): Promise<{
  textArea: HTMLTextAreaElement | null
  richEle: HTMLElement | null
}> {
  return new Promise((resolve) => {
    // 立即返回当前结果
    const textArea = document.querySelector('textarea.d-editor-input') as HTMLTextAreaElement | null
    const richEle = document.querySelector('.ProseMirror.d-editor-input') as HTMLElement | null

    resolve({ textArea, richEle })
  })
}

// 异步生成表情内容
async function generateEmojiContent(
  emojiData: emoji,
  settings: any,
): Promise<{
  textContent: string
  htmlContent: string
  scaledWidth: number
  scaledHeight: number
}> {
  return new Promise((resolve) => {
    // 获取图片尺寸信息
    let width = '500'
    let height = '500'
    const imgSrc = emojiData.realUrl?.toString() || emojiData.displayUrl?.toString() || ''

    // 尝试从 URL 中提取尺寸
    const match = imgSrc.match(/_(\d{3,})x(\d{3,})\./)
    if (match) {
      width = match[1]
      height = match[2]
    }

    const imageScale = settings.imageScale || 30
    const scaledWidth = Math.round((parseInt(width) * imageScale) / 100)
    const scaledHeight = Math.round((parseInt(height) * imageScale) / 100)

    // 生成不同格式的内容
    let textContent: string
    switch (settings.outputFormat) {
      case 'html':
        textContent = `<img src="${imgSrc}" title=":${emojiData.displayName}:" class="emoji only-emoji" alt=":${emojiData.displayName}:" loading="lazy" width="${scaledWidth}" height="${scaledHeight}" style="aspect-ratio: ${scaledWidth} / ${scaledHeight};">`
        break
      case 'bbcode':
        textContent = `[img]${imgSrc}[/img]`
        break
      case 'markdown':
      default:
        textContent = `![${emojiData.displayName}|${width}x${height},${imageScale}%](${imgSrc}) `
        break
    }

    const htmlContent = `<img src="${imgSrc}" title=":${emojiData.displayName}:" class="emoji only-emoji" alt=":${emojiData.displayName}:" loading="lazy" width="${scaledWidth}" height="${scaledHeight}" style="aspect-ratio: ${scaledWidth} / ${scaledHeight};">`

    resolve({ textContent, htmlContent, scaledWidth, scaledHeight })
  })
}

// 优化后的异步插入函数
async function insertEmoji(emojiData: emoji): Promise<void> {
  const taskId = taskManager.createTask(emojiData)

  try {
    console.log('[异步插入] 开始处理:', emojiData.displayName)
    const startTime = performance.now()

    // 并行执行多个异步操作
    const [elements, settings] = await Promise.all([findInputElement(), getEmojiSettings()])

    taskManager.updateTaskStep(taskId, 'findElement', true)
    taskManager.updateTaskStep(taskId, 'getSettings', true)

    const { textArea, richEle } = elements

    if (!textArea && !richEle) {
      console.error('[异步插入] 找不到输入框')
      taskManager.completeTask(taskId, false)
      return
    }

    console.log('[异步插入] 找到输入框:', { textArea: !!textArea, richEle: !!richEle })
    console.log('[异步插入] 使用设置:', {
      outputFormat: settings.outputFormat,
      imageScale: settings.imageScale,
    })

    // 生成内容
    const content = await generateEmojiContent(emojiData, settings)
    taskManager.updateTaskStep(taskId, 'generateContent', true)

    console.log('[异步插入] 生成的内容:', content.textContent)

    // 插入内容
    if (textArea) {
      console.log('[异步插入] 处理普通文本框插入')

      const start = textArea.selectionStart || 0
      const end = textArea.selectionEnd || 0
      const text = textArea.value

      // 插入表情文本
      textArea.value = text.substring(0, start) + content.textContent + text.substring(end)
      textArea.selectionStart = textArea.selectionEnd = start + content.textContent.length
      textArea.focus()

      // 触发事件
      const inputEvent = new Event('input', { bubbles: true, cancelable: true })
      textArea.dispatchEvent(inputEvent)
    } else if (richEle) {
      console.log('[异步插入] 处理富文本编辑器插入')

      try {
        const dt = new DataTransfer()
        dt.setData('text/html', content.htmlContent)
        const evt = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true })
        richEle.dispatchEvent(evt)
        console.log('[异步插入] 通过粘贴事件插入表情成功')
      } catch (e1) {
        console.warn('[异步插入] 粘贴事件失败，尝试 execCommand:', e1)
        try {
          const result = document.execCommand('insertHTML', false, content.htmlContent)
          console.log('[异步插入] execCommand 结果:', result)
        } catch (e2) {
          console.error('[异步插入] 无法向富文本编辑器中插入表情:', e2)
          throw e2
        }
      }
    }

    taskManager.updateTaskStep(taskId, 'insertContent', true)

    const duration = performance.now() - startTime
    console.log(
      `[异步插入] 成功插入表情: ${emojiData.displayName}, 耗时: ${Math.round(duration)}ms`,
    )

    taskManager.completeTask(taskId, true)
  } catch (error) {
    console.error('[异步插入] 插入表情失败:', error)
    taskManager.completeTask(taskId, false)
    throw error
  }
}

// 旧的同步实现（保留作为备用）
async function insertEmojiLegacy(emojiData: emoji) {
  console.log('[Emoji Insert] 开始插入表情:', emojiData)

  // 首先尝试主动查找文本框（参考simple.js的实现）
  const textArea = document.querySelector('textarea.d-editor-input') as HTMLTextAreaElement | null
  const richEle = document.querySelector('.ProseMirror.d-editor-input') as HTMLElement | null

  console.log('[Emoji Insert] 找到输入框:', { textArea: !!textArea, richEle: !!richEle })

  if (!textArea && !richEle) {
    console.error('[Emoji Insert] 找不到输入框')
    return
  }

  // 获取图片尺寸信息
  let width = '500'
  let height = '500'
  const imgSrc = emojiData.realUrl
    ? emojiData.realUrl.toString()
    : emojiData.displayUrl
      ? emojiData.displayUrl.toString()
      : ''

  if (!imgSrc) {
    console.error('[Emoji Insert] 表情没有有效的URL')
    return
  }

  // 尝试从 URL 中提取尺寸
  const match = imgSrc.match(/_(\d{3,})x(\d{3,})\./)
  if (match) {
    width = match[1]
    height = match[2]
  }

  // 实时从后端获取最新设置
  let currentSettings = cachedState.settings // 默认使用缓存设置作为备用
  try {
    console.log('[Emoji Insert] 实时获取最新设置...')
    const response = await sendMessageToBackground({ type: 'GET_EMOJI_DATA' })
    if (response && response.success && response.data && response.data.settings) {
      currentSettings = { ...cachedState.settings, ...response.data.settings }
      console.log('[Emoji Insert] 成功获取最新设置:', currentSettings)
    } else {
      console.warn('[Emoji Insert] 获取最新设置失败，使用缓存设置')
    }
  } catch (error) {
    console.error('[Emoji Insert] 获取设置时出错:', error)
  }

  // 获取缩放比例
  const imageScale = currentSettings.imageScale || 30
  console.log('[Emoji Insert] 使用设置:', {
    outputFormat: currentSettings.outputFormat,
    imageScale,
  })

  if (textArea) {
    console.log('[Emoji Insert] 处理普通文本框插入')
    // 对于普通文本框，根据输出格式生成不同的文本
    let emojiText: string
    switch (currentSettings.outputFormat) {
      case 'html':
        const scaledWidth = Math.round((parseInt(width) * imageScale) / 100)
        const scaledHeight = Math.round((parseInt(height) * imageScale) / 100)
        // 使用指定的HTML格式，包含完整的属性
        emojiText = `<img src="${imgSrc}" title=":${emojiData.displayName}:" class="emoji only-emoji" alt=":${emojiData.displayName}:" loading="lazy" width="${scaledWidth}" height="${scaledHeight}" style="aspect-ratio: ${scaledWidth} / ${scaledHeight};">`
        break
      case 'bbcode':
        emojiText = `[img]${imgSrc}[/img]`
        break
      case 'markdown':
      default:
        // 使用类似simple.js的格式：![alt|widthxheight,scale%](url)
        emojiText = `![${emojiData.displayName}|${width}x${height},${imageScale}%](${imgSrc}) `
        break
    }

    console.log('[Emoji Insert] 生成的表情文本:', emojiText)

    const start = textArea.selectionStart || 0
    const end = textArea.selectionEnd || 0
    const text = textArea.value

    // 插入表情文本
    textArea.value = text.substring(0, start) + emojiText + text.substring(end)
    textArea.selectionStart = textArea.selectionEnd = start + emojiText.length
    textArea.focus()

    // Trigger input event
    const inputEvent = new Event('input', { bubbles: true, cancelable: true })
    textArea.dispatchEvent(inputEvent)

    console.log('[Emoji Insert] 成功插入表情到文本框')
  } else if (richEle) {
    console.log('[Emoji Insert] 处理富文本编辑器插入')
    // 对于富文本编辑器，使用HTML模板（参考simple.js的实现）
    const scaledWidth = Math.round((parseInt(width) * imageScale) / 100)
    const scaledHeight = Math.round((parseInt(height) * imageScale) / 100)
    // 使用指定的HTML格式，包含完整的属性
    const imgTemplate = `<img src="${imgSrc}" title=":${emojiData.displayName}:" class="emoji only-emoji" alt=":${emojiData.displayName}:" loading="lazy" width="${scaledWidth}" height="${scaledHeight}" style="aspect-ratio: ${scaledWidth} / ${scaledHeight};">`

    console.log('[Emoji Insert] 生成的HTML模板:', imgTemplate)

    try {
      const dt = new DataTransfer()
      dt.setData('text/html', imgTemplate)
      const evt = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true })
      richEle.dispatchEvent(evt)
      console.log('[Emoji Insert] 通过粘贴事件插入表情成功')
    } catch (e1) {
      console.warn('[Emoji Insert] 粘贴事件失败，尝试execCommand:', e1)
      try {
        const result = document.execCommand('insertHTML', false, imgTemplate)
        console.log('[Emoji Insert] execCommand结果:', result)
      } catch (e2) {
        console.error('[Emoji Insert] 无法向富文本编辑器中插入表情:', e2)
      }
    }
  }
}
