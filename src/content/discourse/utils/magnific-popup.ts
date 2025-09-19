import type { AddEmojiButtonData } from '../types/main'
import { createE } from '../../utils/createEl'

import { setupButtonClickHandler } from './emoji-button'
import { extractNameFromUrl } from './picture'

export function isMagnificPopup(element: Element): boolean {
  return (
    element.classList &&
    element.classList.contains('mfp-wrap') &&
    element.classList.contains('mfp-gallery') &&
    element.querySelector('.mfp-img') !== null
  )
}

export function extractEmojiDataFromMfp(
  imgElement: HTMLImageElement,
  titleContainer: Element
): AddEmojiButtonData | null {
  const src = imgElement.src
  if (!src || !src.startsWith('http')) return null
  let name = ''
  const titleText = titleContainer.textContent || ''
  const titleParts = titleText.split('·')
  if (titleParts.length > 0) name = titleParts[0].trim()
  if (!name || name.length < 2) name = imgElement.alt || imgElement.title || extractNameFromUrl(src)
  name = name.trim() || '表情'
  return { name, url: src }
}

export function createMfpEmojiButton(data: AddEmojiButtonData): HTMLElement {
  const button = createE('a', {
    class: 'emoji-add-link',
    style: `color:#fff;background:linear-gradient(135deg,#4f46e5,#7c3aed);border-radius:6px;padding:4px 8px;margin:0 2px;display:inline-flex;align-items:center;font-weight:600;`,
    ti: '添加到未分组表情',
    in: '添加表情'
  })
  setupButtonClickHandler(button, data)
  return button
}

export function addEmojiButtonToMfp(mfpContainer: Element) {
  if (mfpContainer.querySelector('.emoji-add-link')) return
  const imgElement = mfpContainer.querySelector('.mfp-img') as HTMLImageElement
  const titleContainer = mfpContainer.querySelector('.mfp-title')
  if (!imgElement || !titleContainer) return
  const emojiData = extractEmojiDataFromMfp(imgElement, titleContainer)
  if (!emojiData) return
  const addButton = createMfpEmojiButton(emojiData)
  const downloadLink = titleContainer.querySelector('a.image-source-link')
  if (downloadLink) {
    titleContainer.insertBefore(document.createTextNode(' · '), downloadLink)
    titleContainer.insertBefore(addButton, downloadLink)
  } else {
    titleContainer.appendChild(document.createTextNode(' · '))
    titleContainer.appendChild(addButton)
  }
}

export function scanForMagnificPopup() {
  const mfpContainers = document.querySelectorAll('.mfp-wrap.mfp-gallery')
  mfpContainers.forEach(container => {
    if (isMagnificPopup(container)) addEmojiButtonToMfp(container)
  })
}

export function observeMagnificPopup() {
  const observer = new MutationObserver(mutations => {
    let changed = false
    mutations.forEach(m => {
      if (m.type === 'childList') {
        m.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const el = node as Element
            if (el.classList && el.classList.contains('mfp-wrap')) changed = true
          }
        })
      }
    })
    if (changed) setTimeout(scanForMagnificPopup, 100)
  })
  observer.observe(document.body, { childList: true, subtree: true })
}
