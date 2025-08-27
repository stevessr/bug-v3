import { createEmojiButtonElement } from './genbotton'
import { PICKER_CLASS, BUTTON_CLASS } from './css'
import { startExternalButtonListenerLoop } from '../loop/main'
import { recordUsage } from '../../data/store/main'
import store from '../../data/store/main'

export type InjectorConfig = {
  toolbarSelector?: string
  emojiButtonClass?: string
  emojiPickerClass?: string
  textAreaSelector?: string
  richEditorSelector?: string
  emojiContentGeneratorFn: () => string | Promise<string>
  pollInterval?: number
}

/**
 * 注入器：在页面上创建按钮和弹出选择器，并返回一个 cleanup 函数以便移除所有监听和 DOM。
 * - 会轮询查找 toolbar（或使用默认选择器），并在找到时插入按钮
 * - 点击按钮会创建 picker，并注入 emojiContentGeneratorFn 的 HTML
 */
export function injectNachonekoEmojiFeature(cfg: InjectorConfig) {
  const config: Required<InjectorConfig> = {
    // include both the role'd toolbar and a fallback plain class selector
    toolbarSelector:
      cfg.toolbarSelector || '.d-editor-button-bar[role="toolbar"], .d-editor-button-bar',
    emojiButtonClass: cfg.emojiButtonClass || BUTTON_CLASS,
    emojiPickerClass: cfg.emojiPickerClass || PICKER_CLASS,
    textAreaSelector: cfg.textAreaSelector || 'textarea.d-editor-input',
    richEditorSelector: cfg.richEditorSelector || '.ProseMirror.d-editor-input',
    emojiContentGeneratorFn: cfg.emojiContentGeneratorFn,
    pollInterval: cfg.pollInterval || 2000, // Reduced frequency from 500ms to 2s
  }

  if (typeof document === 'undefined') {
    return {
      stop: () => {},
    }
  }

  // NOTE: do not inject any styles into the page — styles come from the host site or static assets.

  let stopped = false
  const listeners: Array<() => void> = []
  const createdNodes: Node[] = []

  const isMiniReply = () => {
    const replyEle = document.querySelector('#reply-control')
    return !!(replyEle && replyEle.className.includes('hide-preview') && window.innerWidth < 1600)
  }

  function attachPickerBehavior(emojiButton: HTMLElement) {
    function handleClick(event: MouseEvent) {
      event.stopPropagation()
      const existingPicker = document.querySelector(`.${config.emojiPickerClass}`)
      if (existingPicker) {
        existingPicker.remove()
        try {
          emojiButton.setAttribute('aria-expanded', 'false')
        } catch (_) {}
        document.removeEventListener('click', handleClickOutside)
        return
      }

      // generator() returns the full picker markup (root element like in simple.html).
      const container = document.createElement('div')
      // support generator returning either string or Promise<string>
      try {
        const result = config.emojiContentGeneratorFn()
        if (result && typeof (result as any).then === 'function') {
          ;(result as Promise<string>).then((html) => {
            try {
              container.innerHTML = (html || '').trim()
              const emojiPicker = container.firstElementChild as HTMLElement | null
              if (!emojiPicker) return
              // ensure the picker has the configured picker class so toggle detection works
              try {
                emojiPicker.classList.add(config.emojiPickerClass)
              } catch (_) {}
              // append the generator-produced root node directly
              document.body.appendChild(emojiPicker)
              createdNodes.push(emojiPicker)
            } catch (_) {}
          })
        } else {
          container.innerHTML = String(result || '').trim()
        }
      } catch (err) {
        try {
          container.innerHTML = String(config.emojiContentGeneratorFn() || '').trim()
        } catch (_) {
          container.innerHTML = ''
        }
      }
      const emojiPicker = container.firstElementChild as HTMLElement | null
      if (!emojiPicker) return
      // ensure the picker has the configured picker class so toggle detection works
      try {
        emojiPicker.classList.add(config.emojiPickerClass)
      } catch (_) {}
      // append the generator-produced root node directly (if not already appended by async branch)
      if (!document.body.contains(emojiPicker)) {
        document.body.appendChild(emojiPicker)
        createdNodes.push(emojiPicker)
      } else {
        createdNodes.push(emojiPicker)
      }

      // Debug: log current emojis inside the newly opened picker for diagnosis
      try {
        const imgs = Array.from(
          emojiPicker.querySelectorAll('.emoji-picker__section-emojis .emoji, img'),
        ) as HTMLImageElement[]
        const emojiSnapshot = imgs
          .map((el) => {
            try {
              return {
                alt: (el.alt || '').toString(),
                src: (el.src || el.getAttribute('src') || '').toString(),
                uuid: (
                  el.getAttribute('data-uuid') ||
                  el.getAttribute('data-UUID') ||
                  ''
                ).toString(),
                width: el.getAttribute('data-width') || (el.width ? String(el.width) : null),
                height: el.getAttribute('data-height') || (el.height ? String(el.height) : null),
              }
            } catch (_) {
              return null
            }
          })
          .filter(Boolean)
        console.log(
          '[nacho-inject] emojiPicker opened, emoji snapshot:',
          emojiSnapshot.slice(0, 50),
        )
      } catch (_) {}

      // 统一定位逻辑：优先使用回复控件(`#reply-control`)定位（若存在），否则回退到编辑器包裹器定位
      const replyControl = document.querySelector('#reply-control')
      if (replyControl) {
        const replyRect = (replyControl as Element).getBoundingClientRect()
        emojiPicker.style.position = 'fixed'
        emojiPicker.style.bottom = replyRect.top - 5 + 'px'
        emojiPicker.style.left = replyRect.left + 'px'
        const imagePanel = emojiPicker.querySelector('img')
        if (imagePanel) {
          ;(imagePanel as HTMLElement).style.width = '80px'
          ;(imagePanel as HTMLElement).style.height = '85px'
        }
      } else {
        const editorWrapper = document.querySelector('.d-editor-textarea-wrapper')
        if (editorWrapper) {
          const editorRect = (editorWrapper as Element).getBoundingClientRect()
          emojiPicker.style.position = 'fixed'
          if (isMiniReply()) {
            emojiPicker.style.top = editorRect.top + 'px'
            emojiPicker.style.left =
              editorRect.left + editorRect.width / 2 - emojiPicker.clientWidth / 2 + 'px'
          } else {
            emojiPicker.style.top = editorRect.top + 'px'
            emojiPicker.style.left = editorRect.right + 10 + 'px'
          }
        }
      }

      function handleClickOutside(e: MouseEvent) {
        if (emojiPicker && !emojiPicker.contains(e.target as Node)) {
          emojiPicker.remove()
          try {
            emojiButton.setAttribute('aria-expanded', 'false')
          } catch (_) {}
          document.removeEventListener('click', handleClickOutside)
        }
      }

      setTimeout(() => {
        document.addEventListener('click', handleClickOutside)
        listeners.push(() => document.removeEventListener('click', handleClickOutside))
      }, 0)

      // Attach filter input listener using DOM APIs (avoids inline script and works with CSP)
      try {
        const filterInput = emojiPicker.querySelector('.filter-input') as HTMLInputElement | null
        if (filterInput) {
          const filterHandler = function () {
            try {
              const q = (filterInput.value || '').trim().toLowerCase()
              const imgs = emojiPicker.querySelectorAll('.emoji-picker__section-emojis .emoji')
              imgs.forEach((img) => {
                try {
                  const txt = (
                    img.getAttribute('data-emoji') ||
                    img.getAttribute('alt') ||
                    ''
                  ).toLowerCase()
                  if (!q) (img as HTMLElement).style.display = ''
                  else (img as HTMLElement).style.display = txt.includes(q) ? '' : 'none'
                } catch (_) {}
              })
            } catch (_) {}
          }
          filterInput.addEventListener('input', filterHandler)
          listeners.push(() => filterInput.removeEventListener('input', filterHandler))
        }
      } catch (_) {}
      // mark the trigger as expanded
      try {
        emojiButton.setAttribute('aria-expanded', 'true')
      } catch (_) {}

      emojiPicker.addEventListener('click', function (e) {
        const target = e.target as HTMLElement
        if (target && target.tagName === 'IMG') {
          // record usage if the image has a UUID data attribute
          try {
            const idAttr =
              (target as HTMLElement).getAttribute('data-uuid') ||
              (target as HTMLElement).getAttribute('data-UUID')
            if (idAttr) recordUsage(idAttr)
          } catch (_) {}
          const textArea = document.querySelector(
            config.textAreaSelector,
          ) as HTMLTextAreaElement | null
          const richEle = document.querySelector(config.richEditorSelector) as HTMLElement | null
          if (!textArea && !richEle) {
            console.error('找不到输入框')
            return
          }

          const imgElement = target as HTMLImageElement
          let width = imgElement.getAttribute('data-width') || '500'
          let height = imgElement.getAttribute('data-height') || '500'
          if (!imgElement.getAttribute('data-width') || !imgElement.getAttribute('data-height')) {
            const match = imgElement.src.match(/_(\d{3,})x(\d{3,})\./)
            if (match) {
              width = match[1]
              height = match[2]
            }
          }

          // Get current settings for image scale and output format
          const settings = store.getSettings()
          const imageScale = settings.imageScale || 30
          const outputFormat = settings.outputFormat || 'markdown'

          if (textArea) {
            let emojiText = ''
            if (outputFormat === 'html') {
              emojiText = `<img src="${imgElement.src}" alt="${imgElement.alt}" width="${Math.round((parseInt(width) * imageScale) / 100)}" height="${Math.round((parseInt(height) * imageScale) / 100)}" />`
            } else {
              // Default to markdown format
              emojiText = `![${imgElement.alt}|${width}x${height},${imageScale}%](${imgElement.src}) `
            }

            const startPos = textArea.selectionStart
            const endPos = textArea.selectionEnd
            textArea.value =
              textArea.value.substring(0, startPos) +
              emojiText +
              textArea.value.substring(endPos, textArea.value.length)
            textArea.selectionStart = textArea.selectionEnd = startPos + emojiText.length
            textArea.focus()
            const event = new Event('input', { bubbles: true, cancelable: true })
            textArea.dispatchEvent(event)
          } else if (richEle) {
            const scaledWidth = Math.round((parseInt(width) * imageScale) / 100)
            const scaledHeight = Math.round((parseInt(height) * imageScale) / 100)
            const imgTemplate = `<img src="${imgElement.src}" alt="${imgElement.alt}" width="${width}" height="${height}" data-scale="${imageScale}" style="width: ${scaledWidth}px; height: ${scaledHeight}px">`
            try {
              const dt = new DataTransfer()
              dt.setData('text/html', imgTemplate)
              const evt = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true })
              richEle.dispatchEvent(evt)
            } catch (_) {
              try {
                document.execCommand('insertHTML', false, imgTemplate)
              } catch (err) {
                console.error('无法向富文本编辑器中插入表情', err)
              }
            }
          }

          if (emojiPicker) emojiPicker.remove()
          try {
            emojiButton.setAttribute('aria-expanded', 'false')
          } catch (_) {}
        }
      })
    }

    emojiButton.addEventListener('click', handleClick)
    listeners.push(() => emojiButton.removeEventListener('click', handleClick))
  }

  // Track which toolbars we've already processed to prevent duplicate injection
  const processedToolbars = new WeakSet<Element>()

  // helper to detect toolbar and insert the emoji button if missing
  function checkAndInsert() {
    if (stopped) return
    try {
      const toolbars = document.querySelectorAll(config.toolbarSelector)

      toolbars.forEach((toolbar) => {
        // Skip if we've already processed this toolbar
        if (processedToolbars.has(toolbar)) {
          return
        }

        // Check if this toolbar already has our button
        const existingButton = toolbar.querySelector(`.${config.emojiButtonClass}`)
        if (existingButton) {
          processedToolbars.add(toolbar)
          return
        }

        console.log('[nacho-inject] inserting emoji button into new toolbar', toolbar)
        const emojiButton = createEmojiButtonElement({ buttonClass: config.emojiButtonClass })
        toolbar.appendChild(emojiButton)
        createdNodes.push(emojiButton)
        attachPickerBehavior(emojiButton)
        processedToolbars.add(toolbar)
        console.log('[nacho-inject] emoji button appended')
      })
    } catch (err) {
      console.log('[nacho-inject] checkAndInsert error', err)
    }
    // If no toolbar found at all, create a floating button as a fallback so tests/pages without the
    // site's toolbar can still open the picker. Only create one floating button per page.
    try {
      const existingFloating = document.querySelector(
        `.${config.emojiButtonClass}.nacho-floating-btn`,
      )
      const anyToolbar = document.querySelector(config.toolbarSelector)
      if (!anyToolbar && !existingFloating && document.body) {
        const floatingBtn = createEmojiButtonElement({ buttonClass: config.emojiButtonClass })
        floatingBtn.classList.add('nacho-floating-btn')
        // simple inline styles to ensure visibility in tests
        floatingBtn.style.position = 'fixed'
        floatingBtn.style.right = '12px'
        floatingBtn.style.bottom = '12px'
        floatingBtn.style.zIndex = '2147483647'
        floatingBtn.style.width = '44px'
        floatingBtn.style.height = '44px'
        floatingBtn.style.borderRadius = '8px'
        document.body.appendChild(floatingBtn)
        createdNodes.push(floatingBtn)
        attachPickerBehavior(floatingBtn)
        console.log('[nacho-inject] floating emoji button appended')
      }
    } catch (e) {
      console.warn('[nacho-inject] failed to append floating button', e)
    }
  }

  // run an initial check
  checkAndInsert()

  // start a polling fallback
  const pollId = window.setInterval(() => {
    checkAndInsert()
  }, config.pollInterval)

  // mutation observer to react when DOM changes (faster than polling)
  let observer: MutationObserver | null = null
  try {
    observer = new MutationObserver(() => {
      checkAndInsert()
      attachExternalButtonListeners()
    })
    if (document.body) observer.observe(document.body, { childList: true, subtree: true })
  } catch (_) {
    observer = null
  }

  // 启动外部按钮监听循环
  const stopExternalLoop = startExternalButtonListenerLoop({
    selectors: undefined,
    emojiButtonClass: config.emojiButtonClass,
    textAreaSelector: config.textAreaSelector,
    interval: config.pollInterval,
  })
  listeners.push(() => stopExternalLoop())

  // 外部按钮选择器列表（依据提供的 HTML 片段）
  const externalButtonSelectors = [
    '#create-topic',
    '.topic-drafts-menu-trigger',
    'button.post-action-menu__reply',
    'button.reply.create',
    'button.create.reply-to-post',
    '.topic-footer-button',
  ]

  function externalClickHandler(this: Element, ev: Event) {
    // 尝试触发工具栏的 emoji 按钮来打开选择器
    const btn = document.querySelector(`.${config.emojiButtonClass}`) as HTMLElement | null
    if (btn) {
      // 延迟触发，以便原始点击事件之类的优先执行
      setTimeout(() => btn.click(), 0)
    } else {
      // 若找不到工具栏按钮，尝试聚焦输入框作为回退
      const ta = document.querySelector(config.textAreaSelector) as HTMLTextAreaElement | null
      if (ta) ta.focus()
    }
    // 不阻止原始事件，允许页面原有行为继续
  }

  function attachExternalButtonListeners() {
    try {
      externalButtonSelectors.forEach((sel) => {
        const nodes = Array.from(document.querySelectorAll(sel)) as Element[]
        nodes.forEach((n) => {
          if (!n.getAttribute('data-nacho-listener')) {
            n.addEventListener('click', externalClickHandler)
            n.setAttribute('data-nacho-listener', '1')
            listeners.push(() => n.removeEventListener('click', externalClickHandler))
            // track node so cleanup will remove it if necessary
            createdNodes.push(n)
          }
        })
      })
    } catch (err) {
      // 忽略扫描过程中的异常，保持注入器稳定
      // console.warn('attachExternalButtonListeners error', err)
    }
  }

  function stop() {
    stopped = true
    window.clearInterval(pollId)
    try {
      if (observer) observer.disconnect()
    } catch (_) {}
    listeners.forEach((fn) => {
      try {
        fn()
      } catch (_) {}
    })
    // 移除创建的 DOM
    createdNodes.forEach((n) => n && n.parentNode && n.parentNode.removeChild(n))
    // 不移除样式（注入器不负责样式）
  }

  return { stop }
}

export default injectNachonekoEmojiFeature
