<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, computed, watch, provide } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ConfigProvider as AConfigProvider } from 'ant-design-vue'

import { generateAntdTheme, getCurrentThemeMode } from '../styles/antdTheme'

import ImportConfigModal from './modals/ImportConfigModal.vue'
import ImportEmojisModal from './modals/ImportEmojisModal.vue'
import CreateGroupModal from './modals/CreateGroupModal.vue'
import AddEmojiModal from './modals/AddEmojiModal.vue'
import ConfirmGenericModal from './modals/ConfirmGenericModal.vue'
import NotificationToasts from './components/NotificationToasts.vue'
import EditEmojiModal from './modals/EditEmojiModal.vue'
import EditGroupModal from './modals/EditGroupModal.vue'
// composable
import useOptions from './useOptions'
import ExportProgressModal from './components/ExportProgressModal.vue'

import { setConfirmHandler, clearConfirmHandler } from '@/options/utils/confirmService'
import opensource from '@/options/modals/opensource.vue'

const router = useRouter()
const route = useRoute()
const options = useOptions()

// 提供 options 给子组件使用
provide('options', options)

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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    { key: 'import', label: '外部导入', route: '/import' },
    { key: 'bilibili', label: 'Bilibili 导入', route: '/bilibili' },
    { key: 'tenor', label: 'Tenor GIF', route: '/tenor' },
    { key: 'waline', label: 'Waline 导入', route: '/waline' },
    { key: 'stats', label: '统计', route: '/stats' },
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
  const currentRouteName = route.name as string
  return currentRouteName ? [currentRouteName] : ['groups']
})

// 菜单选择处理
const handleMenuSelect = (info: any) => {
  const key = info && info.key ? String(info.key) : ''
  if (key) {
    // 根据菜单键导航到对应路由
    const routeMap: Record<string, string> = {
      settings: '/settings',
      favorites: '/favorites',
      groups: '/groups',
      ungrouped: '/ungrouped',
      import: '/import',
      bilibili: '/bilibili',
      tenor: '/tenor',
      waline: '/waline',
      stats: '/stats',
      about: '/about'
    }
    
    const targetRoute = routeMap[key]
    if (targetRoute && route.path !== targetRoute) {
      router.push(targetRoute)
    }
  }
}

const onExportModalClose = () => {
  // delegate to composable to cleanup previews and hide modal
  try {
    if (typeof (options as any).closeExportModal === 'function') (options as any).closeExportModal()
  } catch (_e) {
    showExportModal.value = false
  }
}

const onExportModalCancel = () => {
  // delegate cancellation to composable which will abort and cleanup
  try {
    if (typeof (options as any).cancelExport === 'function') (options as any).cancelExport()
  } catch (_e) {
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
  window.addEventListener('theme-changed', handleThemeChange as EventListener)

  // 初始化主题模式
  currentThemeMode.value = getCurrentThemeMode()
})

onBeforeUnmount(() => {
  // clear any pending resolver and registered handler
  pendingConfirmResolver = null
  clearConfirmHandler()

  // 移除主题变化监听器
  window.removeEventListener('theme-changed', handleThemeChange as EventListener)
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
const handleSaveGroup = (payload: { id?: string; name?: string; icon?: string } | null) => {
  if (payload && payload.id) {
    emojiStore.updateGroup(payload.id, {
      name: payload.name,
      icon: payload.icon
    })
    // IndexedDB removed: no-op flushBuffer was removed — nothing to do here
    options.showSuccess('分组已更新')
  }
}
</script>

<template>
  <AConfigProvider :theme="antdThemeConfig">
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
              @openImport="showImportModal = true"
              @openImportEmojis="showImportEmojiModal = true"
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
            v-model:selectedKeys="menuSelectedKeys"
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
      <CreateGroupModal v-model:show="showCreateGroupModal" @created="onGroupCreated" />

      <AddEmojiModal
        v-model:show="showAddEmojiModal"
        :groups="emojiStore.groups"
        :defaultGroupId="selectedGroupForAdd"
        @added="onEmojiAdded"
      />

      <EditGroupModal
        v-model:show="showEditGroupModal"
        :editingGroupId="editingGroupId"
        :initialName="editGroupName"
        :initialIcon="editGroupIcon"
        :isImageUrl="options.isImageUrl"
        @save="handleSaveGroup"
        @imageError="handleImageError"
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
