<script lang="ts">
import { defineComponent, ref, onMounted, onBeforeUnmount, reactive, computed } from 'vue'
import { message } from 'ant-design-vue'

import store from '../../data/store/main'
import { createOptionsCommService } from '../../services/communication'

export default defineComponent({
  setup() {
    const items = ref<any[]>([])
    const stats = ref({ groupCount: 0, emojiCount: 0, totalHotness: 0 })
    const settings = reactive({ ...store.getSettings() })
    const gridColsClass = computed(() => `grid-cols-${(settings as any).gridColumns || 4}`)
    const gridStyle = computed(() => ({
      display: 'grid',
      gridTemplateColumns: `repeat(${(settings as any).gridColumns || 4}, 1fr)`,
      gap: '8px',
    }))

    // 🚀 关键优化：添加加载状态和错误处理
    const loading = ref(false)
    const error = ref<string | null>(null)

    async function load() {
      try {
        loading.value = true
        error.value = null
        console.info('[HotTab] enter hot tab - gridColumns =', (settings as any).gridColumns || 4)

        // 🚀 关键优化：强制从存储中重新加载数据
        await refreshHotData()

        // compute stats
        const groups = store.getGroups()
        let emojiCount = 0
        let totalHot = 0
        for (const g of groups) {
          if (Array.isArray(g.emojis)) {
            emojiCount += g.emojis.length
            for (const e of g.emojis) {
              totalHot += (e as any).usageCount || 0
            }
          }
        }
        stats.value = { groupCount: groups.length, emojiCount, totalHotness: totalHot }
      } catch (err) {
        error.value = err instanceof Error ? err.message : String(err)
        console.error('[HotTab] 加载数据失败:', err)
      } finally {
        loading.value = false
      }
    }

    // 🚀 关键优化：添加强制刷新函数
    async function refreshHotData() {
      try {
        console.log('[HotTab] Starting hot data refresh...')

        // 强制从存储中重新加载热门表情数据
        const hotEmojis = store.getHot(true) // 传递true参数强制刷新
        console.log('[HotTab] Retrieved hot emojis from store:', hotEmojis.length)

        // 过滤出有使用次数的表情
        const filteredEmojis = hotEmojis.filter((e: any) => e.usageCount > 0)
        items.value = filteredEmojis

        console.log('[HotTab] Hot data refresh completed:', {
          totalEmojis: hotEmojis.length,
          filteredEmojis: filteredEmojis.length,
          topEmojis: filteredEmojis
            .slice(0, 5)
            .map((e) => ({ name: e.displayName, count: e.usageCount })),
        })
      } catch (err) {
        console.error('[HotTab] Failed to refresh hot data:', err)
        throw err
      }
    }

    onMounted(load)
    // subscribe to settings changes so grid columns update live
    const comm = createOptionsCommService()
    const settingsHandler = (message: any) => {
      try {
        const payload =
          message && typeof message === 'object' && message.payload !== undefined
            ? message.payload
            : message
        if (payload && typeof payload === 'object') Object.assign(settings, payload)
        try {
          console.info(
            '[HotTab] settings changed - gridColumns =',
            (settings as any).gridColumns || 4,
          )
        } catch (_) {}
      } catch (_) {}
    }
    comm.on('app:settings-changed', settingsHandler)

    // 🚀 关键修复：监听使用记录更新和常用表情组变更
    const usageRecordedHandler = async (data: any) => {
      try {
        console.log('[HotTab] Received usage recorded message for UUID:', data?.uuid)

        // 设置加载状态
        loading.value = true
        error.value = null

        // 强制刷新热门表情数据
        await refreshHotData()

        // 重新计算统计信息
        const groups = store.getGroups()
        let emojiCount = 0
        let totalHot = 0
        for (const g of groups) {
          if (Array.isArray(g.emojis)) {
            emojiCount += g.emojis.length
            for (const e of g.emojis) {
              totalHot += (e as any).usageCount || 0
            }
          }
        }
        stats.value = { groupCount: groups.length, emojiCount, totalHotness: totalHot }

        console.log('[HotTab] Usage update completed, stats:', stats.value)
      } catch (err) {
        console.error('[HotTab] Failed to handle usage update:', err)
        error.value = err instanceof Error ? err.message : String(err)
      } finally {
        loading.value = false
      }
    }

    const commonGroupChangedHandler = async (data: any) => {
      try {
        console.log('[HotTab] Received common group changed message:', data)

        // 设置加载状态
        loading.value = true
        error.value = null

        // 强制刷新热门表情数据
        await refreshHotData()

        console.log('[HotTab] Common group change handled successfully')
      } catch (err) {
        console.error('[HotTab] Failed to handle common group change:', err)
        error.value = err instanceof Error ? err.message : String(err)
      } finally {
        loading.value = false
      }
    }

    const groupsChangedHandler = (groups: any) => {
      try {
        console.log('[HotTab] 收到表情组变更消息，刷新统计数据')
        load() // 重新加载统计数据
      } catch (error) {
        console.error('[HotTab] 处理表情组变更失败:', error)
      }
    }

    // 注册监听器
    comm.onUsageRecorded(usageRecordedHandler)
    comm.onCommonEmojiGroupChanged(commonGroupChangedHandler)
    comm.onGroupsChanged(groupsChangedHandler)

    onBeforeUnmount(() => {
      try {
        comm.off && comm.off('app:settings-changed', settingsHandler)
        comm.off && comm.off('app:usage-recorded', usageRecordedHandler)
        comm.off && comm.off('app:common-group-changed', commonGroupChangedHandler)
        comm.off && comm.off('app:groups-changed', groupsChangedHandler)
      } catch (_) {}
    })

    function resetHot() {
      try {
        store.resetHot()
        message.success('常用表情使用次数已清零')
        load()
      } catch (err) {
        message.error('操作失败')
      }
    }

    function resetHotByUUID(uuid: string) {
      try {
        store.resetHotByUUID(uuid)
        message.success('该表情使用次数已清零')
        load()
      } catch (err) {
        message.error('操作失败')
      }
    }

    // 🚀 关键优化：添加手动刷新功能
    async function manualRefresh() {
      try {
        console.log('[HotTab] Manual refresh triggered')
        loading.value = true
        error.value = null

        // 强制刷新数据
        await load()

        console.log('[HotTab] Manual refresh completed successfully')
        message.success('数据已刷新')
      } catch (err) {
        console.error('[HotTab] Manual refresh failed:', err)
        error.value = err instanceof Error ? err.message : String(err)
        message.error('刷新失败: ' + (err instanceof Error ? err.message : String(err)))
      } finally {
        loading.value = false
      }
    }

    return {
      items,
      stats,
      gridColsClass,
      gridStyle,
      resetHot,
      resetHotByUUID,
      loading,
      error,
      manualRefresh,
    }
  },
})
</script>

