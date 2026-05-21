import { computed, onScopeDispose, ref, watch } from 'vue'
import { nanoid } from 'nanoid'

import { loadAgentSettings, resetAgentSettings, saveAgentSettings } from './storage'
import type { AgentSettings, ProviderProfile, SubAgentConfig } from './types'

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

  // === Provider Profile helpers ===

  const activeProviderProfile = computed<ProviderProfile | undefined>(() => {
    const profiles = settings.value.providerProfiles
    if (!Array.isArray(profiles) || profiles.length === 0) return undefined
    const active = settings.value.activeProvider
    return profiles.find(p => p.provider === active) || profiles[0]
  })

  /** 写入 active profile 的同时同步 legacy 字段（baseUrl/apiKey/taskModel）。 */
  const syncLegacyFromActiveProfile = (
    next: AgentSettings,
    profile: ProviderProfile
  ): AgentSettings => {
    return {
      ...next,
      baseUrl: profile.baseUrl || '',
      apiKey: profile.apiKey || '',
      taskModel: profile.taskModel ? `${profile.provider}/${profile.taskModel}` : '',
      reasoningModel: profile.reasoningModel ? `${profile.provider}/${profile.reasoningModel}` : '',
      imageModel: profile.imageModel ? `${profile.provider}/${profile.imageModel}` : ''
    }
  }

  const setActiveProvider = (provider: string) => {
    const profiles = settings.value.providerProfiles || []
    const target = profiles.find(p => p.provider === provider)
    if (!target) return
    settings.value = syncLegacyFromActiveProfile(
      { ...settings.value, activeProvider: provider },
      target
    )
  }

  const addProviderProfile = (input: Partial<ProviderProfile> & { provider: string }) => {
    const existing = settings.value.providerProfiles || []
    if (existing.some(p => p.provider === input.provider)) {
      // 已存在：直接切换为 active，不重复添加
      setActiveProvider(input.provider)
      return
    }
    const profile: ProviderProfile = {
      provider: input.provider,
      label: input.label || input.provider,
      apiKey: input.apiKey || '',
      baseUrl: input.baseUrl || '',
      taskModel: input.taskModel || '',
      reasoningModel: input.reasoningModel || '',
      imageModel: input.imageModel || ''
    }
    settings.value = syncLegacyFromActiveProfile(
      {
        ...settings.value,
        providerProfiles: [...existing, profile],
        activeProvider: profile.provider
      },
      profile
    )
  }

  const removeProviderProfile = (provider: string) => {
    const profiles = settings.value.providerProfiles || []
    if (profiles.length <= 1) return // 至少保留一个
    const next = profiles.filter(p => p.provider !== provider)
    const activeStillExists = next.some(p => p.provider === settings.value.activeProvider)
    const nextActive = activeStillExists ? settings.value.activeProvider : next[0].provider
    const nextProfile = next.find(p => p.provider === nextActive) || next[0]
    settings.value = syncLegacyFromActiveProfile(
      {
        ...settings.value,
        providerProfiles: next,
        activeProvider: nextActive
      },
      nextProfile
    )
  }

  /** 修改当前 active profile 的某个字段，自动同步 legacy 字段。 */
  const updateActiveProfile = <K extends keyof ProviderProfile>(
    key: K,
    value: ProviderProfile[K]
  ) => {
    const profiles = settings.value.providerProfiles || []
    const idx = profiles.findIndex(p => p.provider === settings.value.activeProvider)
    if (idx === -1) return
    const updated: ProviderProfile = { ...profiles[idx], [key]: value }
    const nextProfiles = profiles.slice()
    nextProfiles[idx] = updated
    settings.value = syncLegacyFromActiveProfile(
      { ...settings.value, providerProfiles: nextProfiles },
      updated
    )
  }

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
        input: true,
        fileAccess: false
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
    restoreDefaults,
    activeProviderProfile,
    setActiveProvider,
    addProviderProfile,
    removeProviderProfile,
    updateActiveProfile
  }
}
