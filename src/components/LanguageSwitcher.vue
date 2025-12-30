<template>
  <div class="language-switcher">
    <a-select
      v-model:value="currentLanguage"
      style="width: 120px"
      @change="handleLanguageChange"
      size="small"
    >
      <a-select-option value="zh_CN">中文</a-select-option>
      <a-select-option value="en">English</a-select-option>
    </a-select>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from '../utils/i18n'

const { locale, t, setLanguage, initI18n } = useI18n()
const currentLanguage = ref<string>('zh_CN')

// 从 localStorage 获取保存的语言设置，或使用浏览器语言
const getSavedLanguage = (): string => {
  const saved = localStorage.getItem('emoji-extension-language')
  if (saved) return saved
  
  const browserLocale = locale()
  if (browserLocale.startsWith('zh') || browserLocale.startsWith('cn')) {
    return 'zh_CN'
  }
  return 'en'
}

// 处理语言切换
const handleLanguageChange = async (newLanguage: string) => {
  currentLanguage.value = newLanguage
  localStorage.setItem('emoji-extension-language', newLanguage)
  
  // 设置新语言
  await setLanguage(newLanguage)
  
  // 触发重新渲染以应用新语言
  // 使用自定义事件通知其他组件语言已更改
  window.dispatchEvent(new CustomEvent('languageChanged', { detail: newLanguage }))
}

onMounted(async () => {
  currentLanguage.value = getSavedLanguage()
  await initI18n()
})
</script>

<style scoped>
.language-switcher {
  display: inline-block;
}
</style>