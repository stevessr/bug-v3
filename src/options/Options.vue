<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, computed, watch, provide } from 'vue'
import { useRouter, useRoute } from 'vue-router'

import { generateAntdTheme, getCurrentThemeMode } from '../styles/antdTheme'

import ImportConfigModal from './modals/ImportConfigModal.vue'
import ImportEmojisModal from './modals/ImportEmojisModal.vue'
import CreateGroupModal from './components/CreateGroupModal.vue'
import AddEmojiModal from './modals/AddEmojiModal.vue'
import ConfirmGenericModal from './modals/ConfirmGenericModal.vue'
import NotificationToasts from './components/NotificationToasts.vue'
import EditEmojiModal from './modals/EditEmojiModal.vue'
import EditGroupModal from './components/EditGroupModal.vue'
// composable
import useOptions from './useOptions'
import ExportProgressModal from './components/ExportProgressModal.vue'

import ErrorBoundary from '@/components/ErrorBoundary.vue'
import { setConfirmHandler, clearConfirmHandler } from '@/options/utils/confirmService'
import opensource from '@/options/modals/opensource.vue'

const router = useRouter()
const route = useRoute()
const options = useOptions()

// 提供 options 给子组件使用
provide('options', options)

// 流式处理事件处理器
const handleBatchUpdateSizeStreaming = (group: any) => {
  options.runBatchUpdateSizeStreaming(group)
}

const handleExportGroupStreaming = (group: any) => {
  options.exportGroupStreamingMethod(group)
}

// 提供流式处理方法
provide('streamingHandlers', {
  batchUpdateSizeStreaming: handleBatchUpdateSizeStreaming,
  exportGroupStreaming: handleExportGroupStreaming
})

// 主题相关状态
const currentThemeMode = ref<'light' | 'dark'>(getCurrentThemeMode())

// 响应式的 Ant Design Vue 主题配置
const antdThemeConfig = computed(() => {
  const primaryColor = options.emojiStore.settings.customPrimaryColor || '#1890ff'
  return generateAntdTheme(currentThemeMode.value, primaryColor)
})

// 监听主题变化事件
const handleThemeChange = (event: CustomEvent) => {
  currentThemeMode.value = event.detail.mode
}

// 监听自定义主色变化
watch(
  () => options.emojiStore.settings.customPrimaryColor,
  () => {
    // 主色变化时会自动通过 computed 更新主题
  }
)

// pending resolver for requestConfirmation -> modal bridge

// resolver saved when requestConfirmation() is called; resolved by modal handlers
// resolver saved when requestConfirmation() is called; resolved by modal handlers

let pendingConfirmResolver: any = null

// expose used components to template for linter
const _modalComponents = {
  ImportConfigModal,
  ImportEmojisModal,
  CreateGroupModal,
  AddEmojiModal
} as const
void Object.keys(_modalComponents)

// re-export bindings for template access
const {
  emojiStore,
  showCreateGroupModal,
  showAddEmojiModal,
  showEditGroupModal,
  showImportModal,
  showImportEmojiModal,
  showSuccessToast,
  showErrorToast,
  showConfirmGenericModal,
  confirmGenericTitle,
  confirmGenericMessage,
  executeConfirmGenericAction,
  cancelConfirmGenericAction,
  successMessage,
  errorMessage,
  editingGroupId,
  editGroupName,
  editGroupIcon,
  editGroupDetail,
  showExportModal,
  exportModalPercent,
  exportModalCurrentName,
  exportModalCurrentPreview,
  exportModalPreviews,
  exportModalNames,
  exportModalCancelled,
  exportConfiguration,
  handleConfigImported,
  handleEmojisImported,
  onGroupCreated,
  onEmojiAdded,
  resetSettings,
  syncToChrome,
  forceLocalToExtension,
  handleImageError,
  showEditEmojiModal,
  editingEmoji,
  editingEmojiGroupId,
  editingEmojiIndex,
  handleEmojiEdit,
  selectedGroupForAdd
} = options

// 基于路由的菜单项
const menuItems = computed(() => {
  const routes = [
    { key: 'settings', label: '设置', route: '/settings' },
    { key: 'favorites', label: '常用', route: '/favorites' },
    { key: 'groups', label: '分组管理', route: '/groups' },
    { key: 'ungrouped', label: '未分组', route: '/ungrouped' },
    { key: 'archived', label: '已归档', route: '/archived' },
    { key: 'buffer', label: '缓冲区', route: '/buffer' },
    { key: 'market', label: '云端市场', route: '/market' },
    { key: 'export', label: '导出', route: '/export' },
    { key: 'bilibili-import', label: 'Bilibili 导入', route: '/bilibili-import' },
    { key: 'stats', label: '统计', route: '/stats' },
    { key: 'ai-rename', label: 'AI 批量重命名', route: '/ai-rename' },
    { key: 'about', label: '关于', route: '/about' }
  ]

  return routes.map(item => ({
    key: item.key,
    label: item.label,
    title: item.label
  }))
})

