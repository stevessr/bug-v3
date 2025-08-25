<template>
  <div :class="['popup-root', { mobile: settings.MobileMode }]">
    <div class="popup-header">
      <div class="center">表情快速面板</div>
      <div class="right">
        <a-button type="text" size="small" @click="openOptions">
          <template #icon>
            <setting-outlined />
          </template>
          设置
        </a-button>
      </div>
    </div>

    <!-- 图片缩放控制栏 -->
    <div class="scale-control">
      <div class="scale-control-content">
        <span class="scale-label">图片缩放</span>
        <a-slider
          v-model:value="settings.imageScale"
          :min="1"
          :max="100"
          class="scale-slider"
          @change="onScaleChange"
        />
        <span class="scale-value">{{ settings.imageScale }}%</span>
      </div>
    </div>

    <div class="popup-body">
      <div class="group-list">
        <div v-if="hot.length" class="group-section">
          <div class="group-title">常用</div>
          <div class="emoji-grid" :style="gridStyle">
            <div v-for="e in hot" :key="e.UUID" class="emoji-cell" @click="onEmojiClick(e)">
              <img :src="stringifyUrl(e.displayUrl || e.realUrl)" :style="emojiStyle as any" />
            </div>
          </div>
        </div>

        <div v-for="g in groups" :key="g.UUID" class="group-section">
          <div class="group-title">{{ g.displayName }}</div>
          <div class="emoji-grid" :style="gridStyle">
            <div v-for="e in g.emojis" :key="e.UUID" class="emoji-cell" @click="onEmojiClick(e)">
              <img :src="stringifyUrl(e.displayUrl || e.realUrl)" :style="emojiStyle as any" />
            </div>
          </div>
        </div>

        <div v-if="ungrouped.length" class="group-section">
          <div class="group-title">未分组</div>
          <div class="emoji-grid" :style="gridStyle">
            <div v-for="e in ungrouped" :key="e.UUID" class="emoji-cell" @click="onEmojiClick(e)">
              <img :src="stringifyUrl(e.displayUrl || e.realUrl)" :style="emojiStyle as any" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
declare const chrome: any
import { defineComponent, ref, reactive, computed, onMounted } from 'vue'
import store, { recordUsage } from '../data/store/main'
import { SettingOutlined } from '@ant-design/icons-vue'
import { createPopupCommService } from '../services/communication'

export default defineComponent({
  components: {
    SettingOutlined,
  },
  setup() {
  const commService = createPopupCommService()
    const settings = reactive({ ...store.getSettings() })
    const groups = ref(store.getGroups())
    const ungrouped = ref(store.getUngrouped())
    const hot = ref(store.getHot())

    const gridStyle = computed(() => ({
      gridTemplateColumns: `repeat(${settings.gridColumns || 4}, 1fr)`,
      gap: '8px',
    }))
    const emojiStyle = computed<Record<string, string>>(() => ({
      width: '100%',
      aspectRatio: '1/1',
      objectFit: 'cover' as any,
      // 移除缩放变换，popup 页面不使用图片缩放控制
    }))

    function onScaleChange(value: number) {
      try {
        // 更新全局设置，这个设置会影响其他地方的图片缩放
        const newSettings = { ...settings, imageScale: value }
        store.saveSettings(newSettings)
        // 使用通信服务发送设置变更消息到所有页面
        commService.sendSettingsChanged(newSettings)
      } catch (error) {
        console.error('Failed to save image scale:', error)
      }
    }


    function openOptions() {
      try {
        // 打开扩展选项页面
        if (typeof chrome !== 'undefined' && chrome.runtime) {
          chrome.runtime.openOptionsPage()
        } else {
          // 在开发环境中直接打开页面
          window.open('/options.html', '_blank')
        }
      } catch (_) {
        // 如果 openOptionsPage 不可用，则回退到直接打开 URL
        try {
          if (typeof chrome !== 'undefined' && chrome.runtime) {
            const url = chrome.runtime.getURL('options.html')
            window.open(url, '_blank')
          } else {
            window.open('/options.html', '_blank')
          }
        } catch (_) {}
      }
    }

    function stringifyUrl(u: any) {
      try {
        if (!u) return ''
        if (typeof u === 'string') return u
        if (u && typeof u.toString === 'function') return String(u.toString())
        return String(u)
      } catch (_) {
        return ''
      }
    }

    function onEmojiClick(e: any) {
      try {
        // record usage and quick copy to clipboard (displayUrl preferred)
        try {
          recordUsage(e.UUID)
          // 发送使用记录消息到其他页面
          commService.sendUsageRecorded(e.UUID)
        } catch (_) {
          try {
            ;(store as any).recordUsage && (store as any).recordUsage(e.UUID)
          } catch (_) {}
        }
        const txt = stringifyUrl(e.displayUrl || e.realUrl) || ''
        try {
          navigator.clipboard.writeText(txt)
        } catch (_) {}
      } catch (_) {}
    }

    onMounted(() => {
      try {
        // 监听设置变更消息
        commService.onSettingsChanged((newSettings) => {
          Object.assign(settings, newSettings)
        })

        // 监听表情组变更消息
        commService.onGroupsChanged((newGroups) => {
          groups.value = newGroups
        })

        // 监听使用记录消息
        commService.onUsageRecorded((data) => {
          // 可以在这里更新常用表情列表
          hot.value = store.getHot()
        })

        // 向后兼容：监听 CustomEvent
        window.addEventListener('app:settings-changed', (ev: any) => {
          try {
            const s = ev && ev.detail ? ev.detail : store.getSettings()
            Object.assign(settings, s)
          } catch (_) {}
        })
      } catch (_) {}
    })

    return {
      settings,
      groups,
      ungrouped,
      hot,
      gridStyle,
      emojiStyle,
      onScaleChange,
      openOptions,
      onEmojiClick,
      stringifyUrl,
    }
  },
})
</script>

<style scoped>
.popup-root {
  min-width: 600px;
  min-height: 800px;
  max-width: 100vw;
  max-height: 100vh;
  display: flex;
  flex-direction: column;
  font-family: var(--ant-font-family, Arial, sans-serif);
}
.popup-root.mobile {
  width: 100vw;
  height: 100vh;
}
.popup-header {
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  border-bottom: 1px solid #eee;
}
.scale-control {
  height: 48px;
  display: flex;
  align-items: center;
  padding: 8px 16px;
  border-bottom: 1px solid #f0f0f0;
  background-color: #fafafa;
}
.scale-control-content {
  display: flex;
  align-items: center;
  width: 100%;
  gap: 12px;
}
.scale-slider {
  flex: 1;
  min-width: 200px;
}
.scale-label {
  font-size: 14px;
  color: #666;
  min-width: 60px;
}
.scale-value {
  font-size: 12px;
  color: #999;
  min-width: 45px;
  text-align: right;
}
.popup-body {
  padding: 12px;
  overflow: auto;
  flex: 1;
}
.group-title {
  font-weight: 600;
  margin-bottom: 8px;
}
.emoji-grid {
  display: grid;
}
.emoji-cell img {
  width: 100%;
  height: auto;
  border-radius: 6px;
}
</style>
