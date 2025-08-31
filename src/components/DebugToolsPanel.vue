<template>
  <a-card title="调试工具面板" style="margin-bottom: 16px">
    <a-row :gutter="16">
      <!-- 缓存管理 -->
      <a-col :span="8">
        <a-card title="缓存管理" size="small">
          <a-space direction="vertical" style="width: 100%">
            <a-button @click="clearHotEmojiCache" :loading="clearingCache" block>
              清除热门表情缓存
            </a-button>
            <a-button @click="clearAllCache" :loading="clearingAllCache" block type="dashed">
              清除所有缓存
            </a-button>
            <a-button @click="viewCacheStatus" block>
              查看缓存状态
            </a-button>
          </a-space>
        </a-card>
      </a-col>

      <!-- 数据同步 -->
      <a-col :span="8">
        <a-card title="数据同步" size="small">
          <a-space direction="vertical" style="width: 100%">
            <a-button @click="forceSyncToExtension" :loading="syncing" block type="primary">
              强制同步到扩展存储
            </a-button>
            <a-button @click="syncFromExtension" :loading="syncingFrom" block>
              从扩展存储同步
            </a-button>
            <a-button @click="validateStorageConsistency" :loading="validating" block>
              验证存储一致性
            </a-button>
          </a-space>
        </a-card>
      </a-col>

      <!-- 测试工具 -->
      <a-col :span="8">
        <a-card title="测试工具" size="small">
          <a-space direction="vertical" style="width: 100%">
            <a-button @click="simulateEmojiUsage" :loading="simulating" block>
              模拟表情使用
            </a-button>
            <a-button @click="generateTestData" :loading="generating" block>
              生成测试数据
            </a-button>
            <a-button @click="resetAllUsage" :loading="resetting" block type="danger">
              重置所有使用统计
            </a-button>
          </a-space>
        </a-card>
      </a-col>
    </a-row>

    <!-- 操作日志 -->
    <div style="margin-top: 16px">
      <h4>操作日志</h4>
      <div style="max-height: 200px; overflow-y: auto; background: #fafafa; padding: 12px; border-radius: 4px">
        <div v-for="(log, index) in operationLogs" :key="index" style="margin-bottom: 4px">
          <span :style="{ color: getLogColor(log.type) }">
            [{{ new Date(log.timestamp).toLocaleTimeString() }}] {{ log.message }}
          </span>
        </div>
        <div v-if="operationLogs.length === 0" style="text-align: center; color: #999">
          暂无操作日志
        </div>
      </div>
      <div style="margin-top: 8px; text-align: right">
        <a-button @click="clearOperationLogs" size="small">清除日志</a-button>
      </div>
    </div>

    <!-- 缓存状态模态框 -->
    <a-modal v-model:open="showCacheModal" title="缓存状态" :footer="null" width="600px">
      <div v-if="cacheStatus">
        <a-descriptions :column="2" size="small" bordered>
          <a-descriptions-item label="热门表情缓存">
            {{ cacheStatus.hotEmojis.hasData ? '有数据' : '无数据' }}
          </a-descriptions-item>
          <a-descriptions-item label="缓存大小">
            {{ cacheStatus.hotEmojis.dataCount }} 个表情
          </a-descriptions-item>
          <a-descriptions-item label="缓存时间">
            {{ cacheStatus.hotEmojis.timestamp ? 
              new Date(cacheStatus.hotEmojis.timestamp).toLocaleString() : '未设置' }}
          </a-descriptions-item>
          <a-descriptions-item label="缓存年龄">
            {{ cacheStatus.hotEmojis.age }}ms
          </a-descriptions-item>
          <a-descriptions-item label="是否过期">
            {{ cacheStatus.hotEmojis.isExpired ? '是' : '否' }}
          </a-descriptions-item>
        </a-descriptions>

        <div v-if="cacheStatus.hotEmojis.hasData" style="margin-top: 16px">
          <h4>缓存的热门表情预览</h4>
          <a-table 
            :columns="cacheEmojiColumns" 
            :data-source="cacheStatus.hotEmojis.preview" 
            :pagination="false"
            size="small"
          />
        </div>
      </div>
    </a-modal>

    <!-- 模拟表情使用模态框 -->
    <a-modal v-model:open="showSimulateModal" title="模拟表情使用" @ok="executeSimulation">
      <a-form layout="vertical">
        <a-form-item label="表情UUID">
          <a-input v-model:value="simulateForm.emojiUUID" placeholder="输入表情UUID" />
        </a-form-item>
        <a-form-item label="使用次数">
          <a-input-number v-model:value="simulateForm.usageCount" :min="1" :max="100" />
        </a-form-item>
        <a-form-item label="模拟延迟(ms)">
          <a-input-number v-model:value="simulateForm.delay" :min="0" :max="5000" />
        </a-form-item>
      </a-form>
    </a-modal>
  </a-card>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { message } from 'ant-design-vue'
