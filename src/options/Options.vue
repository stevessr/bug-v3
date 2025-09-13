<script setup lang="ts">
import { onMounted, onBeforeUnmount, defineAsyncComponent } from 'vue'

import { setConfirmHandler, clearConfirmHandler } from '../utils/confirmService'

// composable
import useOptions from './useOptions'

// Loading component for async components
const LoadingComponent = {
  template:
    '<div class="flex items-center justify-center p-4"><div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div></div>'
}

// Error component for async components
const ErrorComponent = {
  template: '<div class="text-red-500 p-4">组件加载失败，请刷新页面重试</div>'
}

// Lazy load components with loading states
const GridColumnsSelector = defineAsyncComponent({
  loader: () => import('../components/GridColumnsSelector.vue'),
  loadingComponent: LoadingComponent,
  errorComponent: ErrorComponent,
  delay: 200,
  timeout: 3000
})

const AboutSection = defineAsyncComponent({
  loader: () => import('../components/AboutSection.vue'),
  loadingComponent: LoadingComponent,
  errorComponent: ErrorComponent,
  delay: 200,
  timeout: 3000
})

const HeaderControls = defineAsyncComponent({
  loader: () => import('./components/HeaderControls.vue'),
  loadingComponent: LoadingComponent,
  errorComponent: ErrorComponent,
  delay: 200,
  timeout: 3000
})

const GlobalSettings = defineAsyncComponent({
  loader: () => import('./components/GlobalSettings.vue'),
  loadingComponent: LoadingComponent,
  errorComponent: ErrorComponent,
  delay: 200,
  timeout: 3000
})

const EmojiStats = defineAsyncComponent({
  loader: () => import('./components/EmojiStats.vue'),
  loadingComponent: LoadingComponent,
  errorComponent: ErrorComponent,
  delay: 200,
  timeout: 3000
})

const NotificationToasts = defineAsyncComponent({
  loader: () => import('./components/NotificationToasts.vue'),
  loadingComponent: LoadingComponent,
  errorComponent: ErrorComponent,
  delay: 200,
  timeout: 3000
})

// Tab components - grouped for better chunk optimization
// Main emoji tabs are used together, so group them
const GroupsTab = defineAsyncComponent({
  loader: () => import(/* webpackChunkName: "emoji-tabs" */ './components/GroupsTab.vue'),
  loadingComponent: LoadingComponent,
  errorComponent: ErrorComponent,
  delay: 200,
  timeout: 3000
})

const FavoritesTab = defineAsyncComponent({
  loader: () => import(/* webpackChunkName: "emoji-tabs" */ './components/FavoritesTab.vue'),
  loadingComponent: LoadingComponent,
  errorComponent: ErrorComponent,
  delay: 200,
  timeout: 3000
})

const UngroupedTab = defineAsyncComponent({
  loader: () => import(/* webpackChunkName: "emoji-tabs" */ './components/UngroupedTab.vue'),
  loadingComponent: LoadingComponent,
  errorComponent: ErrorComponent,
  delay: 200,
  timeout: 3000
})

// Import tabs are used together, so group them
const ExternalImportTab = defineAsyncComponent({
  loader: () => import(/* webpackChunkName: "import-tabs" */ './components/ExternalImportTab.vue'),
  loadingComponent: LoadingComponent,
  errorComponent: ErrorComponent,
  delay: 200,
  timeout: 3000
})

const BilibiliImport = defineAsyncComponent({
  loader: () => import(/* webpackChunkName: "import-tabs" */ './tabs/BilibiliImport.vue'),
  loadingComponent: LoadingComponent,
  errorComponent: ErrorComponent,
  delay: 200,
  timeout: 3000
})

// Modal components - grouped for better chunk optimization
// Import modals are used together, so group them
const ImportConfigModal = defineAsyncComponent({
  loader: () => import(/* webpackChunkName: "import-modals" */ './modals/ImportConfigModal.vue'),
  loadingComponent: LoadingComponent,
  errorComponent: ErrorComponent,
  delay: 200,
  timeout: 3000
})

const ImportEmojisModal = defineAsyncComponent({
  loader: () => import(/* webpackChunkName: "import-modals" */ './modals/ImportEmojisModal.vue'),
  loadingComponent: LoadingComponent,
  errorComponent: ErrorComponent,
  delay: 200,
  timeout: 3000
})

// Edit modals are used together, so group them
const EditEmojiModal = defineAsyncComponent({
  loader: () => import(/* webpackChunkName: "edit-modals" */ './modals/EditEmojiModal.vue'),
  loadingComponent: LoadingComponent,
  errorComponent: ErrorComponent,
  delay: 200,
  timeout: 3000
})

const EditGroupModal = defineAsyncComponent({
  loader: () => import(/* webpackChunkName: "edit-modals" */ './modals/EditGroupModal.vue'),
  loadingComponent: LoadingComponent,
  errorComponent: ErrorComponent,
  delay: 200,
  timeout: 3000
})

// Create/Add modals are used together, so group them
const CreateGroupModal = defineAsyncComponent({
  loader: () => import(/* webpackChunkName: "create-modals" */ './modals/CreateGroupModal.vue'),
  loadingComponent: LoadingComponent,
  errorComponent: ErrorComponent,
  delay: 200,
  timeout: 3000
})

