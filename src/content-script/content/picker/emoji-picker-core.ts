// content-script/content/picker/emoji-picker-core.ts - 核心选择器创建逻辑

import { getDefaultEmojis } from '../default'
import type { EmojiGroup } from '../types'
import { performanceMonitor } from '../performance'
import { 
  loadGroupsFromBackground, 
  checkForUpdatesInBackground, 
  isAggressiveMode, 
  getAllCachedGroups,
  setupCacheListeners
} from './cache-manager'
import { 
  generateSectionNavHTML, 
  generateSectionHTML, 
  generateDesktopPickerHTML, 
  generateMobilePickerHTML,
  applyDesktopStyles,
  applyMobileStyles,
  isMobile 
} from './render-utils'
import { 
  setupEmojiClickHandlers,
  setupSectionNavigationHandlers,
  setupCloseHandlers,
  setupFilterHandlers,
  setupUploadHandlers,
  setupCommonGroupRefreshHandler
} from './event-handlers'

/**
 * 创建表情选择器
 * @param isMobilePicker 是否为移动端选择器
 * @returns Promise<HTMLElement> 表情选择器元素
 */
export async function createEmojiPicker(isMobilePicker: boolean): Promise<HTMLElement> {
  const measureId = performanceMonitor.startMeasure('emoji-picker-creation', { isMobilePicker })
  const startTime = performance.now()
  console.log('[组级缓存] 开始创建表情选择器')

  // 设置缓存监听器（只需要设置一次）
  setupCacheListeners()

  let groups: EmojiGroup[] = []

  // 在激进缓存模式下，优先使用缓存数据
  if (isAggressiveMode()) {
    console.log('[组级缓存] 激进模式，尝试使用缓存数据')

    const cachedGroups = getAllCachedGroups()
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

  // 🚀 关键修复：确保常用表情分组存在并显示在第一位
  const commonGroupIndex = groups.findIndex((g) => g.UUID === 'common-emoji-group')

  if (commonGroupIndex === -1) {
    // 如果没有常用表情分组，创建一个空的
    const emptyCommonGroup: EmojiGroup = {
      UUID: 'common-emoji-group',
      id: 'common-emoji-group',
      displayName: '常用',
      icon: '⭐',
      order: 0,
      emojis: [],
      originalId: 'favorites'
    }
    groups.unshift(emptyCommonGroup)
    console.log('[组级缓存] 创建空的常用表情分组')
  } else if (commonGroupIndex > 0) {
    // 如果常用表情分组不在第一位，移动到第一位
    const commonGroup = groups.splice(commonGroupIndex, 1)[0]
    groups.unshift(commonGroup)
    console.log('[组级缓存] 将常用表情分组移动到第一位')
  }

  const renderStartTime = performance.now()
  const loadTime = renderStartTime - startTime
  console.log(`[组级缓存] 数据加载完成，耗时: ${Math.round(loadTime)}ms`)

  // Generate sections navigation HTML and content HTML
  const { sectionsNavHtml, sectionsHtml } = generatePickerContent(groups)

  // Create the picker element
  const picker = document.createElement('div')

  if (isMobilePicker) {
    // 移动端模式：使用modal-container结构
    applyMobileStyles(picker)
    picker.innerHTML = generateMobilePickerHTML(sectionsNavHtml, sectionsHtml)
  } else {
    // 桌面端模式：使用原有的fk-d-menu结构
    applyDesktopStyles(picker)
    picker.innerHTML = generateDesktopPickerHTML(sectionsNavHtml, sectionsHtml)
  }

  // 设置所有事件处理器
  setupAllEventHandlers(picker, isMobilePicker)

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

/**
 * 生成选择器内容HTML
 * @param groups 表情组数组
 * @returns { sectionsNavHtml: string, sectionsHtml: string }
 */
function generatePickerContent(groups: EmojiGroup[]): { sectionsNavHtml: string, sectionsHtml: string } {
  let sectionsNavHtml = ''
  let sectionsHtml = ''

  groups.forEach((group, groupIndex) => {
    if (group.emojis && Array.isArray(group.emojis)) {
      // Add navigation button for this group
      sectionsNavHtml += generateSectionNavHTML(group, groupIndex)
      // Add section for this group
      sectionsHtml += generateSectionHTML(group, groupIndex)
    }
  })

  return { sectionsNavHtml, sectionsHtml }
}

/**
 * 设置所有事件处理器
 * @param picker 选择器元素
 * @param isMobilePicker 是否为移动端
 */
function setupAllEventHandlers(picker: HTMLElement, isMobilePicker: boolean): void {
  // 设置表情点击事件
  setupEmojiClickHandlers(picker, isMobilePicker)
  
  // 设置分组导航事件
  setupSectionNavigationHandlers(picker)
  
  // 设置关闭按钮事件
  setupCloseHandlers(picker, isMobilePicker)
  
  // 设置过滤器事件
  setupFilterHandlers(picker)
  
  // 设置上传功能事件
  setupUploadHandlers(picker)
  
  // 设置常用表情组刷新监听器
  const cleanupRefreshHandler = setupCommonGroupRefreshHandler(picker)
  
  // 在选择器被关闭时移除监听器
  const originalRemove = picker.remove.bind(picker)
  picker.remove = function () {
    cleanupRefreshHandler()
    originalRemove()
  }
}

/**
 * 导出isMobile函数供外部使用
 */
export { isMobile }