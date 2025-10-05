import { ref, onMounted, watch } from 'vue'

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEmojiStore } from '../stores/emojiStore'
import type { Emoji } from '../types/emoji'

export function usePopup() {
  const emojiStore = useEmojiStore()
  const localScale = ref(100)
  const showCopyToast = ref(false)

  onMounted(async () => {
    await emojiStore.loadData()
    localScale.value = emojiStore.settings.imageScale
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
    // 在同一页面中，通过添加 hash 导航到 options 页面
    window.location.href = 'index.html?mode=options#/groups'
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
