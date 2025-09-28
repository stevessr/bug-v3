// Popular emoji display module
import { userscriptState } from '../state'
import { getPopularEmojis, clearEmojiUsageStats, trackEmojiUsage } from '../userscript-storage'
import { createEl } from '../utils/createEl'
import { injectGlobalThemeStyles } from '../utils/themeSupport'
import { showTemporaryMessage } from '../utils/tempMessage'
import { ensureStyleInjected } from '../utils/injectStyles'

export function showPopularEmojisModal() {
  // Ensure theme styles are injected
  injectGlobalThemeStyles()

  const modal = createEl('div', {
    style: `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 999999;
      display: flex;
      align-items: center;
      justify-content: center;
    `
  })

  const popularEmojis = getPopularEmojis(50) // Get top 50 popular emojis

  const content = createEl('div', {
    style: `
      background: var(--secondary);
      color: var(--emoji-modal-text);
      border-radius: 8px;
      padding: 24px;
      max-height: 80vh;
      overflow-y: auto;
      position: relative;
    `,
    innerHTML: `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
      <h2 style="margin: 0; color: var(--emoji-modal-text);">常用表情 (${popularEmojis.length})</h2>
      <div style="display: flex; gap: 8px; align-items: center;">
        <button id="clearStats" style="padding: 6px 12px; background: #ff4444; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">清空统计</button>
        <button id="closeModal" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #999;">×</button>
      </div>
    </div>
    
    <div style="margin-bottom: 16px; padding: 12px; background: var(--emoji-modal-button-bg); border-radius: 6px; border: 1px solid var(--emoji-modal-border);">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span style="font-weight: 500; color: var(--emoji-modal-label);">表情按使用次数排序</span>
        <span style="font-size: 12px; color: var(--emoji-modal-text);">点击表情直接使用</span>
      </div>
      <div style="font-size: 12px; color: var(--emoji-modal-text);">
        总使用次数: ${popularEmojis.reduce((sum, emoji) => sum + emoji.count, 0)}
      </div>
    </div>
    
    <div id="popularEmojiGrid" style="
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
      gap: 8px;
      max-height: 400px;
      overflow-y: auto;
    ">
      ${
        popularEmojis.length === 0
          ? '<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--emoji-modal-text);">还没有使用过表情<br><small>开始使用表情后，这里会显示常用的表情</small></div>'
          : popularEmojis
              .map(
                emoji => `
          <div class="popular-emoji-item" data-name="${emoji.name}" data-url="${emoji.url}" style="
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 8px;
            border: 1px solid var(--emoji-modal-border);
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.2s;
            background: var(--emoji-modal-button-bg);
          ">
            <img src="${emoji.url}" alt="${emoji.name}" style="
              width: 40px;
              height: 40px;
              object-fit: contain;
              margin-bottom: 4px;
            ">
            <div style="
              font-size: 11px;
              font-weight: 500;
              color: var(--emoji-modal-text);
              text-align: center;
              word-break: break-all;
              line-height: 1.2;
              margin-bottom: 2px;
            ">${emoji.name}</div>
            <div style="
              font-size: 10px;
              color: var(--emoji-modal-text);
              opacity: 0.6;
              text-align: center;
            ">使用${emoji.count}次</div>
          </div>
        `
              )
              .join('')
      }
    </div>
    
    ${
      popularEmojis.length > 0
        ? `
      <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--emoji-modal-border); font-size: 12px; color: var(--emoji-modal-text); opacity: 0.6; text-align: center;">
        统计数据保存在本地，清空统计将重置所有使用记录
      </div>
    `
        : ''
    }
  `
  })

  modal.appendChild(content)
  document.body.appendChild(modal)

  // Add hover effects for emoji items
  const id = 'popular-emojis-styles'
  const css = `
    .popular-emoji-item:hover {
      transform: translateY(-2px);
      border-color: var(--emoji-modal-primary-bg) !important;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }
  `
  ensureStyleInjected(id, css)

  // Event listeners
  content.querySelector('#closeModal')?.addEventListener('click', () => {
    modal.remove()
  })

  content.querySelector('#clearStats')?.addEventListener('click', () => {
    if (confirm('确定要清空所有表情使用统计吗？此操作不可撤销。')) {
      clearEmojiUsageStats()
      modal.remove()

      // Show success message
      showTemporaryMessage('表情使用统计已清空')

      // Reopen the modal to show updated state
      setTimeout(() => showPopularEmojisModal(), 300)
    }
  })

  // Add click handlers for emoji items
  const emojiItems = content.querySelectorAll('.popular-emoji-item')
  emojiItems.forEach(item => {
    item.addEventListener('click', () => {
      const name = item.getAttribute('data-name')
      const url = item.getAttribute('data-url')

      if (name && url) {
        // Track usage
        trackEmojiUsage(name, url)

        // Use the emoji (same logic as in emoji picker)
        useEmojiFromPopular(name, url)

        // Close modal
        modal.remove()
        // Show feedback
        showTemporaryMessage(`已使用表情: ${name}`)
      }
    })
  })

  // Close on outside click
  modal.addEventListener('click', e => {
    if (e.target === modal) {
      modal.remove()
    }
  })
}

function useEmojiFromPopular(name: string, url: string) {
  // Find the active text area or input
  const activeElement = document.activeElement as HTMLElement

  if (
    activeElement &&
    (activeElement.tagName === 'TEXTAREA' || activeElement.tagName === 'INPUT')
  ) {
    const textArea = activeElement as HTMLTextAreaElement | HTMLInputElement
    const format = userscriptState.settings.outputFormat

    let emojiText = ''
    if (format === 'markdown') {
      emojiText = `![${name}](${url})`
    } else {
      emojiText = `<img src="${url}" alt="${name}" style="width: ${userscriptState.settings.imageScale}px; height: ${userscriptState.settings.imageScale}px;">`
    }

    // Insert at cursor position
    const start = textArea.selectionStart || 0
    const end = textArea.selectionEnd || 0
    const currentValue = textArea.value

    textArea.value = currentValue.slice(0, start) + emojiText + currentValue.slice(end)

    // Move cursor to end of inserted text
    const newPosition = start + emojiText.length
    textArea.setSelectionRange(newPosition, newPosition)

    // Trigger input event to notify frameworks
    textArea.dispatchEvent(new Event('input', { bubbles: true }))
    textArea.focus()
  } else {
    // Try to find the most recently focused text area
    const textAreas = document.querySelectorAll(
      'textarea, input[type="text"], [contenteditable="true"]'
    )
    const lastTextArea = Array.from(textAreas).pop() as HTMLElement

    if (lastTextArea) {
      lastTextArea.focus()

      if (lastTextArea.tagName === 'TEXTAREA' || lastTextArea.tagName === 'INPUT') {
        const format = userscriptState.settings.outputFormat
        let emojiText = ''
        if (format === 'markdown') {
          emojiText = `![${name}](${url})`
        } else {
          emojiText = `<img src="${url}" alt="${name}" style="width: ${userscriptState.settings.imageScale}px; height: ${userscriptState.settings.imageScale}px;">`
        }

        const textarea = lastTextArea as HTMLTextAreaElement | HTMLInputElement
        textarea.value += emojiText
        textarea.dispatchEvent(new Event('input', { bubbles: true }))
      }
    }
  }
}
