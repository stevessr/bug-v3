<script lang="ts">
import { defineComponent, reactive, ref, onMounted, onUnmounted, computed } from 'vue'
import { Modal } from 'ant-design-vue'

import settingsStore from '../data/update/settingsStore'
import emojiGroupsStore from '../data/update/emojiGroupsStore'
import storage from '../data/update/storage'
import store from '../data/store/main'
import { initializeData } from '../data/store/main'
import { createOptionsCommService } from '../services/communication'
import { optionsLogger } from '../utils/logger'

import ToolsTab from './tabs/ToolsTab.vue'
export default defineComponent({
  components: {
    ToolsTab,
  },
  setup() {
    // Enhanced communication service with better error handling
    const commService = createOptionsCommService()

    // 🚀 直接存储监听器管理
    const storageUnsubscribers = ref<(() => void)[]>([])

    const currentTab = ref<'groups' | 'ungrouped' | 'hot' | 'tools' | 'importexport' | 'settings'>(
      'groups',
    )
    const s = settingsStore.getSettings()
    const siderCollapsed = ref(!!s.sidebarCollapsed)

    // Enhanced connection status tracking
    const isConnected = ref(true)
    const lastSyncTime = ref(Date.now())
    const syncInProgress = ref(false)

    console.log('[OptionsApp] 🚀 Enhanced options page initialized with communication service')

    // Enhanced sidebar toggle with acknowledgment
    async function toggleSider(collapsed: boolean) {
      console.log('[OptionsApp] 🎛️ Toggling sidebar:', collapsed)
      try {
        siderCollapsed.value = collapsed

        // Persist settings
        const newSettings = { sidebarCollapsed: collapsed }
        store.saveSettings(newSettings)

        // Send settings change with acknowledgment
        syncInProgress.value = true
        const result = await commService.sendSettingsChanged(newSettings, true)
        console.log('[OptionsApp] ✅ Sidebar settings sent successfully:', result)

        // Update sync status
        lastSyncTime.value = Date.now()
        isConnected.value = true
      } catch (error) {
        console.error('[OptionsApp] ❌ Failed to sync sidebar settings:', error)
        isConnected.value = false
      } finally {
        syncInProgress.value = false
      }
    }

    const form = reactive({ ...s })

    const groups = ref<any[]>([])

    function loadGroups() {
      groups.value = emojiGroupsStore.getEmojiGroups()
    }

    function select(key: any) {
      currentTab.value = key
    }

    // Enhanced settings save with acknowledgment and better error handling
    async function save() {
      console.log('[OptionsApp] 💾 Saving settings:', form)
      try {
        syncInProgress.value = true

        const newSettings = {
          imageScale: Number(form.imageScale),
          defaultEmojiGroupUUID: form.defaultEmojiGroupUUID,
          gridColumns: form.gridColumns as any,
          outputFormat: form.outputFormat,
          MobileMode: !!form.MobileMode,
        }

        // Save to store
        settingsStore.setSettings(newSettings, groups.value)

        // Send settings change with acknowledgment
        const result = await commService.sendSettingsChanged(newSettings, true)
        console.log('[OptionsApp] ✅ Settings saved and synced successfully:', result)

        // Update sync status
        lastSyncTime.value = Date.now()
        isConnected.value = true

        // Reload groups to ensure consistency
        loadGroups()

        // Show success feedback
        try {
          const msg = (window as any).__options_message
          if (msg && typeof msg.success === 'function') {
            msg.success('设置已保存并同步')
          }
        } catch (_) {}
      } catch (error) {
        console.error('[OptionsApp] ❌ Failed to save/sync settings:', error)
        isConnected.value = false

        // Show error feedback
        try {
          const msg = (window as any).__options_message
          if (msg && typeof msg.error === 'function') {
            msg.error('设置保存失败，请重试')
          }
        } catch (_) {}
      } finally {
        syncInProgress.value = false
      }
    }

    // Enhanced group creation with real-time sync
    async function createGroup() {
      console.log('[OptionsApp] 🆕 Creating new group')
      try {
        syncInProgress.value = true

        const id =
          typeof crypto !== 'undefined' && (crypto as any).randomUUID
            ? (crypto as any).randomUUID()
            : String(Date.now())
        const group = { UUID: id, displayName: 'New Group', emojis: [], icon: '', order: 0 }

        // Add group to store
        emojiGroupsStore.addGroup(group)

        // Reload and sync groups
        loadGroups()

        // Send groups change notification
        const result = await commService.sendGroupsChanged(groups.value, true)
        console.log('[OptionsApp] ✅ New group created and synced:', result)

        // Update sync status
        lastSyncTime.value = Date.now()
        isConnected.value = true
      } catch (error) {
        console.error('[OptionsApp] ❌ Failed to create/sync group:', error)
        isConnected.value = false
      } finally {
        syncInProgress.value = false
      }
    }

    function editGroup(item: any) {
      try {
        Modal.confirm({
          title: '编辑分组名称',
          content: '请通过分组编辑对话框修改分组名称',
          onOk() {
            const name = window.prompt('新的分组名称', item.displayName)
            if (name == null) return
            const g = groups.value.find((x: any) => x.UUID === item.UUID)
            if (g) g.displayName = name
            emojiGroupsStore.setEmojiGroups(groups.value)
            loadGroups()
          },
        })
        return
      } catch (_) {}
      const name = window.prompt('新的分组名称', item.displayName)
      if (name == null) return
      const g = groups.value.find((x: any) => x.UUID === item.UUID)
      if (g) g.displayName = name
      emojiGroupsStore.setEmojiGroups(groups.value)
      loadGroups()
    }

    function deleteGroup(item: any) {
      try {
        Modal.confirm({
          title: '确认',
          content: '确认删除分组: ' + item.displayName + ' ?',
          onOk() {
            emojiGroupsStore.removeGroup(item.UUID)
            loadGroups()
          },
        })
        return
      } catch (_) {}
      if (!window.confirm('确认删除分组: ' + item.displayName + ' ?')) return
      emojiGroupsStore.removeGroup(item.UUID)
      loadGroups()
    }

    // import/export
    const exportJson = ref('')
    function refreshExport() {
      const payload = {
        Settings: settingsStore.getSettings(),
        emojiGroups: emojiGroupsStore.getEmojiGroups(),
      }
      exportJson.value = JSON.stringify(payload, null, 2)
    }

    function downloadExport() {
      refreshExport()
      const blob = new Blob([exportJson.value], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'bugcopilot-config.json'
      a.click()
      URL.revokeObjectURL(url)
    }

    async function copyExport() {
      refreshExport()
      try {
        await navigator.clipboard.writeText(exportJson.value)
        // eslint-disable-next-line no-console
        console.log('copied')
      } catch (e) {
        // ignore
      }
    }

    const importText = ref('')
    function clearImport() {
      importText.value = ''
    }

    function doImport() {
      try {
        const parsed = JSON.parse(importText.value)
        if (parsed && parsed.Settings) {
          settingsStore.setSettings(parsed.Settings, parsed.emojiGroups || [])
          // 发送设置变更消息
          commService.sendSettingsChanged(parsed.Settings)
        }
        if (parsed && Array.isArray(parsed.emojiGroups)) {
          emojiGroupsStore.setEmojiGroups(parsed.emojiGroups)
          // 发送表情组变更消息
          commService.sendGroupsChanged(parsed.emojiGroups)
        }
        // 发送数据导入完成消息
        commService.sendDataImported(parsed)
        loadGroups()
        refreshExport()
        // eslint-disable-next-line no-console
        console.log('imported')
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('import failed', err)
        window.alert('导入失败: JSON 格式不正确')
      }
    }

    // derived lists (best-effort)
    const allEmojis = computed(() => {
      const arr: any[] = []
      for (const g of groups.value) {
        if (Array.isArray(g.emojis))
          arr.push(...g.emojis.map((e: any) => ({ ...e, groupUUID: g.UUID })))
      }
      return arr
    })

    const ungrouped = computed(() => {
      // currently we keep ungrouped as empty because storage model stores only groups
      // This returns emojis that do not have groupUUID (none) — placeholder
      return [] as any[]
    })

    const hot = computed(() => {
      // If we had usage tracking, we'd sort by usageCount. For now return top N where usageCount exists
      const withUsage = allEmojis.value.filter((e) => typeof e.usageCount === 'number')
      withUsage.sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0))
      return withUsage.slice(0, 50)
    })

    onMounted(async () => {
      try {
        // 🚀 关键修复：异步初始化数据
        await initializeData()

        loadGroups()
        refreshExport()

        // Enhanced message listeners with better error handling and real-time sync
        console.log('[OptionsApp] 🔧 Setting up enhanced message listeners')

        // Enhanced settings change listener
        commService.onSettingsChanged((newSettings) => {
          console.log('[OptionsApp] 📨 Received settings changed:', newSettings)
          try {
            if (newSettings && typeof newSettings === 'object') {
              Object.assign(form, newSettings)

              // Update sync status
              lastSyncTime.value = Date.now()
              isConnected.value = true

              console.log('[OptionsApp] ✅ Settings updated successfully')
            }
          } catch (error) {
            console.error('[OptionsApp] ❌ Error updating settings:', error)
            isConnected.value = false
          }
        })

        // Enhanced groups change listener
        commService.onGroupsChanged((newGroups) => {
          console.log('[OptionsApp] 📨 Received groups changed:', newGroups.length, 'groups')
          try {
            if (Array.isArray(newGroups)) {
              groups.value = newGroups
              refreshExport() // Auto-refresh export data

              // Update sync status
              lastSyncTime.value = Date.now()
              isConnected.value = true

              console.log('[OptionsApp] ✅ Groups updated successfully')
            }
          } catch (error) {
            console.error('[OptionsApp] ❌ Error updating groups:', error)
            isConnected.value = false
          }
        })

        // Enhanced usage recording listener
        commService.onUsageRecorded((data) => {
          console.log('[OptionsApp] 📨 📊 Received usage recorded:', data)
          try {
            if (data && data.uuid) {
              // Refresh emoji groups data to get latest usage statistics
              loadGroups()

              // Update sync status
              lastSyncTime.value = Date.now()
              isConnected.value = true

              console.log('[OptionsApp] ✅ Usage data refreshed')
            }
          } catch (error) {
            console.error('[OptionsApp] ❌ Error refreshing usage data:', error)
            isConnected.value = false
          }
        })

        // 🚀 存储标志位监听 - 完全替换消息传递机制
        try {
          const { onCommonEmojiChange, watchStorageFlags } = await import('../data/update/storage')

          // 确保存储标志位监听已启动
          watchStorageFlags()

          // 监听常用表情变化
          const unsubscribe1 = onCommonEmojiChange((group) => {
            console.log('[OptionsApp] 📨 Direct storage: Common emoji group changed:', group)
            try {
              if (group && group.emojis) {
                // Update common emoji group with enhanced error handling
                const commonGroupIndex = groups.value.findIndex(
                  (g) => g.UUID === 'common-emoji-group',
                )
                if (commonGroupIndex >= 0) {
                  groups.value[commonGroupIndex] = group
                  console.log(
                    '[OptionsApp] ✅ Common emoji group updated at index via direct storage:',
                    commonGroupIndex,
                  )
                } else {
                  // If common emoji group doesn't exist, add it at the beginning
                  groups.value.unshift(group)
                  console.log(
                    '[OptionsApp] ✅ Common emoji group added to beginning via direct storage',
                  )
                }

                // Refresh export data
                refreshExport()

                // Update sync status
                lastSyncTime.value = Date.now()
                isConnected.value = true

                console.log(
                  '[OptionsApp] ✅ Common emoji group sync completed via direct storage:',
                  group.displayName,
                  'with',
                  group.emojis?.length || 0,
                  'emojis',
                )
              }
            } catch (error) {
              console.error('[OptionsApp] ❌ Error in direct storage listener:', error)
              isConnected.value = false
            }
          })

          storageUnsubscribers.value = [unsubscribe1]
          console.log('[OptionsApp] ✅ Direct storage listeners registered successfully')
          isConnected.value = true
        } catch (error) {
          console.error('[OptionsApp] ❌ Failed to setup direct storage listeners:', error)
          isConnected.value = false
        }

        // Additional listener for COMMON_EMOJI_UPDATED sync messages
        commService.onCommonEmojiUpdated((commonGroup) => {
          console.log('[OptionsApp] 📨 🔄 Received common emoji updated sync message:', commonGroup)
          try {
            if (commonGroup) {
              const commonGroupIndex = groups.value.findIndex(
                (g) => g.UUID === 'common-emoji-group',
              )
              if (commonGroupIndex >= 0) {
                groups.value[commonGroupIndex] = commonGroup
              } else {
                groups.value.unshift(commonGroup)
              }

              // Refresh export data
              refreshExport()

              // Update sync status
              lastSyncTime.value = Date.now()
              isConnected.value = true

              console.log(
                '[OptionsApp] ✅ Common emoji group synced:',
                commonGroup.displayName,
                'with',
                commonGroup.emojis?.length || 0,
                'emojis',
              )
            }
          } catch (error) {
            console.error('[OptionsApp] ❌ Error syncing common emoji group:', error)
            isConnected.value = false
          }
        })

        // 🚀 新增：监听特定表情组更新
        commService.onSpecificGroupChanged((data) => {
          console.log('[Options] Received specific group changed:', data)
          if (data && data.groupUUID && data.group) {
            const groupIndex = groups.value.findIndex((g) => g.UUID === data.groupUUID)
            if (groupIndex >= 0) {
              groups.value[groupIndex] = data.group
              refreshExport() // 自动刷新导出数据
            }
          }
        })

        // 🚀 新增：监听普通表情组变更
        commService.onNormalGroupsChanged((data) => {
          console.log('[Options] Received normal groups changed:', data)
          if (data && data.groups) {
            // 保留常用表情组，更新其他组
            const commonGroup = groups.value.find((g) => g.UUID === 'common-emoji-group')
            groups.value = commonGroup ? [commonGroup, ...data.groups] : data.groups
            refreshExport() // 自动刷新导出数据
          }
        })

        // 🚀 新增：监听未分组表情变更
        commService.onUngroupedEmojisChanged((data) => {
          console.log('[Options] Received ungrouped emojis changed:', data)
          // 触发未分组标签页的数据刷新
          if (currentTab.value === 'ungrouped') {
            // 可以通过事件总线通知未分组标签页刷新
            window.dispatchEvent(
              new CustomEvent('ungrouped-emojis-updated', {
                detail: data,
              }),
            )
          }
        })

        // 🚀 新增：监听数据导入完成
        commService.onDataImported((data) => {
          console.log('[Options] Received data imported:', data)
          // 重新加载所有数据
          loadGroups()
          refreshExport()

          // 通知用户导入成功
          try {
            Modal.success({
              title: '导入成功',
              content: '数据已成功导入并同步到所有页面',
            })
          } catch (error) {
            console.log('Data imported successfully')
          }
        })

        // 🚀 新增：监听实时同步消息
        commService.onCommonEmojiUpdated((commonGroup) => {
          console.log('[Options] Received common emoji updated (realtime):', commonGroup)
          if (commonGroup) {
            const commonGroupIndex = groups.value.findIndex((g) => g.UUID === 'common-emoji-group')
            if (commonGroupIndex >= 0) {
              groups.value[commonGroupIndex] = commonGroup
            }
          }
        })

        commService.onEmojiOrderChanged((groupUUID, updatedOrder) => {
          console.log('[Options] Received emoji order changed (realtime):', groupUUID, updatedOrder)
          const group = groups.value.find((g) => g.UUID === groupUUID)
          if (group && group.emojis) {
            // 重新排序表情
            const reorderedEmojis = updatedOrder
              .map((uuid) => group.emojis.find((e: any) => e.UUID === uuid))
              .filter(Boolean)
            group.emojis = reorderedEmojis
          }
        })

        commService.onGroupIconUpdated((groupUUID, iconUrl) => {
          console.log('[Options] Received group icon updated (realtime):', groupUUID, iconUrl)
          const group = groups.value.find((g) => g.UUID === groupUUID)
          if (group) {
            group.icon = iconUrl
          }
        })

        commService.onUngroupedEmojisChangedSync((ungroupedEmojis) => {
          console.log(
            '[Options] Received ungrouped emojis changed (realtime):',
            ungroupedEmojis.length,
          )
          // 触发未分组标签页的实时刷新
          window.dispatchEvent(
            new CustomEvent('ungrouped-emojis-realtime-updated', {
              detail: { emojis: ungroupedEmojis, timestamp: Date.now() },
            }),
          )
        })
      } catch (error) {
        console.error('[OptionsApp] ❌ Failed to initialize options page:', error)
        isConnected.value = false
      }
    })

    // Cleanup function for component unmounting
    onUnmounted(() => {
      console.log('[OptionsApp] 🧹 Cleaning up options component')
      try {
        // 清理直接存储监听器
        if (storageUnsubscribers.value && storageUnsubscribers.value.length > 0) {
          storageUnsubscribers.value.forEach((unsubscribe: () => void) => {
            try {
              unsubscribe()
            } catch (error) {
              console.warn('[OptionsApp] ⚠️ Error unsubscribing storage listener:', error)
            }
          })
          console.log('[OptionsApp] ✅ Storage listeners cleaned up')
        }

        // 清理通信服务
        if (commService && typeof commService.destroy === 'function') {
          commService.destroy()
        }
      } catch (error) {
        console.warn('[OptionsApp] ⚠️ Error during cleanup:', error)
      }
    })

    return {
      currentTab,
      select,
      form,
      groups,
      exportJson,
      refreshExport,
      downloadExport,
      copyExport,
      importText,
      clearImport,
      doImport,
      ungrouped,
      hot,
      siderCollapsed,
      toggleSider,
      // Enhanced connection status tracking
      isConnected,
      lastSyncTime,
      syncInProgress,
      // components are auto-imported by unplugin-vue-components
    }
  },
})
</script>

