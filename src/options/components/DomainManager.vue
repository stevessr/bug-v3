<script setup lang="ts">
import { ref, h, toRaw, computed } from 'vue'

import { useEmojiStore } from '../../stores/emojiStore'

import { newStorageHelpers } from '@/utils/newStorage'

const emojiStore = useEmojiStore()

interface MockData {
  key: string
  title: string
  description: string
  disabled: boolean
}

const domainList = ref<Array<{ domain: string; enabledGroups: string[] }>>([])
const domainModalVisible = ref(false)
const editingDomain = ref<string | null>(null)
const transferTargetKeys = ref<string[]>([])
const transferDataSource = ref<MockData[]>([])
const newDomainInput = ref<string>('')

async function loadDomains() {
  try {
    const ds = await newStorageHelpers.getDiscourseDomains()
    domainList.value = ds
  } catch (error) {
    console.warn('failed to load discourse domains', error)
  }
}

async function addCustomDomain() {
  let val = (newDomainInput.value || '').trim()
  if (!val) return
  try {
    try {
      const u = new URL(val)
      val = u.hostname
    } catch {
      val = val.replace(/^https?:\/\//i, '').replace(/\/.*$/, '')
    }
    if (!val) return
    const existing = (await newStorageHelpers.getDiscourseDomains()).find(d => d.domain === val)
    if (existing) {
      newDomainInput.value = ''
      await loadDomains()
      return
    }
    await newStorageHelpers.ensureDiscourseDomainExists(val)
    newDomainInput.value = ''
    await loadDomains()
  } catch (error) {
    console.warn('failed to add custom domain', error)
  }
}

async function openDomainManager(domain: string) {
  try {
    editingDomain.value = domain
    domainModalVisible.value = true

    // convert reactive proxies to raw plain objects to avoid Transfer rendering issues
    const rawGroups = (emojiStore.sortedGroups || [])
      .map((g: any) => (g ? toRaw(g) : g))
      .filter((g: any) => g && g.id !== 'favorites')

    // build a clean data source (plain objects, validated)
    const ds: MockData[] = []
    for (const g of rawGroups) {
      if (!g || g.id == null) continue
      const key = String(g.id)
      const title = String(g.name || '')
      const count = Array.isArray(g.emojis) ? g.emojis.length : 0
      ds.push({ key, title, description: `${count} 表情`, disabled: false })
    }
    transferDataSource.value = ds

    const entry = domainList.value.find(d => d.domain === domain)
    // normalize target keys to strings and filter to existing keys
    const available = new Set(ds.map(i => i.key))
    let initialKeys: string[] = []
    if (entry && Array.isArray(entry.enabledGroups)) {
      initialKeys = entry.enabledGroups.map((k: any) => String(k))
    } else {
      initialKeys = ds.map(i => i.key)
    }
    // filter and dedupe
    const filtered = Array.from(new Set(initialKeys.filter(k => available.has(k))))
    transferTargetKeys.value = filtered
  } catch {
    console.error('[DomainManager] openDomainManager error', err)
    // fallback to empty safe state
    transferDataSource.value = []
    transferTargetKeys.value = []
    domainModalVisible.value = true
  }
}

function renderTransferItem(item: MockData | null | undefined) {
  // defensive: if item is falsy, return placeholder
  if (!item) return h('div', { class: 'text-sm text-gray-500' }, 'No data')
  const title = typeof item.title === 'string' ? item.title : ''
  const desc = typeof item.description === 'string' ? item.description : ''
  return h('div', { class: 'transfer-item' }, [
    h('div', { class: 'font-medium text-gray-900 dark:text-white' }, title),
    desc ? h('div', { class: 'text-xs text-gray-500 dark:text-white' }, desc) : null
  ])
}

const plainDataSource = computed(() => {
  try {
    return (transferDataSource.value || []).map(i => ({ ...(i || {}) }))
  } catch {
    return []
  }
})

function safeFilter(inputValue: string, item: MockData | undefined | null) {
  try {
    if (!item) return false
    const v = String(item.title || '') + ' ' + String(item.description || '')
    return v.toLowerCase().includes(String(inputValue || '').toLowerCase())
  } catch {
    return false
  }
}

async function saveDomainSettings() {
  if (!editingDomain.value) return
  await newStorageHelpers.setDiscourseDomain(editingDomain.value, transferTargetKeys.value)
  await loadDomains()
  domainModalVisible.value = false
  editingDomain.value = null
}

// initialize
void loadDomains()
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-4">
      <div>
        <h3 class="text-md font-medium text-gray-900 dark:text-white">域名管理</h3>
        <p class="text-sm text-gray-500 dark:text-white">为每个 Discourse 域名选择启用的表情分组</p>
      </div>
      <div>
        <a-button @click="loadDomains">刷新</a-button>
      </div>
    </div>

    <div class="mb-4 flex gap-2">
      <a-input v-model:value="newDomainInput" placeholder="输入域名，例如: meta.discourse.org" />
      <a-button type="primary" @click="addCustomDomain">添加域名</a-button>
    </div>

    <div class="space-y-2">
      <div v-if="domainList.length === 0" class="text-sm text-gray-500">暂无域名数据</div>
      <div
        v-for="d in domainList"
        :key="d.domain"
        class="flex items-center justify-between p-3 bg-gray-50 rounded dark:bg-gray-600"
      >
        <div class="truncate">
          <div class="font-medium text-gray-900 dark:text-white">{{ d.domain }}</div>
          <div class="text-xs text-gray-500 dark:text-white">
            启用分组：{{ d.enabledGroups.length }}
          </div>
        </div>
        <div class="flex items-center gap-2">
          <a-button size="small" @click.prevent="openDomainManager(d.domain)">管理</a-button>
          <a-popconfirm
            title="确认删除该域名？"
            @confirm="
              async () => {
                await newStorageHelpers.removeDiscourseDomain(d.domain)
                await loadDomains()
              }
            "
          >
            <a-button size="small" danger>删除</a-button>
          </a-popconfirm>
        </div>
      </div>
    </div>

    <a-modal v-model:open="domainModalVisible" title="域名分组管理" :footer="null">
      <div>
        <a-transfer
          v-model:target-keys="transferTargetKeys"
          :data-source="plainDataSource"
          :show-search="true"
          :filterOption="safeFilter"
          :list-style="{ width: '45%', height: '320px' }"
          :render="renderTransferItem"
        />

        <div class="flex justify-end gap-2 mt-4">
          <a-button
            @click="
              () => {
                domainModalVisible = false
                editingDomain = null
              }
            "
          >
            取消
          </a-button>
          <a-button type="primary" @click="saveDomainSettings">保存</a-button>
        </div>
      </div>
    </a-modal>
  </div>
</template>

<style scoped>
/* keep minimal styling; relies on existing project styles */
</style>
