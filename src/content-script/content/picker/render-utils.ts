// content-script/content/picker/render-utils.ts - 渲染工具函数

import { isLikelyUrl, isBase64Image } from '../../../options/utils/isLikelyUrl'

/**
 * 渲染分组图标，支持 URL、Base64 和文本格式
 * @param groupIcon 分组图标字符串
 * @returns 渲染后的 HTML 字符串
 */
export function renderSectionIcon(groupIcon: string | URL): string {
  const iconStr = typeof groupIcon === 'string' ? groupIcon : groupIcon.toString()
  const isUrl = isImageUrl(iconStr)
  const isBase64 = isBase64Image(iconStr)

  if (isUrl || isBase64) {
    // 图片格式：使用 img 标签显示
    return `<img src="${iconStr}" style="width: 20px; height: 20px; object-fit: cover; border-radius: 3px; display: inline-block;" alt="group-icon" onerror="this.style.display='none';this.nextElementSibling.style.display='inline-block';" /><span style="font-size: 20px; display: none;">📁</span>`
  } else {
    // 文本格式：直接显示字符
    return `<span style="font-size: 20px; display: inline-block;">${iconStr}</span>`
  }
}

/**
 * 检测字符串是否为任何形式的图片URL（包括Base64）
 */
export function isImageUrl(str: string): boolean {
  return isLikelyUrl(str) || isBase64Image(str)
}

/**
 * 创建上传触发按钮
 * @returns 上传按钮的 HTML 字符串
 */
export function createUploadTriggerButton(): string {
  return `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
    </svg>
  `
}

/**
 * 检测是否为移动设备
 * @returns boolean 是否为移动设备
 */
export function isMobile(): boolean {
  return (
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    window.innerWidth <= 768
  )
}

/**
 * 生成表情HTML
 * @param emojiData 表情数据
 * @param index 索引
 * @param groupIndex 组索引
 * @returns 表情HTML字符串
 */
export function generateEmojiHTML(emojiData: any, index: number, groupIndex: number): string {
  const nameEsc = String(emojiData.displayName || '').replace(/"/g, '&quot;')
  const tabindex = index === 0 && groupIndex === 0 ? '0' : '-1'
  const dataEmoji = nameEsc
  const displayUrl = emojiData.displayUrl || emojiData.realUrl
  const emojiUUID = emojiData.UUID || ''
  
  return `<img width="32" height="32" class="emoji" src="${displayUrl}" tabindex="${tabindex}" data-emoji="${dataEmoji}" data-uuid="${emojiUUID}" alt="${nameEsc}" title=":${nameEsc}:" loading="lazy" />\n`
}

/**
 * 生成分组导航HTML
 * @param group 表情组数据
 * @param groupIndex 组索引
 * @returns 导航HTML字符串
 */
export function generateSectionNavHTML(group: any, groupIndex: number): string {
  const groupId = group.UUID || `group-${groupIndex}`
  const groupIcon = group.icon || '😀'
  const isActive = groupIndex === 0 ? 'active' : ''

  return `
    <button class="btn no-text btn-flat emoji-picker__section-btn ${isActive}" tabindex="-1" data-section="${groupId}" type="button">
      ${renderSectionIcon(groupIcon)}
    </button>
  `
}

/**
 * 生成表情分组HTML
 * @param group 表情组数据
 * @param groupIndex 组索引
 * @returns 分组HTML字符串
 */
export function generateSectionHTML(group: any, groupIndex: number): string {
  const groupId = group.UUID || `group-${groupIndex}`
  const groupName = group.displayName || `分组 ${groupIndex + 1}`

  // Generate emoji images for this group
  let groupEmojisHTML = ''
  if (group.emojis && Array.isArray(group.emojis)) {
    group.emojis.forEach((emojiData: any, index: number) => {
      groupEmojisHTML += generateEmojiHTML(emojiData, index, groupIndex)
    })
  }

  // Check if this is a "frequently used" or "favorite" group that should have delete button
  const isFrequentlyUsedGroup =
    groupName.includes('常用') ||
    groupName.includes('收藏') ||
    groupName.includes('最近') ||
    groupId === 'default-uuid' ||
    groupId.includes('frequent') ||
    groupId.includes('favorite')

  // Generate delete button only for frequently used groups
  const deleteButtonHTML = isFrequentlyUsedGroup
    ? `
    <button class="btn no-text btn-icon btn-transparent" type="button">
      <svg class="fa d-icon d-icon-trash-can svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
        <use href="#trash-can"></use>
      </svg>
      <span aria-hidden="true">&ZeroWidthSpace;</span>
    </button>
  `
    : ''

  return `
    <div class="emoji-picker__section" data-section="${groupId}" role="region" aria-label="${groupName}">
      <div class="emoji-picker__section-title-container">
        <h2 class="emoji-picker__section-title">${groupName}</h2>
        ${deleteButtonHTML}
      </div>
      <div class="emoji-picker__section-emojis">
        ${groupEmojisHTML}
      </div>
    </div>
  `
}

/**
 * 生成桌面端表情选择器HTML结构
 * @param sectionsNavHtml 分组导航HTML
 * @param sectionsHtml 分组内容HTML
 * @returns 桌面端选择器HTML
 */
export function generateDesktopPickerHTML(sectionsNavHtml: string, sectionsHtml: string): string {
  return `
    <div class="fk-d-menu__inner-content">
      <div class="emoji-picker">
        <div class="emoji-picker__filter-container">
          <div class="emoji-picker__filter filter-input-container">
            <input class="filter-input" placeholder="按表情符号名称和别名搜索…" type="text" />
            <svg class="fa d-icon d-icon-magnifying-glass svg-icon -right svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
              <use href="#magnifying-glass"></use>
            </svg>
          </div>
          <button class="btn no-text fk-d-menu__trigger -trigger emoji-picker__upload-trigger btn-transparent" aria-expanded="false" data-trigger="" type="button" id="emoji-upload-trigger" title="批量上传图片">
            ${createUploadTriggerButton()}
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

/**
 * 生成移动端表情选择器HTML结构
 * @param sectionsNavHtml 分组导航HTML
 * @param sectionsHtml 分组内容HTML
 * @returns 移动端选择器HTML
 */
export function generateMobilePickerHTML(sectionsNavHtml: string, sectionsHtml: string): string {
  return `
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
              <button class="btn no-text fk-d-menu__trigger -trigger emoji-picker__upload-trigger btn-transparent" aria-expanded="false" data-trigger="" type="button" id="emoji-upload-trigger" title="批量上传图片">
                ${createUploadTriggerButton()}
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
}

/**
 * 应用桌面端样式
 * @param picker 选择器元素
 */
export function applyDesktopStyles(picker: HTMLElement): void {
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
}

/**
 * 应用移动端样式
 * @param picker 选择器元素
 */
export function applyMobileStyles(picker: HTMLElement): void {
  picker.className = 'modal-container'
}