const AddEmojiModal = defineAsyncComponent({
  loader: () => import(/* webpackChunkName: "create-modals" */ './modals/AddEmojiModal.vue'),
  loadingComponent: LoadingComponent,
  errorComponent: ErrorComponent,
  delay: 200,
  timeout: 3000
})

// Utility modals - keep separate as they're used independently
const ConfirmGenericModal = defineAsyncComponent({
  loader: () => import('./modals/ConfirmGenericModal.vue'),
  loadingComponent: LoadingComponent,
  errorComponent: ErrorComponent,
  delay: 200,
  timeout: 3000
})

const options = useOptions()

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
  isImageUrl,
  activeTab,
  tabs,
  totalEmojis,
  expandedGroups,
  toggleGroupExpansion,
  selectedGroupForAdd,
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
  localGridColumns,
  updateImageScale,
  updateShowSearchBar,
  updateOutputFormat,
  updateForceMobileMode,
  updateEnableLinuxDoInjection,
  updateEnableXcomExtraSelectors,
  handleDragStart,
  handleDrop,
  handleEmojiDragStart,
  handleEmojiDrop,
  removeEmojiFromGroup,
  handleConfigImported,
  handleEmojisImported,
  exportGroup,
  exportGroupZip,
  exportConfiguration,
  exportProgress,
  exportProgressGroupId,
  confirmDeleteGroup,
  openEditGroup,
  openAddEmojiModal,
  onGroupCreated,
  onEmojiAdded,
  resetSettings,
  syncToChrome,
  forceLocalToExtension,
  showSuccess,
  flushBuffer,
  handleImageError,
  openEditEmoji,
  showEditEmojiModal,
  editingEmoji,
  editingEmojiGroupId,
  editingEmojiIndex,
  handleEmojiEdit
} = options

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
})

onBeforeUnmount(() => {
  // clear any pending resolver and registered handler
  pendingConfirmResolver = null
  clearConfirmHandler()
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
    void flushBuffer(true).then(() => {})
    showSuccess('\u5206\u7ec4\u5df2\u66f4\u65b0')
  }
}
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Header -->
    <header class="bg-white shadow-sm border-b">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between items-center py-6">
          <div>
            <h1 class="text-2xl font-bold text-gray-900">表情管理</h1>
            <p class="text-sm text-gray-600">管理表情包分组、自定义表情和扩展设置</p>
          </div>
          <HeaderControls
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
    <nav class="bg-white border-b border-gray-200">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex space-x-8">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            @click="activeTab = tab.id"
            class="py-4 px-1 border-b-2 font-medium text-sm transition-colors"
            :class="[
              activeTab === tab.id
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            ]"
          >
            {{ tab.label }}
          </button>
        </div>
      </div>
    </nav>

    <!-- Main Content -->
    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- Settings Tab -->
      <div v-if="activeTab === 'settings'" class="space-y-8">
        <GlobalSettings
          :settings="emojiStore.settings"
          @update:imageScale="updateImageScale"
          @update:showSearchBar="updateShowSearchBar"
          @update:outputFormat="updateOutputFormat"
          @update:forceMobileMode="updateForceMobileMode"
          @update:enableLinuxDoInjection="updateEnableLinuxDoInjection"
          @update:enableXcomExtraSelectors="updateEnableXcomExtraSelectors"
        >
          <template #grid-selector>
            <GridColumnsSelector v-model="localGridColumns" :min="2" :max="8" :step="1" />
          </template>
        </GlobalSettings>
      </div>

      <GroupsTab
        :emojiStore="emojiStore"
        :expandedGroups="expandedGroups"
        :isImageUrl="isImageUrl"
        v-model:activeTab="activeTab"
        :exportProgress="exportProgress"
        :exportProgressGroupId="exportProgressGroupId"
        @openCreateGroup="showCreateGroupModal = true"
        @groupDragStart="handleDragStart"
        @groupDrop="handleDrop"
        @toggleExpand="toggleGroupExpansion"
        @openEditGroup="openEditGroup"
        @exportGroup="exportGroup"
        @exportGroupZip="exportGroupZip"
        @confirmDeleteGroup="confirmDeleteGroup"
        @openAddEmoji="openAddEmojiModal"
        @emojiDragStart="handleEmojiDragStart"
        @emojiDrop="handleEmojiDrop"
        @removeEmoji="removeEmojiFromGroup"
        @editEmoji="openEditEmoji"
        @imageError="handleImageError"
      />

      <FavoritesTab
        v-if="activeTab === 'favorites'"
        :emojiStore="emojiStore"
        @remove="removeEmojiFromGroup"
        @edit="openEditEmoji"
      />

      <!-- Ungrouped Tab -->
      <UngroupedTab
        v-if="activeTab === 'ungrouped'"
        :emojiStore="emojiStore"
        @remove="removeEmojiFromGroup"
        @edit="openEditEmoji"
      />

      <!-- External Import Tab -->
      <ExternalImportTab v-if="activeTab === 'import'" />
      <BilibiliImport v-if="activeTab === 'bilibili'" />

      <!-- Statistics Tab -->
      <div v-if="activeTab === 'stats'" class="space-y-8">
        <EmojiStats
          :groupCount="emojiStore.groups.length"
          :totalEmojis="totalEmojis"
          :favoritesCount="emojiStore.favorites.size"
        />
      </div>

      <!-- About Tab -->
      <div v-if="activeTab === 'about'" class="space-y-8">
        <AboutSection />
      </div>
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
      :isImageUrl="isImageUrl"
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
  </div>
</template>
