import { ref, onMounted, watch } from 'vue'

import { useEmojiStore } from '@/stores/emojiStore'
import type { Emoji } from '@/types/type'

export function usePopup(options?: { manageUrl?: boolean }) {
  const emojiStore = useEmojiStore()
  const localScale = ref(100)
  const showCopyToast = ref(false)
  const manageUrl = options?.manageUrl ?? true

  onMounted(async () => {
    // CRITICAL: Enable read-only mode BEFORE loading data
    // This prevents popup from accidentally overwriting all emoji data
    // In read-only mode, only favorites updates are allowed
    emojiStore.setReadOnlyMode(true)

    await emojiStore.loadData()
    localScale.value = emojiStore.settings.imageScale
  })

  // After loading data, sync selection with URL or settings
  onMounted(() => {
    if (!manageUrl) return
    try {
      const params = new URLSearchParams(window.location.search)
      const tabParam = params.get('tab') || params.get('tabs')

      if (tabParam) {
        // try find group by name or id
        const found = emojiStore.groups.find(
          g => g.id === tabParam || g.name === decodeURIComponent(tabParam)
        )
        if (found && found.id) {
          emojiStore.activeGroupId = found.id
        }
      } else {
        // no tab param, if settings has defaultGroup then reflect it into URL
        const defaultGroupId = emojiStore.settings.defaultGroup
        const defaultGroup = emojiStore.groups.find(g => g.id === defaultGroupId)
        if (defaultGroup && defaultGroup.name) {
          const qs = `?type=popup&tab=${encodeURIComponent(defaultGroup.name)}`
          window.history.replaceState({}, '', window.location.pathname + qs)
        }
      }
    } catch (e) {
      // ignore
    }
  })

  // When active group changes, update URL (but don't save settings in popup - read-only mode)
  watch(
    () => emojiStore.activeGroupId,
    newId => {
      if (!manageUrl) return
      try {
        if (!newId) return
        const g = emojiStore.groups.find(x => x.id === newId)
        if (g) {
          // In read-only mode (popup/sidebar), we don't persist settings changes
          // Just update the URL for user convenience
          const qs = `?type=popup&tab=${encodeURIComponent(g.name)}`
          window.history.replaceState({}, '', window.location.pathname + qs)
        }
        // No lazy-loading: all groups keep their emojis in memory and persist normally
      } catch (e) {
        // ignore
      }
    }
  )

  watch(
    () => emojiStore.settings.imageScale,
    newScale => {
      localScale.value = newScale
    }
  )

  const updateScale = () => {
    emojiStore.updateSettings({ imageScale: localScale.value })
  }

  const selectEmoji = (emoji: Emoji) => {
    // If emoji has customOutput configured, use it directly
    if (emoji.customOutput && emoji.customOutput.trim()) {
      const customText = emoji.customOutput

      navigator.clipboard
        .writeText(customText)
        .then(() => {
          // 显示复制成功提示，不关闭弹窗
          showCopyToast.value = true
          setTimeout(() => {
            showCopyToast.value = false
          }, 2000)
        })
        .catch(() => {
          const chromeApi = (window as any).chrome
          if (chromeApi && chromeApi.tabs) {
            chromeApi.tabs.query({ active: true, currentWindow: true }, (tabs: any) => {
              if (tabs[0] && tabs[0].id) {
                chromeApi.tabs.sendMessage(tabs[0].id, {
                  type: 'INSERT_EMOJI',
                  emoji: emoji,
                  customOutput: customText
                })
                showCopyToast.value = true
                setTimeout(() => {
                  showCopyToast.value = false
                }, 2000)
              }
            })
          }
        })

      emojiStore.addToFavorites(emoji)
      return
    }

    // Default behavior: use markdown/html format based on settings
    const scale = emojiStore.settings.imageScale
    const match = emoji.url.match(/_(\d{3,})x(\d{3,})\./)
    let width = '500'
    let height = '500'
    if (match) {
      width = match[1]
      height = match[2]
    } else if (emoji.width && emoji.height) {
      width = emoji.width.toString()
      height = emoji.height.toString()
    }

    const emojiMarkdown = `![${emoji.name}|${width}x${height},${scale}%](${emoji.url}) `

    navigator.clipboard
      .writeText(emojiMarkdown)
      .then(() => {
        // 显示复制成功提示，不关闭弹窗
        showCopyToast.value = true
        setTimeout(() => {
          showCopyToast.value = false
        }, 2000)
      })
      .catch(() => {
        const chromeApi = (window as any).chrome
        if (chromeApi && chromeApi.tabs) {
          chromeApi.tabs.query({ active: true, currentWindow: true }, (tabs: any) => {
            if (tabs[0] && tabs[0].id) {
              chromeApi.tabs.sendMessage(tabs[0].id, {
                type: 'INSERT_EMOJI',
                emoji: emoji,
                scale: scale
              })
              showCopyToast.value = true
              setTimeout(() => {
                showCopyToast.value = false
              }, 2000)
            }
          })
        }
      })

    emojiStore.addToFavorites(emoji)
  }

  const openOptions = () => {
    // Use new query format to open options page: index.html?type=options&tabs=groups
    window.location.href = 'index.html?type=options&tabs=groups'
  }

  const openSidebar = async () => {
    // Chrome
    if (typeof chrome !== 'undefined' && chrome.sidePanel) {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true
      })
      if (!tab.id) throw new Error('No active tab found')

      // Set sidepanel URL to our extension's sidebar page
      await chrome.sidePanel.setOptions({
        tabId: tab.id,
        path: 'index.html?type=sidebar',
        enabled: true
      })
      // Open the sidepanel
      return chrome.sidePanel.open({ windowId: tab.windowId })
    }

    throw new Error('Sidebar not supported')
  }

  return {
    emojiStore,
    localScale,
    showCopyToast,
    updateScale,
    selectEmoji,
    openOptions,
    openSidebar
  }
}
