<script setup lang="ts">
import { DownOutlined } from '@ant-design/icons-vue'
import { ref, watch, isRef, type Ref } from 'vue'

import type { AppSettings } from '../../types/type'

import SettingSwitch from './SettingSwitch.vue'

const props = defineProps<{ settings: AppSettings | Ref<AppSettings> }>()
const settings = props.settings as AppSettings | Ref<AppSettings>

const emit = defineEmits([
  'update:outputFormat',
  'update:forceMobileMode',
  'update:enableXcomExtraSelectors',
  'update:enableCalloutSuggestions',
  'update:enableBatchParseImages',
  'update:useIndexedDBForImages',
  'update:enableContentImageCache',
  'update:enableSubmenuInjector',
  'update:cloudMarketDomain',
  'update:enableDiscourseRouterRefresh',
  'update:discourseRouterRefreshInterval'
])

const getSetting = (key: keyof AppSettings, defaultValue: any = false) => {
  try {
    if (isRef(settings)) return (settings.value && settings.value[key]) ?? defaultValue
    return (settings && (settings as AppSettings)[key]) ?? defaultValue
  } catch {
    return defaultValue
  }
}

const handleSettingUpdate = (key: string, value: any) => {
  emit(`update:${key}` as any, value)
}

const getOutputFormat = () => {
  try {
    if (isRef(settings)) return (settings.value && settings.value.outputFormat) || 'markdown'
    return (settings && (settings as AppSettings).outputFormat) || 'markdown'
  } catch {
    return 'markdown'
  }
}

const localOutputFormat = ref<string>(getOutputFormat())
watch(
  () => getOutputFormat(),
  val => {
    localOutputFormat.value = val || 'markdown'
  }
)

const handleOutputFormatSelect = (key: string) => {
  localOutputFormat.value = key
  emit('update:outputFormat', key)
}

const handleOutputFormatSelectInfo = (info: { key: string | number }) => {
  handleOutputFormatSelect(String(info.key))
}

// 云端市场域名的本地状态
const localCloudMarketDomain = ref<string>(
  getSetting('cloudMarketDomain', 'video2gif-pages.pages.dev')
)
const isCloudMarketDomainSaving = ref(false)

// 监听 settings 变化，同步到本地状态
watch(
  () => getSetting('cloudMarketDomain', 'video2gif-pages.pages.dev'),
  val => {
    localCloudMarketDomain.value = val
  }
)

// 保存云端市场域名
const saveCloudMarketDomain = async () => {
  isCloudMarketDomainSaving.value = true
  try {
    emit('update:cloudMarketDomain', localCloudMarketDomain.value)
    // 给用户一点反馈时间
    await new Promise(resolve => setTimeout(resolve, 300))
  } finally {
    isCloudMarketDomainSaving.value = false
  }
}

// Discourse 路由刷新间隔的本地状态
const localRouterRefreshInterval = ref<number>(
  getSetting('discourseRouterRefreshInterval', 30000) as number
)
const isRouterRefreshIntervalSaving = ref(false)

// 监听 settings 变化，同步到本地状态
watch(
  () => getSetting('discourseRouterRefreshInterval', 30000),
  val => {
    localRouterRefreshInterval.value = val as number
  }
)

// 保存路由刷新间隔
const saveRouterRefreshInterval = async () => {
  isRouterRefreshIntervalSaving.value = true
  try {
    // 确保间隔至少为 10 秒
    const safeInterval = Math.max(localRouterRefreshInterval.value, 10000)
    emit('update:discourseRouterRefreshInterval', safeInterval)
    await new Promise(resolve => setTimeout(resolve, 300))
  } finally {
    isRouterRefreshIntervalSaving.value = false
  }
}
</script>

