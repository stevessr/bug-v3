<script setup lang="ts">
import {
  defineAsyncComponent,
  onMounted,
  onBeforeUnmount,
  ref,
  computed,
  provide,
  watch,
  watchEffect
} from 'vue'
import { useRouter, useRoute } from 'vue-router'

// 模态框 / 通知组件按需异步加载，配合 v-if "首次显示" 标志位，
// 避免初次进入 Options 页就下载所有 modal 代码
const ImportConfigModal = defineAsyncComponent(() => import('./modals/ImportConfigModal.vue'))
const ImportEmojisModal = defineAsyncComponent(() => import('./modals/ImportEmojisModal.vue'))
const CreateGroupModal = defineAsyncComponent(() => import('./components/CreateGroupModal.vue'))
const AddEmojiModal = defineAsyncComponent(() => import('./modals/AddEmojiModal.vue'))
const ConfirmGenericModal = defineAsyncComponent(() => import('./modals/ConfirmGenericModal.vue'))
const NotificationToasts = defineAsyncComponent(() => import('./components/NotificationToasts.vue'))
const EditEmojiModal = defineAsyncComponent(() => import('./modals/EditEmojiModal.vue'))
const EditGroupModal = defineAsyncComponent(() => import('./components/EditGroupModal.vue'))
const ExportProgressModal = defineAsyncComponent(
  () => import('./components/ExportProgressModal.vue')
)
const opensource = defineAsyncComponent(() => import('@/options/modals/opensource.vue'))

// composable
import useOptions from './useOptions'

import ErrorBoundary from '@/components/ErrorBoundary.vue'
import { setConfirmHandler, clearConfirmHandler } from '@/options/utils/confirmService'

const { t, initI18n, isReady } = useI18n()

// 本地 i18n 就绪状态
const i18nReady = ref(false)

// 监听 isReady 变化
watchEffect(() => {
  i18nReady.value = isReady.value
})

const router = useRouter()
const route = useRoute()
const options = useOptions()
const enableForumBrowser = __ENABLE_FORUM_BROWSER__
const legacyMenuKeyMap: Record<string, string> = {
  'bilibili-import': 'import',
  'telegram-import': 'import'
}
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
  stats: '/stats',
  'ai-rename': '/ai-rename',
  workflows: '/workflows',
  about: '/about'
}

if (enableForumBrowser) {
  routeMap['discourse-browser'] = '/discourse-browser'
}

const normalizeMenuKey = (key?: string | null) => {
  if (!key) return ''
  return legacyMenuKeyMap[key] || key
}

const getRouteTargetForKey = (key: string) => {
  if (key === 'bilibili-import') {
    return { path: '/import', query: { source: 'bilibili' } }
  }

  if (key === 'telegram-import') {
    return { path: '/import', query: { source: 'telegram' } }
  }

  const path = routeMap[key]
  return path ? { path } : null
}

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

// Modal latching: 只在首次需要显示时才挂载（触发 async chunk 加载），之后保持挂载
// NotificationToasts 始终挂载以便随时弹出提示
const createGroupModalLoaded = ref(false)
const addEmojiModalLoaded = ref(false)
const editGroupModalLoaded = ref(false)
const importConfigModalLoaded = ref(false)
const importEmojisModalLoaded = ref(false)
const editEmojiModalLoaded = ref(false)
const confirmGenericModalLoaded = ref(false)
const exportProgressModalLoaded = ref(false)

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
  // 引用 i18nReady.value 确保在 i18nReady 变化时重新计算
  i18nReady.value

  const routes = [
    { key: 'settings', label: t('settings'), route: '/settings' },
    { key: 'favorites', label: t('favorites'), route: '/favorites' },
    { key: 'groups', label: t('groupManagement'), route: '/groups' },
    { key: 'ungrouped', label: t('ungrouped'), route: '/ungrouped' },
    { key: 'archived', label: t('archived'), route: '/archived' },
    { key: 'buffer', label: t('buffer'), route: '/buffer' },
    { key: 'market', label: t('cloudMarket'), route: '/market' },
    { key: 'export', label: t('export'), route: '/export' },
    { key: 'import', label: t('import'), route: '/import' },
    { key: 'stats', label: t('statistics'), route: '/stats' },
    { key: 'ai-rename', label: t('aiRename'), route: '/ai-rename' },
    { key: 'workflows', label: '工作流', route: '/workflows' },
    { key: 'about', label: t('about'), route: '/about' }
  ]

  if (enableForumBrowser) {
    routes.splice(routes.length - 2, 0, {
      key: 'discourse-browser',
      label: '论坛浏览器',
      route: '/discourse-browser'
    })
  }

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
    const normalizedQueryTabs = normalizeMenuKey(queryTabs)
    // 如果 tabs 对应于菜单键，直接使用；否则将视为分组名称，选中 groups 菜单
    if (keys.includes(normalizedQueryTabs)) return [normalizedQueryTabs]
    return ['groups']
  }

  const currentRouteName = normalizeMenuKey(route.name as string)
  return currentRouteName && keys.includes(currentRouteName) ? [currentRouteName] : ['groups']
})

