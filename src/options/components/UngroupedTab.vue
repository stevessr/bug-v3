<template>
  <div class="space-y-8">
    <div class="bg-white rounded-lg shadow-sm border">
      <div class="px-6 py-4 border-b border-gray-200">
        <div class="flex justify-between items-center">
          <h2 class="text-lg font-semibold text-gray-900">未分组表情</h2>
          <div class="flex items-center gap-4">
            <!-- 批量操作控制 -->
            <div v-if="isMultiSelectMode && selectedEmojis.size > 0" class="flex items-center gap-2">
              <span class="text-sm text-gray-600">已选择 {{ selectedEmojis.size }} 个</span>
              <select 
                v-model="targetGroupId" 
                class="text-sm border border-gray-300 rounded px-2 py-1"
              >
                <option value="">选择目标分组</option>
                <option v-for="group in availableGroups" :key="group.id" :value="group.id">
                  {{ group.name }}
                </option>
                <option value="__create_new__">+ 创建新分组</option>
              </select>
              <button 
                @click="moveSelectedEmojis"
                :disabled="!targetGroupId"
                class="text-sm px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                移动
              </button>
              <button 
                @click="clearSelection"
                class="text-sm px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600"
              >
                清空选择
              </button>
            </div>
            <!-- 多选模式开关 -->
            <label class="flex items-center gap-2 cursor-pointer">
              <input 
                type="checkbox" 
                v-model="isMultiSelectMode"
                @change="onMultiSelectModeChange"
                class="rounded"
              />
              <span class="text-sm text-gray-700">多选模式</span>
            </label>
          </div>
        </div>
      </div>

      <div class="p-6">
        <div v-if="ungroup && ungroup.emojis?.length" class="grid gap-3" :style="{ gridTemplateColumns: `repeat(${emojiStore.settings.gridColumns}, minmax(0, 1fr))` }">
          <div v-for="(emoji, idx) in ungroup.emojis" :key="`ung-${emoji.id || idx}`" class="emoji-item relative">
            <div 
              class="aspect-square bg-gray-50 rounded-lg overflow-hidden"
              :class="{ 'cursor-pointer': isMultiSelectMode, 'ring-2 ring-blue-500': isMultiSelectMode && selectedEmojis.has(idx) }"
              @click="isMultiSelectMode ? toggleEmojiSelection(idx) : null"
            >
              <img :src="emoji.url" :alt="emoji.name" class="w-full h-full object-cover" />
            </div>
            
            <!-- 多选模式下的选择框 -->
            <div v-if="isMultiSelectMode" class="absolute bottom-1 right-1">
              <input 
                type="checkbox" 
                :checked="selectedEmojis.has(idx)"
                @change="toggleEmojiSelection(idx)"
                class="w-4 h-4 text-blue-600 bg-white border-2 border-gray-300 rounded focus:ring-blue-500"
              />
            </div>
            
            <!-- 非多选模式下的编辑/删除按钮 -->
            <div v-if="!isMultiSelectMode" class="absolute top-1 right-1 flex gap-1">
              <button @click="$emit('edit', emoji, ungroup.id, idx)" title="编辑" class="text-xs px-1 py-0.5 bg-white bg-opacity-80 rounded">编辑</button>
              <button @click="$emit('remove', ungroup.id, idx)" title="移除" class="text-xs px-1 py-0.5 bg-white bg-opacity-80 rounded">移除</button>
            </div>
            
            <div class="text-xs text-center text-gray-600 mt-1 truncate">{{ emoji.name }}</div>
          </div>
        </div>
        <div v-else class="text-sm text-gray-500">未分组表情为空。</div>
      </div>
    </div>

    <!-- 创建新分组对话框 -->
    <div v-if="showCreateGroupDialog" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg p-6 w-96">
        <h3 class="text-lg font-semibold mb-4">创建新分组</h3>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">分组名称</label>
            <input 
              v-model="newGroupName"
              type="text" 
              class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="输入分组名称"
              @keyup.enter="confirmCreateGroup"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">分组图标</label>
            <input 
              v-model="newGroupIcon"
              type="text" 
              class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="输入图标 URL 或 emoji"
            />
          </div>
        </div>
        <div class="flex justify-end gap-2 mt-6">
          <button 
            @click="cancelCreateGroup"
            class="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
          >
            取消
          </button>
          <button 
            @click="confirmCreateGroup"
            :disabled="!newGroupName.trim()"
            class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            创建
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { EmojiGroup } from '../../types/emoji';

