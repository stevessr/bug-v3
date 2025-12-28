/**
 * 试验性功能：子菜单注入
 * 监听 Discourse 工具栏和聊天编辑器的下拉菜单，将功能按钮注入其中
 * 这种方式比持续观察 DOM 更节省 CPU
 */

import { createE, DQS, DOA } from '../../utils/createEl'
import { showImageUploadDialog } from '../../utils/uploader'
import { animateEnter, animateExit } from '../../utils/animation'
import { autoReadAll, autoReadAllv2 } from '../../utils/autoReadReplies'
import { notify } from '../../utils/notify'
import { createAndShowIframeModal, createAndShowSideIframeModal } from '../../utils/iframe'
import { createQuickInsertMenu } from '../../utils/injector'

import { cachedState } from './ensure'
import { createEmojiPicker } from './picker'

// 菜单容器选择器
const MENU_CONTAINER_SELECTORS = [
  // 工具栏选项菜单
  '.fk-d-menu[data-identifier="toolbar-menu__options"]',
  // 聊天编辑器下拉菜单
  '.fk-d-menu[data-identifier="chat-composer-dropdown__menu"]'
]

// 标记已注入的菜单项
const INJECTED_MARKER = 'emoji-extension-submenu-injected'

// 当前打开的 picker
let currentSubmenuPicker: HTMLElement | null = null
let isSubmenuAnimating = false

/**
 * 创建菜单项按钮
 */
function createMenuItem(
  text: string,
  emoji: string,
  onClick: (e: MouseEvent) => void,
  isChat: boolean = false
): HTMLElement {
  const li = createE('li', {
    class: isChat ? 'chat-composer-dropdown__item' : 'dropdown-menu__item'
  })
  li.setAttribute('data-emoji-extension', 'true')

  const btn = createE('button', {
    class: isChat
      ? 'btn btn-icon-text chat-composer-dropdown__action-btn btn-transparent'
      : 'btn btn-icon-text',
    type: 'button',
    ti: text
  }) as HTMLButtonElement

  const emojiSpan = createE('span', { text: emoji })
  emojiSpan.style.marginRight = '6px'

  const labelSpan = createE('span', {
    class: 'd-button-label',
    text: text
  })

  btn.appendChild(emojiSpan)
  btn.appendChild(labelSpan)
  btn.addEventListener('click', onClick as any)

  li.appendChild(btn)
  return li
}

/**
 * 创建分隔线
 */
function createSeparator(): HTMLElement {
  const li = createE('li', {
    class: 'dropdown-menu__divider',
    style: 'border-top: 1px solid var(--primary-low); margin: 4px 0;'
  })
  li.setAttribute('data-emoji-extension', 'true')
  return li
}

/**
 * 关闭当前打开的子菜单 picker
 */
function closeSubmenuPicker() {
  if (!currentSubmenuPicker || isSubmenuAnimating) return

  isSubmenuAnimating = true
  const pickerToClose = currentSubmenuPicker
  currentSubmenuPicker = null

  animateExit(pickerToClose, 'picker', () => {
    isSubmenuAnimating = false
  })
}

/**
 * 在菜单附近显示 emoji picker
 */
async function showEmojiPickerNearMenu(menuContainer: HTMLElement) {
  if (isSubmenuAnimating) return

  // 如果已经有 picker 打开，先关闭
  if (currentSubmenuPicker) {
    closeSubmenuPicker()
    return
  }

  const picker = await createEmojiPicker(false)
  currentSubmenuPicker = picker
  DOA(picker)

  // 定位 picker
  const menuRect = menuContainer.getBoundingClientRect()
  const margin = 8
  const vpWidth = window.innerWidth
  const vpHeight = window.innerHeight

  picker.style.position = 'fixed'
  picker.style.zIndex = '1000000'

  // 先放置到菜单右侧
  let left = menuRect.right + margin
  let top = menuRect.top

  // 测量 picker 尺寸
  const pickerRect = picker.getBoundingClientRect()

  // 如果右侧空间不够，放到左侧
  if (left + pickerRect.width > vpWidth) {
    left = Math.max(margin, menuRect.left - pickerRect.width - margin)
  }

  // 如果底部空间不够，向上调整
  if (top + pickerRect.height > vpHeight) {
    top = Math.max(margin, vpHeight - pickerRect.height - margin)
  }

  picker.style.left = `${left}px`
  picker.style.top = `${top}px`

  animateEnter(picker, 'picker')

  // 点击外部关闭
  const closeHandler = (e: Event) => {
    if (currentSubmenuPicker && !currentSubmenuPicker.contains(e.target as Node)) {
      closeSubmenuPicker()
      document.removeEventListener('click', closeHandler)
    }
  }

  setTimeout(() => {
    document.addEventListener('click', closeHandler)
  }, 100)
}

