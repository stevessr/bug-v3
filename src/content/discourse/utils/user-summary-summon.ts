import { createE } from '@/content/utils/dom/createEl'

const BUTTON_CLASS = 'emoji-summon-button'
const TARGET_GROUP_NAME = '召唤分组'

const isUserSummaryPage = () => {
  return /\/u\/[^/]+\/summary(?:\?|#|$)/.test(window.location.pathname)
}

const stripEmoji = (value: string): string => {
  try {
    return value.replace(/\p{Extended_Pictographic}+/gu, '').trim()
  } catch {
    return value.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '').trim()
  }
}

const getProfileInfo = () => {
  const avatarEl = document.querySelector(
    '.user-profile-avatar img.avatar'
  ) as HTMLImageElement | null
  const fullNameEl = document.querySelector('.user-profile-names__primary') as HTMLElement | null
  const usernameEl = document.querySelector('.user-profile-names__secondary') as HTMLElement | null

  const avatarSrc = avatarEl?.getAttribute('src') || avatarEl?.src || ''
  const avatarUrl = avatarSrc ? new URL(avatarSrc, window.location.origin).href : ''
  const username = (usernameEl?.textContent || '').trim()
  const fullNameRaw = (fullNameEl?.textContent || '').trim()
  const name = stripEmoji(fullNameRaw) || username

  return {
    avatarUrl,
    username,
    name
  }
}

const createSummonButton = () => {
  const label = createE('span', {
    class: 'd-button-label',
    text: '召唤'
  })

  const button = createE('button', {
    class: 'btn btn-icon-text btn-default',
    type: 'button',
    on: {
      click: async (e: Event) => {
        e.preventDefault()
        e.stopPropagation()

        const { avatarUrl, username, name } = getProfileInfo()
        if (!avatarUrl || !username) return

        const originalText = label.textContent || '召唤'
        label.textContent = '处理中...'
        button.disabled = true

        try {
          await chrome.runtime.sendMessage({
            action: 'addEmojiFromWeb',
            emojiData: {
              name: name || username,
              url: avatarUrl,
              customOutput: `@${username}`,
              targetGroupName: TARGET_GROUP_NAME,
              sourceDomain: window.location.hostname
            }
          })
          label.textContent = '已添加'
          setTimeout(() => {
            label.textContent = originalText
            button.disabled = false
          }, 1500)
        } catch {
          label.textContent = '添加失败'
          setTimeout(() => {
            label.textContent = originalText
            button.disabled = false
          }, 1500)
        }
      }
    },
    child: [label]
  })

  return button
}

const injectSummonButton = () => {
  if (!isUserSummaryPage()) return

  const controlsList = document.querySelector(
    'div.primary section.controls ul'
  ) as HTMLUListElement | null
  if (!controlsList) return
  if (controlsList.querySelector(`.${BUTTON_CLASS}`)) return

  const button = createSummonButton()
  const listItem = createE('li', {
    class: `user-profile-controls-outlet ${BUTTON_CLASS}`
  })
  listItem.appendChild(button)

  const firstItem = controlsList.querySelector('li')
  if (firstItem && firstItem.nextSibling) {
    controlsList.insertBefore(listItem, firstItem.nextSibling)
  } else {
    controlsList.appendChild(listItem)
  }
}

export const initUserSummarySummonButton = () => {
  let lastUrl = window.location.href
  let pending: number | null = null

  const schedule = () => {
    if (pending) window.clearTimeout(pending)
    pending = window.setTimeout(() => {
      pending = null
      injectSummonButton()
    }, 200)
  }

  schedule()

  const observer = new MutationObserver(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href
    }
    schedule()
  })

  observer.observe(document.body, { childList: true, subtree: true })
}
