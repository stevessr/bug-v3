import { onMounted, onUnmounted, ref } from 'vue'

import {
  formatMessage,
  getCurrentLanguage,
  getMessage,
  getUILanguage,
  setLanguage
} from '@/utils/i18n'

// Keep Vue reactivity out of the framework-neutral i18n utility. Background
// and content-script code can now use translations without loading Vue.
const isReady = ref(false)

async function initI18n(): Promise<void> {
  let savedLanguage: string | null = null
  try {
    if (typeof localStorage !== 'undefined') {
      savedLanguage = localStorage.getItem('emoji-extension-language')
    }
  } catch {
    // Some extension contexts expose localStorage but deny access to it.
  }

  const browserLocale = getUILanguage()
  const language =
    savedLanguage ||
    (browserLocale.startsWith('zh') || browserLocale.startsWith('cn') ? 'zh_CN' : 'en')

  await setLanguage(language)
  isReady.value = true
}

/** Vue-facing i18n state for extension UI surfaces. */
export function useI18n() {
  const language = ref(getCurrentLanguage())

  const updateLanguage = (event: CustomEvent<string>) => {
    void setLanguage(event.detail)
    language.value = event.detail
  }

  onMounted(() => {
    window.addEventListener('languageChanged', updateLanguage as EventListener)
  })

  onUnmounted(() => {
    window.removeEventListener('languageChanged', updateLanguage as EventListener)
  })

  return {
    t: getMessage,
    locale: () => language.value,
    isChinese: () => language.value.startsWith('zh'),
    format: formatMessage,
    setLanguage,
    initI18n,
    isReady
  }
}
