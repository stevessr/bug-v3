<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Header -->
    <header class="bg-white shadow-sm border-b">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between items-center py-6">
          <div>
            <h1 class="text-2xl font-bold text-gray-900">表情管理</h1>
            <p class="text-sm text-gray-600">
              管理表情包分组、自定义表情和扩展设置
            </p>
          </div>
          <div class="flex gap-3">
            <button
              @click="showImportModal = true"
              class="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
            >
              导入配置
            </button>
            <button
              @click="showImportEmojiModal = true"
              class="px-4 py-2 text-sm bg-purple-100 text-purple-700 rounded-md hover:bg-purple-200 transition-colors"
            >
              导入表情
            </button>
            <button
              @click="resetSettings"
              class="px-4 py-2 text-sm bg-orange-100 text-orange-700 rounded-md hover:bg-orange-200 transition-colors"
            >
              重置设置
            </button>
            <button
              @click="syncToChrome"
              class="px-4 py-2 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
            >
              上传到Chrome同步
            </button>
            <button
              @click="exportConfiguration"
              class="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              导出配置
            </button>
          </div>
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
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
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
        <div class="bg-white rounded-lg shadow-sm border">
          <div class="px-6 py-4 border-b border-gray-200">
            <h2 class="text-lg font-semibold text-gray-900">全局设置</h2>
          </div>
          <div class="p-6 space-y-6">
            <!-- Image Scale -->
            <div class="flex items-center justify-between">
              <div>
                <label class="text-sm font-medium text-gray-900"
                  >默认图片缩放</label
                >
                <p class="text-sm text-gray-500">控制插入表情的默认尺寸</p>
              </div>
              <div class="flex items-center gap-3">
                <input
                  :value="emojiStore.settings.imageScale"
                  @input="updateImageScale"
                  type="range"
                  min="5"
                  max="150"
                  step="5"
                  class="w-32"
                />
                <span class="text-sm text-gray-600 w-12"
                  >{{ emojiStore.settings.imageScale }}%</span
                >
              </div>
            </div>

            <!-- Grid Columns -->
            <div class="flex items-center justify-between">
              <div>
                <label class="text-sm font-medium text-gray-900"
                  >网格列数</label
                >
                <p class="text-sm text-gray-500">表情选择器中的列数</p>
              </div>
              <GridColumnsSelector
                v-model="localGridColumns"
                :min="2"
                :max="8"
                :step="1"
              />
            </div>

            <!-- Show Search Bar -->
            <div class="flex items-center justify-between">
              <div>
                <label class="text-sm font-medium text-gray-900"
                  >显示搜索框</label
                >
                <p class="text-sm text-gray-500">在表情选择器中显示搜索功能</p>
              </div>
              <label class="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  :checked="emojiStore.settings.showSearchBar"
                  @change="updateShowSearchBar"
                  class="sr-only peer"
                />
                <div
                  class="relative w-11 h-6 bg-gray-200 rounded-full transition-colors peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:w-5 after:h-5 after:bg-white after:rounded-full after:transition-all after:border after:border-gray-300 peer-checked:after:translate-x-[20px]"
                ></div>
              </label>
            </div>
          </div>
        </div>
      </div>

      <!-- Emoji Groups Tab -->
      <div v-if="activeTab === 'groups'" class="space-y-8">
        <div class="bg-white rounded-lg shadow-sm border">
          <div class="px-6 py-4 border-b border-gray-200">
            <div class="flex justify-between items-center">
              <h2 class="text-lg font-semibold text-gray-900">表情分组管理</h2>
              <button
                @click="showCreateGroupModal = true"
                class="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                新建分组
              </button>
            </div>
          </div>

          <div class="p-6">
            <div class="space-y-4">
              <div
                v-for="group in emojiStore.sortedGroups"
                :key="group.id"
                class="group-item border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
                :draggable="group.id !== 'favorites'"
                @dragstart="handleDragStart(group, $event)"
                @dragover.prevent
                @drop="handleDrop(group, $event)"
              >
                <div class="flex items-center justify-between p-4">
                  <div class="flex items-center gap-3">
                    <div
                      v-if="group.id !== 'favorites'"
                      class="cursor-move text-gray-400"
                    >
                      ⋮⋮
                    </div>
                    <div v-else class="w-6 text-yellow-500">⭐</div>
                    <div class="text-lg">
                      <template v-if="isImageUrl(group.icon)">
                        <img
                          :src="group.icon"
                          alt="group icon"
                          class="w-6 h-6 object-contain rounded"
                          @error="handleImageError"
                        />
                      </template>
                      <template v-else>
                        {{ group.icon }}
                      </template>
                    </div>
                    <div>
                      <h3 class="font-medium text-gray-900">
                        {{ group.name }}
                      </h3>
                      <p class="text-sm text-gray-500">
                        {{ group.emojis?.length || 0 }} 个表情
                      </p>
                    </div>
                  </div>
                  <div class="flex items-center gap-2">
                    <button
                      @click="toggleGroupExpansion(group.id)"
                      class="px-3 py-1 text-sm text-gray-600 hover:bg-gray-50 rounded transition-colors"
                    >
                      {{ expandedGroups.has(group.id) ? "收起" : "展开" }}
                    </button>
                    <button
                      v-if="group.id !== 'favorites'"
                      @click="openEditGroup(group)"
                      class="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded transition-colors"
                    >
                      编辑
                    </button>
                    <button
                      @click="exportGroup(group)"
                      class="px-3 py-1 text-sm text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                    >
                      导出
                    </button>
                    <button
                      v-if="
                        group.id !== 'favorites' && group.id !== 'nachoneko'
                      "
                      @click="confirmDeleteGroup(group)"
                      class="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded transition-colors"
                    >
                      删除
                    </button>
                  </div>
                </div>

                <!-- Expanded emoji display -->
                <div
                  v-if="expandedGroups.has(group.id)"
                  class="px-4 pb-4 border-t border-gray-100"
                >
                  <div class="mt-4">
                    <div
                      class="grid gap-3"
                      :style="{
                        gridTemplateColumns: `repeat(${emojiStore.settings.gridColumns}, minmax(0, 1fr))`,
                      }"
                    >
                      <div
                        v-for="(emoji, index) in group.emojis"
                        :key="`${group.id}-${index}`"
                        class="emoji-item relative group cursor-move"
                        :draggable="true"
                        @dragstart="
                          handleEmojiDragStart(emoji, group.id, index, $event)
                        "
                        @dragover.prevent
                        @drop="handleEmojiDrop(group.id, index, $event)"
                      >
                        <div
                          class="aspect-square bg-gray-50 rounded-lg overflow-hidden hover:bg-gray-100 transition-colors"
                        >
                          <img
                            :src="emoji.url"
                            :alt="emoji.name"
                            class="w-full h-full object-cover"
                          />
                        </div>
                        <div
                          class="text-xs text-center text-gray-600 mt-1 truncate"
                        >
                          {{ emoji.name }}
                        </div>
                        <button
                          @click="removeEmojiFromGroup(group.id, index)"
                          class="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          ×
                        </button>
                      </div>
                    </div>

                    <!-- Add emoji button (hidden for favorites group) -->
                    <div v-if="group.id !== 'favorites'" class="mt-4">
                      <button
                        @click="openAddEmojiModal(group.id)"
                        class="px-3 py-2 text-sm border border-dashed border-gray-300 rounded-lg hover:border-gray-400 transition-colors w-full"
                      >
                        + 添加表情
                      </button>
                    </div>
                    <!-- For favorites group, show info instead -->
                    <div v-if="group.id === 'favorites'" class="mt-4">
                      <div
                        class="px-3 py-2 text-sm text-gray-500 text-center border border-gray-200 rounded-lg bg-gray-50"
                      >
                        使用表情会自动添加到常用分组
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Statistics Tab -->
      <div v-if="activeTab === 'stats'" class="space-y-8">
        <div class="bg-white rounded-lg shadow-sm border">
          <div class="px-6 py-4 border-b border-gray-200">
            <h2 class="text-lg font-semibold text-gray-900">使用统计</h2>
          </div>
          <div class="p-6">
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div class="bg-blue-50 rounded-lg p-4">
                <div class="text-2xl font-bold text-blue-600">
                  {{ emojiStore.groups.length }}
                </div>
                <div class="text-sm text-blue-800">表情分组</div>
              </div>
              <div class="bg-green-50 rounded-lg p-4">
                <div class="text-2xl font-bold text-green-600">
                  {{ totalEmojis }}
                </div>
                <div class="text-sm text-green-800">总表情数</div>
              </div>
              <div class="bg-purple-50 rounded-lg p-4">
                <div class="text-2xl font-bold text-purple-600">
                  {{ emojiStore.favorites.size }}
                </div>
                <div class="text-sm text-purple-800">收藏表情</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- About Tab -->
      <div v-if="activeTab === 'about'" class="space-y-8">
        <AboutSection />
      </div>

      <!-- Legacy content (remove this section) -->
      <div v-if="false" class="bg-white rounded-lg shadow-sm border mb-8">
        <div class="px-6 py-4 border-b border-gray-200">
          <div class="flex justify-between items-center">
            <h2 class="text-lg font-semibold text-gray-900">表情分组管理</h2>
            <button
              @click="showCreateGroupModal = true"
              class="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              新建分组
            </button>
          </div>
        </div>

        <div class="p-6">
          <div class="space-y-4">
            <div
              v-for="group in emojiStore.groups"
              :key="group.id"
              class="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
            >
              <div class="flex items-center gap-3">
                <div class="text-lg">{{ group.icon }}</div>
                <div>
                  <h3 class="font-medium text-gray-900">{{ group.name }}</h3>
                  <p class="text-sm text-gray-500">
                    {{ group.emojis.length }} 个表情
                  </p>
                </div>
              </div>
              <div class="flex items-center gap-2">
                <button
                  @click="openEditGroup(group)"
                  class="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded transition-colors"
                >
                  编辑
                </button>
                <button
                  v-if="group.id !== 'favorites' && group.id !== 'nachoneko'"
                  @click="confirmDeleteGroup(group)"
                  class="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded transition-colors"
                >
                  删除
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Legacy emoji management (remove this section) -->
      <div v-if="false" class="bg-white rounded-lg shadow-sm border">
        <div class="px-6 py-4 border-b border-gray-200">
          <div class="flex justify-between items-center">
            <h2 class="text-lg font-semibold text-gray-900">表情管理</h2>
            <div class="flex gap-2">
              <select
                v-model="selectedGroupId"
                class="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">所有分组</option>
                <option
                  v-for="group in emojiStore.groups"
                  :key="group.id"
                  :value="group.id"
                >
                  {{ group.name }}
                </option>
              </select>
              <button
                @click="showAddEmojiModal = true"
                class="px-4 py-2 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
              >
                添加表情
              </button>
            </div>
          </div>
        </div>

        <div class="p-6">
          <div class="grid grid-cols-6 gap-4">
            <div
              v-for="emoji in filteredEmojis"
              :key="emoji.id"
              class="relative group border border-gray-200 rounded-lg p-3 hover:border-gray-300 transition-colors"
            >
              <img
                :src="emoji.url"
                :alt="emoji.name"
                class="w-full h-16 object-contain mb-2"
                @error="handleImageError"
              />
              <p class="text-xs text-gray-600 truncate">{{ emoji.name }}</p>
              <div
                class="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <button
                  @click="deleteEmoji(emoji.id)"
                  class="w-6 h-6 bg-red-500 text-white rounded-full text-xs hover:bg-red-600 transition-colors"
                >
                  ×
                </button>
              </div>
            </div>
          </div>

          <div v-if="filteredEmojis.length === 0" class="text-center py-12">
            <p class="text-gray-500">暂无表情</p>
          </div>
        </div>
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

    <!-- Edit Group Modal (top-level) -->
    <div
      v-if="showEditGroupModal"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      @click="showEditGroupModal = false"
    >
      <div class="bg-white rounded-lg p-6 w-full max-w-md" @click.stop>
        <h3 class="text-lg font-semibold mb-4">编辑分组</h3>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1"
              >分组名称</label
            >
            <input
              v-model="editGroupName"
              type="text"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1"
              >分组图标/图片链接</label
            >
            <input
              v-model="editGroupIcon"
              type="text"
              placeholder="例如：😀 或 https://..."
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div v-if="isImageUrl(editGroupIcon)" class="mt-2 text-center">
              <img
                :src="editGroupIcon"
                alt="预览"
                class="w-10 h-10 object-contain mx-auto border border-gray-200 rounded"
                @error="handleImageError"
              />
            </div>
          </div>
        </div>
        <div class="flex justify-end gap-3 mt-6">
          <button
            @click="showEditGroupModal = false"
            class="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded transition-colors"
          >
            取消
          </button>
          <button
            @click="saveEditGroup"
            class="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            保存
          </button>
        </div>
      </div>
    </div>

  <!-- Import modals (components) -->
  <ImportConfigModal v-model="showImportModal" @imported="handleConfigImported" />

  <ImportEmojisModal v-model="showImportEmojiModal" @imported="handleEmojisImported" />

    <ConfirmDeleteModal
      v-model:show="showConfirmDeleteModal"
      :group="groupToDelete"
      @confirm="deleteGroup"
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
import { ref, computed, onMounted, watch } from "vue";
import GridColumnsSelector from "../components/GridColumnsSelector.vue";
import AboutSection from "../components/AboutSection.vue";
import ImportConfigModal from './ImportConfigModal.vue';
import ImportEmojisModal from './ImportEmojisModal.vue';
import CreateGroupModal from './CreateGroupModal.vue';
import AddEmojiModal from './AddEmojiModal.vue';
import ConfirmDeleteModal from './ConfirmDeleteModal.vue';
import NotificationToasts from './NotificationToasts.vue';
import { importConfigurationToStore, importEmojisToStore } from './importUtils';
import { exportConfigurationFile, exportGroupFile } from './exportUtils';
import { useEmojiStore } from "../stores/emojiStore";
// force flush to IndexedDB buffer when options page updates data
import { flushBuffer } from "../utils/indexedDB";
import type { EmojiGroup } from "../types/emoji";
import { isImageUrl } from "../utils/isImageUrl";