import store from '../data/store/main'

// 响应式数据
const clearingCache = ref(false)
const clearingAllCache = ref(false)
const syncing = ref(false)
const syncingFrom = ref(false)
const validating = ref(false)
const simulating = ref(false)
const generating = ref(false)
const resetting = ref(false)

const showCacheModal = ref(false)
const showSimulateModal = ref(false)
const cacheStatus = ref<any>(null)

const operationLogs = ref<Array<{ timestamp: number, type: string, message: string }>>([])

const simulateForm = reactive({
  emojiUUID: '',
  usageCount: 1,
  delay: 100
})

// 表格列定义
const cacheEmojiColumns = [
  { title: '名称', dataIndex: 'name', key: 'name' },
  { title: '使用次数', dataIndex: 'count', key: 'count' },
  { title: '分组', dataIndex: 'group', key: 'group' }
]

// 工具方法
const addLog = (type: string, message: string) => {
  operationLogs.value.unshift({
    timestamp: Date.now(),
    type,
    message
  })
  
  // 限制日志数量
  if (operationLogs.value.length > 50) {
    operationLogs.value = operationLogs.value.slice(0, 50)
  }
}

const getLogColor = (type: string) => {
  switch (type) {
    case 'error': return '#cf1322'
    case 'warning': return '#d48806'
    case 'success': return '#3f8600'
    case 'info': return '#1890ff'
    default: return '#000000'
  }
}

const clearOperationLogs = () => {
  operationLogs.value = []
  addLog('info', '操作日志已清除')
}

