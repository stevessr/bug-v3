<template>
  <div class="bg-white rounded-lg shadow-sm border">
    <div class="px-6 py-4 border-b border-gray-200">
      <h2 class="text-lg font-semibold text-gray-900">全局设置</h2>
    </div>
    <div class="p-6 space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <label class="text-sm font-medium text-gray-900">默认图片缩放</label>
          <p class="text-sm text-gray-500">控制插入表情的默认尺寸</p>
        </div>
        <div class="flex items-center gap-3">
          <input :value="settings.imageScale" @input="$emit('update:imageScale', $event)" type="range" min="5" max="150" step="5" class="w-32" />
          <span class="text-sm text-gray-600 w-12">{{ settings.imageScale }}%</span>
        </div>
      </div>

      <div class="flex items-center justify-between">
        <div>
          <label class="text-sm font-medium text-gray-900">网格列数</label>
          <p class="text-sm text-gray-500">表情选择器中的列数</p>
        </div>
        <slot name="grid-selector"></slot>
      </div>

      <div class="flex items-center justify-between">
        <div>
          <label class="text-sm font-medium text-gray-900">显示搜索栏</label>
          <p class="text-sm text-gray-500">在表情选择器中显示搜索功能</p>
        </div>
        <label class="relative inline-flex items-center cursor-pointer">
          <input type="checkbox" :checked="settings.showSearchBar" @change="$emit('update:showSearchBar', $event)" class="sr-only peer" />
          <div class="relative w-11 h-6 bg-gray-200 rounded-full transition-colors peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:w-5 after:h-5 after:bg-white after:rounded-full after:transition-all after:border after:border-gray-300 peer-checked:after:translate-x-[20px]"></div>
        </label>
      </div>

      <div class="flex items-center justify-between">
        <div>
          <label class="text-sm font-medium text-gray-900">输出格式</label>
          <p class="text-sm text-gray-500">插入表情时使用的格式</p>
        </div>
        <select 
          v-model="localOutputFormat"
          @change="handleOutputFormatChange"
          class="px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="markdown">Markdown 格式</option>
          <option value="html">HTML 格式</option>
        </select>
      </div>

      <div class="flex items-center justify-between">
        <div>
          <label class="text-sm font-medium text-gray-900">强制移动模式</label>
          <p class="text-sm text-gray-500">在桌面端强制使用移动端样式</p>
        </div>
        <label class="relative inline-flex items-center cursor-pointer">
          <input type="checkbox" :checked="settings.forceMobileMode" @change="$emit('update:forceMobileMode', $event)" class="sr-only peer" />
          <div class="relative w-11 h-6 bg-gray-200 rounded-full transition-colors peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:w-5 after:h-5 after:bg-white after:rounded-full after:transition-all after:border after:border-gray-300 peer-checked:after:translate-x-[20px]"></div>
        </label>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, isRef } from 'vue';

const props = defineProps<{ settings: any }>();
// allow flexible typing (either a reactive ref or a plain object)
const settings: any = props.settings;
const emit = defineEmits(['update:imageScale', 'update:showSearchBar', 'update:outputFormat', 'update:forceMobileMode']);

// support both ref(settings) and plain settings object
const getOutputFormat = () => {
  try {
    if (isRef(settings)) return (settings.value && (settings.value as any).outputFormat) || 'markdown';
    return (settings && (settings as any).outputFormat) || 'markdown';
  } catch {
    return 'markdown';
  }
};

// local reactive copy for outputFormat so the select will update when parent props change
const localOutputFormat = ref<string>(getOutputFormat());
watch(
  () => getOutputFormat(),
  (val) => {
    localOutputFormat.value = val || 'markdown';
  }
);

const handleOutputFormatChange = (event: Event) => {
  const target = event.target as HTMLSelectElement;
  if (target) {
    // keep local state in sync and notify parent
    localOutputFormat.value = target.value;
    emit('update:outputFormat', target.value);
  }
};
</script>

<style scoped></style>