/**
 * 注入按钮到菜单
 */
function injectButtonsToMenu(menuContainer: HTMLElement, isChat: boolean) {
  // 检查是否已注入
  if (menuContainer.hasAttribute(INJECTED_MARKER)) return

  // 找到 ul 列表
  const ul = menuContainer.querySelector(
    isChat ? '.chat-composer-dropdown__list' : '.dropdown-menu'
  )
  if (!ul) return

  // 标记已注入
  menuContainer.setAttribute(INJECTED_MARKER, 'true')

  // 添加分隔线
  ul.appendChild(createSeparator())

  // 添加表情包按钮
  const emojiItem = createMenuItem(
    '表情包',
    '🐈‍⬛',
    () => {
      showEmojiPickerNearMenu(menuContainer)
    },
    isChat
  )
  ul.appendChild(emojiItem)

  // 添加上传图片按钮
  const uploadItem = createMenuItem(
    '上传本地图片',
    '📁',
    async () => {
      await showImageUploadDialog()
    },
    isChat
  )
  ul.appendChild(uploadItem)

  // 添加自动阅读按钮（仅非聊天模式）
  if (!isChat) {
    const autoReadItem = createMenuItem(
      '自动阅读所有回复',
      '📖',
      async () => {
        try {
          await autoReadAll()
        } catch (error) {
          notify(
            '自动阅读失败：' +
              (error && (error as any).message ? (error as any).message : String(error)),
            'error'
          )
        }
      },
      isChat
    )
    ul.appendChild(autoReadItem)

    const autoReadItem2 = createMenuItem(
      '全自动阅读所有帖子',
      '📖',
      async () => {
        try {
          await autoReadAllv2()
        } catch (error) {
          notify(
            '自动阅读失败：' +
              (error && (error as any).message ? (error as any).message : String(error)),
            'error'
          )
        }
      },
      isChat
    )
    ul.appendChild(autoReadItem2)
  }

  // 添加快捷输入按钮
  const quickInsertItem = createMenuItem(
    '快捷输入',
    '⎘',
    (e: MouseEvent) => {
      e.stopPropagation()

      const targetBtn = e.currentTarget as HTMLElement
      const forceMobile = (cachedState.settings as any)?.forceMobileMode || false
      const isMobile = forceMobile || isChat
      const menu = createQuickInsertMenu()

      if (isMobile) {
        let modalPortal = DQS('.modal-container') as HTMLElement | null
        if (!modalPortal) {
          modalPortal = createE('div', { class: 'modal-container' }) as HTMLElement
          DOA(modalPortal)
        }

        // Clear previous content
        modalPortal.innerHTML = ''

        const backdrop = createE('div', { class: 'd-modal__backdrop' })
        backdrop.addEventListener('click', () => {
          if (modalPortal) modalPortal.innerHTML = ''
        })

        modalPortal.appendChild(menu)
        modalPortal.appendChild(backdrop)
      } else {
        let portal = DQS('#d-menu-portals') as HTMLElement | null
        if (!portal) {
          portal = createE('div', { id: 'd-menu-portals' }) as HTMLDivElement
          DOA(portal)
        }

        portal.appendChild(menu)

        // Position relative to the menu item
        const rect = targetBtn.getBoundingClientRect()
        menu.style.position = 'fixed'
        menu.style.zIndex = '1000001'

        // 尝试放在右侧
        let left = rect.right + 5
        let top = rect.top

        // 如果右侧空间不足，放左侧
        if (left + 300 > window.innerWidth) {
          left = Math.max(8, rect.left - 300 - 5)
        }

        // 如果底部空间不足，向上调整
        const menuRect = menu.getBoundingClientRect()
        if (top + menuRect.height > window.innerHeight) {
          top = Math.max(5, window.innerHeight - menuRect.height - 5)
        }

        menu.style.top = `${top}px`
        menu.style.left = `${left}px`

        // 点击外部关闭
        const removeMenu = (evt: Event) => {
          if (!menu.contains(evt.target as Node)) {
            if (menu.parentElement) menu.parentElement.removeChild(menu)
            document.removeEventListener('click', removeMenu)
          }
        }

        setTimeout(() => {
          document.addEventListener('click', removeMenu)
        }, 100)
      }
    },
    isChat
  )
  ul.appendChild(quickInsertItem)

  // 从后端配置加载额外菜单项
  const backendUploadConfig = (cachedState.settings as any)?.uploadMenuItems || {}

  // 添加 autoItems（在新标签页中打开的链接）
  if (Array.isArray(backendUploadConfig.autoItems)) {
    backendUploadConfig.autoItems.forEach(([text, icon, url]: any) => {
      const autoItem = createMenuItem(
        text,
        icon,
        () => {
          try {
            window.open(url, '_blank')
          } catch {
            window.location.href = url
          }
        },
        isChat
      )
      ul.appendChild(autoItem)
    })
  }

  // 添加侧边栏项
  if (Array.isArray(backendUploadConfig.sides)) {
    backendUploadConfig.sides.forEach(([text, icon, url, className]: any) => {
      const sideItem = createMenuItem(
        text,
        icon,
        () => {
          const existing = DQS(`.${className}`) as HTMLElement | null
          if (existing) return
          createAndShowSideIframeModal(url, () => false, {
            title: text,
            className: className,
            icon: icon
          })
        },
        isChat
      )
      ul.appendChild(sideItem)
    })
  }

  // 添加 iframe 模态框项
  if (Array.isArray(backendUploadConfig.iframes)) {
    backendUploadConfig.iframes.forEach(([text, icon, url, className]: any) => {
      const iframeItem = createMenuItem(
        text,
        icon,
        () => {
          const existing = DQS(`.${className}`) as HTMLElement | null
          if (existing) return
          createAndShowIframeModal(
            url,
            href => {
              try {
                const u = new URL(href)
                return u.hostname.endsWith('linux.do')
              } catch {
                return false
              }
            },
            {
              title: text,
              className: className,
              style:
                'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:80%;max-width:900px;height:80%;max-height:700px;border-radius:8px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,0.3);z-index:100000;cursor:move'
            }
          )
        },
        isChat
      )
      ul.appendChild(iframeItem)
    })
  }
}

