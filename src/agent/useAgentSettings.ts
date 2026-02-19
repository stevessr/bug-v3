import { computed, onScopeDispose, ref, watch } from 'vue'
import { nanoid } from 'nanoid'

import { loadAgentSettings, resetAgentSettings, saveAgentSettings } from './storage'
import type { AgentSettings, SubAgentConfig } from './types'

export function useAgentSettings() {
  const SAVE_DEBOUNCE_MS = 250
  const settings = ref<AgentSettings>(loadAgentSettings())
  const isSaving = ref(false)
  let saveTimer: ReturnType<typeof setTimeout> | null = null

  const flushSettingsSave = () => {
    if (saveTimer) {
      clearTimeout(saveTimer)
      saveTimer = null
    }
    saveAgentSettings(settings.value)
    isSaving.value = false
  }

  const activeSubagent = computed(() => {
    const id = settings.value.defaultSubagentId
    return (
      settings.value.subagents.find(agent => agent.id === id) ||
      settings.value.subagents[0] ||
      undefined
    )
  })

  const setActiveSubagent = (id: string) => {
    settings.value = { ...settings.value, defaultSubagentId: id }
  }

  const addSubagent = (agent?: Partial<SubAgentConfig>) => {
    const newAgent: SubAgentConfig = {
      id: nanoid(),
      name: agent?.name || '新子代理',
      description: agent?.description,
      systemPrompt: agent?.systemPrompt || '',
      taskModel: agent?.taskModel || '',
      reasoningModel: agent?.reasoningModel || '',
      imageModel: agent?.imageModel || '',
      mcpServerIds: agent?.mcpServerIds || [],
      permissions: agent?.permissions || {
        click: true,
        scroll: true,
        touch: false,
        screenshot: true,
        navigate: true,
        clickDom: true,
        input: true
      },
      enabled: agent?.enabled ?? true,
      isPreset: agent?.isPreset
    }

    settings.value = {
      ...settings.value,
      subagents: [...settings.value.subagents, newAgent],
      defaultSubagentId: newAgent.id
    }
  }

  const removeSubagent = (id: string) => {
    const idx = settings.value.subagents.findIndex(agent => agent.id === id)
    if (idx === -1) return
    const removed = settings.value.subagents[idx]
    const newSubagents = settings.value.subagents.filter((_, i) => i !== idx)
    let newDefaultId = settings.value.defaultSubagentId
    if (removed && newDefaultId === removed.id) {
      newDefaultId = newSubagents[0]?.id
    }
    settings.value = {
      ...settings.value,
      subagents: newSubagents,
      defaultSubagentId: newDefaultId
    }
    if (settings.value.subagents.length === 0) {
      addSubagent({ name: '新子代理' })
    }
  }

  const restoreDefaults = () => {
    settings.value = resetAgentSettings()
  }

  watch(
    settings,
    () => {
      isSaving.value = true
      if (saveTimer) {
        clearTimeout(saveTimer)
      }
      saveTimer = setTimeout(flushSettingsSave, SAVE_DEBOUNCE_MS)
    },
    { deep: true, flush: 'post' }
  )

  onScopeDispose(() => {
    if (saveTimer) {
      flushSettingsSave()
    }
  })

  return {
    settings,
    isSaving,
    activeSubagent,
    setActiveSubagent,
    addSubagent,
    removeSubagent,
    restoreDefaults
  }
}