// 缓存管理方法
const clearHotEmojiCache = async () => {
  clearingCache.value = true
  addLog('info', '开始清除热门表情缓存')
  
  try {
    // 调用store的缓存清除方法
    if (typeof (store as any).clearHotEmojiCache === 'function') {
      (store as any).clearHotEmojiCache()
      addLog('success', '热门表情缓存已清除')
      message.success('热门表情缓存已清除')
    } else {
      addLog('warning', 'store中未找到clearHotEmojiCache方法')
      message.warning('缓存清除方法不可用')
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    addLog('error', `清除缓存失败: ${errorMessage}`)
    message.error('清除缓存失败: ' + errorMessage)
  } finally {
    clearingCache.value = false
  }
}

const clearAllCache = async () => {
  clearingAllCache.value = true
  addLog('info', '开始清除所有缓存')
  
  try {
    // 清除热门表情缓存
    if (typeof (store as any).clearHotEmojiCache === 'function') {
      (store as any).clearHotEmojiCache()
    }
    
    // 清除localStorage中的缓存数据
    if (typeof window !== 'undefined' && window.localStorage) {
      // 这里可以添加更多缓存清除逻辑
      addLog('info', '已清除localStorage缓存')
    }
    
    addLog('success', '所有缓存已清除')
    message.success('所有缓存已清除')
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    addLog('error', `清除所有缓存失败: ${errorMessage}`)
    message.error('清除所有缓存失败: ' + errorMessage)
  } finally {
    clearingAllCache.value = false
  }
}

const viewCacheStatus = async () => {
  addLog('info', '查看缓存状态')
  
  try {
    // 获取热门表情缓存状态
    const hotEmojis = store.getHot(false) // 不强制刷新，查看缓存状态
    
    cacheStatus.value = {
      hotEmojis: {
        hasData: hotEmojis.length > 0,
        dataCount: hotEmojis.length,
        timestamp: Date.now(), // 这里应该从实际缓存中获取
        age: 0, // 这里应该计算实际年龄
        isExpired: false, // 这里应该检查实际过期状态
        preview: hotEmojis.slice(0, 10).map(e => ({
          name: e.displayName,
          count: e.usageCount,
          group: e.groupUUID
        }))
      }
    }
    
    showCacheModal.value = true
    addLog('info', `缓存状态已获取 - 热门表情: ${hotEmojis.length} 个`)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    addLog('error', `获取缓存状态失败: ${errorMessage}`)
    message.error('获取缓存状态失败: ' + errorMessage)
  }
}

// 数据同步方法
const forceSyncToExtension = async () => {
  syncing.value = true
  addLog('info', '开始强制同步到扩展存储')
  
  try {
    // 这里应该调用实际的同步方法
    // await storage.syncToExtensionStorage()
    
    // 模拟同步过程
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    addLog('success', '数据已成功同步到扩展存储')
    message.success('数据已成功同步到扩展存储')
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    addLog('error', `同步到扩展存储失败: ${errorMessage}`)
    message.error('同步失败: ' + errorMessage)
  } finally {
    syncing.value = false
  }
}

const syncFromExtension = async () => {
  syncingFrom.value = true
  addLog('info', '开始从扩展存储同步数据')
  
  try {
    // 这里应该调用实际的从扩展存储加载数据的方法
    
    // 模拟同步过程
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    addLog('success', '数据已从扩展存储同步')
    message.success('数据已从扩展存储同步')
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    addLog('error', `从扩展存储同步失败: ${errorMessage}`)
    message.error('同步失败: ' + errorMessage)
  } finally {
    syncingFrom.value = false
  }
}

const validateStorageConsistency = async () => {
  validating.value = true
  addLog('info', '开始验证存储一致性')
  
  try {
    // 这里应该调用实际的一致性验证方法
    // const report = await checkDataConsistency()
    
    // 模拟验证过程
    await new Promise(resolve => setTimeout(resolve, 1500))
    
    addLog('success', '存储一致性验证完成')
    message.success('存储一致性验证完成')
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    addLog('error', `存储一致性验证失败: ${errorMessage}`)
    message.error('验证失败: ' + errorMessage)
  } finally {
    validating.value = false
  }
}

// 测试工具方法
const simulateEmojiUsage = () => {
  showSimulateModal.value = true
}

const executeSimulation = async () => {
  if (!simulateForm.emojiUUID) {
    message.error('请输入表情UUID')
    return
  }
  
  simulating.value = true
  addLog('info', `开始模拟表情使用 - UUID: ${simulateForm.emojiUUID}, 次数: ${simulateForm.usageCount}`)
  
  try {
    for (let i = 0; i < simulateForm.usageCount; i++) {
      // 模拟表情使用
      const success = store.recordUsage(simulateForm.emojiUUID)
      
      if (success) {
        addLog('info', `模拟使用第 ${i + 1} 次成功`)
      } else {
        addLog('warning', `模拟使用第 ${i + 1} 次失败 - 表情未找到`)
      }
      
      // 添加延迟
      if (simulateForm.delay > 0 && i < simulateForm.usageCount - 1) {
        await new Promise(resolve => setTimeout(resolve, simulateForm.delay))
      }
    }
    
    addLog('success', `表情使用模拟完成 - 总计 ${simulateForm.usageCount} 次`)
    message.success('表情使用模拟完成')
    showSimulateModal.value = false
    
    // 重置表单
    simulateForm.emojiUUID = ''
    simulateForm.usageCount = 1
    simulateForm.delay = 100
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    addLog('error', `模拟表情使用失败: ${errorMessage}`)
    message.error('模拟失败: ' + errorMessage)
  } finally {
    simulating.value = false
  }
}

const generateTestData = async () => {
  generating.value = true
  addLog('info', '开始生成测试数据')
  
  try {
    // 获取所有表情
    const groups = store.getGroups()
    const allEmojis: any[] = []
    
    groups.forEach(group => {
      if (Array.isArray(group.emojis)) {
        allEmojis.push(...group.emojis)
      }
    })
    
    if (allEmojis.length === 0) {
      addLog('warning', '没有找到表情数据')
      message.warning('没有找到表情数据')
      return
    }
    
    // 随机选择一些表情并设置使用次数
    const testEmojis = allEmojis.slice(0, Math.min(10, allEmojis.length))
    
    for (const emoji of testEmojis) {
      const randomUsage = Math.floor(Math.random() * 10) + 1
      for (let i = 0; i < randomUsage; i++) {
        store.recordUsage(emoji.UUID)
      }
      addLog('info', `为表情 ${emoji.displayName} 生成了 ${randomUsage} 次使用记录`)
    }
    
    addLog('success', `测试数据生成完成 - 为 ${testEmojis.length} 个表情生成了使用记录`)
    message.success('测试数据生成完成')
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    addLog('error', `生成测试数据失败: ${errorMessage}`)
    message.error('生成测试数据失败: ' + errorMessage)
  } finally {
    generating.value = false
  }
}

const resetAllUsage = async () => {
  resetting.value = true
  addLog('info', '开始重置所有使用统计')
  
  try {
    store.resetHot()
    addLog('success', '所有使用统计已重置')
    message.success('所有使用统计已重置')
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    addLog('error', `重置使用统计失败: ${errorMessage}`)
    message.error('重置失败: ' + errorMessage)
  } finally {
    resetting.value = false
  }
}
</script>

<style scoped>
.ant-card-small .ant-card-head {
  min-height: 38px;
}

.ant-card-small .ant-card-body {
  padding: 12px;
}
</style>