const props = defineProps<{ emojiStore: any }>();
defineEmits<{
  (e: 'remove', groupId: string, idx: number): void;
  (e: 'edit', emoji: any, groupId: string, idx: number): void;
}>();

// 多选功能相关状态
const isMultiSelectMode = ref(false);
const selectedEmojis = ref(new Set<number>());
const targetGroupId = ref('');
const showCreateGroupDialog = ref(false);
const newGroupName = ref('');
const newGroupIcon = ref('');

const ungroup = computed(() => props.emojiStore?.groups?.find((g: any) => g.id === 'ungrouped'));

// 可用的分组列表（排除未分组）
const availableGroups = computed(() => 
  props.emojiStore?.groups?.filter((g: EmojiGroup) => g.id !== 'ungrouped') || []
);

// 多选模式变化处理
const onMultiSelectModeChange = () => {
  if (!isMultiSelectMode.value) {
    clearSelection();
  }
};

// 切换表情选择状态
const toggleEmojiSelection = (idx: number) => {
  if (selectedEmojis.value.has(idx)) {
    selectedEmojis.value.delete(idx);
  } else {
    selectedEmojis.value.add(idx);
  }
  // 触发响应式更新
  selectedEmojis.value = new Set(selectedEmojis.value);
};

// 清空选择
const clearSelection = () => {
  selectedEmojis.value.clear();
  selectedEmojis.value = new Set();
  targetGroupId.value = '';
};

// 移动选中的表情
const moveSelectedEmojis = async () => {
  if (!targetGroupId.value || selectedEmojis.value.size === 0) return;

  try {
    let targetGroup;
    
    // 如果选择创建新分组
    if (targetGroupId.value === '__create_new__') {
      showCreateGroupDialog.value = true;
      return;
    }
    
    targetGroup = props.emojiStore.groups.find((g: EmojiGroup) => g.id === targetGroupId.value);
    if (!targetGroup) return;

    // 获取选中的表情索引（按降序排列，避免删除时索引变化）
    const sortedIndices = Array.from(selectedEmojis.value).sort((a, b) => b - a);

    // 开始批量操作
    props.emojiStore.beginBatch();

    try {
      // 逐个移动表情
      for (const index of sortedIndices) {
        if (index < ungroup.value.emojis.length) {
          // 使用store的moveEmoji方法移动表情
          props.emojiStore.moveEmoji(
            'ungrouped', 
            index, 
            targetGroupId.value, 
            -1 // -1表示添加到目标分组的末尾
          );
        }
      }
    } finally {
      // 结束批量操作，触发保存
      await props.emojiStore.endBatch();
    }

    // 清空选择
    clearSelection();
    
    console.log(`已移动 ${sortedIndices.length} 个表情到分组: ${targetGroup.name}`);
  } catch (error) {
    console.error('移动表情时出错:', error);
  }
};

// 确认创建新分组
const confirmCreateGroup = async () => {
  if (!newGroupName.value.trim()) return;

  try {
    // 创建新分组
    const newGroup = props.emojiStore.createGroup(
      newGroupName.value.trim(),
      newGroupIcon.value || '📁'
    );

    // 设置目标分组ID并关闭对话框
    targetGroupId.value = newGroup.id;
    showCreateGroupDialog.value = false;
    
    // 重置表单
    newGroupName.value = '';
    newGroupIcon.value = '';

    // 立即执行移动操作
    await moveSelectedEmojis();
    
    console.log(`已创建新分组: ${newGroup.name}`);
  } catch (error) {
    console.error('创建分组时出错:', error);
  }
};

// 取消创建分组
const cancelCreateGroup = () => {
  showCreateGroupDialog.value = false;
  newGroupName.value = '';
  newGroupIcon.value = '';
  targetGroupId.value = '';
};
</script>

<style scoped>
.emoji-item { width: 80px; }
</style>
