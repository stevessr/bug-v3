import { cachedState } from './state'
import { getDefaultEmojis } from './default'
import type { emoji } from './types'

export function isMobile(): boolean {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    (window.innerWidth <= 768)
}

export async function createEmojiPicker(isMobilePicker: boolean): Promise<HTMLElement> {
  const picker = document.createElement('div')
  picker.className = 'emoji-picker-container'
  
  if (isMobilePicker) {
    picker.className += ' mobile-picker'
    picker.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 90%;
      max-width: 400px;
      max-height: 80vh;
      background: white;
      border-radius: 12px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
      z-index: 10000;
      overflow-y: auto;
      padding: 20px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `
  } else {
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
      padding: 16px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `
  }

  // Add header
  const header = document.createElement('div')
  header.style.cssText = `
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid #eee;
  `
  header.innerHTML = `
    <h3 style="margin: 0; font-size: 16px; font-weight: 600;">表情包</h3>
    <button class="close-btn" style="
      background: none;
      border: none;
      font-size: 18px;
      cursor: pointer;
      padding: 4px;
      border-radius: 4px;
      color: #666;
    ">✕</button>
  `
  
  header.querySelector('.close-btn')?.addEventListener('click', () => {
    picker.remove()
  })

  picker.appendChild(header)

  // Add emoji groups
  const groups = cachedState.emojiGroups.length > 0 ? cachedState.emojiGroups : getDefaultEmojis()
  
  groups.forEach(group => {
    const groupSection = document.createElement('div')
    groupSection.style.cssText = `
      margin-bottom: 16px;
    `
    
    const groupTitle = document.createElement('div')
    groupTitle.style.cssText = `
      font-size: 14px;
      font-weight: 600;
      color: #333;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 6px;
    `
    
    // Handle icon that could be string or URL
    const iconDisplay = typeof group.icon === 'string' ? group.icon : '📷'
    groupTitle.innerHTML = `
      <span>${iconDisplay}</span>
      <span>${group.displayName || '未命名'}</span>
    `
    
    groupSection.appendChild(groupTitle)
    
    // Add emoji grid
    const emojiGrid = document.createElement('div')
    emojiGrid.style.cssText = `
      display: grid;
      grid-template-columns: repeat(${cachedState.settings.gridColumns || 4}, 1fr);
      gap: 8px;
    `
    
    if (group.emojis && Array.isArray(group.emojis)) {
      group.emojis.forEach((emojiData: emoji) => {
        const emojiButton = document.createElement('button')
        emojiButton.style.cssText = `
          background: none;
          border: none;
          cursor: pointer;
          padding: 8px;
          border-radius: 6px;
          font-size: ${cachedState.settings.imageScale || 30}px;
          transition: background-color 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 40px;
        `
        
        // Use displayUrl for showing, realUrl for actual insertion
        const img = document.createElement('img')
        img.src = emojiData.displayUrl.toString()
        img.alt = emojiData.displayName
        img.style.cssText = `
          max-width: ${cachedState.settings.imageScale || 30}px;
          max-height: ${cachedState.settings.imageScale || 30}px;
          object-fit: contain;
        `
        
        emojiButton.appendChild(img)
        
        emojiButton.addEventListener('click', () => {
          insertEmoji(emojiData)
          picker.remove()
        })
        
        emojiButton.addEventListener('mouseenter', () => {
          emojiButton.style.backgroundColor = '#f0f0f0'
        })
        
        emojiButton.addEventListener('mouseleave', () => {
          emojiButton.style.backgroundColor = 'transparent'
        })
        
        emojiGrid.appendChild(emojiButton)
      })
    }
    
    groupSection.appendChild(emojiGrid)
    picker.appendChild(groupSection)
  })

  return picker
}

function insertEmoji(emojiData: emoji) {
  const activeElement = document.activeElement as HTMLElement
  
  if (activeElement.tagName === 'TEXTAREA' || activeElement.tagName === 'INPUT') {
    const input = activeElement as HTMLTextAreaElement | HTMLInputElement
    const start = input.selectionStart || 0
    const end = input.selectionEnd || 0
    const text = input.value
    
    let emojiText: string
    switch (cachedState.settings.outputFormat) {
      case 'html':
        emojiText = `<img src="${emojiData.realUrl.toString()}" alt="${emojiData.displayName}" />`
        break
      case 'bbcode':
        emojiText = `[img]${emojiData.realUrl.toString()}[/img]`
        break
      case 'markdown':
      default:
        emojiText = `![${emojiData.displayName}](${emojiData.realUrl.toString()})`
        break
    }
    
    input.value = text.substring(0, start) + emojiText + text.substring(end)
    input.selectionStart = input.selectionEnd = start + emojiText.length
    
    // Trigger input event
    input.dispatchEvent(new Event('input', { bubbles: true }))
  }
}