// 菜单选择处理
const handleMenuSelect = (info: any) => {
  const key = info && info.key ? String(info.key) : ''
  if (!key) return

  // 根据菜单键导航到对应路由，但保持地址栏为 index.html?type=...&tabs=...（通过 history.replaceState）
  const targetRoute = getRouteTargetForKey(key)
  const originalPath = window.location.pathname
  const newSearchParams = new URLSearchParams(window.location.search)
  newSearchParams.set('type', 'options')
  newSearchParams.set('tabs', key)
  const newSearch = newSearchParams.toString() ? `?${newSearchParams.toString()}` : ''

  // First update visible URL to include the tabs param (so external links reflect selection)
  window.history.replaceState({}, '', originalPath + newSearch)

  if (targetRoute && route.path !== targetRoute.path) {
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

// Latching watchers: 一旦某个 modal 第一次显示，就保持挂载，避免重复触发 import
watch(
  () => showCreateGroupModal.value,
  v => v && (createGroupModalLoaded.value = true)
)
watch(
  () => showAddEmojiModal.value,
  v => v && (addEmojiModalLoaded.value = true)
)
watch(
  () => showEditGroupModal.value,
  v => v && (editGroupModalLoaded.value = true)
)
watch(
  () => showImportModal.value,
  v => v && (importConfigModalLoaded.value = true)
)
watch(
  () => showImportEmojiModal.value,
  v => v && (importEmojisModalLoaded.value = true)
)
watch(
  () => showEditEmojiModal.value,
  v => v && (editEmojiModalLoaded.value = true)
)
watch(
  () => showConfirmGenericModal.value,
  v => v && (confirmGenericModalLoaded.value = true)
)
watch(
  () => showExportModal.value,
  v => v && (exportProgressModalLoaded.value = true)
)

onMounted(async () => {
  // 初始化 i18n
  await initI18n()

  setConfirmHandler((title?: string, message?: string) => {
    return new Promise<boolean>(resolve => {
      // save resolver so modal handlers can resolve when user acts
      pendingConfirmResolver = resolve

      confirmGenericTitle.value = title || ''
      confirmGenericMessage.value = message || ''
      showConfirmGenericModal.value = true
    })
  }) // 处理通过 query tabs 指定的初始页面或分组
  const queryTabs =
    (route.query.tabs as string) || new URLSearchParams(window.location.search).get('tabs')
  const keys = menuItems.value.map(i => i.key)
  const originalPath = window.location.pathname
  const originalSearch = window.location.search
  if (queryTabs) {
    const normalizedQueryTabs = normalizeMenuKey(queryTabs)
    const targetRoute = getRouteTargetForKey(queryTabs)

    if (keys.includes(normalizedQueryTabs) && targetRoute) {
      // 如果是菜单键，导航内部路由然后恢复可见 URL
      router
        .replace(targetRoute)
        .then(() => {
          // restore visible URL to original (keep query)
          window.history.replaceState({}, '', originalPath + (originalSearch || ''))
        })
        .catch(() => {})
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

  // 主题监听已移除（MD3 主题由全局主题系统统一管理）
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
    options.showSuccess(t('groupUpdated'))
  }
}
</script>

<template>
  <AConfigProvider>
    <ErrorBoundary />
    <div class="options-root min-h-screen bg-gray-50 dark:bg-gray-900">
      <!-- Header -->
      <header class="bg-white dark:bg-gray-800 shadow-sm border-b dark:border-gray-700">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="flex justify-between items-center py-6">
            <div>
              <h1 class="text-2xl font-bold dark:text-white">{{ t('emojiManagement') }}</h1>
              <p class="text-sm dark:bg-black dark:text-white">
                {{ t('manageEmojisGroupsAndSettings') }}
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
            v-if="i18nReady"
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
      <CreateGroupModal
        v-if="createGroupModalLoaded"
        v-model:visible="showCreateGroupModal"
        @create="onGroupCreated"
      />

      <AddEmojiModal
        v-if="addEmojiModalLoaded"
        v-model:show="showAddEmojiModal"
        :groups="emojiStore.groups"
        :defaultGroupId="selectedGroupForAdd"
        @added="onEmojiAdded"
      />

      <EditGroupModal
        v-if="editGroupModalLoaded"
        v-model:visible="showEditGroupModal"
        :group-id="editingGroupId"
        :initial-name="editGroupName"
        :initial-icon="editGroupIcon"
        :initial-detail="editGroupDetail"
        @save="handleSaveGroup"
      />

      <!-- Import modals (components) -->
      <ImportConfigModal
        v-if="importConfigModalLoaded"
        v-model="showImportModal"
        @imported="handleConfigImported"
      />

      <ImportEmojisModal
        v-if="importEmojisModalLoaded"
        v-model="showImportEmojiModal"
        @imported="handleEmojisImported"
      />

      <EditEmojiModal
        v-if="editEmojiModalLoaded"
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
        v-if="confirmGenericModalLoaded"
        v-model:show="showConfirmGenericModal"
        :title="confirmGenericTitle"
        :message="confirmGenericMessage"
        @confirm="onModalConfirm"
        @cancel="onModalCancel"
      />

      <!-- Export progress modal (shows detailed per-emoji preview + progress) -->
      <ExportProgressModal
        v-if="exportProgressModalLoaded"
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
