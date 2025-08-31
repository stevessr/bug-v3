<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { message } from 'ant-design-vue'

import {
  checkDataConsistency,
  fixDataInconsistency,
  createMonitoringData,
  type ConsistencyReport,
} from '../utils/dataConsistencyChecker'

// 响应式数据
const loading = ref(false)
const checkingConsistency = ref(false)
const fixingData = ref(false)
const activeTab = ref('overview')
const showConsistencyModal = ref(false)

const consistencyReport = ref<ConsistencyReport | null>(null)
const popupData = ref<any>(null)
const optionsData = ref<any>(null)
const storageData = ref<any>(null)
const debugLogs = ref<Array<{ timestamp: number; level: string; message: string }>>([])

// 计算属性
const consistencyStatus = computed(() => {
  if (!consistencyReport.value) return '未检查'
  return consistencyReport.value.isConsistent ? '一致' : '不一致'
})

const lastSyncTime = computed(() => {
  if (!consistencyReport.value?.details.storageSync.lastSyncTime) return '未知'
  return new Date(consistencyReport.value.details.storageSync.lastSyncTime).toLocaleTimeString()
})

const syncAge = computed(() => {
  return consistencyReport.value?.details.storageSync.syncAge || 0
})

const overviewData = computed(() => {
  if (!consistencyReport.value) return []

  return [
    {
      key: 'hotEmojis',
      item: '热门表情数量',
      store: consistencyReport.value.details.hotEmojisCount.store,
      cached: consistencyReport.value.details.hotEmojisCount.cached,
      consistent:
        consistencyReport.value.details.hotEmojisCount.store ===
        consistencyReport.value.details.hotEmojisCount.cached,
    },
    {
      key: 'commonGroup',
      item: '常用表情组',
      store: consistencyReport.value.details.commonEmojiGroup.store?.emojiCount || 0,
      cached: consistencyReport.value.details.commonEmojiGroup.localStorage?.emojiCount || 0,
      consistent:
        (consistencyReport.value.details.commonEmojiGroup.store?.emojiCount || 0) ===
        (consistencyReport.value.details.commonEmojiGroup.localStorage?.emojiCount || 0),
    },
  ]
})

// 表格列定义
const overviewColumns = [
  { title: '项目', dataIndex: 'item', key: 'item' },
  { title: 'Store', dataIndex: 'store', key: 'store' },
  { title: 'Cached', dataIndex: 'cached', key: 'cached' },
  { title: '状态', key: 'status' },
]

const emojiColumns = [
  { title: '名称', dataIndex: 'name', key: 'name' },
  { title: '使用次数', dataIndex: 'count', key: 'count' },
  { title: '分组', dataIndex: 'group', key: 'group' },
]

const storageEmojiColumns = [
  { title: '名称', dataIndex: 'name', key: 'name' },
  { title: '使用次数', dataIndex: 'count', key: 'count' },
]

// 方法
const addLog = (level: string, message: string) => {
  debugLogs.value.unshift({
    timestamp: Date.now(),
    level,
    message,
  })

  // 限制日志数量
  if (debugLogs.value.length > 100) {
    debugLogs.value = debugLogs.value.slice(0, 100)
  }
}

const getLogColor = (level: string) => {
  switch (level.toLowerCase()) {
    case 'error':
      return '#cf1322'
    case 'warn':
      return '#d48806'
    case 'info':
      return '#1890ff'
    default:
      return '#000000'
  }
}

const clearLogs = () => {
  debugLogs.value = []
  addLog('info', '日志已清除')
}

const refreshData = async () => {
  loading.value = true
  addLog('info', '开始刷新监控数据')

  try {
    const monitoring = createMonitoringData()

    // 获取各种数据
    popupData.value = await monitoring.getPopupData()
    optionsData.value = await monitoring.getOptionsData()
    storageData.value = await monitoring.getStorageData()

    addLog(
      'info',
      `数据刷新完成 - Popup: ${popupData.value.hotEmojisCount}, Options: ${optionsData.value.hotEmojisCount}`,
    )

    // 自动运行一致性检查
    await runConsistencyCheck()
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    addLog('error', `数据刷新失败: ${errorMessage}`)
    message.error('数据刷新失败: ' + errorMessage)
  } finally {
    loading.value = false
  }
}

