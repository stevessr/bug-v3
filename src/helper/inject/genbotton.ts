import { BUTTON_CLASS } from './css'

/** 可选的按钮配置 */
export type EmojiButtonOptions = {
  baseClasses?: string[]
  buttonClass?: string
  title?: string
  content?: string
}

/**
 * 创建并返回表情包按钮的DOM元素。
 * 不会自动插入到文档中。
 */
export function createEmojiButtonElement(opts: EmojiButtonOptions = {}) {
  const {
    baseClasses = ['btn', 'no-text', 'btn-icon', 'toolbar__button'],
    buttonClass = BUTTON_CLASS,
    title = 'Nachoneko表情包',
    content = '🐈‍⬛',
  } = opts
  const emojiButton = document.createElement('button')
  emojiButton.classList.add(...baseClasses)
  if (buttonClass) emojiButton.classList.add(buttonClass)
  emojiButton.title = title
  emojiButton.type = 'button'
  emojiButton.innerHTML = content
  return emojiButton
}

export default createEmojiButtonElement
