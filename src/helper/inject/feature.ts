import injectNachonekoEmojiFeature from './main'
import { BUTTON_CLASS } from './css'

export type EmojiItem = {
  packet?: number
  name: string
  url: string
  width?: number
  height?: number
}

/**
 * 安装 Nachoneko 表情选择器特征。
 * @param emojis - 要展示的表情数组
 * @param opts - 可选配置，用于覆盖选择器/输入框选择器
 * @returns 注入器返回的 stop 函数容器
 */
export function installNachonekoPicker(
  emojis: EmojiItem[],
  opts?: { toolbarSelector?: string; textAreaSelector?: string; richEditorSelector?: string },
) {
  const generator = () =>
    emojis
      .map((e) => {
        const dw = e.width ? ` data-width="${e.width}"` : ''
        const dh = e.height ? ` data-height="${e.height}"` : ''
        return `<img src="${e.url}" alt="${e.name}" title="${e.name}"${dw}${dh} />`
      })
      .join('')

  const injector = injectNachonekoEmojiFeature({
    toolbarSelector: opts?.toolbarSelector,
    emojiButtonClass: BUTTON_CLASS,
    // emojiPickerClass will use default PICKER_CLASS from css.ts if not provided
    textAreaSelector: opts?.textAreaSelector,
    richEditorSelector: opts?.richEditorSelector,
    emojiContentGeneratorFn: generator,
  })

  return injector
}

const defaultEmojis: EmojiItem[] = [
  {
    packet: 1,
    name: '瞌睡',
    url: 'https://linux.do/uploads/default/optimized/4X/5/9/f/59ffbc2c53dd2a07dc30d4368bd5c9e01ca57d80_2_490x500.jpeg',
  },
  {
    packet: 2,
    name: '哭泣',
    url: 'https://linux.do/uploads/default/optimized/4X/5/d/9/5d932c05a642396335f632a370bd8d45463cf2e2_2_503x500.jpeg',
  },
  {
    packet: 3,
    name: '疑问',
    url: 'https://linux.do/uploads/default/optimized/4X/f/a/a/faa5afe1749312bc4a326feff0eca6fb39355300_2_518x499.jpeg',
  },
]

export function installDefaultNachonekoPicker() {
  return installNachonekoPicker(defaultEmojis)
}

export default installNachonekoPicker
