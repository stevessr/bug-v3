import { computed, onScopeDispose, shallowRef } from 'vue'

import {
  AGENT_BROWSER_WORKFLOWS_STORAGE_KEY,
  AGENT_WORKFLOW_SCHEDULES_STORAGE_KEY,
  computeNextAgentWorkflowRun,
  createAgentBrowserWorkflow,
  createAgentWorkflowSchedule,
  loadAgentBrowserWorkflows,
  loadAgentWorkflowSchedules,
  removeAgentBrowserWorkflow,
  removeAgentWorkflowSchedule,
  upsertAgentBrowserWorkflow,
  upsertAgentWorkflowSchedule,
  type AgentBrowserWorkflow,
  type AgentRecordingSession,
  type AgentWorkflowSchedule,
  type AgentWorkflowScheduleOptions
} from './browserWorkflows'

type RuntimeResponse<T> = { success: true; data?: T } | { success: false; error?: string }

const sendRuntimeMessage = async <T>(message: unknown): Promise<T> => {
  if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
    throw new Error('工作流录制仅在已加载的浏览器扩展中可用')
  }
  const response = (await chrome.runtime.sendMessage(message)) as RuntimeResponse<T> | undefined
  if (!response?.success) throw new Error(response?.error || '工作流操作失败')
  return response.data as T
}

export function useBrowserWorkflows() {
  const workflows = shallowRef<AgentBrowserWorkflow[]>([])
  const schedules = shallowRef<AgentWorkflowSchedule[]>([])
  const recordingSession = shallowRef<AgentRecordingSession | null>(null)
  const loading = shallowRef(false)

  const isRecording = computed(() => Boolean(recordingSession.value))

  const reloadWorkflows = async () => {
    workflows.value = await loadAgentBrowserWorkflows()
    return workflows.value
  }

  const reloadSchedules = async () => {
    schedules.value = await loadAgentWorkflowSchedules()
    return schedules.value
  }

  const initialize = async (tabId?: number | null) => {
    loading.value = true
    try {
      await Promise.all([reloadWorkflows(), reloadSchedules()])
      if (typeof chrome !== 'undefined') {
        recordingSession.value = await sendRuntimeMessage<AgentRecordingSession | null>({
          type: 'AGENT_RECORDING_STATUS',
          tabId: typeof tabId === 'number' ? tabId : undefined
        })
      }
    } catch {
      recordingSession.value = null
    } finally {
      loading.value = false
    }
  }

  const startRecording = async (tabId: number) => {
    recordingSession.value = await sendRuntimeMessage<AgentRecordingSession>({
      type: 'AGENT_RECORDING_START',
      tabId
    })
    return recordingSession.value
  }

  const stopRecording = async () => {
    const session = await sendRuntimeMessage<AgentRecordingSession | null>({
      type: 'AGENT_RECORDING_STOP',
      tabId: recordingSession.value?.tabId
    })
    recordingSession.value = null
    return session
  }

  const saveRecording = async (session: AgentRecordingSession, name: string) => {
    const workflow = createAgentBrowserWorkflow(session, name)
    workflows.value = await upsertAgentBrowserWorkflow(workflow)
    schedules.value = await loadAgentWorkflowSchedules()
    return workflows.value.find(item => item.id === workflow.id) || workflow
  }

  const deleteWorkflow = async (workflowId: string) => {
    workflows.value = await removeAgentBrowserWorkflow(workflowId)
    schedules.value = await loadAgentWorkflowSchedules()
  }

  const markWorkflowRun = async (
    workflowId: string,
    status: AgentBrowserWorkflow['lastRunStatus'],
    error?: string
  ) => {
    const workflow = workflows.value.find(item => item.id === workflowId)
    if (!workflow) return
    workflows.value = await upsertAgentBrowserWorkflow({
      ...workflow,
      lastRunAt: Date.now(),
      lastRunStatus: status,
      lastRunError: error
    })
  }

  const createSchedule = async (
    workflow: AgentBrowserWorkflow,
    options: number | AgentWorkflowScheduleOptions
  ) => {
    const schedule = createAgentWorkflowSchedule(workflow, options)
    schedules.value = await upsertAgentWorkflowSchedule(schedule)
    return schedules.value.find(item => item.id === schedule.id) || schedule
  }

  const toggleSchedule = async (schedule: AgentWorkflowSchedule, enabled: boolean) => {
    schedules.value = await upsertAgentWorkflowSchedule({
      ...schedule,
      enabled,
      nextRunAt: enabled
        ? schedule.nextRunAt > Date.now()
          ? schedule.nextRunAt
          : computeNextAgentWorkflowRun(schedule)
        : schedule.nextRunAt
    })
  }

  const deleteSchedule = async (scheduleId: string) => {
    schedules.value = await removeAgentWorkflowSchedule(scheduleId)
  }

  const runScheduleNow = async (scheduleId: string) => {
    return sendRuntimeMessage<{ started: boolean }>({
      type: 'AGENT_WORKFLOW_RUN_SCHEDULE',
      scheduleId
    })
  }

  const handleChromeStorageChange = (
    changes: Record<string, chrome.storage.StorageChange>,
    areaName: string
  ) => {
    if (areaName !== 'local') return
    if (changes[AGENT_BROWSER_WORKFLOWS_STORAGE_KEY]) void reloadWorkflows()
    if (changes[AGENT_WORKFLOW_SCHEDULES_STORAGE_KEY]) void reloadSchedules()
  }

  const handleWindowStorageChange = (event: StorageEvent) => {
    if (event.key === AGENT_BROWSER_WORKFLOWS_STORAGE_KEY) void reloadWorkflows()
    if (event.key === AGENT_WORKFLOW_SCHEDULES_STORAGE_KEY) void reloadSchedules()
  }

  if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
    chrome.storage.onChanged.addListener(handleChromeStorageChange)
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', handleWindowStorageChange)
  }

  onScopeDispose(() => {
    if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
      chrome.storage.onChanged.removeListener(handleChromeStorageChange)
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', handleWindowStorageChange)
    }
  })

  return {
    workflows,
    schedules,
    recordingSession,
    isRecording,
    loading,
    initialize,
    startRecording,
    stopRecording,
    saveRecording,
    deleteWorkflow,
    markWorkflowRun,
    createSchedule,
    toggleSchedule,
    deleteSchedule,
    runScheduleNow
  }
}