const runConsistencyCheck = async () => {
  checkingConsistency.value = true
  addLog('info', '开始数据一致性检查')

  try {
    consistencyReport.value = await checkDataConsistency()

    const status = consistencyReport.value.isConsistent ? '通过' : '失败'
    addLog(
      consistencyReport.value.isConsistent ? 'info' : 'warn',
      `一致性检查${status} - 发现 ${consistencyReport.value.issues.length} 个问题`,
    )

    if (!consistencyReport.value.isConsistent) {
      showConsistencyModal.value = true
    } else {
      message.success('数据一致性检查通过')
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    addLog('error', `一致性检查失败: ${errorMessage}`)
    message.error('一致性检查失败: ' + errorMessage)
  } finally {
    checkingConsistency.value = false
  }
}

const fixInconsistency = async () => {
  fixingData.value = true
  addLog('info', '开始修复数据不一致')

  try {
    await fixDataInconsistency()
    addLog('info', '数据不一致修复完成')
    message.success('数据不一致修复完成')

    // 重新检查
    await runConsistencyCheck()
    showConsistencyModal.value = false
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    addLog('error', `修复失败: ${errorMessage}`)
    message.error('修复失败: ' + errorMessage)
  } finally {
    fixingData.value = false
  }
}

// 自动刷新定时器
let autoRefreshTimer: number | null = null

const startAutoRefresh = () => {
  autoRefreshTimer = setInterval(() => {
    refreshData()
  }, 30000) // 每30秒自动刷新
}

const stopAutoRefresh = () => {
  if (autoRefreshTimer) {
    clearInterval(autoRefreshTimer)
    autoRefreshTimer = null
  }
}

// 生命周期
onMounted(() => {
  addLog('info', '数据监控面板已启动')
  refreshData()
  startAutoRefresh()
})

onUnmounted(() => {
  stopAutoRefresh()
  addLog('info', '数据监控面板已关闭')
})
</script>

<template>
  <a-card title="数据同步监控面板" style="margin-bottom: 16px">
    <template #extra>
      <a-space>
        <a-button @click="refreshData" :loading="loading" size="small">刷新</a-button>
        <a-button
          @click="runConsistencyCheck"
          :loading="checkingConsistency"
          size="small"
          type="primary"
        >
          一致性检查
        </a-button>
        <a-button @click="fixInconsistency" :loading="fixingData" size="small" type="dashed" danger>
          修复数据
        </a-button>
      </a-space>
    </template>

    <!-- 实时状态指示器 -->
    <div style="margin-bottom: 16px">
      <a-row :gutter="16">
        <a-col :span="8">
          <a-statistic
            title="数据一致性状态"
            :value="consistencyStatus"
            :value-style="{ color: consistencyReport?.isConsistent ? '#3f8600' : '#cf1322' }"
          />
        </a-col>
        <a-col :span="8">
          <a-statistic title="最后同步时间" :value="lastSyncTime" />
        </a-col>
        <a-col :span="8">
          <a-statistic title="同步延迟" :value="syncAge + 'ms'" />
        </a-col>
      </a-row>
    </div>

    <!-- 数据对比表格 -->
    <a-tabs v-model:activeKey="activeTab">
      <a-tab-pane key="overview" tab="概览">
        <a-table
          :columns="overviewColumns"
          :data-source="overviewData"
          :pagination="false"
          size="small"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'status'">
              <a-tag :color="record.consistent ? 'green' : 'red'">
                {{ record.consistent ? '一致' : '不一致' }}
              </a-tag>
            </template>
          </template>
        </a-table>
      </a-tab-pane>

      <a-tab-pane key="popup" tab="Popup数据">
        <div v-if="popupData">
          <p><strong>上下文:</strong> {{ popupData.context }}</p>
          <p><strong>热门表情数量:</strong> {{ popupData.hotEmojisCount }}</p>
          <p><strong>常用表情数量:</strong> {{ popupData.commonEmojiCount }}</p>
          <p><strong>时间戳:</strong> {{ new Date(popupData.timestamp).toLocaleString() }}</p>

          <a-table
            :columns="emojiColumns"
            :data-source="popupData.hotEmojis"
            :pagination="false"
            size="small"
            style="margin-top: 16px"
          />
        </div>
        <a-empty v-else description="暂无Popup数据" />
      </a-tab-pane>

      <a-tab-pane key="options" tab="Options数据">
        <div v-if="optionsData">
          <p><strong>上下文:</strong> {{ optionsData.context }}</p>
          <p><strong>热门表情数量:</strong> {{ optionsData.hotEmojisCount }}</p>
          <p><strong>常用表情数量:</strong> {{ optionsData.commonEmojiCount }}</p>
          <p><strong>时间戳:</strong> {{ new Date(optionsData.timestamp).toLocaleString() }}</p>

          <a-table
            :columns="emojiColumns"
            :data-source="optionsData.hotEmojis"
            :pagination="false"
            size="small"
            style="margin-top: 16px"
          />
        </div>
        <a-empty v-else description="暂无Options数据" />
      </a-tab-pane>

      <a-tab-pane key="storage" tab="存储数据">
        <div v-if="storageData">
          <a-row :gutter="16">
            <a-col :span="12">
              <a-card title="localStorage" size="small">
                <div v-if="storageData.localStorage">
                  <p><strong>表情数量:</strong> {{ storageData.localStorage.emojiCount }}</p>
                  <a-table
                    :columns="storageEmojiColumns"
                    :data-source="storageData.localStorage.emojis"
                    :pagination="false"
                    size="small"
                  />
                </div>
                <a-empty v-else description="暂无localStorage数据" size="small" />
              </a-card>
            </a-col>
            <a-col :span="12">
              <a-card title="Chrome Storage" size="small">
                <div v-if="storageData.chromeStorage">
                  <p><strong>表情数量:</strong> {{ storageData.chromeStorage.emojiCount }}</p>
                  <a-table
                    :columns="storageEmojiColumns"
                    :data-source="storageData.chromeStorage.emojis"
                    :pagination="false"
                    size="small"
                  />
                </div>
                <a-empty v-else description="暂无Chrome Storage数据" size="small" />
              </a-card>
            </a-col>
          </a-row>
        </div>
        <a-empty v-else description="暂无存储数据" />
      </a-tab-pane>

      <a-tab-pane key="logs" tab="调试日志">
        <div
          style="
            max-height: 400px;
            overflow-y: auto;
            background: #f5f5f5;
            padding: 12px;
            border-radius: 4px;
          "
        >
          <div v-for="(log, index) in debugLogs" :key="index" style="margin-bottom: 8px">
            <span :style="{ color: getLogColor(log.level) }">
              [{{ new Date(log.timestamp).toLocaleTimeString() }}] {{ log.level.toUpperCase() }}:
              {{ log.message }}
            </span>
          </div>
        </div>
        <div style="margin-top: 12px; text-align: right">
          <a-button @click="clearLogs" size="small">清除日志</a-button>
        </div>
      </a-tab-pane>
    </a-tabs>

    <!-- 一致性检查结果 -->
    <a-modal
      v-model:open="showConsistencyModal"
      title="数据一致性检查结果"
      :footer="null"
      width="800px"
    >
      <div v-if="consistencyReport">
        <a-result
          :status="consistencyReport.isConsistent ? 'success' : 'error'"
          :title="consistencyReport.isConsistent ? '数据一致' : '发现数据不一致'"
          :sub-title="`检查时间: ${new Date(consistencyReport.timestamp).toLocaleString()}`"
        >
          <template #extra>
            <a-button
              v-if="!consistencyReport.isConsistent"
              @click="fixInconsistency"
              type="primary"
            >
              修复数据不一致
            </a-button>
          </template>
        </a-result>

        <div v-if="consistencyReport.issues.length > 0" style="margin-top: 16px">
          <h4>发现的问题:</h4>
          <a-list :data-source="consistencyReport.issues" size="small">
            <template #renderItem="{ item }">
              <a-list-item>
                <a-typography-text type="danger">{{ item }}</a-typography-text>
              </a-list-item>
            </template>
          </a-list>
        </div>

        <div style="margin-top: 16px">
          <h4>详细信息:</h4>
          <a-descriptions :column="2" size="small" bordered>
            <a-descriptions-item label="热门表情(Store)">
              {{ consistencyReport.details.hotEmojisCount.store }}
            </a-descriptions-item>
            <a-descriptions-item label="热门表情(Cached)">
              {{ consistencyReport.details.hotEmojisCount.cached }}
            </a-descriptions-item>
            <a-descriptions-item label="最后同步时间">
              {{
                consistencyReport.details.storageSync.lastSyncTime
                  ? new Date(consistencyReport.details.storageSync.lastSyncTime).toLocaleString()
                  : '未知'
              }}
            </a-descriptions-item>
            <a-descriptions-item label="同步延迟">
              {{ consistencyReport.details.storageSync.syncAge }}ms
            </a-descriptions-item>
          </a-descriptions>
        </div>
      </div>
    </a-modal>
  </a-card>
</template>

<style scoped>
.ant-statistic {
  text-align: center;
}

.ant-table-small .ant-table-tbody > tr > td {
  padding: 4px 8px;
}
</style>
