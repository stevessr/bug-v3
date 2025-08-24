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
            @open-import="showImportModal = true"
            @open-import-emojis="showImportEmojiModal = true"
            @reset-settings="resetSettings"
            @sync-to-chrome="syncToChrome"
            @export-configuration="exportConfiguration"
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
            :class="[
              'py-4 px-1 border-b-2 font-medium text-sm transition-colors',
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
          @update:imageScale="e => updateImageScale(e)"
          @update:showSearchBar="e => updateShowSearchBar(e)"
          @update:outputFormat="value => updateOutputFormat(value)"
          @update:forceMobileMode="e => updateForceMobileMode(e)"
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
        :activeTab="activeTab"
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
  </div>
</template>

<script setup lang="ts">
import GridColumnsSelector from '../components/GridColumnsSelector.vue'
import AboutSection from '../components/AboutSection.vue'
import HeaderControls from './components/HeaderControls.vue'
import GlobalSettings from './components/GlobalSettings.vue'
import EmojiStats from './components/EmojiStats.vue'
import ImportConfigModal from './modals/ImportConfigModal.vue'
import ImportEmojisModal from './modals/ImportEmojisModal.vue'
import CreateGroupModal from './modals/CreateGroupModal.vue'
import AddEmojiModal from './modals/AddEmojiModal.vue'
import ConfirmDeleteModal from './modals/ConfirmDeleteModal.vue'
import NotificationToasts from './components/NotificationToasts.vue'
import GroupsTab from './components/GroupsTab.vue'
import FavoritesTab from './components/FavoritesTab.vue'
import UngroupedTab from './components/UngroupedTab.vue'
import ExternalImportTab from './components/ExternalImportTab.vue'
import EditEmojiModal from './modals/EditEmojiModal.vue'
import EditGroupModal from './modals/EditGroupModal.vue'
// composable
import useOptions from './useOptions'

const options = useOptions()

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