const emojiStore = useEmojiStore();

// mark these imports as used for TS/linters (they are used in template)
const _modalComponents = { ImportConfigModal, ImportEmojisModal, CreateGroupModal, AddEmojiModal } as const;
// read the keys to avoid 'declared but not used' errors
void Object.keys(_modalComponents);

// Tab navigation
const activeTab = ref("settings");
const tabs = [
  { id: "settings", label: "设置" },
  { id: "groups", label: "分组管理" },
  { id: "stats", label: "统计" },
  { id: "about", label: "关于" },
];

// Drag and drop state
const draggedGroup = ref<EmojiGroup | null>(null);
const draggedEmoji = ref<any>(null);
const draggedEmojiGroupId = ref<string>("");
const draggedEmojiIndex = ref<number>(-1);

// Group expansion state
const expandedGroups = ref<Set<string>>(new Set());

// Reactive data
const selectedGroupId = ref("");
const selectedGroupForAdd = ref("");
const showCreateGroupModal = ref(false);
const showAddEmojiModal = ref(false);
const showEditGroupModal = ref(false);
const showImportModal = ref(false);
const showImportEmojiModal = ref(false);
const showSuccessToast = ref(false);
const showErrorToast = ref(false);
const showConfirmDeleteModal = ref(false);
const successMessage = ref("");
const errorMessage = ref("");
const groupToDelete = ref<EmojiGroup | null>(null);

