<script lang="ts">
import { defineComponent, reactive, ref, onMounted, computed } from 'vue'
import { Modal } from 'ant-design-vue'

import settingsStore from '../data/update/settingsStore'
import emojiGroupsStore from '../data/update/emojiGroupsStore'
import storage from '../data/update/storage'
import store from '../data/store/main'
import { initializeData } from '../data/store/main'
import { createOptionsCommService } from '../services/communication'

import ToolsTab from './tabs/ToolsTab.vue'
export default defineComponent({
  components: {
    ToolsTab,
  },
  setup() {
    const commService = createOptionsCommService()
    const currentTab = ref<'groups' | 'ungrouped' | 'hot' | 'tools' | 'importexport' | 'settings'>(
      'groups',
    )
    const s = settingsStore.getSettings()
    const siderCollapsed = ref(!!s.sidebarCollapsed)

    function toggleSider(collapsed: boolean) {
      siderCollapsed.value = collapsed
      // persist
      const newSettings = { sidebarCollapsed: collapsed }
      store.saveSettings(newSettings)
      // 发送设置变更消息到其他页面
      commService.sendSettingsChanged(newSettings)
    }

    const form = reactive({ ...s })

    const groups = ref<any[]>([])

    function loadGroups() {
      groups.value = emojiGroupsStore.getEmojiGroups()
    }

    function select(key: any) {
      currentTab.value = key
    }

    function save() {
      const newSettings = {
        imageScale: Number(form.imageScale),
        defaultEmojiGroupUUID: form.defaultEmojiGroupUUID,
        gridColumns: form.gridColumns as any,
        outputFormat: form.outputFormat,
        MobileMode: !!form.MobileMode,
      }
      settingsStore.setSettings(newSettings, groups.value)
      // 发送设置变更消息到其他页面
      commService.sendSettingsChanged(newSettings)
      loadGroups()
    }

    function createGroup() {
      const id =
        typeof crypto !== 'undefined' && (crypto as any).randomUUID
          ? (crypto as any).randomUUID()
          : String(Date.now())
      const group = { UUID: id, displayName: 'New Group', emojis: [], icon: '', order: 0 }
      emojiGroupsStore.addGroup(group)
      loadGroups()
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

        // 监听来自其他页面的消息
        commService.onSettingsChanged((newSettings) => {
          console.log('[Options] Received settings changed:', newSettings)
          Object.assign(form, newSettings)
        })

        commService.onGroupsChanged((newGroups) => {
          console.log('[Options] Received groups changed:', newGroups.length, 'groups')
          groups.value = newGroups
          refreshExport() // 自动刷新导出数据
        })

        commService.onUsageRecorded((data) => {
          console.log('[Options] Received usage recorded:', data)
          // 刷新表情组数据以获取最新的使用统计
          loadGroups()
        })

        // 🚀 新增：监听常用表情组专门更新
        commService.onCommonEmojiGroupChanged((data) => {
          console.log('[Options] Received common emoji group changed:', data)
          if (data && data.group) {
            // 更新常用表情组
            const commonGroupIndex = groups.value.findIndex(g => g.UUID === 'common-emoji-group')
            if (commonGroupIndex >= 0) {
              groups.value[commonGroupIndex] = data.group
            } else {
              // 如果不存在常用表情组，添加到开头
              groups.value.unshift(data.group)
            }
            refreshExport() // 自动刷新导出数据
          }
        })

        // 🚀 新增：监听特定表情组更新
        commService.onSpecificGroupChanged((data) => {
          console.log('[Options] Received specific group changed:', data)
          if (data && data.groupUUID && data.group) {
            const groupIndex = groups.value.findIndex(g => g.UUID === data.groupUUID)
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
            const commonGroup = groups.value.find(g => g.UUID === 'common-emoji-group')
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
            window.dispatchEvent(new CustomEvent('ungrouped-emojis-updated', {
              detail: data
            }))
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
              content: '数据已成功导入并同步到所有页面'
            })
          } catch (error) {
            console.log('Data imported successfully')
          }
        })

        // 🚀 新增：监听实时同步消息
        commService.onCommonEmojiUpdated((commonGroup) => {
          console.log('[Options] Received common emoji updated (realtime):', commonGroup)
          if (commonGroup) {
            const commonGroupIndex = groups.value.findIndex(g => g.UUID === 'common-emoji-group')
            if (commonGroupIndex >= 0) {
              groups.value[commonGroupIndex] = commonGroup
            }
          }
        })

        commService.onEmojiOrderChanged((groupUUID, updatedOrder) => {
          console.log('[Options] Received emoji order changed (realtime):', groupUUID, updatedOrder)
          const group = groups.value.find(g => g.UUID === groupUUID)
          if (group && group.emojis) {
            // 重新排序表情
            const reorderedEmojis = updatedOrder.map(uuid => 
              group.emojis.find((e: any) => e.UUID === uuid)
            ).filter(Boolean)
            group.emojis = reorderedEmojis
          }
        })

        commService.onGroupIconUpdated((groupUUID, iconUrl) => {
          console.log('[Options] Received group icon updated (realtime):', groupUUID, iconUrl)
          const group = groups.value.find(g => g.UUID === groupUUID)
          if (group) {
            group.icon = iconUrl
          }
        })

        commService.onUngroupedEmojisChangedSync((ungroupedEmojis) => {
          console.log('[Options] Received ungrouped emojis changed (realtime):', ungroupedEmojis.length)
          // 触发未分组标签页的实时刷新
          window.dispatchEvent(new CustomEvent('ungrouped-emojis-realtime-updated', {
            detail: { emojis: ungroupedEmojis, timestamp: Date.now() }
          }))
        })
      } catch (error) {
        console.error('Failed to initialize options page:', error)
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
