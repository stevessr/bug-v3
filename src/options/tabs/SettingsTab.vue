<script lang="ts">
import { defineComponent, reactive, watch, onMounted, nextTick } from 'vue'
import { message } from 'ant-design-vue'

import store from '../../data/store/main'
import { createOptionsCommService } from '../../services/communication'
import settingsStore from '../../data/update/settingsStore'

export default defineComponent({
  setup() {
    const commService = createOptionsCommService()
    const form = reactive({ ...store.getSettings() })
    let isUpdatingFromExternal = false

    // 加载转换后的默认配置
    async function loadConvertedDefaults() {
      try {
        const response = await fetch('/static/config/converted_payload.json')
        if (response.ok) {
          const payload = await response.json()
          return payload
        }
      } catch (error) {
        console.warn('Failed to load converted defaults, using fallback:', error)
      }
      // 回退到内置默认值
      return {
        Settings: { ...settingsStore.defaults },
        emojiGroups: [],
      }
    }

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
            console.log(`Settings changed: ${k} = ${newValue} (was ${oldValue})`)
            try {
              store.saveSettings(form)
              // 发送设置变更消息到其他页面（包括popup）
              commService.sendSettingsChanged(form)
            } catch (error) {
              console.error('Failed to save settings:', error)
            }
          }
        },
        { deep: true },
      )
    }

    onMounted(() => {
      // 监听来自其他页面的设置变更消息（包括popup）
      commService.onSettingsChanged((newSettings) => {
        console.log('Received settings change:', newSettings)

        // 检查消息是否有效
        if (!newSettings || typeof newSettings !== 'object') {
          console.warn('Invalid settings message received:', newSettings)
          return
        }

        isUpdatingFromExternal = true

        // 逐个更新属性，确保Vue的响应式系统能正确检测变化
        keys.forEach((key) => {
          if (newSettings[key] !== undefined && newSettings[key] !== (form as any)[key]) {
            console.log(`Updating ${key} from ${(form as any)[key]} to ${newSettings[key]}`)
            ;(form as any)[key] = newSettings[key]
          }
        })

        // 使用 nextTick 确保在 Vue 更新周期完成后重置标志
        nextTick(() => {
          isUpdatingFromExternal = false
        })
      })
    })

    // 执行重置设置的核心逻辑（不包含确认提示）
    async function resetSettings() {
      try {
        const defaultPayload = await loadConvertedDefaults()
        const defs = { ...defaultPayload.Settings }

        // 将 Date 转为可序列化字符串（storage 会处理字符串->Date 的反序列化）
        if (defs.lastModified instanceof Date) defs.lastModified = defs.lastModified.toISOString()

        // 更新本地表单并保存，广播到其他页面
        Object.keys(defs).forEach((k) => ((form as any)[k] = (defs as any)[k]))
        store.saveSettings(defs)
        const comm = createOptionsCommService()
        comm.sendSettingsChanged(defs)

        console.log('Settings reset to converted defaults:', defs)
      } catch (err) {
        console.error('Failed to reset settings', err)
        // 回退到内置默认值
        const defs = { ...(settingsStore.defaults as any) }
        if (defs.lastModified instanceof Date) defs.lastModified = defs.lastModified.toISOString()
        Object.keys(defs).forEach((k) => ((form as any)[k] = (defs as any)[k]))
        store.saveSettings(defs)
        const comm = createOptionsCommService()
        comm.sendSettingsChanged(defs)
      }
    }

    // Popconfirm 的确认回调：调用核心逻辑并显示反馈
    function onConfirmResetSettings(e?: MouseEvent) {
      console.log('Popconfirm confirm event:', e)
      resetSettings()
      message.success('设置已重置')
    }

    // 完全重置：包括表情组数据
    // 完全重置：包括表情组数据（核心逻辑）
    async function resetAllData() {
      try {
        const defaultPayload = await loadConvertedDefaults()

        // 使用导入功能完全重置数据
        const success = store.importPayload(defaultPayload)
        if (success) {
          // 更新表单显示
          const newSettings = defaultPayload.Settings
          Object.keys(newSettings).forEach((k) => ((form as any)[k] = (newSettings as any)[k]))

          // 刷新页面以确保所有组件都更新
          setTimeout(() => {
            window.location.reload()
          }, 1000)

          console.log('All data reset to converted defaults')
        } else {
          throw new Error('Import failed')
        }
      } catch (err) {
        console.error('Failed to reset all data', err)
        alert('重置失败，请检查控制台错误信息')
      }
    }

    // Popconfirm 的确认回调
    function onConfirmResetAllData(e?: MouseEvent) {
      console.log('Popconfirm confirm event (all data):', e)
      resetAllData()
      message.success('所有数据已重置，页面将刷新')
    }

    function onCancel(e?: MouseEvent) {
      console.log('Popconfirm cancelled:', e)
      message.info('已取消')
    }

    // applyDefaults: 将默认值应用到设置但不改分组数据（保守操作）
    async function applyDefaults() {
      try {
        const defaultPayload = await loadConvertedDefaults()
        const defs = { ...defaultPayload.Settings }
        if (defs.lastModified instanceof Date) defs.lastModified = defs.lastModified.toISOString()

        // 只覆盖 Settings 字段
        Object.keys(defs).forEach((k) => ((form as any)[k] = (defs as any)[k]))
        store.saveSettings(defs)
        const comm = createOptionsCommService()
        comm.sendSettingsChanged(defs)

        console.log('Applied converted defaults to settings only')
      } catch (err) {
        console.error('Failed to apply defaults', err)
        // 回退到内置默认值
        const defs = { ...(settingsStore.defaults as any) }
        if (defs.lastModified instanceof Date) defs.lastModified = defs.lastModified.toISOString()
        Object.keys(defs).forEach((k) => ((form as any)[k] = (defs as any)[k]))
        store.saveSettings(defs)
        const comm = createOptionsCommService()
        comm.sendSettingsChanged(defs)
      }
    }

    // Popconfirm 的确认回调：应用默认并显示反馈
    function onConfirmApplyDefaults(e?: MouseEvent) {
      console.log('Popconfirm confirm event (apply defaults):', e)
      applyDefaults()
      message.success('默认设置已应用')
    }

    return {
      form,
      resetSettings,
      applyDefaults,
      resetAllData,
      onConfirmResetSettings,
      onConfirmResetAllData,
      onConfirmApplyDefaults,
      onCancel,
    }
  },
})
</script>