<template>
  <a-layout style="min-height: 100vh; padding: 24px">
    <a-layout-sider width="240" collapsible :collapsed="siderCollapsed" @collapse="toggleSider">
      <a-menu mode="inline" :selectedKeys="[currentTab]" style="height: 100%">
        <a-menu-item key="groups" @click="select('groups')">表情管理</a-menu-item>
        <a-menu-item key="ungrouped" @click="select('ungrouped')">未分组表情</a-menu-item>
        <a-menu-item key="hot" @click="select('hot')">常用表情</a-menu-item>
        <a-menu-item key="tools" @click="select('tools')">小工具</a-menu-item>
        <a-menu-item key="importexport" @click="select('importexport')">配置导入/导出</a-menu-item>
        <a-menu-item key="settings" @click="select('settings')">设置</a-menu-item>
      </a-menu>
    </a-layout-sider>

    <a-layout-content style="padding: 16px">
      <GroupsTab v-if="currentTab === 'groups'" />
      <UngroupedTab v-if="currentTab === 'ungrouped'" />
      <HotTab v-if="currentTab === 'hot'" />
      <ToolsTab v-if="currentTab === 'tools'" />
      <ImportExportTab v-if="currentTab === 'importexport'" />
      <SettingsTab v-if="currentTab === 'settings'" />
    </a-layout-content>
  </a-layout>
</template>
