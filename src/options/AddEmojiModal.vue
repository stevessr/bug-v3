<template>
  <div v-if="show" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" @click="close">
    <div class="bg-white rounded-lg p-6 w-full max-w-md" @click.stop>
      <h3 class="text-lg font-semibold mb-4">添加表情</h3>
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">表情名称</label>
          <input v-model="name" type="text" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="输入表情名称" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">图片URL</label>
          <input v-model="url" type="url" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="输入图片链接" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">所属分组</label>
          <select v-model="groupId" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option v-for="g in groups" :key="g.id" :value="g.id">{{ g.name }}</option>
          </select>
        </div>
        <div v-if="url" class="text-center">
          <img :src="url" alt="预览" class="w-16 h-16 object-contain mx-auto border border-gray-200 rounded" @error="handleImageError" />
        </div>
      </div>
      <div class="flex justify-end gap-3 mt-6">
        <button @click="close" class="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded transition-colors">取消</button>
        <button @click="add" class="px-4 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors">添加</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useEmojiStore } from '../stores/emojiStore';
import { flushBuffer } from '../utils/indexedDB';

const { show, groups, defaultGroupId } = defineProps<{ show: boolean; groups: any[]; defaultGroupId?: string }>()

const emits = defineEmits<{
  (e: 'update:show', value: boolean): void,
  (e: 'added', payload: { groupId: string; name: string }): void,
}>();

const name = ref('');
const url = ref('');
const groupId = ref(defaultGroupId || groups[0]?.id || '');

watch(() => defaultGroupId, (v) => {
  if (v) groupId.value = v;
});

const emojiStore = useEmojiStore();

const handleImageError = (event: Event) => {
  const target = event.target as HTMLImageElement;
  target.src = '';
};

const close = () => {
  emits('update:show', false);
};

const add = () => {
  if (!name.value.trim() || !url.value.trim() || !groupId.value) return;
  const emojiData = { packet: Date.now(), name: name.value.trim(), url: url.value.trim() };
  emojiStore.addEmoji(groupId.value, emojiData);
  void flushBuffer(true).then(() => console.log('[AddEmojiModal] addEmoji flushed'));
  emits('added', { groupId: groupId.value, name: emojiData.name });
  emits('update:show', false);
  name.value = '';
  url.value = '';
  groupId.value = groups[0]?.id || '';
}
</script>