// Edit group state
const editingGroupId = ref<string>("");
const editGroupName = ref<string>("");
const editGroupIcon = ref<string>("");

// ...use shared isImageUrl from utils

// New emoji data (moved to AddEmojiModal)

// Import modal states handled by components; parsed payloads handled via events

const handleConfigImported = async (config: any) => {
  if (!config) {
    showError('配置文件格式错误');
    return;
  }
  try {
    await importConfigurationToStore(config);
    showSuccess('配置导入成功');
  } catch (err) {
    console.error(err);
    showError('配置导入失败');
  }
};

const handleEmojisImported = async (payload: any | null) => {
  if (!payload) {
    showError('表情数据格式错误');
    return;
  }
  try {
    // normalized { items, targetGroupId }
    if (payload.items && Array.isArray(payload.items)) {
      await importEmojisToStore(payload.items, payload.targetGroupId);
      showSuccess(`成功导入 ${payload.items.length} 个表情`);
      return;
    }

    // array or wrapped object { group, emojis }
    await importEmojisToStore(payload);
    const count = Array.isArray(payload) ? payload.length : (payload.emojis?.length || 0);
    showSuccess(`成功导入 ${count} 个表情`);
  } catch (err) {
    console.error(err);
    showError('表情导入失败');
  }
};
// Computed properties
const filteredEmojis = computed(() => {
  if (!selectedGroupId.value) {
    // Return all emojis from all groups
    return emojiStore.groups.flatMap((group) => group.emojis);
  }
  const group = emojiStore.groups.find((g) => g.id === selectedGroupId.value);
  return group ? group.emojis : [];
});

