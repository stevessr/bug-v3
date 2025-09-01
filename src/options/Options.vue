<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import type { MenuProps } from 'ant-design-vue'

import GridColumnsSelector from '../components/GridColumnsSelector.vue'
import HeaderControls from './components/HeaderControls.vue'
import ImportConfigModal from './modals/ImportConfigModal.vue'
import ImportEmojisModal from './modals/ImportEmojisModal.vue'
import CreateGroupModal from './modals/CreateGroupModal.vue'
import AddEmojiModal from './modals/AddEmojiModal.vue'
import ConfirmDeleteModal from './modals/ConfirmDeleteModal.vue'
import NotificationToasts from './components/NotificationToasts.vue'
import EditEmojiModal from './modals/EditEmojiModal.vue'
import EditGroupModal from './modals/EditGroupModal.vue'

// composable
import useOptions from './useOptions'

const router = useRouter()
const options = useOptions()

// Ant Design layout state
const collapsed = ref(false)
const selectedKeys = ref([router.currentRoute.value.name as string])

// Menu items
const menuItems: MenuProps['items'] = [
  {
    key: 'settings',
    icon: '⚙️',
    label: '设置'
  },
  {
    key: 'groups',
    icon: '📁',
    label: '分组管理'
  },
  {
    key: 'favorites',
    icon: '⭐',
    label: '收藏夹'
  },
  {
    key: 'ungrouped',
    icon: '📋',
    label: '未分组'
  },
  {
    key: 'import',
    icon: '📥',
    label: '外部导入'
  },
  {
    key: 'stats',
    icon: '📊',
    label: '统计信息'
  },
  {
    key: 'about',
    icon: 'ℹ️',
    label: '关于'
  }
]

// Handle menu click
const handleMenuClick = ({ key }: { key: string }) => {
  selectedKeys.value = [key]
  router.push({ name: key })
}

// Watch route changes to update selected menu
router.afterEach(to => {
  if (to.name) {
    selectedKeys.value = [to.name as string]
  }
})

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
  showConfirmDeleteModal,
  successMessage,
  errorMessage,
  groupToDelete,
  editingGroupId,
  editGroupName,
  editGroupIcon,
  localGridColumns,
  updateImageScale,
  updateShowSearchBar,
  updateOutputFormat,
  updateForceMobileMode,
  handleDragStart,
  handleDrop,
  handleEmojiDragStart,
  handleEmojiDrop,
  removeEmojiFromGroup,
  handleConfigImported,
  handleEmojisImported,
  exportGroup,
  exportConfiguration,
  confirmDeleteGroup,
  deleteGroup,
  openEditGroup,
  openAddEmojiModal,
  onGroupCreated,
  onEmojiAdded,
  resetSettings,
  syncToChrome,
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
</script>

<template>
  <a-layout style="min-height: 100vh">
    <!-- Header -->
    <a-layout-header style="background: #fff; padding: 0; box-shadow: 0 1px 4px rgba(0,21,41,.08)">
      <div style="padding: 0 24px; display: flex; align-items: center; justify-content: space-between; height: 100%">
        <div style="display: flex; align-items: center">
          <a-button
            type="text"
            @click="collapsed = !collapsed"
            style="margin-right: 16px"
          >
            {{ collapsed ? '➤' : '⬅️' }}
          </a-button>
          <div>
            <h1 style="margin: 0; font-size: 20px; font-weight: 600">🐈‍⬛ 表情管理</h1>
            <p style="margin: 0; font-size: 12px; color: #666">管理表情包分组、自定义表情和扩展设置</p>
          </div>
        </div>
        <HeaderControls
          @open-import="showImportModal = true"
          @open-import-emojis="showImportEmojiModal = true"
          @reset-settings="resetSettings"
          @sync-to-chrome="syncToChrome"
          @export-configuration="exportConfiguration"
        />
      </div>
    </a-layout-header>

    <a-layout>
      <!-- Sidebar Menu -->
      <a-layout-sider
        v-model:collapsed="collapsed"
        :trigger="null"
        collapsible
        :width="200"
        style="background: #fff"
      >
        <a-menu
          :items="menuItems"
          :selected-keys="selectedKeys"
          mode="inline"
          @click="handleMenuClick"
          style="height: 100%; border-right: 0"
        />
      </a-layout-sider>

      <!-- Main Content -->
      <a-layout-content style="margin: 24px 16px; padding: 24px; background: #f0f2f5">
        <router-view
          :emojiStore="emojiStore"
          :expandedGroups="expandedGroups"
          :isImageUrl="isImageUrl"
          :settings="emojiStore.settings"
          :totalEmojis="totalEmojis"
          :groupCount="emojiStore.groups.length"
          :favoritesCount="emojiStore.favorites.size"
          @update:imageScale="updateImageScale"
          @update:showSearchBar="updateShowSearchBar"
          @update:outputFormat="updateOutputFormat"
          @update:forceMobileMode="updateForceMobileMode"
          @open-create-group="showCreateGroupModal = true"
          @group-dragstart="handleDragStart"
          @group-drop="handleDrop"
          @toggle-expand="toggleGroupExpansion"
          @open-edit-group="openEditGroup"
          @export-group="exportGroup"
          @confirm-delete-group="confirmDeleteGroup"
          @open-add-emoji="openAddEmojiModal"
          @emoji-drag-start="handleEmojiDragStart"
          @emoji-drop="handleEmojiDrop"
          @remove-emoji="removeEmojiFromGroup"
          @edit-emoji="openEditEmoji"
          @image-error="handleImageError"
          @remove="removeEmojiFromGroup"
          @edit="openEditEmoji"
        >
          <template #grid-selector>
            <GridColumnsSelector v-model="localGridColumns" :min="2" :max="8" :step="1" />
          </template>
        </router-view>
      </a-layout-content>
    </a-layout>

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
      @save="
        payload => {
          if (payload && payload.id) {
            emojiStore.updateGroup(payload.id, {
              name: payload.name,
              icon: payload.icon
            })
            void flushBuffer(true).then(() =>
              console.log('[Options] saveEditGroup flushed to IndexedDB', {
                id: payload.id,
                name: payload.name
              })
            )
            showSuccess('分组已更新')
          }
        }
      "
      @image-error="handleImageError"
    />

    <!-- Import modals (components) -->
    <ImportConfigModal v-model="showImportModal" @imported="handleConfigImported" />

    <ImportEmojisModal v-model="showImportEmojiModal" @imported="handleEmojisImported" />

    <ConfirmDeleteModal
      v-model:show="showConfirmDeleteModal"
      :group="groupToDelete"
      @confirm="deleteGroup"
    />

    <EditEmojiModal
      v-model:show="showEditEmojiModal"
      :emoji="editingEmoji"
      :groupId="editingEmojiGroupId"
      :index="editingEmojiIndex"
      @save="handleEmojiEdit"
      @image-error="handleImageError"
    />

    <NotificationToasts
      v-model:showSuccess="showSuccessToast"
      :successMessage="successMessage"
      v-model:showError="showErrorToast"
      :errorMessage="errorMessage"
    />
  </a-layout>
</template>
