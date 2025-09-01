<template>
  <div class="space-y-8">
    <a-card title="全局设置">
      <div class="space-y-6">
        <div class="flex items-center justify-between">
          <label class="text-sm font-medium text-gray-700">表情尺寸</label>
          <div class="flex items-center space-x-3">
            <span class="text-sm text-gray-500">小</span>
            <a-slider
              :min="20"
              :max="64"
              :value="settings?.imageScale || 30"
              @change="(value: number) => emit('update:imageScale', value)"
              class="w-32"
            />
            <span class="text-sm text-gray-500">大</span>
          </div>
        </div>

        <div class="flex items-center justify-between">
          <label class="text-sm font-medium text-gray-700">显示搜索栏</label>
          <a-switch
            :checked="settings?.showSearchBar !== false"
            @change="(checked: boolean) => emit('update:showSearchBar', checked)"
          />
        </div>

        <div class="flex items-center justify-between">
          <label class="text-sm font-medium text-gray-700">输出格式</label>
          <a-select
            :value="localOutputFormat"
            @change="handleOutputFormatChange"
            style="width: 120px"
          >
            <a-select-option value="markdown">Markdown</a-select-option>
            <a-select-option value="html">HTML</a-select-option>
            <a-select-option value="unicode">Unicode</a-select-option>
          </a-select>
        </div>

        <div class="flex items-center justify-between">
          <label class="text-sm font-medium text-gray-700">强制移动端模式</label>
          <a-switch
            :checked="settings?.forceMobileMode === true"
            @change="(checked: boolean) => emit('update:forceMobileMode', checked)"
          />
        </div>

        <div class="flex items-center justify-between">
          <label class="text-sm font-medium text-gray-700">网格列数</label>
          <slot name="grid-selector" />
        </div>
      </div>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, isRef } from 'vue'

const props = defineProps<{ settings: any }>()
const settings: any = props.settings
const emit = defineEmits([
  'update:imageScale',
  'update:showSearchBar', 
  'update:outputFormat',
  'update:forceMobileMode'
])

// support both ref(settings) and plain settings object
const getOutputFormat = () => {
  try {
    if (isRef(settings))
      return (settings.value && (settings.value as any).outputFormat) || 'markdown'
    return (settings && (settings as any).outputFormat) || 'markdown'
  } catch {
    return 'markdown'
  }
}

// local reactive copy for outputFormat so the select will update when parent props change
const localOutputFormat = ref<string>(getOutputFormat())
watch(
  () => getOutputFormat(),
  val => {
    localOutputFormat.value = val || 'markdown'
  }
)

const handleOutputFormatChange = (value: string) => {
  localOutputFormat.value = value
  emit('update:outputFormat', value)
}
</script>