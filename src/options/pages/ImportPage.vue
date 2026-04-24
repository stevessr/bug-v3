<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import BilibiliImportPage from './BilibiliImportPage.vue'
import TelegramImportPage from './TelegramImportPage.vue'

type ImportSource = 'bilibili' | 'telegram'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()

const hasTelegramQuery = () => {
  return ['tgAuto', 'tgInput', 'tgGroupId'].some(key => {
    const value = route.query[key]
    if (Array.isArray(value)) return value.length > 0 && !!value[0]
    return !!value
  })
}

const resolveSource = (): ImportSource => {
  const source = Array.isArray(route.query.source) ? route.query.source[0] : route.query.source
  if (source === 'telegram') return 'telegram'
  if (source === 'bilibili') return 'bilibili'
  return hasTelegramQuery() ? 'telegram' : 'bilibili'
}

const activeSource = computed<ImportSource>({
  get: () => resolveSource(),
  set: source => {
    const { tgAuto, tgInput, tgGroupId, ...restQuery } = route.query
    void tgAuto
    void tgInput
    void tgGroupId

    const nextQuery = source === 'telegram' ? { ...route.query, source } : { ...restQuery, source }

    router.replace({ path: '/import', query: nextQuery }).catch(() => {})
  }
})
</script>

<template>
  <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700">
    <div class="px-6 pt-5">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">{{ t('import') }}</h1>
    </div>

    <a-tabs v-model:activeKey="activeSource" class="px-4">
      <a-tab-pane key="bilibili" :tab="t('bilibiliImport')">
        <div class="pb-4">
          <BilibiliImportPage embedded />
        </div>
      </a-tab-pane>

      <a-tab-pane key="telegram" :tab="t('telegramImport')">
        <div class="pb-4">
          <TelegramImportPage embedded />
        </div>
      </a-tab-pane>
    </a-tabs>
  </div>
</template>