<template>
  <a-card title="常用表情">
    <!-- 添加手动刷新按钮 -->
    <div style="margin-bottom: 16px; text-align: right">
      <a-button @click="manualRefresh" :loading="loading">刷新</a-button>
    </div>

    <!-- 显示加载状态 -->
    <div v-if="loading" style="text-align: center; padding: 20px">
      <a-spin size="large" />
      <div style="margin-top: 10px">加载中...</div>
    </div>

    <!-- 显示错误信息 -->
    <div v-else-if="error" style="text-align: center; padding: 20px; color: red">
      <div>加载失败: {{ error }}</div>
      <a-button @click="manualRefresh" style="margin-top: 10px">重试</a-button>
    </div>

    <!-- 显示内容 -->
    <div v-else>
      <div v-if="items.length === 0">暂无常用表情</div>
      <div v-else>
        <a-collapse bordered default-active-key="1">
          <a-collapse-panel header="常用表情列表" key="1">
            <div v-if="items.length === 0">暂无常用表情</div>
            <div v-else>
              <div class="emoji-grid grid gap-2" :class="[gridColsClass]" :style="gridStyle">
                <a-card v-for="e in items" :key="e.UUID" hoverable size="small" style="width: 100%">
                  <template #cover>
                    <img
                      :src="e.displayUrl || e.realUrl"
                      style="width: 100%; aspect-ratio: 1/1; object-fit: cover; border-radius: 4px"
                    />
                  </template>
                  <a-card-meta :title="e.displayName">
                    <template #description>使用次数: {{ e.usageCount || 0 }}</template>
                  </a-card-meta>
                  <template #actions>
                    <a-popconfirm
                      title="确定要清零该表情的使用次数吗？"
                      ok-text="确定"
                      cancel-text="取消"
                      @confirm="() => resetHotByUUID(e.UUID)"
                    >
                      <a-button type="link" danger>清零</a-button>
                    </a-popconfirm>
                  </template>
                </a-card>
              </div>
            </div>
          </a-collapse-panel>
        </a-collapse>

        <a-divider />

        <a-popconfirm
          title="确定要清零所有表情的使用次数吗？"
          ok-text="确定"
          cancel-text="取消"
          @confirm="resetHot"
        >
          <a-button danger>清零使用次数</a-button>
        </a-popconfirm>

        <div style="margin-top: 16px">
          <a-row :gutter="16">
            <a-col :span="8">
              <a-card size="small" style="text-align: center">
                <div style="font-size: 24px; font-weight: bold; color: var(--ant-primary-color)">
                  {{ stats.groupCount }}
                </div>
                <div style="font-size: 14px; color: var(--ant-text-color-secondary)">分组数量</div>
              </a-card>
            </a-col>
            <a-col :span="8">
              <a-card size="small" style="text-align: center">
                <div style="font-size: 24px; font-weight: bold; color: var(--ant-success-color)">
                  {{ stats.emojiCount }}
                </div>
                <div style="font-size: 14px; color: var(--ant-text-color-secondary)">表情数量</div>
              </a-card>
            </a-col>
            <a-col :span="8">
              <a-card size="small" style="text-align: center">
                <div style="font-size: 24px; font-weight: bold; color: var(--ant-warning-color)">
                  {{ stats.totalHotness }}
                </div>
                <div style="font-size: 14px; color: var(--ant-text-color-secondary)">总热度</div>
              </a-card>
            </a-col>
          </a-row>
        </div>
      </div>
    </div>
  </a-card>
</template>
