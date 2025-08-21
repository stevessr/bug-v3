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
          <div class="flex gap-3">
            <button
              @click="showImportModal = true"
              class="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
            >
              导入配置
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

    <!-- Main Content -->
    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- Settings Panel -->
      <div class="bg-white rounded-lg shadow-sm border mb-8">
        <div class="px-6 py-4 border-b border-gray-200">
          <h2 class="text-lg font-semibold text-gray-900">全局设置</h2>
        </div>
        <div class="p-6 space-y-6">
          <!-- Image Scale -->
          <div class="flex items-center justify-between">
            <div>
              <label class="text-sm font-medium text-gray-900">默认图片缩放</label>
              <p class="text-sm text-gray-500">控制插入表情的默认尺寸</p>
            </div>
            <div class="flex items-center gap-3">
              <input
                v-model.number="emojiStore.settings.imageScale"
                type="range"
                min="5"
                max="150"
                step="5"
                class="w-32"
              />
              <span class="text-sm text-gray-600 w-12">{{ emojiStore.settings.imageScale }}%</span>
            </div>
          </div>

          <!-- Grid Columns -->
          <div class="flex items-center justify-between">
            <div>
              <label class="text-sm font-medium text-gray-900">网格列数</label>
              <p class="text-sm text-gray-500">表情选择器中的列数</p>
            </div>
            <select
              v-model="emojiStore.settings.gridColumns"
              class="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="2">2 列</option>
              <option value="3">3 列</option>
              <option value="4">4 列</option>
              <option value="5">5 列</option>
              <option value="6">6 列</option>
              <option value="8">8 列</option>
            </select>
          </div>

          <!-- Show Search Bar -->
          <div class="flex items-center justify-between">
            <div>
              <label class="text-sm font-medium text-gray-900">显示搜索框</label>
              <p class="text-sm text-gray-500">在表情选择器中显示搜索功能</p>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
              <input
                v-model="emojiStore.settings.showSearchBar"
                type="checkbox"
                class="sr-only peer"
              />
              <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>
      </div>

      <!-- Groups Management -->
      <div class="bg-white rounded-lg shadow-sm border">
        <div class="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h2 class="text-lg font-semibold text-gray-900">表情分组管理</h2>
          <button
            @click="showCreateGroupModal = true"
            class="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            新建分组
          </button>
        </div>
        
        <!-- Groups List -->
        <div class="divide-y divide-gray-200">
          <div
            v-for="group in emojiStore.sortedGroups"
            :key="group.id"
            class="p-6 hover:bg-gray-50 transition-colors"
          >
            <div class="flex items-center justify-between mb-4">
              <div class="flex items-center gap-3">
                <span class="text-2xl">{{ group.icon }}</span>
                <div>
                  <h3 class="font-medium text-gray-900">{{ group.name }}</h3>
                  <p class="text-sm text-gray-500">{{ group.emojis.length }} 个表情</p>
                </div>
              </div>
              <div class="flex items-center gap-2">
                <button
                  @click="editGroup(group)"
                  class="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded"
                >
                  编辑
                </button>
                <button
                  @click="showAddEmojiToGroup(group.id)"
                  class="px-3 py-1 text-sm text-green-600 hover:bg-green-50 rounded"
                >
                  添加表情
                </button>
                <button
                  v-if="group.id !== 'favorites' && group.id !== 'nachoneko'"
                  @click="deleteGroup(group.id)"
                  class="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded"
                >
                  删除
                </button>
              </div>
            </div>

            <!-- Emojis Grid -->
            <div v-if="group.emojis.length > 0" class="grid grid-cols-8 gap-2">
              <div
                v-for="emoji in group.emojis.slice(0, 16)"
                :key="emoji.id"
                class="relative group/emoji"
              >
                <img
                  :src="emoji.url"
                  :alt="emoji.name"
                  :title="emoji.name"
                  class="w-10 h-10 object-contain rounded hover:scale-110 transition-transform cursor-pointer"
                  @click="editEmoji(emoji)"
                />
                <button
                  @click="deleteEmoji(emoji.id)"
                  class="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-xs opacity-0 group-hover/emoji:opacity-100 transition-opacity"
                >
                  ×
                </button>
              </div>
              <div
                v-if="group.emojis.length > 16"
                class="w-10 h-10 bg-gray-100 rounded flex items-center justify-center text-xs text-gray-500"
              >
                +{{ group.emojis.length - 16 }}
              </div>
            </div>
            <div v-else class="text-center py-8 text-gray-500 text-sm">
              该分组还没有表情
            </div>
          </div>
        </div>
      </div>
    </main>

    <!-- Create Group Modal -->
    <div v-if="showCreateGroupModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg p-6 w-96">
        <h3 class="text-lg font-semibold mb-4">新建表情分组</h3>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">分组名称</label>
            <input
              v-model="newGroup.name"
              type="text"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="输入分组名称"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">分组图标</label>
            <input
              v-model="newGroup.icon"
              type="text"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="输入表情符号 (如: 😊)"
            />
          </div>
        </div>
        <div class="flex justify-end gap-3 mt-6">
          <button
            @click="showCreateGroupModal = false"
            class="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded"
          >
            取消
          </button>
          <button
            @click="createGroup"
            class="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            创建
          </button>
        </div>
      </div>
    </div>

    <!-- Add Emoji Modal -->
    <div v-if="showAddEmojiModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg p-6 w-96">
        <h3 class="text-lg font-semibold mb-4">添加表情</h3>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">表情名称</label>
            <input
              v-model="newEmoji.name"
              type="text"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="输入表情名称"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">图片URL</label>
            <input
              v-model="newEmoji.url"
              type="url"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="https://example.com/emoji.png"
            />
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">宽度</label>
              <input
                v-model.number="newEmoji.width"
                type="number"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="可选"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">高度</label>
              <input
                v-model.number="newEmoji.height"
                type="number"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="可选"
              />
            </div>
          </div>
          <!-- Preview -->
          <div v-if="newEmoji.url" class="border border-gray-200 rounded p-4 text-center">
            <p class="text-sm text-gray-600 mb-2">预览:</p>
            <img
              :src="newEmoji.url"
              :alt="newEmoji.name"
              class="w-16 h-16 object-contain mx-auto"
              @error="() => {}"
            />
          </div>
        </div>
        <div class="flex justify-end gap-3 mt-6">
          <button
            @click="showAddEmojiModal = false"
            class="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded"
          >
            取消
          </button>
          <button
            @click="addEmoji"
            class="px-4 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700"
          >
            添加
          </button>
        </div>
      </div>
    </div>

    <!-- Import Modal -->
    <div v-if="showImportModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg p-6 w-96">
        <h3 class="text-lg font-semibold mb-4">导入配置</h3>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">配置JSON</label>
            <textarea
              v-model="importData"
              rows="10"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-xs"
              placeholder="粘贴配置JSON数据..."
            ></textarea>
          </div>
        </div>
        <div class="flex justify-end gap-3 mt-6">
          <button
            @click="showImportModal = false"
            class="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded"
          >
            取消
          </button>
          <button
            @click="importConfiguration"
            class="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            导入
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useEmojiStore } from '../src/stores/emojiStore';
import type { EmojiGroup, Emoji } from '../src/types/emoji';