const totalEmojis = computed(() => {
  return emojiStore.groups.reduce(
    (total, group) => total + (group.emojis?.length || 0),
    0
  );
});

// Group management methods
const toggleGroupExpansion = (groupId: string) => {
  if (expandedGroups.value.has(groupId)) {
    expandedGroups.value.delete(groupId);
  } else {
    expandedGroups.value.add(groupId);
  }
};

const confirmDeleteGroup = (group: EmojiGroup) => {
  groupToDelete.value = group;
  showConfirmDeleteModal.value = true;
};

const deleteGroup = async () => {
  if (groupToDelete.value) {
    await emojiStore.deleteGroup(groupToDelete.value.id);
    showSuccess(`分组 "${groupToDelete.value.name}" 已删除`);
    showConfirmDeleteModal.value = false;
    groupToDelete.value = null;
  }
};

// Drag and drop handlers
const handleDragStart = (group: EmojiGroup, event: DragEvent) => {
  // Prevent dragging favorites group
  if (group.id === "favorites") {
    event.preventDefault();
    showError("常用分组不能移动位置");
    return;
  }
  draggedGroup.value = group;
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = "move";
  }
};

const handleDrop = async (targetGroup: EmojiGroup, event: DragEvent) => {
  event.preventDefault();
  // Prevent dropping onto favorites group
  if (targetGroup.id === "favorites") {
    showError("不能移动到常用分组位置");
    draggedGroup.value = null;
    return;
  }
  if (draggedGroup.value && draggedGroup.value.id !== targetGroup.id) {
    // Reorder groups logic here
    await emojiStore.reorderGroups(draggedGroup.value.id, targetGroup.id);
    await flushBuffer(true);
    console.log("[Options] reorderGroups flushed to IndexedDB", {
      source: draggedGroup.value.id,
      target: targetGroup.id,
    });
    showSuccess("分组顺序已更新");
  }
  draggedGroup.value = null;
};

