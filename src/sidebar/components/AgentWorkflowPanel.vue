<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { assessWorkflowScheduleEligibility } from '@/agent/browserWorkflows'
import type {
  AgentBrowserWorkflow,
  AgentRecordingSession,
  AgentWorkflowSchedule,
  AgentWorkflowScheduleCadence
} from '@/agent/browserWorkflows'

const props = defineProps<{
  workflows: AgentBrowserWorkflow[]
  schedules: AgentWorkflowSchedule[]
  recordingSession: AgentRecordingSession | null
  recordingDraft: AgentRecordingSession | null
  busy?: boolean
}>()

const emit = defineEmits<{
  startRecording: []
  stopRecording: []
  saveRecording: [payload: { session: AgentRecordingSession; name: string }]
  discardDraft: []
  run: [workflow: AgentBrowserWorkflow]
  delete: [workflow: AgentBrowserWorkflow]
  createSchedule: [
    payload: {
      workflow: AgentBrowserWorkflow
      cadence: AgentWorkflowScheduleCadence
      intervalMinutes?: number
      firstRunAt: number
    }
  ]
  toggleSchedule: [payload: { schedule: AgentWorkflowSchedule; enabled: boolean }]
  deleteSchedule: [schedule: AgentWorkflowSchedule]
  runSchedule: [schedule: AgentWorkflowSchedule]
}>()

const panelOpen = ref(false)
const search = ref('')
const saveModalOpen = ref(false)
const workflowName = ref('')
const scheduleModalOpen = ref(false)
const scheduleWorkflow = ref<AgentBrowserWorkflow | null>(null)
const scheduleCadence = ref<AgentWorkflowScheduleCadence>('daily')
const scheduleInterval = ref(60)
const scheduleFirstRun = ref('')
const scheduleAcknowledged = ref(false)

const scheduleCadenceOptions: Array<{
  value: AgentWorkflowScheduleCadence
  label: string
}> = [
  { value: 'interval', label: '自定义间隔' },
  { value: 'daily', label: '每天' },
  { value: 'weekly', label: '每周' },
  { value: 'monthly', label: '每月' },
  { value: 'yearly', label: '每年' }
]

const filteredWorkflows = computed(() => {
  const query = search.value.trim().toLocaleLowerCase()
  if (!query) return props.workflows
  return props.workflows.filter(workflow =>
    `${workflow.name} ${workflow.shortcut} ${workflow.startTitle || ''}`
      .toLocaleLowerCase()
      .includes(query)
  )
})

const selectedScheduleEligibility = computed(() =>
  scheduleWorkflow.value
    ? assessWorkflowScheduleEligibility(scheduleWorkflow.value)
    : { eligible: false, reasons: [], origins: [] }
)

const selectedFirstRunAt = computed(() => {
  const parsed = new Date(scheduleFirstRun.value).getTime()
  return Number.isFinite(parsed) ? parsed : 0
})

const scheduleFormValid = computed(
  () =>
    selectedFirstRunAt.value > Date.now() + 30_000 &&
    (scheduleCadence.value !== 'interval' ||
      (Number.isFinite(scheduleInterval.value) && scheduleInterval.value >= 1))
)

const scheduleByWorkflow = computed(() => {
  const result = new Map<string, AgentWorkflowSchedule[]>()
  for (const schedule of props.schedules) {
    const items = result.get(schedule.workflowId) || []
    items.push(schedule)
    result.set(schedule.workflowId, items)
  }
  return result
})

watch(
  () => props.recordingDraft,
  draft => {
    if (!draft) return
    workflowName.value = draft.startTitle || '新工作流'
    saveModalOpen.value = true
    panelOpen.value = true
  }
)

const formatTime = (timestamp?: number) => {
  if (!timestamp) return '尚未运行'
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(timestamp)
}

