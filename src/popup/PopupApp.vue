<template>
  <div :class="['popup-root', { mobile: settings.MobileMode }]">
    <div class="popup-header">
      <div class="center">
        <div class="menu-scroll">
          <a-menu v-model:selectedKeys="selectedKeys" mode="horizontal" :items="menuItems" />
        </div>
      </div>
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
        <!-- 常用 -->
        <div
          v-if="(selectedGroup === 'all' || selectedGroup === 'hot') && hot.length"
          class="group-section"
        >
          <div class="group-title">常用</div>
          <div class="emoji-grid" :style="gridStyle">
            <div v-for="e in hot" :key="e.UUID" class="emoji-cell" @click="onEmojiClick(e)">
              <img :src="stringifyUrl(e.displayUrl || e.realUrl)" :style="emojiStyle as any" />
            </div>
          </div>
        </div>

        <!-- 普通分组（按选中或全部显示） -->
        <template v-for="g in groups" :key="g.UUID">
          <div class="group-section" v-if="selectedGroup === 'all' || selectedGroup === g.UUID">
            <div class="group-title">{{ g.displayName }}</div>
            <div class="emoji-grid" :style="gridStyle">
              <div v-for="e in g.emojis" :key="e.UUID" class="emoji-cell" @click="onEmojiClick(e)">
                <img :src="stringifyUrl(e.displayUrl || e.realUrl)" :style="emojiStyle as any" />
              </div>
            </div>
          </div>
        </template>

        <!-- 未分组 -->
        <div
          v-if="(selectedGroup === 'all' || selectedGroup === 'ungrouped') && ungrouped.length"
          class="group-section"
        >
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
import {
  defineComponent,
  ref,
  reactive,
  computed,
  onMounted,
  nextTick,
  watch,
  h,
  onBeforeUnmount,
} from 'vue'
import store, { recordUsage } from '../data/store/main'
import { createPopupCommService } from '../services/communication'
// lightweight local icon to avoid importing ant-design icons in popup build
const SettingOutlined = {
  name: 'SettingOutlined',
  // render function to avoid runtime-template compilation requirement
  render() {
    return h(
      'span',
      {
        'aria-hidden': 'true',
        style:
          'display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;font-size:14px;line-height:1',
      },
      '⚙',
    )
  },
}