<template>
  <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700">
    <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
      <h2 class="text-lg font-semibold dark:text-white">功能开关</h2>
    </div>
    <div class="p-6 space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <label class="text-sm font-medium dark:text-white">输出格式</label>
          <p class="text-sm dark:text-white">插入表情时使用的格式</p>
        </div>
        <a-dropdown>
          <template #overlay>
            <a-menu @click="handleOutputFormatSelectInfo">
              <a-menu-item key="markdown">Markdown 格式</a-menu-item>
              <a-menu-item key="html">HTML 格式</a-menu-item>
            </a-menu>
          </template>
          <a-button title="选择输出格式">
            {{ localOutputFormat === 'markdown' ? 'Markdown 格式' : 'HTML 格式' }}
            <DownOutlined />
          </a-button>
        </a-dropdown>
      </div>

      <SettingSwitch
        :model-value="getSetting('forceMobileMode', false)"
        @update:model-value="handleSettingUpdate('forceMobileMode', $event)"
        label="强制移动模式"
        description="在桌面端强制使用移动端样式"
      />

      <SettingSwitch
        :model-value="getSetting('enableXcomExtraSelectors', false)"
        @update:model-value="handleSettingUpdate('enableXcomExtraSelectors', $event)"
        label="启用 X.com 额外选择器"
        description="在 X.com(Twitter) 启用额外的选择器控制"
      />

      <SettingSwitch
        :model-value="getSetting('enableCalloutSuggestions', false)"
        @update:model-value="handleSettingUpdate('enableCalloutSuggestions', $event)"
        label="启用 Callout 自动补全"
        description="在编辑器中输入 [! 时显示 Callout 语法提示"
      />

      <SettingSwitch
        :model-value="getSetting('enableBatchParseImages', true)"
        @update:model-value="handleSettingUpdate('enableBatchParseImages', $event)"
        label="启用一键解析全部图片"
        description="控制前端是否注入'一键解析并添加所有图片'按钮"
      />

      <SettingSwitch
        :model-value="getSetting('useIndexedDBForImages', false)"
        @update:model-value="handleSettingUpdate('useIndexedDBForImages', $event)"
        label="启用 IndexedDB 缓存图片"
        description="将图片缓存在 IndexedDB 中以加快加载速度并支持离线访问"
      />

      <SettingSwitch
        :model-value="getSetting('enableContentImageCache', false)"
        @update:model-value="handleSettingUpdate('enableContentImageCache', $event)"
        label="启用前端图片缓存 (试验性功能)"
        description="允许前端注入的content script使用本地缓存的图片显示，而不是直接请求表情的URL"
      />

      <SettingSwitch
        :model-value="getSetting('enableSubmenuInjector', false)"
        @update:model-value="handleSettingUpdate('enableSubmenuInjector', $event)"
        label="启用子菜单注入 (试验性功能)"
        description="将功能按钮注入到 Discourse 工具栏的下拉菜单中，而不是传统的菜单栏，可降低 CPU 消耗"
      />

      <SettingSwitch
        :model-value="getSetting('enableDiscourseRouterRefresh', false)"
        @update:model-value="handleSettingUpdate('enableDiscourseRouterRefresh', $event)"
        label="启用 Discourse 路由刷新"
        description="周期性刷新 Discourse 路由以优化页面状态同步（仅在 Discourse 站点生效）"
      />

      <!-- Discourse 路由刷新间隔配置（仅在启用时显示） -->
      <div
        v-if="getSetting('enableDiscourseRouterRefresh', false)"
        class="ml-6 mt-2 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
      >
        <div class="flex items-start justify-between">
          <div>
            <label class="text-sm font-medium dark:text-white">刷新间隔</label>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              设置路由刷新的间隔时间（最小 10 秒）
            </p>
          </div>
          <div class="flex items-center gap-2">
            <a-input-number
              v-model:value="localRouterRefreshInterval"
              :min="10000"
              :max="300000"
              :step="5000"
              class="w-32"
              :formatter="(value: string | number) => `${Math.round(Number(value) / 1000)}s`"
              :parser="(value: string) => Number(value.replace('s', '')) * 1000"
            />
            <a-button
              type="primary"
              :loading="isRouterRefreshIntervalSaving"
              @click="saveRouterRefreshInterval"
            >
              保存
            </a-button>
          </div>
        </div>
      </div>

      <!-- 云端市场域名配置 -->
      <div class="pt-4 border-t border-gray-200 dark:border-gray-700">
        <div class="flex items-start justify-between">
          <div>
            <label class="text-sm font-medium dark:text-white">云端市场域名</label>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              配置云端表情包市场的域名（不包含 https://）
            </p>
          </div>
          <div class="flex items-center gap-2">
            <input
              v-model="localCloudMarketDomain"
              class="border border-gray-300 dark:border-gray-600 rounded px-3 py-2 w-80 dark:bg-gray-700 dark:text-white"
              placeholder="video2gif-pages.pages.dev"
              title="云端市场域名"
            />
            <a-button
              type="primary"
              :loading="isCloudMarketDomainSaving"
              @click="saveCloudMarketDomain"
            >
              保存
            </a-button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
