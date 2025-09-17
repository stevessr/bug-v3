// Autonomous Discourse Platform Script
// Self-contained script for Discourse forums, includes all necessary functions inline
// This script will be injected by chrome.scripting.executeScript

// ==== Platform Detection ====
function isDiscoursePage(): boolean {
    try {
      // Check for discourse meta tag as primary indicator
      const discourseMetaTags = document.querySelectorAll(
        'meta[name*="discourse"], meta[content*="discourse"], meta[property*="discourse"]'
      )
      if (discourseMetaTags.length > 0) {
        return true
      }

      // Check for common forum/discussion platforms
      const generatorMeta = document.querySelector('meta[name="generator"]')
      if (generatorMeta) {
        const content = generatorMeta.getAttribute('content')?.toLowerCase() || ''
        if (content.includes('discourse')) {
          return true
        }
      }

      // Check current domain - allow known discourse sites
      const hostname = window.location.hostname.toLowerCase()
      const discourseDomains = ['linux.do', 'meta.discourse.org']
      if (discourseDomains.some(domain => hostname.includes(domain))) {
        return true
      }

      // Check for editor elements that suggest discourse platform
      const editors = document.querySelectorAll(
        'textarea.d-editor-input, .ProseMirror.d-editor-input, .composer-input'
      )
      if (editors.length > 0) {
        return true
      }

      // Check for discourse-specific body classes
      const body = document.body
      if (
        body &&
        body.className &&
        (body.className.includes('discourse') || body.className.includes('ember-'))
      ) {
        return true
      }

      return false
    } catch (e) {
      console.error('[DiscourseScript] Platform detection failed', e)
      return false
    }
  }

  // ==== Element Creation Utilities ====
  function createEl(
    tagName: string,
    options: {
      className?: string
      style?: Partial<CSSStyleDeclaration>
      innerHTML?: string
      title?: string
      on?: { [event: string]: (e: Event) => void }
    } = {}
  ): HTMLElement {
    const el = document.createElement(tagName)

    if (options.className) {
      el.className = options.className
    }

    if (options.style) {
      Object.assign(el.style, options.style)
    }

    if (options.innerHTML) {
      el.innerHTML = options.innerHTML
    }

    if (options.title) {
      el.title = options.title
    }

    if (options.on) {
      Object.entries(options.on).forEach(([event, handler]) => {
        el.addEventListener(event, handler)
      })
    }

    return el
  }

  // ==== Chrome Extension Communication ====
  function sendToBackground(message: any): Promise<any> {
    return new Promise(resolve => {
      try {
        const chromeAPI = (window as any).chrome
        if (chromeAPI && chromeAPI.runtime && chromeAPI.runtime.sendMessage) {
          chromeAPI.runtime.sendMessage(message, (response: any) => {
            resolve(response || { success: false, error: 'No response' })
          })
        } else {
          console.warn('[DiscourseScript] Chrome runtime not available')
          resolve({ success: false, error: 'Chrome runtime not available' })
        }
      } catch (e) {
        console.error('[DiscourseScript] Failed to send message to background', e)
        resolve({ success: false, error: e.message })
      }
    })
  }

  // ==== Batch Parse Button ====
  function createBatchParseButton(cookedElement: Element): HTMLElement {
    const button = createEl('button', {
      className: 'emoji-batch-parse-button',
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        background: 'linear-gradient(135deg,#f59e0b,#d97706)',
        color: '#fff',
        borderRadius: '8px',
        padding: '8px 12px',
        margin: '10px 0',
        fontWeight: '600'
      },
      innerHTML: '一键解析并添加所有图片',
      title: '解析当前内容中的所有图片并添加到未分组表情',
      on: {
        click: async (e: Event) => {
          e.preventDefault()
          e.stopPropagation()

          const originalContent = button.innerHTML
          const originalStyle = button.style.cssText

          try {
            button.innerHTML = '正在解析...'
            button.style.background = 'linear-gradient(135deg, #6b7280, #4b5563)'

            const images = cookedElement.querySelectorAll(
              'img[src]'
            ) as NodeListOf<HTMLImageElement>
            let successCount = 0
            const totalCount = images.length

            if (totalCount === 0) {
              button.innerHTML = '未找到图片'
              button.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)'
              setTimeout(() => {
                button.innerHTML = originalContent
                button.style.cssText = originalStyle
              }, 2000)
              return
            }

            for (const img of images) {
              const src = img.src
              const name = img.alt || img.title || `表情-${Date.now()}`

              if (src && src.startsWith('http')) {
                const response = await sendToBackground({
                  action: 'addEmojiFromWeb',
                  emojiData: { name, url: src }
                })

                if (response.success) {
                  successCount++
                }
              }
            }

            if (successCount > 0) {
              button.innerHTML = `已添加 ${successCount}/${totalCount} 个表情`
              button.style.background = 'linear-gradient(135deg, #10b981, #059669)'
            } else {
              button.innerHTML = '添加失败'
              button.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)'
            }

            setTimeout(() => {
              button.innerHTML = originalContent
              button.style.cssText = originalStyle
            }, 3000)
          } catch (error) {
            console.error('[DiscourseScript] Batch parse failed', error)
            button.innerHTML = '解析出错'
            button.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)'
            setTimeout(() => {
              button.innerHTML = originalContent
              button.style.cssText = originalStyle
            }, 2000)
          }
        }
      }
    })

    return button
  }

  // ==== Single Image Add Button ====
  function createSingleAddButton(imgElement: HTMLImageElement): HTMLElement {
    const button = createEl('button', {
      className: 'discourse-single-add-btn',
      style: {
        position: 'absolute',
        top: '8px',
        right: '8px',
        background: 'rgba(0, 0, 0, 0.7)',
        border: 'none',
        borderRadius: '6px',
        color: '#fff',
        cursor: 'pointer',
        fontSize: '18px',
        padding: '6px',
        zIndex: '10000',
        transition: 'all 0.2s ease'
      },
      innerHTML: '➕',
      title: '添加此图片为表情',
      on: {
        click: async (e: Event) => {
          e.preventDefault()
          e.stopPropagation()

          const originalContent = button.innerHTML

          try {
            button.innerHTML = '⏳'

            const src = imgElement.src
            const name = imgElement.alt || imgElement.title || `表情-${Date.now()}`

            if (src && src.startsWith('http')) {
              const response = await sendToBackground({
                action: 'addEmojiFromWeb',
                emojiData: { name, url: src }
              })

              if (response.success) {
                button.innerHTML = '✅'
                button.style.background = 'rgba(34, 197, 94, 0.9)'
              } else {
                button.innerHTML = '❌'
                button.style.background = 'rgba(239, 68, 68, 0.9)'
              }
            } else {
              button.innerHTML = '❌'
              button.style.background = 'rgba(239, 68, 68, 0.9)'
            }

            setTimeout(() => {
              button.innerHTML = originalContent
              button.style.background = 'rgba(0, 0, 0, 0.7)'
            }, 2000)
          } catch (error) {
            console.error('[DiscourseScript] Single add failed', error)
            button.innerHTML = '❌'
            button.style.background = 'rgba(239, 68, 68, 0.9)'
            setTimeout(() => {
              button.innerHTML = originalContent
              button.style.background = 'rgba(0, 0, 0, 0.7)'
            }, 2000)
          }
        }
      }
    })

    return button
  }

  // ==== Content Scanning and Processing ====
  function scanForCookedContent() {
    try {
      const cookedElements = document.querySelectorAll('.cooked, .post-content, .topic-body')

      cookedElements.forEach(cooked => {
        // Skip if already processed
        if (cooked.querySelector('.emoji-batch-parse-button')) {
          return
        }

        const images = cooked.querySelectorAll('img[src]') as NodeListOf<HTMLImageElement>
        if (images.length > 0) {
          // Add batch parse button at the top of the content
          const batchButton = createBatchParseButton(cooked)
          cooked.insertBefore(batchButton, cooked.firstChild)

          // Add individual buttons to images
          images.forEach(img => {
            const parent = img.parentElement
            if (parent && !parent.querySelector('.discourse-single-add-btn')) {
              // Make parent relative for absolute positioning
              if (getComputedStyle(parent).position === 'static') {
                parent.style.position = 'relative'
              }

              const singleButton = createSingleAddButton(img)
              parent.appendChild(singleButton)
            }
          })
        }
      })
    } catch (e) {
      console.error('[DiscourseScript] Scan for cooked content failed', e)
    }
  }

  function scanForMagnificPopup() {
    try {
      // Look for magnific popup containers
      const magnific = document.querySelector('.mfp-container, .lightbox-wrapper, .image-wrapper')
      if (magnific) {
        const img = magnific.querySelector('img[src]') as HTMLImageElement
        if (img && !magnific.querySelector('.discourse-single-add-btn')) {
          // Make sure parent can handle absolute positioning
          if (getComputedStyle(magnific).position === 'static') {
            ;(magnific as HTMLElement).style.position = 'relative'
          }

          const button = createSingleAddButton(img)
          magnific.appendChild(button)
        }
      }
    } catch (e) {
      console.error('[DiscourseScript] Scan for magnific popup failed', e)
    }
  }

  // ==== DOM Observers ====
  function observeCookedContent() {
    const observer = new MutationObserver(mutations => {
      let shouldScan = false

      mutations.forEach(mutation => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as Element
              if (
                element.classList.contains('cooked') ||
                element.classList.contains('post-content') ||
                element.classList.contains('topic-body') ||
                element.querySelector('.cooked, .post-content, .topic-body')
              ) {
                shouldScan = true
              }
            }
          })
        }
      })

      if (shouldScan) {
        setTimeout(scanForCookedContent, 100)
      }
    })

    observer.observe(document.body, { childList: true, subtree: true })
  }

  function observeMagnificPopup() {
    const observer = new MutationObserver(mutations => {
      let shouldScan = false

      mutations.forEach(mutation => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as Element
              if (
                element.classList.contains('mfp-container') ||
                element.classList.contains('lightbox-wrapper') ||
                element.classList.contains('image-wrapper') ||
                element.querySelector('.mfp-container, .lightbox-wrapper, .image-wrapper')
              ) {
                shouldScan = true
              }
            }
          })
        }
      })

      if (shouldScan) {
        setTimeout(scanForMagnificPopup, 100)
      }
    })

    observer.observe(document.body, { childList: true, subtree: true })
  }

  // ==== Main Initialization ====
  function initDiscourseScript() {
    try {
      console.log('[DiscourseScript] Initializing...')

      if (!isDiscoursePage()) {
        console.log('[DiscourseScript] Not a Discourse page, skipping initialization')
        return
      }

      console.log('[DiscourseScript] Discourse page detected, starting feature injection')

      // Initial scans
      setTimeout(scanForCookedContent, 200)
      setTimeout(scanForMagnificPopup, 300)

      // Start observers
      observeCookedContent()
      observeMagnificPopup()

      console.log('[DiscourseScript] Initialization complete')
    } catch (e) {
      console.error('[DiscourseScript] Initialization failed', e)
    }
  }

  // ==== Auto-injection Detection and Request ====
  function requestBackendInjection() {
    try {
      // This function can be used to notify the background script
      // that this autonomous script is ready and functional
      sendToBackground({
        type: 'AUTONOMOUS_SCRIPT_READY',
        platform: 'discourse',
        url: window.location.href,
        timestamp: Date.now()
      })
    } catch (e) {
      console.error('[DiscourseScript] Failed to request backend injection', e)
    }
  }

  // ==== Entry Point ====
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initDiscourseScript)
} else {
  initDiscourseScript()
}

// Request backend injection
requestBackendInjection()
