import { computed, ref, watch } from 'vue'
import { nanoid } from 'nanoid'

import { loadAgentSettings, resetAgentSettings, saveAgentSettings } from './storage'
import type { AgentSettings, SubAgentConfig } from './types'

export function useAgentSettings() {
  const settings = ref<AgentSettings>(loadAgentSettings())
  const isSaving = ref(false)

  const activeSubagent = computed(() => {
    const id = settings.value.defaultSubagentId
    return (
      settings.value.subagents.find(agent => agent.id === id) ||
      settings.value.subagents[0] ||
      undefined
    )
  })

  const setActiveSubagent = (id: string) => {
    settings.value.defaultSubagentId = id
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

    settings.value.subagents.push(newAgent)
    settings.value.defaultSubagentId = newAgent.id
  }

  const removeSubagent = (id: string) => {
    const idx = settings.value.subagents.findIndex(agent => agent.id === id)
    if (idx === -1) return
    const removed = settings.value.subagents.splice(idx, 1)[0]
    if (removed && settings.value.defaultSubagentId === removed.id) {
      settings.value.defaultSubagentId = settings.value.subagents[0]?.id
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
    next => {
      isSaving.value = true
      saveAgentSettings(next)
      isSaving.value = false
    },
    { deep: true }
  )

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
