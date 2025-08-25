<template>
  <a-card title="设置">
    <a-form :model="form" layout="vertical">
      <a-form-item label="图片缩放 (%)">
        <div style="display: flex; gap: 12px; align-items: center">
          <a-slider v-model:value="form.imageScale" :min="1" :max="100" style="flex: 1" />
          <a-input-number v-model:value="form.imageScale" :min="1" :max="100" />
        </div>
      </a-form-item>

      <a-form-item label="默认表情组">
        <default-group-select v-model:modelValue="form.defaultEmojiGroupUUID" />
      </a-form-item>

      <a-form-item label="列数">
        <a-select v-model:value="form.gridColumns">
          <a-select-option v-for="n in 8" :key="n" :value="n">{{ n }}</a-select-option>
        </a-select>
      </a-form-item>

      <a-form-item label="输出格式">
        <a-select v-model:value="form.outputFormat">
          <a-select-option value="markdown">Markdown</a-select-option>
          <a-select-option value="html">HTML</a-select-option>
          <a-select-option value="bbcode">BBCode</a-select-option>
        </a-select>
      </a-form-item>

      <a-form-item> <a-switch v-model:checked="form.MobileMode" /> 移动端视图 </a-form-item>

      <!-- 保存按钮已移除：设置改动将自动保存并广播 -->
    </a-form>
  </a-card>
</template>

<script lang="ts">
import { defineComponent, reactive, watch } from 'vue'
import store from '../../data/store/main'

export default defineComponent({
  setup() {
    const form = reactive({ ...store.getSettings() })
    // watch key settings and persist immediately so UI can react
    const keys = [
      'imageScale',
      'defaultEmojiGroupUUID',
      'gridColumns',
      'outputFormat',
      'MobileMode',
    ]
    for (const k of keys) {
      // use any cast to satisfy TS when indexing by dynamic key
      watch(
        () => (form as any)[k],
        () => {
          try {
            store.saveSettings(form)
          } catch (_) {}
        },
      )
    }
    return { form }
  },
})
</script>