export default defineComponent({
  components: {
    // keep settings button using slot icon; avoid importing icons to prevent type issues in popup build
    SettingOutlined,
  },
  setup() {
    const commService = createPopupCommService()
    const settings = reactive({ ...store.getSettings() })
    const groups = ref(store.getGroups())
    const ungrouped = ref(store.getUngrouped())
    const hot = ref(store.getHot())
    const selectedGroup = ref<'all' | 'hot' | string>('all')
    const selectedKeys = ref<string[]>(['all'])
    const menuScroll = ref<HTMLElement | null>(null)

    // Menu items for antd Menu
    const menuItems = computed(() => {
      const items: any[] = []
      items.push({ key: 'all', label: '全部' })
      items.push({ key: 'hot', label: '常用' })
      groups.value.forEach((g: any) => {
        items.push({ key: g.UUID, label: g.displayName || g.name || 'group' })
      })
      items.push({ key: 'ungrouped', label: '未分组' })
      return items
    })

    // keep selectedGroup in sync with antd Menu selectedKeys
    watch(selectedKeys, (v) => {
      if (Array.isArray(v) && v.length > 0) selectedGroup.value = v[0]
    })
    watch(selectedGroup, (v) => {
      if (!Array.isArray(selectedKeys.value) || selectedKeys.value[0] !== v)
        selectedKeys.value = [v]
    })
    let isUpdatingFromExternal = false

    const gridStyle = computed(() => ({
      gridTemplateColumns: `repeat(${settings.gridColumns || 4}, 1fr)`,
      gap: '8px',
    }))
    const emojiStyle = computed<Record<string, string>>(() => ({
      width: '100%',
      aspectRatio: '1/1',
      objectFit: 'cover' as any,
    }))

    function onScaleChange(value: number) {
      if (isUpdatingFromExternal) return // 避免循环更新
      console.log('Scale changed to:', value)
      try {
        // 更新本地设置对象
        settings.imageScale = value
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

    // 点击表情：记录使用、复制到剪贴板并提示
    // 成功复制后显示提示“格式已经复制到剪贴板”
    import('ant-design-vue').then(({ message }) => {
      ;(window as any).__popup_message = message
    })

    async function onEmojiClick(e: any) {
      try {
        // record usage and quick copy to clipboard (displayUrl preferred)
        try {
          recordUsage(e.UUID)
          // 发送使用记录消息到其他页面
          commService.sendUsageRecorded(e.UUID)
          // 本页也立即刷新常用列表，确保 UI 立刻反映使用变化
          try {
            hot.value = store.getHot()
          } catch (_) {}
        } catch (_) {
          try {
            ;(store as any).recordUsage && (store as any).recordUsage(e.UUID)
            try {
              hot.value = store.getHot()
            } catch (_) {}
          } catch (_) {}
        }

        const txt = stringifyUrl(e.displayUrl || e.realUrl) || ''
        try {
          await navigator.clipboard.writeText(txt)
          // 显示提示（使用全局缓存的 antd message）
          try {
            const msg = (window as any).__popup_message
            if (msg && typeof msg.success === 'function') msg.success('格式已经复制到剪贴板')
            else alert('格式已经复制到剪贴板')
          } catch (_) {
            alert('格式已经复制到剪贴板')
          }
        } catch (err) {
          // 复制失败也尝试提示
          try {
            const msg = (window as any).__popup_message
            if (msg && typeof msg.error === 'function') msg.error('复制到剪贴板失败')
            else alert('复制到剪贴板失败')
          } catch (_) {
            alert('复制到剪贴板失败')
          }
        }
      } catch (_) {}
    }

    onMounted(() => {
      try {
        // 监听设置变更消息
        commService.onSettingsChanged((newSettings) => {
          console.log('Popup received settings change:', newSettings)

          // 检查消息是否有效
          if (!newSettings || typeof newSettings !== 'object') {
            console.warn('Popup: Invalid settings message received:', newSettings)
            return
          }

          isUpdatingFromExternal = true
          // 更新本地设置对象，只更新有变化的属性
          Object.keys(newSettings).forEach((key) => {
            if (newSettings[key] !== undefined && newSettings[key] !== (settings as any)[key]) {
              console.log(
                `Popup updating ${key} from ${(settings as any)[key]} to ${newSettings[key]}`,
              )
              ;(settings as any)[key] = newSettings[key]
            }
          })
          // 使用 nextTick 确保在 Vue 更新周期完成后重置标志
          nextTick(() => {
            isUpdatingFromExternal = false
          })
        })

        // 监听表情组变更消息
        commService.onGroupsChanged((newGroups) => {
          groups.value = newGroups
        })

        // 监听使用记录消息
        commService.onUsageRecorded((_data) => {
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

        // enable mouse wheel to scroll the horizontal menu (convert vertical wheel to horizontal)
        try {
          const el = menuScroll && (menuScroll as any).value ? (menuScroll as any).value : null
          if (el) {
            const wheelHandler = (ev: WheelEvent) => {
              // if user is intentionally scrolling horizontally (shift) or horizontal delta larger, do nothing
              if (ev.shiftKey) return
              if (Math.abs(ev.deltaY) > Math.abs(ev.deltaX)) {
                el.scrollLeft += ev.deltaY
                // only prevent default if the event is cancelable to avoid errors in some browsers
                try {
                  if (ev.cancelable) ev.preventDefault()
                } catch (_) {}
              }
            }
            el.addEventListener('wheel', wheelHandler as any, { passive: false })
            ;(menuScroll as any).__wheelHandler = wheelHandler
          }
        } catch (_) {}
      } catch (_) {}
    })

    onBeforeUnmount(() => {
      try {
        const el = menuScroll && (menuScroll as any).value ? (menuScroll as any).value : null
        if (el && (menuScroll as any).__wheelHandler) {
          el.removeEventListener('wheel', (menuScroll as any).__wheelHandler)
          delete (menuScroll as any).__wheelHandler
        }
      } catch (_) {}
    })

    return {
      settings,
      groups,
      ungrouped,
      hot,
      selectedGroup,
      selectedKeys,
      menuScroll,
      menuItems,
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
.popup-header .center {
  flex: 1 1 auto;
  display: flex;
  align-items: center;
  overflow: hidden; /* hide any vertical overflow */
}
.menu-scroll {
  width: 100%;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch; /* smooth scrolling on iOS/touch */
}
/* Make antd horizontal menu items lay out inline so the container can scroll horizontally */
.menu-scroll .ant-menu-horizontal {
  display: inline-flex;
  white-space: nowrap;
}
/* thin horizontal scrollbar for better affordance */
.menu-scroll::-webkit-scrollbar {
  height: 7px;
}
.menu-scroll::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.18);
  border-radius: 4px;
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
