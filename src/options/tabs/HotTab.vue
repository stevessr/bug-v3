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
    async function refreshHotData(retryCount = 0) {
      const maxRetries = 3
      const refreshStartTime = Date.now()
      
      try {
        console.log('[HotTab] ===== Starting Hot Data Refresh =====')
        console.log('[HotTab] Refresh parameters:', {
          attempt: retryCount + 1,
          maxRetries: maxRetries + 1,
          currentItemsCount: items.value.length
        })

        // 🚀 关键修复：多层缓存清除策略
        console.log('[HotTab] Step 1: Comprehensive cache clearing')
        
        // 清除store中的缓存
        if (typeof (store as any).clearHotEmojiCache === 'function') {
          (store as any).clearHotEmojiCache()
          console.log('[HotTab] Cleared store hot emoji cache')
        }
        
        // 清除本地组件缓存
        const previousItems = [...items.value]
        console.log('[HotTab] Previous items snapshot:', previousItems.map(e => ({
          name: e.displayName,
          count: e.usageCount,
          uuid: e.UUID
        })))
        
        // 🚀 关键修复：强制从存储中重新加载热门表情数据
        console.log('[HotTab] Step 2: Force loading fresh data from store')
        const hotEmojis = store.getHot(true) // 传递true参数强制刷新
        
        console.log('[HotTab] Raw hot emojis from store:', {
          count: hotEmojis.length,
          emojis: hotEmojis.map(e => ({
            name: e.displayName,
            count: e.usageCount,
            group: e.groupUUID,
            uuid: e.UUID
          }))
        })

        // 🚀 关键修复：数据验证和清理
        console.log('[HotTab] Step 3: Data validation and filtering')
        
        // 验证数据完整性
        const validEmojis = hotEmojis.filter(e => {
          const isValid = e && 
            typeof e.UUID === 'string' && 
            typeof e.displayName === 'string' && 
            typeof e.usageCount === 'number'
          
          if (!isValid) {
            console.warn('[HotTab] Invalid emoji data detected:', e)
          }
          return isValid
        })
        
        console.log('[HotTab] Data validation results:', {
          original: hotEmojis.length,
          valid: validEmojis.length,
          invalid: hotEmojis.length - validEmojis.length
        })

        // 过滤出有使用次数的表情
        const filteredEmojis = validEmojis.filter((e: any) => e.usageCount > 0)
        
        console.log('[HotTab] Filtering results:', {
          validEmojis: validEmojis.length,
          withUsage: filteredEmojis.length,
          withoutUsage: validEmojis.length - filteredEmojis.length,
          usageCounts: filteredEmojis.map(e => e.usageCount).sort((a, b) => b - a)
        })
        
        // 🚀 关键修复：数据一致性验证
        console.log('[HotTab] Step 4: Data consistency verification')
        
        // 验证排序
        const sortedCorrectly = filteredEmojis.every((emoji, index) => {
          if (index === 0) return true
          return emoji.usageCount <= filteredEmojis[index - 1].usageCount
        })
        
        if (!sortedCorrectly) {
          console.warn('[HotTab] Data not properly sorted, re-sorting...')
          filteredEmojis.sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0))
        }
        
        // 验证数据变化
        const dataChanged = previousItems.length !== filteredEmojis.length ||
          !previousItems.every((prev, index) => {
            const current = filteredEmojis[index]
            return current && prev.UUID === current.UUID && prev.usageCount === current.usageCount
          })
        
        console.log('[HotTab] Data change analysis:', {
          previousCount: previousItems.length,
          newCount: filteredEmojis.length,
          countChanged: previousItems.length !== filteredEmojis.length,
          contentChanged: dataChanged,
          addedEmojis: filteredEmojis.filter(e => !previousItems.find(p => p.UUID === e.UUID)).map(e => e.displayName),
          removedEmojis: previousItems.filter(p => !filteredEmojis.find(e => e.UUID === p.UUID)).map(p => p.displayName)
        })
        
        // 🚀 关键修复：原子性更新UI
        console.log('[HotTab] Step 5: Atomic UI update')
        items.value = [...filteredEmojis] // 创建新数组确保响应性
        
        // 🚀 关键修复：最终一致性验证
        console.log('[HotTab] Step 6: Final consistency verification')
        const finalConsistencyCheck = {
          itemsValueLength: items.value.length,
          filteredEmojisLength: filteredEmojis.length,
          consistent: items.value.length === filteredEmojis.length,
          allItemsHaveUsage: items.value.every(item => item.usageCount > 0),
          properSorting: items.value.every((item, index) => {
            if (index === 0) return true
            return item.usageCount <= items.value[index - 1].usageCount
          })
        }
        
        console.log('[HotTab] Final consistency check:', finalConsistencyCheck)
        
        if (!finalConsistencyCheck.consistent) {
          throw new Error(`Data inconsistency: items.value.length (${finalConsistencyCheck.itemsValueLength}) !== filteredEmojis.length (${finalConsistencyCheck.filteredEmojisLength})`)
        }
        
        if (!finalConsistencyCheck.allItemsHaveUsage) {
          throw new Error('Some items have zero usage count')
        }
        
        if (!finalConsistencyCheck.properSorting) {
          throw new Error('Items are not properly sorted by usage count')
        }

        // 性能和结果统计
        const refreshDuration = Date.now() - refreshStartTime
        console.log('[HotTab] ✅ Hot data refresh completed successfully')
        console.log('[HotTab] Refresh summary:', {
          duration: refreshDuration,
          attempt: retryCount + 1,
          dataChanged,
          finalCount: items.value.length,
          topEmojis: items.value.slice(0, 5).map(e => ({ name: e.displayName, count: e.usageCount }))
        })
        console.log('[HotTab] ===== Hot Data Refresh Completed =====')
        
      } catch (err) {
        const refreshDuration = Date.now() - refreshStartTime
        console.error('[HotTab] ❌ Hot data refresh failed:', {
          error: err instanceof Error ? err.message : String(err),
          attempt: retryCount + 1,
          duration: refreshDuration,
          stack: err instanceof Error ? err.stack : undefined
        })
        
        // 🚀 关键修复：实现重试机制
        if (retryCount < maxRetries) {
          const retryDelay = Math.min(1000 * Math.pow(2, retryCount), 5000) // 指数退避，最大5秒
          console.log(`[HotTab] Retrying refresh in ${retryDelay}ms... (attempt ${retryCount + 2}/${maxRetries + 1})`)
          
          await new Promise(resolve => setTimeout(resolve, retryDelay))
          return refreshHotData(retryCount + 1)
        } else {
          console.error('[HotTab] Max retries exceeded, refresh failed permanently')
          throw new Error(`Hot data refresh failed after ${maxRetries + 1} attempts: ${err instanceof Error ? err.message : String(err)}`)
        }
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
      const handlerStartTime = Date.now()
      try {
        console.log('[HotTab] ===== Usage Recorded Handler Started =====')
        console.log('[HotTab] Received usage recorded message:', {
          uuid: data?.uuid,
          timestamp: data?.timestamp,
          messageAge: data?.timestamp ? Date.now() - data.timestamp : 'unknown'
        })
        console.log('[HotTab] Current state before refresh:', {
          itemsCount: items.value.length,
          loading: loading.value,
          hasError: !!error.value
        })

        // 设置加载状态
        loading.value = true
        error.value = null

        // 🚀 关键修复：立即清除所有相关缓存
        console.log('[HotTab] Step 1: Clearing all caches before refresh')
        
        // 如果store有清除缓存的方法，调用它
        if (typeof (store as any).clearHotEmojiCache === 'function') {
          (store as any).clearHotEmojiCache()
          console.log('[HotTab] Cleared hot emoji cache in store')
        }

        // 记录刷新前的数据快照
        const beforeRefresh = {
          itemsCount: items.value.length,
          topItems: items.value.slice(0, 3).map(item => ({
            name: item.displayName,
            count: item.usageCount,
            uuid: item.UUID
          }))
        }
        console.log('[HotTab] Data snapshot before refresh:', beforeRefresh)

        // 🚀 关键修复：强制刷新热门表情数据，完全不依赖缓存
        console.log('[HotTab] Step 2: Force refreshing hot data (ignoring all caches)')
        await refreshHotData()
        
        // 验证刷新结果
        const afterRefresh = {
          itemsCount: items.value.length,
          topItems: items.value.slice(0, 3).map(item => ({
            name: item.displayName,
            count: item.usageCount,
            uuid: item.UUID
          }))
        }
        console.log('[HotTab] Data snapshot after refresh:', afterRefresh)
        
        // 检查是否有变化
        const hasChanges = beforeRefresh.itemsCount !== afterRefresh.itemsCount ||
          JSON.stringify(beforeRefresh.topItems) !== JSON.stringify(afterRefresh.topItems)
        
        console.log('[HotTab] Refresh impact analysis:', {
          itemsCountChanged: beforeRefresh.itemsCount !== afterRefresh.itemsCount,
          topItemsChanged: JSON.stringify(beforeRefresh.topItems) !== JSON.stringify(afterRefresh.topItems),
          hasAnyChanges: hasChanges,
          countDifference: afterRefresh.itemsCount - beforeRefresh.itemsCount
        })

        // 🚀 关键修复：验证特定表情是否出现在结果中
        if (data?.uuid) {
          const updatedEmoji = items.value.find(item => item.UUID === data.uuid)
          console.log('[HotTab] Updated emoji verification:', {
            uuid: data.uuid,
            found: !!updatedEmoji,
            currentUsageCount: updatedEmoji?.usageCount || 'not found',
            position: updatedEmoji ? items.value.indexOf(updatedEmoji) + 1 : 'not in list'
          })
        }

        // 重新计算统计信息
        console.log('[HotTab] Step 3: Recalculating statistics')
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
        const newStats = { groupCount: groups.length, emojiCount, totalHotness: totalHot }
        const statsChanged = JSON.stringify(stats.value) !== JSON.stringify(newStats)
        stats.value = newStats

        console.log('[HotTab] Statistics update:', {
          previous: { ...stats.value },
          new: newStats,
          changed: statsChanged
        })

        // 性能统计
        const handlerDuration = Date.now() - handlerStartTime
        console.log('[HotTab] ✅ Usage update completed successfully')
        console.log('[HotTab] Performance metrics:', {
          totalDuration: handlerDuration,
          finalItemsCount: items.value.length,
          dataChanged: hasChanges,
          statsChanged
        })
        console.log('[HotTab] ===== Usage Recorded Handler Completed =====')
        
      } catch (err) {
        const handlerDuration = Date.now() - handlerStartTime
        console.error('[HotTab] ❌ Failed to handle usage update:', err)
        console.error('[HotTab] Error details:', {
          message: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack : undefined,
          duration: handlerDuration,
          uuid: data?.uuid
        })
        error.value = err instanceof Error ? err.message : String(err)
      } finally {
        loading.value = false
        console.log('[HotTab] Handler cleanup completed, loading state reset')
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