const handleEmojiDragStart = (
  emoji: any,
  groupId: string,
  index: number,
  event: DragEvent
) => {
  draggedEmoji.value = emoji;
  draggedEmojiGroupId.value = groupId;
  draggedEmojiIndex.value = index;
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = "move";
  }
};

const handleEmojiDrop = (
  targetGroupId: string,
  targetIndex: number,
  event: DragEvent
) => {
  event.preventDefault();
  if (draggedEmoji.value && draggedEmojiGroupId.value) {
    emojiStore.moveEmoji(
      draggedEmojiGroupId.value,
      draggedEmojiIndex.value,
      targetGroupId,
      targetIndex
    );
    void flushBuffer(true).then(() =>
      console.log("[Options] moveEmoji flushed to IndexedDB", {
        from: draggedEmojiGroupId.value,
        to: targetGroupId,
      })
    );
    showSuccess("表情已移动");
  }
  resetEmojiDrag();
};

const removeEmojiFromGroup = (groupId: string, index: number) => {
  emojiStore.removeEmojiFromGroup(groupId, index);
  void flushBuffer(true).then(() =>
    console.log("[Options] removeEmojiFromGroup flushed to IndexedDB", {
      groupId,
      index,
    })
  );
  showSuccess("表情已删除");
};

const resetEmojiDrag = () => {
  draggedEmoji.value = null;
  draggedEmojiGroupId.value = "";
  draggedEmojiIndex.value = -1;
};

// Settings methods
const updateImageScale = (event: Event) => {
  const target = event.target as HTMLInputElement;
  emojiStore.updateSettings({ imageScale: parseInt(target.value) });
};

// Local grid columns state bound to GridColumnsSelector component
const localGridColumns = ref<number>(emojiStore.settings.gridColumns || 4);

// Keep emojiStore in sync when localGridColumns changes
watch(localGridColumns, (val) => {
  if (Number.isInteger(val) && val >= 1) {
    emojiStore.updateSettings({ gridColumns: val });
  }
});

const updateShowSearchBar = (event: Event) => {
  const target = event.target as HTMLInputElement;
  emojiStore.updateSettings({ showSearchBar: target.checked });
};

// createGroup moved into CreateGroupModal component

const openEditGroup = (group: EmojiGroup) => {
  // Prevent editing favorites group
  if (group.id === "favorites") {
    showError("常用分组不能编辑名称和图标");
    return;
  }
  editingGroupId.value = group.id;
  editGroupName.value = group.name;
  editGroupIcon.value = group.icon;
  showEditGroupModal.value = true;
};

const saveEditGroup = () => {
  if (!editingGroupId.value) return;
  if (!editGroupName.value.trim()) {
    showError("请输入分组名称");
    return;
  }
  emojiStore.updateGroup(editingGroupId.value, {
    name: editGroupName.value.trim(),
    icon: editGroupIcon.value || "📁",
  });
  // Force flush and log
  void flushBuffer(true).then(() =>
    console.log("[Options] saveEditGroup flushed to IndexedDB", {
      id: editingGroupId.value,
      name: editGroupName.value,
    })
  );
  showEditGroupModal.value = false;
  showSuccess("分组已更新");
};