// 当前选中的菜单键
const menuSelectedKeys = computed(() => {
  // 优先使用 URL 查询参数中的 tabs（保持地址为 index.html?type=...&tabs=...）
  const queryTabs =
    (route.query.tabs as string) || new URLSearchParams(window.location.search).get('tabs')
  const keys = menuItems.value.map(i => i.key)
  if (queryTabs) {
    // 如果 tabs 对应于菜单键，直接使用；否则将视为分组名称，选中 groups 菜单
    if (keys.includes(queryTabs)) return [queryTabs]
    return ['groups']
  }

  const currentRouteName = route.name as string
  return currentRouteName ? [currentRouteName] : ['groups']
})

// 菜单选择处理
const handleMenuSelect = (info: any) => {
  const key = info && info.key ? String(info.key) : ''
  if (!key) return

  // 根据菜单键导航到对应路由，但保持地址栏为 index.html?type=...&tabs=...（通过 history.replaceState）
  const routeMap: Record<string, string> = {
    settings: '/settings',
    favorites: '/favorites',
    groups: '/groups',
    ungrouped: '/ungrouped',
    archived: '/archived',
    import: '/import',
    export: '/export',
    buffer: '/buffer',
    market: '/market',
    'bilibili-import': '/bilibili-import',
    stats: '/stats',
    'ai-rename': '/ai-rename',
    about: '/about'
  }

  const targetRoute = routeMap[key]
  const originalPath = window.location.pathname
  const newSearchParams = new URLSearchParams(window.location.search)
  newSearchParams.set('type', 'options')
  newSearchParams.set('tabs', key)
  const newSearch = newSearchParams.toString() ? `?${newSearchParams.toString()}` : ''

  // First update visible URL to include the tabs param (so external links reflect selection)
  window.history.replaceState({}, '', originalPath + newSearch)

  if (targetRoute && route.path !== targetRoute) {
    // Navigate internally with router, then restore visible URL (router will change path)
    router
      .push(targetRoute)
      .then(() => {
        window.history.replaceState({}, '', originalPath + newSearch)
      })
      .catch(() => {
        // ignore navigation failures
      })
  }
}

const onExportModalClose = () => {
  // delegate to composable to cleanup previews and hide modal
  try {
    if (typeof (options as any).closeExportModal === 'function') (options as any).closeExportModal()
  } catch {
    showExportModal.value = false
  }
}

const onExportModalCancel = () => {
  // delegate cancellation to composable which will abort and cleanup
  try {
    if (typeof (options as any).cancelExport === 'function') (options as any).cancelExport()
  } catch {
    exportModalCancelled.value = true
  }
}

onMounted(() => {
  setConfirmHandler((title?: string, message?: string) => {
    return new Promise<boolean>(resolve => {
      // save resolver so modal handlers can resolve when user acts
      pendingConfirmResolver = resolve

      confirmGenericTitle.value = title || ''
      confirmGenericMessage.value = message || ''
      showConfirmGenericModal.value = true
    })
  })

  // 监听主题变化事件
  window.addEventListener('theme-changed', handleThemeChange as (event: Event) => void)

  // 初始化主题模式
  currentThemeMode.value = getCurrentThemeMode()
  // 处理通过 query tabs 指定的初始页面或分组
  const queryTabs =
    (route.query.tabs as string) || new URLSearchParams(window.location.search).get('tabs')
  const keys = menuItems.value.map(i => i.key)
  const originalPath = window.location.pathname
  const originalSearch = window.location.search
  if (queryTabs) {
    if (keys.includes(queryTabs)) {
      // 如果是菜单键，导航内部路由然后恢复可见 URL
      const routeMap: Record<string, string> = {
        settings: '/settings',
        favorites: '/favorites',
        groups: '/groups',
        ungrouped: '/ungrouped',
        archived: '/archived',
        import: '/import',
        buffer: '/buffer',
        market: '/market',
        'bilibili-import': '/bilibili-import',
        stats: '/stats',
        'ai-rename': '/ai-rename',
        about: '/about'
      }
      const targetRoute = routeMap[queryTabs]
      if (targetRoute) {
        router
          .replace(targetRoute)
          .then(() => {
            // restore visible URL to original (keep query)
            window.history.replaceState({}, '', originalPath + (originalSearch || ''))
          })
          .catch(() => {})
      }
    } else {
      // 视为分组名称，尝试查找并选中该分组
      const g = emojiStore.groups.find((x: any) => x.name === queryTabs || x.id === queryTabs)
      if (g && g.id) {
        emojiStore.activeGroupId = g.id
        try {
          emojiStore.updateSettings({ defaultGroup: g.id })
        } catch (e) {
          console.error(e)
        }
      }
    }
  }
})