const emojiStore = useEmojiStore();

// Modal states
const showCreateGroupModal = ref(false);
const showAddEmojiModal = ref(false);
const showImportModal = ref(false);

// Form data
const newGroup = ref({ name: '', icon: '' });
const newEmoji = ref({ 
  name: '', 
  url: '', 
  width: undefined as number | undefined, 
  height: undefined as number | undefined 
});
const importData = ref('');
const currentGroupId = ref('');

// Methods
const createGroup = () => {
  if (newGroup.value.name && newGroup.value.icon) {
    emojiStore.createGroup(newGroup.value.name, newGroup.value.icon);
    newGroup.value = { name: '', icon: '' };
    showCreateGroupModal.value = false;
  }
};

const editGroup = (group: EmojiGroup) => {
  const newName = prompt('输入新的分组名称:', group.name);
  if (newName && newName !== group.name) {
    emojiStore.updateGroup(group.id, { name: newName });
  }
};

const deleteGroup = (groupId: string) => {
  if (confirm('确定要删除这个分组吗？其中的表情也会被删除。')) {
    emojiStore.deleteGroup(groupId);
  }
};

const showAddEmojiToGroup = (groupId: string) => {
  currentGroupId.value = groupId;
  showAddEmojiModal.value = true;
};

const addEmoji = () => {
  if (newEmoji.value.name && newEmoji.value.url && currentGroupId.value) {
    emojiStore.addEmoji(currentGroupId.value, {
      name: newEmoji.value.name,
      url: newEmoji.value.url,
      packet: Date.now(), // Simple packet generation
      width: newEmoji.value.width,
      height: newEmoji.value.height
    });
    
    newEmoji.value = { name: '', url: '', width: undefined, height: undefined };
    showAddEmojiModal.value = false;
    currentGroupId.value = '';
  }
};

const editEmoji = (emoji: Emoji) => {
  const newName = prompt('输入新的表情名称:', emoji.name);
  if (newName && newName !== emoji.name) {
    emojiStore.updateEmoji(emoji.id, { name: newName });
  }
};

const deleteEmoji = (emojiId: string) => {
  if (confirm('确定要删除这个表情吗？')) {
    emojiStore.deleteEmoji(emojiId);
  }
};

const exportConfiguration = () => {
  const config = emojiStore.exportConfiguration();
  const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `emoji-config-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const importConfiguration = () => {
  try {
    const config = JSON.parse(importData.value);
    const success = emojiStore.importConfiguration(config);
    if (success) {
      alert('配置导入成功！');
      showImportModal.value = false;
      importData.value = '';
    } else {
      alert('配置导入失败，请检查格式。');
    }
  } catch (error) {
    alert('JSON格式错误，请检查配置数据。');
  }
};

// Lifecycle
onMounted(async () => {
  await emojiStore.loadData();
});
</script>

<style>
/* Import TailwindCSS */
@import '../src/styles/main.css';

/* Additional custom styles for options page */
.container {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
</style>
