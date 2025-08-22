<template>
  <div
    v-if="show"
    class="fixed inset-0 z-50 overflow-y-auto"
    aria-labelledby="modal-title"
    role="dialog"
    aria-modal="true"
  >
    <div
      class="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0"
    >
      <div
        class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
        @click="closeModal"
      ></div>

      <span
        class="hidden sm:inline-block sm:align-middle sm:h-screen"
        aria-hidden="true"
        >&#8203;</span
      >

      <div
        class="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6"
      >
        <div>
          <div class="mt-3 text-center sm:mt-5">
            <h3
              class="text-lg leading-6 font-medium text-gray-900"
              id="modal-title"
            >
              编辑表情
            </h3>
            <div class="mt-2">
              <p class="text-sm text-gray-500">
                修改表情的名称和描述
              </p>
            </div>
          </div>
        </div>

        <form @submit.prevent="handleSubmit" class="mt-5 space-y-4">
          <!-- Preview -->
          <div class="flex justify-center">
            <div class="w-24 h-24 border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
              <img
                :src="localEmoji.url"
                :alt="localEmoji.name"
                class="w-full h-full object-cover"
                @error="$emit('image-error', $event)"
              />
            </div>
          </div>

          <!-- Name field -->
          <div>
            <label for="emoji-name" class="block text-sm font-medium text-gray-700">
              表情名称
            </label>
            <input
              id="emoji-name"
              v-model="localEmoji.name"
              type="text"
              class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              placeholder="输入表情名称"
              required
            />
          </div>

          <!-- URL field -->
          <div>
            <label for="emoji-url" class="block text-sm font-medium text-gray-700">
              图片链接
            </label>
            <input
              id="emoji-url"
              v-model="localEmoji.url"
              type="url"
              class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              placeholder="https://example.com/emoji.png"
              required
            />
          </div>

          <!-- Buttons -->
          <div class="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
            <button
              type="submit"
              class="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:col-start-2 sm:text-sm"
            >
              保存
            </button>
            <button
              type="button"
              @click="closeModal"
              class="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:col-start-1 sm:text-sm"
            >
              取消
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import type { Emoji } from '../../types/emoji';

const props = defineProps<{
  show: boolean;
  emoji?: Emoji;
  groupId?: string;
  index?: number;
}>();

const emit = defineEmits<{
  'update:show': [value: boolean];
  'save': [payload: { emoji: Emoji; groupId: string; index: number }];
  'image-error': [event: Event];
}>();

const localEmoji = ref<Emoji>({
  name: '',
  url: '',
});

watch(() => props.emoji, (newEmoji) => {
  if (newEmoji) {
    localEmoji.value = { ...newEmoji };
  }
}, { immediate: true });

const closeModal = () => {
  emit('update:show', false);
};

const handleSubmit = () => {
  if (props.groupId !== undefined && props.index !== undefined) {
    emit('save', {
      emoji: localEmoji.value,
      groupId: props.groupId,
      index: props.index,
    });
    closeModal();
  }
};
</script>