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
  onUnmounted,
} from 'vue'

import store, { recordUsage, initializeData } from '../data/store/main'
import { createPopupCommService } from '../services/communication'
import { popupLogger } from '../utils/logger'
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

const SearchOutlined = {
  name: 'SearchOutlined',
  render() {
    return h(
      'span',
      {
        'aria-hidden': 'true',
        style:
          'display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;font-size:14px;line-height:1',
      },
      '🔍',
    )
  },
}

export default defineComponent({
  components: {
    // keep settings button using slot icon; avoid importing icons to prevent type issues in popup build
    SettingOutlined,
    SearchOutlined,
  },
  setup() {
    // Enhanced communication service with better error handling
    const commService = createPopupCommService()

    // 🚀 直接存储监听器管理
    const storageUnsubscribers = ref<(() => void)[]>([])

    // Reactive state management
    const settings = reactive({ ...store.getSettings() })
    const normalGroups = ref(store.getNormalGroups())
    const commonEmojiGroup = ref(store.getCommonEmojiGroup())
    const ungrouped = ref(store.getUngrouped())
    const hot = ref(store.getHot())
    const selectedGroup = ref<'all' | 'hot' | string>('all')
    const selectedKeys = ref<string[]>(['all'])
    const menuScroll = ref<HTMLElement | null>(null)
    const searchQuery = ref('')

    // Connection status tracking
    const isConnected = ref(true)
    const lastSyncTime = ref(Date.now())

    console.log('[PopupApp] 🚀 Enhanced popup initialized with communication service')

    // Filtered data based on search query
    const filteredHot = computed(() => {
      if (!searchQuery.value) return hot.value
      return hot.value.filter(
        (e: any) =>
          (e.name || '').toLowerCase().includes(searchQuery.value.toLowerCase()) ||
          (e.displayName || '').toLowerCase().includes(searchQuery.value.toLowerCase()),
      )
    })

    const filteredGroups = computed(() => {
      // 使用已经在数据层分离的普通分组，不需要再过滤
      if (!searchQuery.value) return normalGroups.value
      return normalGroups.value
        .map((g: any) => ({
          ...g,
          emojis: g.emojis.filter(
            (e: any) =>
              (e.name || '').toLowerCase().includes(searchQuery.value.toLowerCase()) ||
              (e.displayName || '').toLowerCase().includes(searchQuery.value.toLowerCase()),
          ),
        }))
        .filter((g: any) => g.emojis.length > 0)
    })

    const filteredUngrouped = computed(() => {
      if (!searchQuery.value) return ungrouped.value
      return ungrouped.value.filter(
        (e: any) =>
          (e.name || '').toLowerCase().includes(searchQuery.value.toLowerCase()) ||
          (e.displayName || '').toLowerCase().includes(searchQuery.value.toLowerCase()),
      )
    })

    // Menu items for antd Menu
    const menuItems = computed(() => {
      const items: any[] = []
      items.push({ key: 'all', label: '全部' })
      items.push({ key: 'hot', label: '常用' })

      // 使用已经在数据层过滤的普通分组
      normalGroups.value.forEach((g: any) => {
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

    // Enhanced settings change handler with acknowledgment
    async function onScaleChange(value: number) {
      if (isUpdatingFromExternal) return // 避免循环更新
      console.log('[PopupApp] 🎛️ Scale changed to:', value)

      try {
        // Update local settings object
        settings.imageScale = value
        const newSettings = { ...settings, imageScale: value }

        // Save to store
        store.saveSettings(newSettings)

        // Send settings change with acknowledgment
        const result = await commService.sendSettingsChanged(newSettings, true)
        console.log('[PopupApp] ✅ Settings change sent successfully:', result)

        // Update sync time
        lastSyncTime.value = Date.now()
        isConnected.value = true
      } catch (error) {
        console.error('[PopupApp] ❌ Failed to save image scale:', error)
        isConnected.value = false

        // Show user feedback for failed sync
        try {
          const msg = (window as any).__popup_message
          if (msg && typeof msg.warning === 'function') {
            msg.warning('设置同步失败，请检查网络连接')
          }
        } catch (_) {}
      }
    }

    function onSearchInput() {
      // Auto-switch to "all" view when searching to show all results
      if (searchQuery.value && selectedGroup.value !== 'all') {
        selectedGroup.value = 'all'
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

    // Enhanced emoji click handler with better usage recording and real-time sync
    async function onEmojiClick(e: any) {
      console.log('[PopupApp] 🎯 Emoji clicked:', e.displayName, 'UUID:', e.UUID)
      console.log('[PopupApp] Current hot emojis count before click:', hot.value.length)

      try {
        let usageRecorded = false
        const timestamp = Date.now()

        // Enhanced usage recording with better error handling
        try {
          console.log(
            '[PopupApp] 📊 Recording usage for emoji:',
            e.UUID,
            'at timestamp:',
            timestamp,
          )
          const result = recordUsage(e.UUID)
          console.log('[PopupApp] recordUsage result:', result)

          if (result) {
            console.log('[PopupApp] ✅ Usage recorded successfully in local store')
            usageRecorded = true

            // Send usage recorded message with acknowledgment
            try {
              const syncResult = await commService.sendUsageRecorded(e.UUID, true)
              console.log('[PopupApp] ✅ Usage recorded message sent successfully:', syncResult)

              // Update sync status
              lastSyncTime.value = Date.now()
              isConnected.value = true
            } catch (syncError) {
              console.warn(
                '[PopupApp] ⚠️ Usage sync failed but local recording succeeded:',
                syncError,
              )
              isConnected.value = false

              // Still continue - local recording worked
            }
          } else {
            console.warn('[PopupApp] ⚠️ recordUsage returned false - usage not recorded')
          }
        } catch (error) {
          console.error('[PopupApp] ❌ Primary recordUsage failed:', error)

          // Enhanced fallback with multiple attempts
          try {
            if ((store as any).recordUsage && typeof (store as any).recordUsage === 'function') {
              const result = (store as any).recordUsage(e.UUID)
              if (result) {
                console.log('[PopupApp] ✅ Fallback recordUsage succeeded')
                usageRecorded = true

                // Try to sync even with fallback
                try {
                  await commService.sendUsageRecorded(e.UUID, false) // Don't require ack for fallback
                } catch (_) {
                  console.warn('[PopupApp] Fallback sync also failed, but local recording worked')
                }
              }
            }
          } catch (fallbackError) {
            console.error('[PopupApp] ❌ Fallback recordUsage also failed:', fallbackError)
          }
        }

        // 🚀 关键修复：强制刷新UI，无论使用记录是否成功
        try {
          console.log('[PopupApp] Refreshing hot emojis list with force refresh')
          const oldCount = hot.value.length

          // 强制刷新热门表情列表
          hot.value = store.getHot(true) // 传递true强制刷新
          console.log(
            '[PopupApp] Hot emojis refreshed - old count:',
            oldCount,
            'new count:',
            hot.value.length,
          )

          // 验证刷新结果
          if (hot.value.length > 0) {
            console.log(
              '[PopupApp] Top hot emojis after refresh:',
              hot.value.slice(0, 6).map((emoji) => ({
                name: emoji.displayName,
                count: emoji.usageCount,
                group: emoji.groupUUID,
              })),
            )
          }

          // 同时刷新常用表情组
          const oldCommonGroup = commonEmojiGroup.value
          commonEmojiGroup.value = store.getCommonEmojiGroup()
          console.log(
            '[PopupApp] Common emoji group refreshed - emoji count:',
            commonEmojiGroup.value?.emojis?.length || 0,
          )

          // 验证常用表情组更新
          if (oldCommonGroup?.emojis?.length !== commonEmojiGroup.value?.emojis?.length) {
            console.log(
              '[PopupApp] Common emoji group size changed from',
              oldCommonGroup?.emojis?.length || 0,
              'to',
              commonEmojiGroup.value?.emojis?.length || 0,
            )
          }
        } catch (refreshError) {
          console.error('[PopupApp] UI refresh failed:', refreshError)
        }

        // 复制到剪贴板
        const txt = stringifyUrl(e.displayUrl || e.realUrl) || ''
        try {
          await navigator.clipboard.writeText(txt)
          console.log('[PopupApp] Emoji URL copied to clipboard:', txt)

          // 显示成功提示
          try {
            const msg = (window as any).__popup_message
            if (msg && typeof msg.success === 'function') {
              msg.success(usageRecorded ? '表情已复制，使用次数已更新' : '表情已复制到剪贴板')
            } else {
              alert(usageRecorded ? '表情已复制，使用次数已更新' : '表情已复制到剪贴板')
            }
          } catch (_) {
            alert(usageRecorded ? '表情已复制，使用次数已更新' : '表情已复制到剪贴板')
          }
        } catch (err) {
          console.error('[PopupApp] Failed to copy to clipboard:', err)

          // 复制失败提示
          try {
            const msg = (window as any).__popup_message
            if (msg && typeof msg.error === 'function') {
              msg.error('复制到剪贴板失败')
            } else {
              alert('复制到剪贴板失败')
            }
          } catch (_) {
            alert('复制到剪贴板失败')
          }
        }
      } catch (error) {
        console.error('[PopupApp] onEmojiClick error:', error)
      }
    }

    onMounted(async () => {
      try {
        // 🚀 关键修复：异步初始化数据
        await initializeData()

        // 重新加载数据以确保获取最新的
        try {
          normalGroups.value = store.getNormalGroups()
          commonEmojiGroup.value = store.getCommonEmojiGroup()
          ungrouped.value = store.getUngrouped()
          hot.value = store.getHot()
        } catch (error) {
          console.warn('[PopupApp] 数据加载失败:', error)
        }
        // Enhanced settings change listener with better sync tracking
        commService.onSettingsChanged((newSettings) => {
          console.log('[PopupApp] 📨 Received settings change:', newSettings)

          try {
            // Enhanced validation
            if (!newSettings || typeof newSettings !== 'object') {
              console.warn('[PopupApp] ⚠️ Invalid settings message received:', newSettings)
              return
            }

            isUpdatingFromExternal = true

            // Update local settings object with change tracking
            Object.keys(newSettings).forEach((key) => {
              if (newSettings[key] !== undefined && newSettings[key] !== (settings as any)[key]) {
                console.log(
                  `[PopupApp] 🔄 Updating ${key} from ${(settings as any)[key]} to ${newSettings[key]}`,
                )
                ;(settings as any)[key] = newSettings[key]
              }
            })

            // Update sync status
            lastSyncTime.value = Date.now()
            isConnected.value = true

            // Use nextTick to ensure Vue update cycle completion
            nextTick(() => {
              isUpdatingFromExternal = false
            })

            console.log('[PopupApp] ✅ Settings updated successfully')
          } catch (error) {
            console.error('[PopupApp] ❌ Error updating settings:', error)
            isConnected.value = false
          }
        })

        // Enhanced groups change listener with better error handling
        commService.onGroupsChanged((_newGroups) => {
          console.log('[PopupApp] 📨 Received groups changed message')
          try {
            // Use enhanced separated interface
            normalGroups.value = store.getNormalGroups()
            commonEmojiGroup.value = store.getCommonEmojiGroup()
            ungrouped.value = store.getUngrouped()
            hot.value = store.getHot()

            // Update sync status
            lastSyncTime.value = Date.now()
            isConnected.value = true

            console.log('[PopupApp] ✅ Groups updated successfully')
          } catch (e) {
            console.warn('[PopupApp] ⚠️ Groups update failed:', e)
            isConnected.value = false

            // Enhanced fallback with better error handling
            try {
              const allGroups = store.getGroups()
              normalGroups.value = allGroups.filter((g: any) => g.UUID !== 'common-emoji-group')
              console.log('[PopupApp] 🔄 Fallback groups update succeeded')
            } catch (fallbackError) {
              console.error('[PopupApp] ❌ Fallback groups update also failed:', fallbackError)
              normalGroups.value = []
            }
          }
        })

        // Enhanced normal groups change listener
        commService.onNormalGroupsChanged((data) => {
          console.log('[PopupApp] 📨 Received normal groups changed:', data)
          try {
            if (data && data.groups && Array.isArray(data.groups)) {
              normalGroups.value = data.groups
              lastSyncTime.value = Date.now()
              isConnected.value = true
              console.log('[PopupApp] ✅ Normal groups updated, count:', data.groups.length)
            }
          } catch (error) {
            console.error('[PopupApp] ❌ Error updating normal groups:', error)
            isConnected.value = false
          }
        })

        // 🚀 存储标志位监听 - 完全替换消息传递机制
        try {
          const { onCommonEmojiChange, watchStorageFlags } = await import('../data/update/storage')

          // 确保存储标志位监听已启动
          watchStorageFlags()

          // 监听常用表情变化（基于存储标志位）
          const unsubscribe1 = onCommonEmojiChange((group) => {
            console.log('[PopupApp] 🚩 Storage flag: Common emoji group changed:', group)
            try {
              if (group && group.emojis) {
                console.log(
                  '[PopupApp] 🔄 Updating common emoji group with',
                  group.emojis.length,
                  'emojis',
                )
                commonEmojiGroup.value = group
                lastSyncTime.value = Date.now()
                isConnected.value = true
                console.log('[PopupApp] ✅ Common emoji group updated via storage flag')
              }
            } catch (error) {
              console.error('[PopupApp] ❌ Error in storage flag listener:', error)
              isConnected.value = false
            }
          })

          storageUnsubscribers.value = [unsubscribe1]
          console.log('[PopupApp] ✅ Direct storage listeners registered successfully')
          isConnected.value = true
        } catch (error) {
          console.error('[PopupApp] ❌ Failed to setup direct storage listeners:', error)
          isConnected.value = false
        }

        // Additional listener for COMMON_EMOJI_UPDATED sync messages
        commService.onCommonEmojiUpdated((commonGroup) => {
          console.log('[PopupApp] 📨 🔄 Received common emoji updated sync message:', commonGroup)
          try {
            if (commonGroup) {
              commonEmojiGroup.value = commonGroup
              lastSyncTime.value = Date.now()
              isConnected.value = true
              console.log(
                '[PopupApp] ✅ Synced common emoji group:',
                commonGroup.displayName,
                'with',
                commonGroup.emojis?.length || 0,
                'emojis',
              )
            }
          } catch (error) {
            console.error('[PopupApp] ❌ Error syncing common emoji group:', error)
            isConnected.value = false
          }
        })

        // 🚀 新增：监听 app:common-group-changed 消息
        commService.onMessage('app:common-group-changed', (commonGroup) => {
          console.log('[PopupApp] 📨 🔄 Received app:common-group-changed message:', commonGroup)
          try {
            if (commonGroup) {
              commonEmojiGroup.value = commonGroup
              lastSyncTime.value = Date.now()
              isConnected.value = true
              console.log(
                '[PopupApp] ✅ Updated from app:common-group-changed:',
                commonGroup.displayName,
                'with',
                commonGroup.emojis?.length || 0,
                'emojis',
              )
            }
          } catch (error) {
            console.error('[PopupApp] ❌ Error handling app:common-group-changed:', error)
            isConnected.value = false
          }
        })

        // 🚀 新增：监听 extension-storage-synced 消息
        commService.onMessage('extension-storage-synced', (data) => {
          console.log('[PopupApp] 📨 🔄 Extension storage synced:', data)
          try {
            if (data.keys && data.keys.includes('emojiGroups-common-emoji-group')) {
              console.log('[PopupApp] 🔄 Common emoji group was synced, refreshing data')
              // 重新加载常用表情组
              commonEmojiGroup.value = store.getCommonEmojiGroup()
              lastSyncTime.value = Date.now()
              isConnected.value = true
              console.log('[PopupApp] ✅ Refreshed after extension storage sync')
            }
          } catch (error) {
            console.error('[PopupApp] ❌ Error handling extension-storage-synced:', error)
            isConnected.value = false
          }
        })

        // Enhanced usage recording listener (removing duplicates as enhanced versions added above)
        commService.onUsageRecorded((data) => {
          console.log('[PopupApp] 📨 📊 Received usage recorded message for UUID:', data?.uuid)
          try {
            if (data && data.uuid) {
              // Force refresh hot emojis list with enhanced tracking
              hot.value = store.getHot(true) // Pass true for force refresh
              console.log(
                '[PopupApp] ✅ Hot emojis refreshed from usage message, count:',
                hot.value.length,
              )

              // Refresh common emoji group as well
              commonEmojiGroup.value = store.getCommonEmojiGroup()
              console.log('[PopupApp] ✅ Common emoji group refreshed from usage message')

              // Update sync status
              lastSyncTime.value = Date.now()
              isConnected.value = true
            }
          } catch (error) {
            console.error('[PopupApp] ❌ Error handling usage recorded message:', error)
            isConnected.value = false
          }
        })

        // Enhanced specific group change listener (for common emoji group)
        commService.onSpecificGroupChanged((data) => {
          console.log('[PopupApp] 📨 🎯 Received specific group changed message:', data)
          try {
            if (data && data.groupUUID === 'common-emoji-group') {
              console.log('[PopupApp] 🚀 Processing common emoji group specific change')

              // Refresh hot emojis and common group
              hot.value = store.getHot()
              if (data.group) {
                commonEmojiGroup.value = data.group
              }

              // Update sync status
              lastSyncTime.value = Date.now()
              isConnected.value = true

              console.log('[PopupApp] ✅ Common emoji group specific change processed')
            }
          } catch (error) {
            console.error('[PopupApp] ❌ Error processing specific group change:', error)
            isConnected.value = false
          }
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

    // Cleanup function for component unmounting
    onUnmounted(() => {
      console.log('[PopupApp] 🧹 Cleaning up popup component')
      try {
        // 清理直接存储监听器
        if (storageUnsubscribers.value && storageUnsubscribers.value.length > 0) {
          storageUnsubscribers.value.forEach((unsubscribe: () => void) => {
            try {
              unsubscribe()
            } catch (error) {
              console.warn('[PopupApp] ⚠️ Error unsubscribing storage listener:', error)
            }
          })
          console.log('[PopupApp] ✅ Storage listeners cleaned up')
        }

        // 清理通信服务
        if (commService && typeof commService.destroy === 'function') {
          commService.destroy()
        }
      } catch (error) {
        console.warn('[PopupApp] ⚠️ Error during cleanup:', error)
      }
    })

    return {
      settings,
      normalGroups,
      commonEmojiGroup,
      ungrouped,
      hot,
      filteredGroups,
      filteredUngrouped,
      filteredHot,
      selectedGroup,
      selectedKeys,
      menuScroll,
      menuItems,
      gridStyle,
      emojiStyle,
      searchQuery,
      onScaleChange,
      onSearchInput,
      openOptions,
      onEmojiClick,
      stringifyUrl,
      // Enhanced connection status tracking
      isConnected,
      lastSyncTime,
    }
  },
})
</script>

<template>
  <div class="popup-root" :class="[{ mobile: settings.MobileMode }]">
    <div class="popup-header">
      <div class="center">
        <div class="menu-scroll">
          <a-menu v-model:selectedKeys="selectedKeys" mode="horizontal" :items="menuItems" />
        </div>
      </div>
      <div class="right">
        <a-button type="text" size="small" @click="openOptions">
          <template #icon>
            <SettingOutlined />
          </template>
          设置
        </a-button>
      </div>
    </div>

    <!-- 搜索和图片缩放控制栏 -->
    <div class="controls-section">
      <!-- 搜索栏 -->
      <div class="search-control">
        <a-input
          v-model:value="searchQuery"
          placeholder="搜索表情..."
          allowClear
          @input="onSearchInput"
        >
          <template #prefix>
            <SearchOutlined />
          </template>
        </a-input>
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
    </div>

    <div class="popup-body">
      <div class="group-list">
        <!-- 常用 -->
        <div
          v-if="(selectedGroup === 'all' || selectedGroup === 'hot') && filteredHot.length"
          class="group-section"
        >
          <div class="group-title">常用</div>
          <div class="emoji-grid" :style="gridStyle">
            <div v-for="e in filteredHot" :key="e.UUID" class="emoji-cell" @click="onEmojiClick(e)">
              <img :src="stringifyUrl(e.displayUrl || e.realUrl)" :style="emojiStyle as any" />
            </div>
          </div>
        </div>

        <!-- 普通分组（按选中或全部显示） -->
        <template v-for="g in filteredGroups" :key="g.UUID">
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
          v-if="
            (selectedGroup === 'all' || selectedGroup === 'ungrouped') && filteredUngrouped.length
          "
          class="group-section"
        >
          <div class="group-title">未分组</div>
          <div class="emoji-grid" :style="gridStyle">
            <div
              v-for="e in filteredUngrouped"
              :key="e.UUID"
              class="emoji-cell"
              @click="onEmojiClick(e)"
            >
              <img :src="stringifyUrl(e.displayUrl || e.realUrl)" :style="emojiStyle as any" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

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
.controls-section {
  border-bottom: 1px solid #f0f0f0;
  background-color: #fafafa;
}
.search-control {
  padding: 12px 16px 8px 16px;
}
.scale-control {
  height: 48px;
  display: flex;
  align-items: center;
  padding: 8px 16px;
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
