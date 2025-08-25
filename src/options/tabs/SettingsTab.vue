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

      <a-form-item>
        <a-button type="primary" @click="save">保存</a-button>
      </a-form-item>
    </a-form>
  </a-card>
</template>

<script lang="ts">
import { defineComponent, reactive } from 'vue'
import store from '../../data/store/main'

export default defineComponent({
  setup() {
    const form = reactive({ ...store.getSettings() })
    function save() {
      store.saveSettings(form)
    }
    return { form, save }
  },
})
</script>
