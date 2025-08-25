<template>
  <div :class="['popup-root', { mobile: settings.MobileMode }]">
    <div class="popup-header">
      <div class="left">
        <button class="settings-btn" @click="openOptions">设置</button>
      </div>
      <div class="center">表情快速面板</div>
      <div class="right">
        <div style="display: flex; align-items: center; gap: 8px">
          <span>{{ settings.imageScale }}%</span>
          <a-slider
            v-model:value="localScale"
            :min="1"
            :max="100"
            style="width: 160px"
            @change="onScaleChange"
          />
        </div>
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

export default defineComponent({
  setup() {
  const settings = reactive({ ...store.getSettings() })
    const localScale = ref(settings.imageScale || 100)
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
      transform: `scale(${(localScale.value || 100) / 100})`,
    }))

    function onScaleChange(v: number) {
      try {
        const s = { ...settings, imageScale: v }
        store.saveSettings(s)
      } catch (_) {}
    }

    function openOptions() {
      try {
        // open extension options page
        const url = chrome.runtime.getURL('options.html')
        window.open(url, '_blank')
      } catch (_) {}
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
        // react to settings updates
        window.addEventListener('app:settings-changed', (ev: any) => {
          try {
            const s = ev && ev.detail ? ev.detail : store.getSettings()
            Object.assign(settings, s)
            localScale.value = s.imageScale || localScale.value
          } catch (_) {}
        })
      } catch (_) {}
    })

    return {
      settings,
      localScale,
      groups,
      ungrouped,
      hot,
      gridStyle,
      emojiStyle,
      openOptions,
      onScaleChange,
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
  padding: 8px 12px;
  border-bottom: 1px solid #eee;
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
.settings-btn {
  padding: 6px 10px;
}
</style>
