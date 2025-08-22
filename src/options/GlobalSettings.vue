<template>
  <div class="bg-white rounded-lg shadow-sm border">
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
            :value="settings.imageScale"
            @input="$emit('update:imageScale', $event)"
            type="range"
            min="5"
            max="150"
            step="5"
            class="w-32"
          />
          <span class="text-sm text-gray-600 w-12">{{ settings.imageScale }}%</span>
        </div>
      </div>

      <!-- Grid Columns -->
      <div class="flex items-center justify-between">
        <div>
          <label class="text-sm font-medium text-gray-900">网格列数</label>
          <p class="text-sm text-gray-500">表情选择器中的列数</p>
        </div>
        <slot name="grid-selector"></slot>
      </div>

      <!-- Show Search Bar -->
      <div class="flex items-center justify-between">
        <div>
          <label class="text-sm font-medium text-gray-900">显示搜索框</label>
          <p class="text-sm text-gray-500">在表情选择器中显示搜索功能</p>
        </div>
        <label class="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            :checked="settings.showSearchBar"
            @change="$emit('update:showSearchBar', $event)"
            class="sr-only peer"
          />
          <div
            class="relative w-11 h-6 bg-gray-200 rounded-full transition-colors peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:w-5 after:h-5 after:bg-white after:rounded-full after:transition-all after:border after:border-gray-300 peer-checked:after:translate-x-[20px]"
          ></div>
        </label>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{ settings: any }>();
const settings = props.settings;
defineEmits(['update:imageScale', 'update:showSearchBar']);
</script>

<style scoped></style>
