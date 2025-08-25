/**
 * 生成表情包选择器及其子元素的CSS样式字符串。
 * @returns {string} CSS样式字符串。
 */
/** 生成选择器的 CSS 字符串。可用于注入到页面。 */
export const PICKER_CLASS = 'nacho-emoji-picker'
export const BUTTON_CLASS = 'nacho-emoji-picker-button'

// 尝试通过 Vite 的 raw 导入读取独立 CSS 文件；当在非构建/非浏览器环境中或导入失败时，回退到内联生成器。
// Try to import the CSS as raw text via Vite. Use ts-ignore so type-checkers that
// don't know about Vite's ?raw will not fail the build.
// @ts-ignore
import pickerCssRaw from './picker.css?raw'
const rawPickerCss: string | null = (typeof pickerCssRaw === 'string' && pickerCssRaw) || null

export const generatePickerStyles = (pickerClass = PICKER_CLASS) => {
  if (rawPickerCss) {
    return rawPickerCss.replace(/__PICKER_CLASS__/g, pickerClass)
  }

  return `
  .${pickerClass} {
    position: static;
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 10px;
    max-height: 300px;
    overflow: auto;
    background-color: #f8f8f8;
    padding: 10px;
    border-radius: 5px;
    z-index: 9999;
  }
  .${pickerClass} img {
    cursor: pointer;
    width: 95px;
    height: 100px;
  }
`
}

/**
 * 将样式字符串注入到页面 head 中，返回创建或更新的 style 元素。
 * 如果在非浏览器环境中调用将返回 null。
 */
export function injectStyleString(styles: string, id = 'nacho-picker-styles') {
  if (typeof document === 'undefined') return null
  let el = document.getElementById(id) as HTMLStyleElement | null
  if (el) {
    el.innerText = styles
    return el
  }
  el = document.createElement('style')
  el.id = id
  el.type = 'text/css'
  el.innerText = styles
  document.head.appendChild(el)
  return el
}

export default generatePickerStyles