// addEmoji moved into AddEmojiModal component

// Open Add Emoji modal bound to a specific group id
const openAddEmojiModal = (groupId: string) => {
  selectedGroupForAdd.value = groupId || "";
  showAddEmojiModal.value = true;
};

// Export a single group's emojis as JSON file
const exportGroup = (group: EmojiGroup) => {
  if (!group) return;
  exportGroupFile(group);
  showSuccess(`已导出分组 "${group.name}" (${(group.emojis || []).length} 个表情)`);
};

const deleteEmoji = (emojiId: string) => {
  if (confirm("确定要删除这个表情吗？")) {
    emojiStore.deleteEmoji(emojiId);
    void flushBuffer(true).then(() =>
      console.log("[Options] deleteEmoji flushed to IndexedDB", { id: emojiId })
    );
    showSuccess("表情删除成功");
  }
};

const exportConfiguration = () => {
  exportConfigurationFile(emojiStore);
  showSuccess('配置导出成功');
};

// old import helper functions removed - handled by Import*Modal and importUtils

const resetSettings = () => {
  if (confirm("确定要重置所有设置吗？这将清除所有自定义数据。")) {
    emojiStore.resetToDefaults();
    showSuccess("设置重置成功");
  }
};

const syncToChrome = async () => {
  try {
    // Force sync to chrome storage
    const success = await emojiStore.forceSync();
    if (success) {
      showSuccess("数据已上传到Chrome同步存储");
    } else {
      showError("同步失败，请检查网络连接");
    }
  } catch (error) {
    console.error("Sync error:", error);
    showError("同步失败，请重试");
  }
};

const handleImageError = (event: Event) => {
  const target = event.target as HTMLImageElement;
  target.src =
    "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHZpZXdCb3g9IjAgMCA0OCA0OCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQ4IiBoZWlnaHQ9IjQ4IiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0yNCAzNkMzMC42Mjc0IDM2IDM2IDMwLjYyNzQgMzYgMjRDMzYgMTcuMzcyNiAzMC42Mjc0IDEyIDI0IDEyQzE3LjM3MjYgMTIgMTIgMTcuMzcyNiAxMiAyNEMxMiAzMC42Mjc0IDE3LjM3MjYgMzYgMjQgMzZaIiBzdHJva2U9IiM5Q0EzQUYiIHN0cm9rZS13aWR0aD0iMiIvPgo8cGF0aCBkPSJNMjEgMjFIMjdNMjEgMjdIMjciIHN0cm9rZT0iIzlDQTNBRiIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiLz4KPC9zdmc+";
};

// Callbacks from child modals
const onGroupCreated = () => {
  // After CreateGroupModal created a group
  showSuccess('分组创建成功');
  // ensure default new emoji group selection is available
  if (emojiStore.groups.length > 0) {
    // no-op here; AddEmojiModal will use current store.groups when opened
    console.log('[Options] group created, groups count:', emojiStore.groups.length);
  }
};

const onEmojiAdded = () => {
  showSuccess('表情添加成功');
};

const showSuccess = (message: string) => {
  successMessage.value = message;
  showSuccessToast.value = true;
  setTimeout(() => {
    showSuccessToast.value = false;
  }, 3000);
};

const showError = (message: string) => {
  errorMessage.value = message;
  showErrorToast.value = true;
  setTimeout(() => {
    showErrorToast.value = false;
  }, 3000);
};

// Initialize
onMounted(async () => {
  console.log("[Options.vue] Component mounted, loading data...");
  await emojiStore.loadData();
  console.log(
    "[Options.vue] Data loaded, groups count:",
    emojiStore.groups.length
  );

  // Set default values
  if (emojiStore.groups.length > 0) {
    selectedGroupForAdd.value = emojiStore.groups[0].id;
    console.log(
      "[Options.vue] Set default group IDs to:",
      emojiStore.groups[0].id
    );
  } else {
    console.warn("[Options.vue] No groups available after loading");
  }
});

// Keep localGridColumns in sync with store when settings load/change
watch(
  () => emojiStore.settings.gridColumns,
  (val) => {
    if (Number.isInteger(val)) {
      localGridColumns.value = val;
    }
  }
);

// example filler removed
</script>