const scheduleSummary = (schedule: AgentWorkflowSchedule) => {
  const interval = schedule.intervalMinutes
  const calendarLabels: Partial<Record<AgentWorkflowScheduleCadence, string>> = {
    daily: '每天',
    weekly: '每周',
    monthly: '每月',
    yearly: '每年'
  }
  const frequency =
    calendarLabels[schedule.cadence] ||
    (interval < 60
      ? `每 ${interval} 分钟`
      : interval % (24 * 60) === 0
        ? `每 ${interval / (24 * 60)} 天`
        : interval % 60 === 0
          ? `每 ${interval / 60} 小时`
          : `每 ${interval} 分钟`)
  return `${frequency} · 下次 ${formatTime(schedule.nextRunAt)}`
}

const toLocalDateTimeValue = (timestamp: number) => {
  const date = new Date(timestamp)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`
}

const confirmSave = () => {
  if (!props.recordingDraft || !workflowName.value.trim()) return
  emit('saveRecording', { session: props.recordingDraft, name: workflowName.value.trim() })
  saveModalOpen.value = false
}

const discardDraft = () => {
  saveModalOpen.value = false
  emit('discardDraft')
}

const openSchedule = (workflow: AgentBrowserWorkflow) => {
  scheduleWorkflow.value = workflow
  scheduleCadence.value = 'daily'
  scheduleInterval.value = 60
  const firstRun = new Date(Date.now() + 60 * 60 * 1000)
  firstRun.setSeconds(0, 0)
  scheduleFirstRun.value = toLocalDateTimeValue(firstRun.getTime())
  scheduleAcknowledged.value = false
  scheduleModalOpen.value = true
}

const confirmSchedule = () => {
  if (
    !scheduleWorkflow.value ||
    !selectedScheduleEligibility.value.eligible ||
    !scheduleFormValid.value ||
    !scheduleAcknowledged.value
  ) {
    return
  }
  emit('createSchedule', {
    workflow: scheduleWorkflow.value,
    cadence: scheduleCadence.value,
    intervalMinutes: scheduleCadence.value === 'interval' ? scheduleInterval.value : undefined,
    firstRunAt: selectedFirstRunAt.value
  })
  scheduleModalOpen.value = false
}
</script>

<template>
  <section class="agent-workflows" data-testid="agent-workflow-feature">
    <div class="agent-workflow-toolbar">
      <button
        type="button"
        class="agent-workflow-toggle"
        data-testid="agent-workflow-toggle"
        @click="panelOpen = !panelOpen"
      >
        <span>工作流</span>
        <span class="agent-workflow-count">{{ workflows.length }}</span>
      </button>
      <button
        v-if="!recordingSession"
        type="button"
        class="agent-record-button"
        data-testid="agent-record-start"
        :disabled="busy"
        @click="emit('startRecording')"
      >
        <span class="agent-record-dot"></span>
        录制
      </button>
      <button
        v-else
        type="button"
        class="agent-record-button agent-record-button--active"
        data-testid="agent-record-stop"
        :disabled="busy"
        @click="emit('stopRecording')"
      >
        <span class="agent-record-stop-icon"></span>
        停止
      </button>
    </div>

    <div
      v-if="recordingSession"
      class="agent-recording-banner"
      data-testid="agent-recording-banner"
    >
      <span class="agent-recording-pulse"></span>
      <div>
        <strong>正在录制此标签页</strong>
        <span>密码、验证码、令牌与支付字段不会保存</span>
      </div>
    </div>

    <div v-if="panelOpen" class="agent-workflow-panel" data-testid="agent-workflow-panel">
      <div class="agent-workflow-panel-head">
        <div>
          <strong>浏览器工作流</strong>
          <span>录制一次，用 /快捷方式 或定时任务重复执行</span>
        </div>
        <a-input
          v-model:value="search"
          allow-clear
          size="small"
          placeholder="搜索工作流"
          class="agent-workflow-search"
        />
      </div>

      <div v-if="filteredWorkflows.length === 0" class="agent-workflow-empty">
        {{
          workflows.length ? '没有匹配的工作流' : '还没有工作流。点击“录制”并在页面完成一次操作。'
        }}
      </div>

      <article
        v-for="workflow in filteredWorkflows"
        :key="workflow.id"
        class="agent-workflow-card"
        :data-testid="`agent-workflow-${workflow.id}`"
      >
        <div class="agent-workflow-card-main">
          <div class="agent-workflow-name-row">
            <strong>{{ workflow.name }}</strong>
            <code>/{{ workflow.shortcut }}</code>
          </div>
          <div class="agent-workflow-meta">
            {{ workflow.actions.length }} 个动作
            <span v-if="workflow.redactedFields.length" class="agent-workflow-warning">
              · {{ workflow.redactedFields.length }} 个敏感字段已脱敏，禁止自动回放
            </span>
          </div>
          <div class="agent-workflow-origin">{{ workflow.startTitle || workflow.startUrl }}</div>
          <div v-if="workflow.lastRunStatus" class="agent-workflow-last-run">
            上次 {{ formatTime(workflow.lastRunAt) }} ·
            {{
              workflow.lastRunStatus === 'success'
                ? '成功'
                : workflow.lastRunStatus === 'denied'
                  ? '已拒绝'
                  : '失败'
            }}
          </div>
        </div>
        <div class="agent-workflow-card-actions">
          <a-button
            size="small"
            type="primary"
            class="agent-workflow-run"
            :disabled="Boolean(recordingSession) || busy || workflow.redactedFields.length > 0"
            :title="
              workflow.redactedFields.length ? '含敏感字段的工作流禁止自动回放' : '运行工作流'
            "
            @click="emit('run', workflow)"
          >
            运行
          </a-button>
          <a-button size="small" :disabled="busy" @click="openSchedule(workflow)">定时</a-button>
          <a-popconfirm
            title="删除这个工作流及其定时任务？"
            ok-text="删除"
            cancel-text="取消"
            @confirm="emit('delete', workflow)"
          >
            <a-button size="small" type="text" danger :disabled="busy">删除</a-button>
          </a-popconfirm>
        </div>

        <div
          v-for="schedule in scheduleByWorkflow.get(workflow.id) || []"
          :key="schedule.id"
          class="agent-workflow-schedule"
        >
          <div>
            <strong>{{ schedule.enabled ? '定时已开启' : '定时已暂停' }}</strong>
            <span>{{ scheduleSummary(schedule) }}</span>
            <span v-if="schedule.lastRunError" class="agent-workflow-warning">
              {{ schedule.lastRunError }}
            </span>
          </div>
          <div class="agent-workflow-schedule-actions">
            <a-switch
              size="small"
              :checked="schedule.enabled"
              @change="emit('toggleSchedule', { schedule, enabled: Boolean($event) })"
            />
            <a-button size="small" type="text" @click="emit('runSchedule', schedule)">
              立即运行
            </a-button>
            <a-button size="small" type="text" danger @click="emit('deleteSchedule', schedule)">
              移除
            </a-button>
          </div>
        </div>
      </article>
    </div>

    <a-modal
      v-model:open="saveModalOpen"
      title="保存浏览器工作流"
      ok-text="保存"
      cancel-text="丢弃"
      :ok-button-props="{ disabled: !workflowName.trim() }"
      data-testid="agent-workflow-save-modal"
      @ok="confirmSave"
      @cancel="discardDraft"
    >
      <div class="agent-workflow-modal-copy">
        已录制 {{ recordingDraft?.actions.length || 0 }} 个动作。
        <span v-if="recordingDraft?.redactedFields.length">
          其中
          {{ recordingDraft.redactedFields.length }}
          个敏感字段已脱敏；为避免误提交，该工作流不会自动回放或定时运行。
        </span>
      </div>
      <a-input
        v-model:value="workflowName"
        autofocus
        :maxlength="80"
        placeholder="例如：每日检查论坛通知"
        @press-enter="confirmSave"
      />
    </a-modal>

    <a-modal
      v-model:open="scheduleModalOpen"
      title="定时运行工作流"
      ok-text="创建定时任务"
      cancel-text="取消"
      :ok-button-props="{
        disabled:
          !selectedScheduleEligibility.eligible || !scheduleFormValid || !scheduleAcknowledged
      }"
      root-class-name="agent-workflow-schedule-modal-root"
      data-testid="agent-workflow-schedule-modal"
      @ok="confirmSchedule"
    >
      <div v-if="selectedScheduleEligibility.eligible" class="agent-workflow-schedule-form">
        <label>
          <span>重复频率</span>
          <a-select
            v-model:value="scheduleCadence"
            :options="scheduleCadenceOptions"
            data-testid="agent-workflow-schedule-cadence"
          />
        </label>
        <label v-if="scheduleCadence === 'interval'">
          <span>运行间隔（分钟）</span>
          <a-input-number v-model:value="scheduleInterval" :min="1" :max="525600" />
        </label>
        <label>
          <span>首次运行时间</span>
          <input
            v-model="scheduleFirstRun"
            type="datetime-local"
            class="agent-workflow-datetime"
            data-testid="agent-workflow-first-run"
          />
          <small>使用浏览器本地时区；每月和每年会按日历日期推进。</small>
        </label>
        <div class="agent-workflow-schedule-origins">
          <strong>授权站点范围</strong>
          <code v-for="origin in selectedScheduleEligibility.origins" :key="origin">
            {{ origin }}
          </code>
        </div>
        <a-checkbox v-model:checked="scheduleAcknowledged" class="agent-workflow-consent">
          我确认允许扩展按计划在后台打开这些站点并执行此工作流；成功后后台标签页会关闭，失败时会保留供检查。
        </a-checkbox>
      </div>
      <a-alert
        v-else
        type="warning"
        show-icon
        message="此工作流不能定时运行"
        :description="selectedScheduleEligibility.reasons.join('；')"
      />
    </a-modal>
  </section>
</template>

<style scoped>
.agent-workflows {
  margin-top: 8px;
}

.agent-workflow-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
}

.agent-workflow-toggle,
.agent-record-button {
  min-height: 32px;
  border: 1px solid var(--md3-outline-variant);
  border-radius: 999px;
  background: var(--md3-surface-container);
  color: var(--md3-on-surface);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
  transition:
    background 160ms ease,
    border-color 160ms ease,
    transform 160ms ease;
}

.agent-workflow-toggle {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 5px 11px;
}

.agent-workflow-count {
  display: grid;
  min-width: 18px;
  height: 18px;
  place-items: center;
  border-radius: 9px;
  background: var(--md3-secondary-container);
  color: var(--md3-on-secondary-container);
  font-size: 10px;
}

.agent-record-button {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 5px 12px;
}

.agent-record-button:hover,
.agent-workflow-toggle:hover {
  border-color: var(--md3-primary);
  background: var(--md3-surface-container-high);
}

.agent-record-button:active,
.agent-workflow-toggle:active {
  transform: scale(0.97);
}

.agent-record-button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.agent-record-button--active {
  border-color: var(--md3-error);
  background: var(--md3-error-container);
  color: var(--md3-on-error-container);
}

.agent-record-dot,
.agent-recording-pulse {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--md3-error);
}

.agent-record-stop-icon {
  width: 9px;
  height: 9px;
  border-radius: 2px;
  background: currentColor;
}

.agent-recording-banner {
  display: flex;
  align-items: center;
  gap: 9px;
  margin-top: 8px;
  padding: 8px 10px;
  border-radius: 12px;
  background: var(--md3-error-container);
  color: var(--md3-on-error-container);
}

.agent-recording-banner div {
  display: flex;
  min-width: 0;
  flex-direction: column;
  font-size: 10px;
  line-height: 1.45;
}

.agent-recording-banner strong {
  font-size: 11px;
}

.agent-recording-pulse {
  flex: 0 0 auto;
  animation: agent-recording-pulse 1.3s ease-in-out infinite;
}

.agent-workflow-panel {
  max-height: min(52vh, 460px);
  overflow: auto;
  margin-top: 8px;
  padding: 10px;
  border: 1px solid var(--md3-outline-variant);
  border-radius: 16px;
  background: var(--md3-surface-container-lowest);
  box-shadow: var(--md3-elevation-1);
}

.agent-workflow-panel-head {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 124px;
  align-items: center;
  gap: 10px;
  margin-bottom: 9px;
}

.agent-workflow-panel-head > div {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}

.agent-workflow-panel-head strong {
  color: var(--md3-on-surface);
  font-size: 12px;
}

.agent-workflow-panel-head span,
.agent-workflow-meta,
.agent-workflow-origin,
.agent-workflow-last-run {
  color: var(--md3-on-surface-variant);
  font-size: 10px;
}

.agent-workflow-empty {
  padding: 18px 10px;
  color: var(--md3-on-surface-variant);
  font-size: 11px;
  line-height: 1.6;
  text-align: center;
}

.agent-workflow-card {
  padding: 10px;
  border-radius: 14px;
  background: var(--md3-surface-container);
}

.agent-workflow-card + .agent-workflow-card {
  margin-top: 8px;
}

.agent-workflow-card-main {
  min-width: 0;
}

.agent-workflow-name-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.agent-workflow-name-row strong {
  overflow: hidden;
  color: var(--md3-on-surface);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.agent-workflow-name-row code,
.agent-workflow-schedule-origins code {
  padding: 2px 6px;
  border-radius: 7px;
  background: var(--md3-secondary-container);
  color: var(--md3-on-secondary-container);
  font-size: 10px;
}

.agent-workflow-origin {
  overflow: hidden;
  margin-top: 3px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.agent-workflow-last-run {
  margin-top: 3px;
}

.agent-workflow-warning {
  color: var(--md3-error);
}

.agent-workflow-card-actions,
.agent-workflow-schedule-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 8px;
}

.agent-workflow-run:disabled {
  cursor: not-allowed;
  filter: grayscale(0.9);
  opacity: 0.42;
}

.agent-workflow-schedule {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--md3-outline-variant);
}

.agent-workflow-schedule > div:first-child {
  display: flex;
  min-width: 0;
  flex-direction: column;
  color: var(--md3-on-surface-variant);
  font-size: 9px;
}

.agent-workflow-schedule > div:first-child strong {
  color: var(--md3-on-surface);
  font-size: 10px;
}

.agent-workflow-schedule-actions {
  flex: 0 0 auto;
  margin-top: 0;
}

.agent-workflow-modal-copy {
  margin-bottom: 12px;
  color: var(--md3-on-surface-variant);
  font-size: 12px;
  line-height: 1.6;
}

.agent-workflow-schedule-form {
  display: grid;
  gap: 14px;
}

.agent-workflow-schedule-form label,
.agent-workflow-schedule-origins {
  display: grid;
  gap: 7px;
  color: var(--md3-on-surface);
  font-size: 12px;
}

.agent-workflow-schedule-form label > small {
  color: var(--md3-on-surface-variant);
  font-size: 10px;
  line-height: 1.5;
}

.agent-workflow-datetime {
  width: 100%;
  min-height: 34px;
  padding: 5px 11px;
  border: 1px solid var(--md3-outline-variant);
  border-radius: 9px;
  outline: none;
  background: var(--md3-surface-container-lowest);
  color: var(--md3-on-surface);
  font: inherit;
}

.agent-workflow-datetime:focus-visible {
  border-color: var(--md3-primary);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--md3-primary) 18%, transparent);
}

.agent-workflow-schedule-form .agent-workflow-consent {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  line-height: 1.6;
}

:global(.agent-workflow-schedule-modal-root .ant-btn-primary:disabled) {
  border-color: var(--md3-outline-variant);
  background: var(--md3-surface-container-high);
  color: var(--md3-on-surface-variant);
  filter: grayscale(0.9);
  opacity: 0.62;
}

.agent-workflow-schedule-origins code {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@keyframes agent-recording-pulse {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.45;
    transform: scale(0.72);
  }
}

@media (max-width: 420px) {
  .agent-workflow-panel-head {
    grid-template-columns: 1fr;
  }

  .agent-workflow-search {
    width: 100%;
  }

  .agent-workflow-schedule {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
