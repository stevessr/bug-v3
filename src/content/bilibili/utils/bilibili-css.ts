/**
 * 注入按钮样式修复 CSS
 */
import { DEBI, createE, DHA } from '@/content/utils/createEl'

export function injectBilibiliButtonStyles() {
  // Check if styles are already injected
  const id = 'bilibili-emoji-button-fixes'
  if (DEBI(id)) return

  const style = createE('style', {
    id: id,
    text: `
    /* Bilibili Button Styling Fixes */
    .bili-album__watch__control__option.add-emoji {
      background: inherit !important;
      color: inherit !important;
      font-size: inherit !important;
      font-weight: inherit !important;
      padding: inherit !important;
      border-radius: inherit !important;
      transition: inherit !important;
      display: flex !important;
      align-items: center !important;
      gap: 4px !important;
      cursor: pointer !important;
      user-select: none !important;
    }

    .bili-album__watch__control__option.add-emoji:hover {
      background: inherit !important;
      color: inherit !important;
    }

    .bili-album__watch__control__option.add-emoji svg {
      fill: currentColor !important;
      width: 14px !important;
      height: 14px !important;
    }

    .bili-album__watch__control__option.add-emoji span {
      color: inherit !important;
      font-size: inherit !important;
      font-weight: inherit !important;
    }

    .pswp__button.bili-emoji-add-btn {
      position: relative !important;
      display: block !important;
      width: 44px !important;
      height: 44px !important;
      background: none !important;
      border: none !important;
      cursor: pointer !important;
      overflow: visible !important;
      appearance: none !important;
      box-shadow: none !important;
      opacity: 0.75 !important;
      transition: opacity 0.2s !important;
      color: #fff !important;
      font-size: 18px !important;
      line-height: 44px !important;
      text-align: center !important;
    }

    .pswp__button.bili-emoji-add-btn:hover {
      opacity: 1 !important;
    }
  `
  })
  DHA(style)
}