onBeforeUnmount(() => {
  // clear any pending resolver and registered handler
  pendingConfirmResolver = null
  clearConfirmHandler()

  // 移除主题变化监听器
  window.removeEventListener('theme-changed', handleThemeChange as (event: Event) => void)
})

// modal-level handlers: resolve pending promise if present; otherwise delegate to composable actions
const onModalConfirm = () => {
  // if someone awaited requestConfirmation, resolve it
  if (pendingConfirmResolver) {
    try {
      pendingConfirmResolver(true)
    } finally {
      pendingConfirmResolver = null
    }
    // hide modal
    showConfirmGenericModal.value = false
    return
  }

  // otherwise, this modal is being used for composable actions (delete/reset)
  executeConfirmGenericAction()
}

const onModalCancel = () => {
  if (pendingConfirmResolver) {
    try {
      pendingConfirmResolver(false)
    } finally {
      pendingConfirmResolver = null
    }
    showConfirmGenericModal.value = false
    return
  }

  cancelConfirmGenericAction()
}

// Extracted handler for EditGroupModal save to avoid inline template expression
const handleSaveGroup = (
  payload: { id?: string; name?: string; icon?: string; detail?: string } | null
) => {
  if (payload && payload.id) {
    emojiStore.updateGroup(payload.id, {
      name: payload.name,
      icon: payload.icon,
      detail: payload.detail
    })
    // IndexedDB removed: no-op flushBuffer was removed — nothing to do here
    options.showSuccess('分组已更新')
  }
}
</script>

<template>
  <AConfigProvider :theme="antdThemeConfig">
    <ErrorBoundary />
    <div class="options-root min-h-screen bg-gray-50 dark:bg-gray-900">
      <!-- Header -->
      <header class="bg-white dark:bg-gray-800 shadow-sm border-b dark:border-gray-700">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="flex justify-between items-center py-6">
            <div>
              <h1 class="text-2xl font-bold dark:text-white">表情管理</h1>
              <p class="text-sm dark:bg-black dark:text-white">
                管理表情包分组、自定义表情和扩展设置
              </p>
            </div>
            <opensource
              @resetSettings="resetSettings"
              @syncToChrome="syncToChrome"
              @forceLocalToExtension="forceLocalToExtension"
              @exportConfiguration="exportConfiguration"
            />
          </div>
        </div>
      </header>

      <!-- Navigation Tabs -->
      <nav class="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <a-menu
            :selectedKeys="menuSelectedKeys"
            mode="horizontal"
            :items="menuItems"
            class="bg-transparent"
            @select="handleMenuSelect"
          />
        </div>
      </nav>

      <!-- Main Content -->
      <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <router-view />
      </main>

      <!-- Create Group and Add Emoji modals extracted into components -->
      <CreateGroupModal v-model:visible="showCreateGroupModal" @create="onGroupCreated" />

      <AddEmojiModal
        v-model:show="showAddEmojiModal"
        :groups="emojiStore.groups"
        :defaultGroupId="selectedGroupForAdd"
        @added="onEmojiAdded"
      />

      <EditGroupModal
        v-model:visible="showEditGroupModal"
        :group-id="editingGroupId"
        :initial-name="editGroupName"
        :initial-icon="editGroupIcon"
        :initial-detail="editGroupDetail"
        @save="handleSaveGroup"
      />

      <!-- Import modals (components) -->
      <ImportConfigModal v-model="showImportModal" @imported="handleConfigImported" />

      <ImportEmojisModal v-model="showImportEmojiModal" @imported="handleEmojisImported" />

      <EditEmojiModal
        v-model:show="showEditEmojiModal"
        :emoji="editingEmoji || undefined"
        :groupId="editingEmojiGroupId"
        :index="editingEmojiIndex"
        @save="handleEmojiEdit"
        @imageError="handleImageError"
      />

      <NotificationToasts
        v-model:showSuccess="showSuccessToast"
        :successMessage="successMessage"
        v-model:showError="showErrorToast"
        :errorMessage="errorMessage"
      />

      <ConfirmGenericModal
        v-model:show="showConfirmGenericModal"
        :title="confirmGenericTitle"
        :message="confirmGenericMessage"
        @confirm="onModalConfirm"
        @cancel="onModalCancel"
      />

      <!-- Export progress modal (shows detailed per-emoji preview + progress) -->
      <ExportProgressModal
        v-model:show="showExportModal"
        :percent="exportModalPercent"
        :currentName="exportModalCurrentName || undefined"
        :currentPreview="exportModalCurrentPreview || undefined"
        :previews="exportModalPreviews"
        :names="exportModalNames"
        @close="onExportModalClose"
        @cancel="onExportModalCancel"
      />
    </div>
  </AConfigProvider>
</template>
