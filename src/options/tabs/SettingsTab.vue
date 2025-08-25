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
import { defineComponent, reactive, watch, onMounted } from 'vue'
import store from '../../data/store/main'
import { createOptionsCommService } from '../../services/communication'

export default defineComponent({
  setup() {
    const commService = createOptionsCommService()
    const form = reactive({ ...store.getSettings() })
    let isUpdatingFromExternal = false
    
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
        (newValue, oldValue) => {
          if (isUpdatingFromExternal) return // 避免循环更新
          // 确保值确实发生了变化
          if (newValue !== oldValue) {
            try {
              store.saveSettings(form)
              // 发送设置变更消息到其他页面（包括popup）
              commService.sendSettingsChanged(form)
            } catch (_) {}
          }
        },
        { deep: true }
      )
    }

    onMounted(() => {
      // 监听来自其他页面的设置变更消息（包括popup）
      commService.onSettingsChanged((newSettings) => {
        isUpdatingFromExternal = true
        // 逐个更新属性，确保Vue的响应式系统能正确检测变化
        keys.forEach(key => {
          if (newSettings[key] !== undefined && newSettings[key] !== (form as any)[key]) {
            (form as any)[key] = newSettings[key]
          }
        })
        // 使用 requestAnimationFrame 确保在下一帧重置标志
        requestAnimationFrame(() => {
          isUpdatingFromExternal = false
        })
      })
    })
    
    return { form }
  },
})
</script>