/**
 * 观察菜单打开事件
 */
function observeMenuOpen() {
  // 使用 MutationObserver 监听菜单容器的出现
  const observer = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof HTMLElement)) continue

        // 检查是否是菜单容器
        for (const selector of MENU_CONTAINER_SELECTORS) {
          if (node.matches(selector)) {
            const isChat = selector.includes('chat-composer')
            injectButtonsToMenu(node, isChat)
          }

          // 也检查子元素
          const menu = node.querySelector(selector)
          if (menu instanceof HTMLElement) {
            const isChat = selector.includes('chat-composer')
            injectButtonsToMenu(menu, isChat)
          }
        }
      }
    }
  })

  // 监听 body 和 #d-menu-portals
  observer.observe(document.body, { childList: true, subtree: true })

  const portals = document.getElementById('d-menu-portals')
  if (portals) {
    observer.observe(portals, { childList: true, subtree: true })
  }

  return observer
}

/**
 * 初始化子菜单注入功能
 */
export function initSubmenuInjector() {
  console.log('[Submenu Injector] Initializing experimental submenu injection...')

  // 开始观察菜单打开
  const observer = observeMenuOpen()

  // 也处理已经存在的菜单
  for (const selector of MENU_CONTAINER_SELECTORS) {
    const menu = document.querySelector(selector)
    if (menu instanceof HTMLElement) {
      const isChat = selector.includes('chat-composer')
      injectButtonsToMenu(menu, isChat)
    }
  }

  console.log('[Submenu Injector] Submenu injection initialized')

  return () => {
    observer.disconnect()
  }
}
