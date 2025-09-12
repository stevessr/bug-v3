import { ref, onMounted, watch } from 'vue'

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEmojiStore } from '../stores/emojiStore'
import type { Emoji } from '../types/emoji'

export function usePopup() {
  const emojiStore = useEmojiStore()
  const localScale = ref(100)
  const showCopyToast = ref(false)

  onMounted(async () => {
    // Guard against a hung loadData by racing with a short timeout.
    // If loadData does not resolve within 3s, fall back and ensure UI is not stuck.
    const timeoutMs = 3000
    const timeout = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

    try {
      const result = (await Promise.race([
        // mark loaded on success; swallow errors so race resolves
        emojiStore.loadData().then(() => 'loaded').catch(() => 'loaded'),
        timeout(timeoutMs).then(() => 'timeout')
      ])) as 'loaded' | 'timeout'

      if (result === 'timeout') {
        // loadData hasn't finished in time. Avoid stuck UI by clearing loading flag so
        // components can render a fallback state. The background load may still finish
        // later and update the store as normal.
        // eslint-disable-next-line no-console
        console.warn('[Popup] emojiStore.loadData timed out after', timeoutMs, 'ms; clearing isLoading')
        try {
          emojiStore.isLoading = false
        } catch (e) {
          // ignore
        }
      }
    } catch (e) {
      // loadData should handle internal errors; log any unexpected crash here.
      // eslint-disable-next-line no-console
      console.error('[Popup] emojiStore.loadData crashed:', e)
    } finally {
      // Ensure localScale is always set from store defaults even if loadData timed out.
      try {
        localScale.value = emojiStore.settings.imageScale
      } catch (e) {
        // ignore
      }
    }
  })

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
    const chromeApi = (window as any).chrome
    if (chromeApi && chromeApi.runtime) {
      chromeApi.runtime.openOptionsPage()
    }
  }

  return {
    emojiStore,
    localScale,
    showCopyToast,
    updateScale,
    selectEmoji,
    openOptions
  }
}