<template>
  <a-card title="设置">
    <a-form-item>
      <div style="display: flex; gap: 8px; flex-wrap: wrap">
        <a-popconfirm
          title="确认要将设置重置为默认值吗？此操作会覆盖当前设置。"
          ok-text="确认"
          cancel-text="取消"
          @confirm="onConfirmResetSettings"
          @cancel="onCancel"
        >
          <a-button type="default">重置设置</a-button>
        </a-popconfirm>

        <a-popconfirm
          title="确认要将默认设置应用到当前设置吗？此操作会覆盖相关设置但不会刷新分组。"
          ok-text="确认"
          cancel-text="取消"
          @confirm="onConfirmApplyDefaults"
          @cancel="onCancel"
        >
          <a-button type="primary">应用默认（不刷新分组）</a-button>
        </a-popconfirm>

        <a-popconfirm
          title="确认要重置所有数据吗？这将删除所有自定义表情组和设置，恢复到默认状态。此操作不可撤销！"
          ok-text="确认"
          cancel-text="取消"
          @confirm="onConfirmResetAllData"
          @cancel="onCancel"
        >
          <a-button type="danger">完全重置（包括分组）</a-button>
        </a-popconfirm>
      </div>
      <div style="margin-top: 8px; font-size: 12px; color: #666">
        重置功能将使用转换后的默认配置文件 (converted_payload.json)
      </div>
    </a-form-item>

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
    </a-form>
  </a-card>
</template>
