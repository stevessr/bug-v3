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
  const generator = () => {
    // Try to read the latest payload from localStorage so the picker can reflect runtime updates
    let runtimeEmojis: Array<EmojiItem> | null = null
    try {
      const raw =
        typeof window !== 'undefined' ? window.localStorage.getItem('bugcopilot_settings_v1') : null
      if (raw) {
        const parsed = JSON.parse(raw)
        const arr: EmojiItem[] = []
        if (Array.isArray(parsed?.emojiGroups)) {
          for (const g of parsed.emojiGroups) {
            if (Array.isArray(g.emojis)) {
              for (const em of g.emojis) arr.push(em)
            }
          }
        }
        if (Array.isArray(parsed?.ungrouped)) {
          for (const em of parsed.ungrouped) arr.push(em)
        }
        if (arr.length) runtimeEmojis = arr
      }
    } catch (_) {
      runtimeEmojis = null
    }

    const useEmojis = runtimeEmojis || emojis

    const images = useEmojis
      .map((e, idx) => {
        const nameEsc = String(e.name || '').replace(/"/g, '&quot;')
        // tabindex: first emoji tabindex=0, others -1 (match example)
        const tabindex = idx === 0 ? '0' : '-1'
        const dataEmoji = nameEsc
        return `<img width="32" height="32" class="emoji" src="${e.url}" tabindex="${tabindex}" data-emoji="${dataEmoji}" alt="${nameEsc}" title=":${nameEsc}:" loading="lazy" />`
      })
      .join('\n')

  return `
<div class="fk-d-menu -animated -expanded" data-identifier="emoji-picker" data-content="" aria-expanded="true" role="dialog">
  <div class="fk-d-menu__inner-content">
    <div class="emoji-picker">
      <div class="emoji-picker__filter-container">
        <div class="emoji-picker__filter filter-input-container">
          <input class="filter-input" placeholder="按表情符号名称和别名搜索…" type="text" />
          <svg class="fa d-icon d-icon-magnifying-glass svg-icon -right svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><use href="#magnifying-glass"></use></svg>
        </div>
        <button class="btn no-text fk-d-menu__trigger -trigger emoji-picker__diversity-trigger btn-transparent" aria-expanded="false" data-trigger="" type="button">
          <img width="20" height="20" src="${emojis[0]?.url || ''}" title="${emojis[0]?.name || ''}" alt="${emojis[0]?.name || ''}" class="emoji" />
        </button>
      </div>
      <div class="emoji-picker__content">
        <div class="emoji-picker__sections-nav">
          <button class="btn no-text btn-flat emoji-picker__section-btn active" tabindex="-1" data-section="favorites" type="button">
            <img width="20" height="20" src="/images/emoji/twemoji/star.png" title="star" alt="star" class="emoji" />
          </button>
        </div>
        <div class="emoji-picker__scrollable-content">
          <div class="emoji-picker__sections" role="button">
            <div class="emoji-picker__section" data-section="favorites" role="region" aria-label="常用">
              <div class="emoji-picker__section-title-container">
                <h2 class="emoji-picker__section-title">常用</h2>
                <button class="btn no-text btn-icon btn-transparent" type="button">
                  <svg class="fa d-icon d-icon-trash-can svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><use href="#trash-can"></use></svg>
                  <span aria-hidden="true">&ZeroWidthSpace;</span>
                </button>
              </div>
              <div class="emoji-picker__section-emojis">
                ${images}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
  `
  }

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
