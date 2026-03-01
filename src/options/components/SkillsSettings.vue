<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'

import {
  BUILTIN_MCP_SERVERS,
  BUILTIN_SKILLS,
  loadApiKeys,
  setApiKey,
  removeApiKey,
  isBuiltinMcpEnabled,
  setBuiltinMcpEnabled,
  isBuiltinMcpAvailable,
  isSkillEnabled,
  setSkillEnabled,
  discoverAllSkills,
  loadCustomSkills,
  addCustomSkill,
  removeCustomSkill,
  importSkillFromSkillsSh,
  loadSkillChains,
  addSkillChain,
  removeSkillChain,
  loadSkillStats,
  getSkillPresets,
  addSkillPreset,
  removeSkillPreset,
  type Skill,
  type BuiltinMcpServer,
  type CustomSkill,
  type SkillChain,
  type SkillStats,
  type SkillPreset,
  type SkillCategory
} from '@/agent/skills'
import { useAgentSettings } from '@/agent/useAgentSettings'

const { settings } = useAgentSettings()

// API Keys
const apiKeys = reactive<Record<string, string>>({})
const apiKeyInputs = reactive<Record<string, string>>({})
const showApiKeys = reactive<Record<string, boolean>>({})

// 内置 MCP 启用状态
const builtinMcpEnabled = reactive<Record<string, boolean>>({})

// Skills
const skills = ref<Skill[]>([])
const skillsLoading = ref(false)
const skillsEnabled = reactive<Record<string, boolean>>({})

// 自定义 Skills
const customSkills = ref<CustomSkill[]>([])
const showCustomSkillModal = ref(false)
const showImportSkillModal = ref(false)
const importingSkill = ref(false)
const skillsShInput = ref('')
const newCustomSkill = reactive({
  name: '',
  description: '',
  category: 'other' as SkillCategory,
  promptTemplate: '',
  tags: ''
})

// Skill Chains
const skillChains = ref<SkillChain[]>([])
const showChainModal = ref(false)
const newChain = reactive({
  name: '',
  description: '',
  steps: [] as Array<{ skillId: string; staticArgs: string }>
})

// Skill 统计
const skillStats = ref<Record<string, SkillStats>>({})
const showStatsModal = ref(false)
const selectedSkillForStats = ref<Skill | null>(null)

// Skill 预设
const showPresetsModal = ref(false)
const selectedSkillForPresets = ref<Skill | null>(null)
const skillPresets = ref<SkillPreset[]>([])
const newPreset = reactive({
  name: '',
  description: '',
  args: ''
})

// 当前 tab
const activeTab = ref<'skills' | 'custom' | 'chains' | 'stats'>('skills')

// 分类名称
const categoryNames: Record<string, string> = {
  search: '搜索',
  knowledge: '知识',
  code: '代码',
  web: '网页',
  data: '数据',
  automation: '自动化',
  other: '其他'
}

const categoryOptions = Object.entries(categoryNames).map(([value, label]) => ({
  label,
  value
}))

// 按类别分组的 Skills
const skillsByCategory = computed(() => {
  const grouped = new Map<string, Skill[]>()
  for (const skill of skills.value) {
    const list = grouped.get(skill.category) || []
    list.push(skill)
    grouped.set(skill.category, list)
  }
  return grouped
})

// 加载状态
const loadState = () => {
  // 加载 API Keys
  const keys = loadApiKeys()
  Object.assign(apiKeys, keys)

  // 加载内置 MCP 启用状态
  for (const server of BUILTIN_MCP_SERVERS) {
    builtinMcpEnabled[server.id] = isBuiltinMcpEnabled(server.id)
  }

  // 加载 Skills 启用状态
  for (const skill of BUILTIN_SKILLS) {
    skillsEnabled[skill.id] = isSkillEnabled(skill.id)
  }

  // 加载自定义 Skills
  customSkills.value = loadCustomSkills()

  // 加载 Skill Chains
  skillChains.value = loadSkillChains()

  // 加载 Skill 统计
  skillStats.value = loadSkillStats()
}

// 保存 API Key
const saveApiKeyValue = (keyName: string) => {
  const value = apiKeyInputs[keyName]
  if (value && value.trim()) {
    setApiKey(keyName, value.trim())
    apiKeys[keyName] = value.trim()
    apiKeyInputs[keyName] = ''
  }
}

// 删除 API Key
const deleteApiKey = (keyName: string) => {
  removeApiKey(keyName)
  delete apiKeys[keyName]
}

// 切换内置 MCP 启用状态
const toggleBuiltinMcp = (serverId: string, enabled: boolean) => {
  setBuiltinMcpEnabled(serverId, enabled)
  builtinMcpEnabled[serverId] = enabled
  // 刷新 Skills
  refreshSkills()
}

// 切换 Skill 启用状态
const toggleSkill = (skillId: string, enabled: boolean) => {
  setSkillEnabled(skillId, enabled)
  skillsEnabled[skillId] = enabled
}

// 刷新 Skills 列表
const refreshSkills = async () => {
  skillsLoading.value = true
  try {
    const discovered = await discoverAllSkills(settings.value.mcpServers)
    skills.value = discovered
    // 更新启用状态
    for (const skill of discovered) {
      if (!(skill.id in skillsEnabled)) {
        skillsEnabled[skill.id] = skill.enabled
      }
    }
    // 刷新统计
    skillStats.value = loadSkillStats()
  } catch (error) {
    console.error('[Skills] Failed to discover skills:', error)
  } finally {
    skillsLoading.value = false
  }
}

// 检查 MCP 是否可用
const isMcpAvailable = (server: BuiltinMcpServer): boolean => {
  return isBuiltinMcpAvailable(server.id)
}

// 获取需要的 API Key 列表
const requiredApiKeys = computed(() => {
  const keys = new Set<string>()
  for (const server of BUILTIN_MCP_SERVERS) {
    if (server.requiresApiKey) {
      keys.add(server.requiresApiKey)
    }
  }
  return Array.from(keys)
})

// 创建自定义 Skill
const createCustomSkill = () => {
  if (!newCustomSkill.name.trim()) return

  addCustomSkill({
    name: newCustomSkill.name.trim(),
    description: newCustomSkill.description.trim(),
    category: newCustomSkill.category,
    source: 'custom',
    enabled: true,
    promptTemplate: newCustomSkill.promptTemplate.trim(),
    tags: newCustomSkill.tags
      .split(',')
      .map(t => t.trim())
      .filter(Boolean)
  })

  // 重置表单
  newCustomSkill.name = ''
  newCustomSkill.description = ''
  newCustomSkill.category = 'other'
  newCustomSkill.promptTemplate = ''
  newCustomSkill.tags = ''

  // 刷新列表
  customSkills.value = loadCustomSkills()
  showCustomSkillModal.value = false
}

// 从 skills.sh 导入 Skill
const importFromSkillsSh = async () => {
  const input = skillsShInput.value.trim()
  if (!input) {
    message.warning('请输入 skills.sh 链接')
    return
  }

  importingSkill.value = true
  try {
    const result = await importSkillFromSkillsSh(input)
    customSkills.value = loadCustomSkills()
    skillsEnabled[result.skill.id] = true
    const actionText = result.action === 'updated' ? '更新' : '导入'
    message.success(`${actionText}成功：${result.skill.name}`)
    showImportSkillModal.value = false
    skillsShInput.value = ''
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    message.error(`导入失败：${errorMsg}`)
  } finally {
    importingSkill.value = false
  }
}

// 删除自定义 Skill
const deleteCustomSkill = (skillId: string) => {
  removeCustomSkill(skillId)
  customSkills.value = loadCustomSkills()
}

// 创建 Skill Chain
const createSkillChain = () => {
  if (!newChain.name.trim() || newChain.steps.length === 0) return

  addSkillChain({
    name: newChain.name.trim(),
    description: newChain.description.trim(),
    enabled: true,
    steps: newChain.steps.map(step => ({
      skillId: step.skillId,
      staticArgs: step.staticArgs ? JSON.parse(step.staticArgs) : undefined
    }))
  })

  // 重置表单
  newChain.name = ''
  newChain.description = ''
  newChain.steps = []

  // 刷新列表
  skillChains.value = loadSkillChains()
  showChainModal.value = false
}

// 添加 Chain 步骤
const addChainStep = () => {
  newChain.steps.push({ skillId: '', staticArgs: '' })
}

// 删除 Chain 步骤
const removeChainStep = (index: number) => {
  newChain.steps.splice(index, 1)
}

// 删除 Skill Chain
const deleteSkillChain = (chainId: string) => {
  removeSkillChain(chainId)
  skillChains.value = loadSkillChains()
}

// 显示 Skill 统计
const showSkillStats = (skill: Skill) => {
  selectedSkillForStats.value = skill
  showStatsModal.value = true
}

// 获取 Skill 统计
const getStats = (skillId: string): SkillStats | undefined => {
  return skillStats.value[skillId]
}

// 格式化持续时间
const formatDuration = (ms: number): string => {
  if (ms < 1000) return `${Math.round(ms)}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

// 显示 Skill 预设
const showSkillPresets = (skill: Skill) => {
  selectedSkillForPresets.value = skill
  skillPresets.value = getSkillPresets(skill)
  showPresetsModal.value = true
}

// 添加 Skill 预设
const createSkillPreset = () => {
  if (!selectedSkillForPresets.value || !newPreset.name.trim()) return

  try {
    const args = newPreset.args.trim() ? JSON.parse(newPreset.args) : {}
    addSkillPreset(selectedSkillForPresets.value.id, {
      name: newPreset.name.trim(),
      description: newPreset.description.trim(),
      args
    })

    // 刷新预设列表
    skillPresets.value = getSkillPresets(selectedSkillForPresets.value)

    // 重置表单
    newPreset.name = ''
    newPreset.description = ''
    newPreset.args = ''
  } catch (e) {
    console.error('Invalid JSON for preset args:', e)
  }
}

// 删除 Skill 预设
const deleteSkillPreset = (presetId: string) => {
  if (!selectedSkillForPresets.value) return
  removeSkillPreset(selectedSkillForPresets.value.id, presetId)
  skillPresets.value = getSkillPresets(selectedSkillForPresets.value)
}

// 所有可选 Skills (用于 Chain 配置)
const allSelectableSkills = computed(() => {
  return [...skills.value, ...customSkills.value].map(s => ({
    label: `${s.icon || ''} ${s.name}`.trim(),
    value: s.id
  }))
})

onMounted(() => {
  loadState()
  refreshSkills()
})
</script>

<template>
  <div class="space-y-6">
    <!-- API Keys 配置 -->
    <div class="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-4 space-y-4">
      <div>
        <h3 class="text-base font-medium dark:text-white">API Keys 配置</h3>
        <p class="text-xs text-gray-500 dark:text-gray-400">配置内置 MCP 服务所需的 API Keys</p>
      </div>

      <div class="space-y-3">
        <div
          v-for="keyName in requiredApiKeys"
          :key="keyName"
          class="border border-gray-200 dark:border-gray-700 rounded-lg p-3"
        >
          <div class="flex items-center justify-between mb-2">
            <span class="text-sm font-medium dark:text-white">{{ keyName }}</span>
            <div class="flex items-center gap-2">
              <span
                v-if="apiKeys[keyName]"
                class="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
              >
                已配置
              </span>
              <span
                v-else
                class="text-xs px-2 py-0.5 rounded bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300"
              >
                未配置
              </span>
            </div>
          </div>

          <div v-if="apiKeys[keyName]" class="flex items-center gap-2">
            <a-input
              :value="showApiKeys[keyName] ? apiKeys[keyName] : '••••••••••••••••'"
              disabled
              class="flex-1"
            />
            <a-button size="small" @click="showApiKeys[keyName] = !showApiKeys[keyName]">
              {{ showApiKeys[keyName] ? '隐藏' : '显示' }}
            </a-button>
            <a-button size="small" danger @click="deleteApiKey(keyName)">删除</a-button>
          </div>
          <div v-else class="flex items-center gap-2">
            <a-input
              v-model:value="apiKeyInputs[keyName]"
              :placeholder="`输入 ${keyName}`"
              type="password"
              class="flex-1"
              @press-enter="saveApiKeyValue(keyName)"
            />
            <a-button size="small" type="primary" @click="saveApiKeyValue(keyName)">保存</a-button>
          </div>
        </div>
      </div>
    </div>

    <!-- 内置 MCP 服务 -->
    <div class="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-4 space-y-4">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-base font-medium dark:text-white">内置 MCP 服务</h3>
          <p class="text-xs text-gray-500 dark:text-gray-400">
            启用内置的云端 MCP 服务，获取更多 Skills
          </p>
        </div>
      </div>

      <div class="space-y-3">
        <div
          v-for="server in BUILTIN_MCP_SERVERS"
          :key="server.id"
          class="border border-gray-200 dark:border-gray-700 rounded-lg p-3"
        >
          <div class="flex items-center justify-between">
            <div class="flex-1">
              <div class="flex items-center gap-2">
                <span class="text-sm font-medium dark:text-white">{{ server.name }}</span>
                <span
                  v-if="server.requiresApiKey"
                  class="text-xs px-2 py-0.5 rounded"
                  :class="
                    isMcpAvailable(server)
                      ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                      : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                  "
                >
                  {{ isMcpAvailable(server) ? 'API Key 已配置' : '需要 API Key' }}
                </span>
              </div>
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {{ server.description }}
              </p>
            </div>
            <a-switch
              :checked="builtinMcpEnabled[server.id] || false"
              :disabled="server.requiresApiKey && !isMcpAvailable(server)"
              @change="value => toggleBuiltinMcp(server.id, Boolean(value))"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Skills 管理 Tabs -->
    <div class="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-4 space-y-4">
      <div class="flex items-center justify-between border-b dark:border-gray-700 pb-3">
        <div class="flex gap-4">
          <button
            class="text-sm font-medium pb-2 border-b-2 transition-colors"
            :class="[
              activeTab === 'skills'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
            ]"
            @click="activeTab = 'skills'"
          >
            Skills
          </button>
          <button
            class="text-sm font-medium pb-2 border-b-2 transition-colors"
            :class="[
              activeTab === 'custom'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
            ]"
            @click="activeTab = 'custom'"
          >
            自定义
          </button>
          <button
            class="text-sm font-medium pb-2 border-b-2 transition-colors"
            :class="[
              activeTab === 'chains'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
            ]"
            @click="activeTab = 'chains'"
          >
            工作流
          </button>
          <button
            class="text-sm font-medium pb-2 border-b-2 transition-colors"
            :class="[
              activeTab === 'stats'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
            ]"
            @click="activeTab = 'stats'"
          >
            统计
          </button>
        </div>
        <a-button
          v-if="activeTab === 'skills'"
          size="small"
          :loading="skillsLoading"
          @click="refreshSkills"
        >
          刷新
        </a-button>
        <div v-if="activeTab === 'custom'" class="flex items-center gap-2">
          <a-button size="small" @click="showImportSkillModal = true">从 skills.sh 导入</a-button>
          <a-button size="small" type="primary" @click="showCustomSkillModal = true">新建</a-button>
        </div>
        <a-button
          v-if="activeTab === 'chains'"
          size="small"
          type="primary"
          @click="showChainModal = true"
        >
          新建工作流
        </a-button>
      </div>

      <!-- Skills 列表 -->
      <div v-if="activeTab === 'skills'">
        <div v-if="skillsLoading" class="text-center py-8 text-gray-500 dark:text-gray-400">
          正在发现可用 Skills...
        </div>

        <div
          v-else-if="skills.length === 0"
          class="text-center py-8 text-gray-500 dark:text-gray-400"
        >
          暂无可用 Skills，请先启用内置 MCP 服务或添加自定义 MCP 服务
        </div>

        <div v-else class="space-y-4">
          <div v-for="[category, categorySkills] in skillsByCategory" :key="category">
            <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {{ categoryNames[category] || category }}
            </h4>
            <div class="space-y-2">
              <div
                v-for="skill in categorySkills"
                :key="skill.id"
                class="flex items-center justify-between p-2 rounded border border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50"
              >
                <div class="flex items-center gap-2 flex-1">
                  <span v-if="skill.icon" class="text-lg">{{ skill.icon }}</span>
                  <div class="flex-1">
                    <div class="flex items-center gap-2">
                      <span class="text-sm dark:text-white">{{ skill.name }}</span>
                      <span
                        v-if="skill.source === 'mcp'"
                        class="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                      >
                        MCP
                      </span>
                      <span
                        v-if="skill.triggers && skill.triggers.length > 0"
                        class="text-xs px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300"
                      >
                        触发器
                      </span>
                      <span v-if="getStats(skill.id)" class="text-xs text-gray-400">
                        {{ getStats(skill.id)?.totalCalls || 0 }} 次调用
                      </span>
                    </div>
                    <p class="text-xs text-gray-500 dark:text-gray-400">{{ skill.description }}</p>
                  </div>
                </div>
                <div class="flex items-center gap-2">
                  <a-button size="small" @click="showSkillPresets(skill)">预设</a-button>
                  <a-button size="small" @click="showSkillStats(skill)">统计</a-button>
                  <a-switch
                    :checked="skillsEnabled[skill.id] ?? skill.enabled"
                    size="small"
                    @change="value => toggleSkill(skill.id, value as boolean)"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 自定义 Skills -->
      <div v-if="activeTab === 'custom'">
        <div
          v-if="customSkills.length === 0"
          class="text-center py-8 text-gray-500 dark:text-gray-400"
        >
          暂无自定义 Skills，点击"新建"创建
        </div>

        <div v-else class="space-y-2">
          <div
            v-for="skill in customSkills"
            :key="skill.id"
            class="flex items-center justify-between p-3 rounded border border-gray-200 dark:border-gray-700"
          >
            <div>
              <div class="flex items-center gap-2">
                <span class="text-sm font-medium dark:text-white">{{ skill.name }}</span>
                <span
                  class="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                >
                  {{ categoryNames[skill.category] || skill.category }}
                </span>
                <span
                  v-if="skill.importSource === 'skills.sh'"
                  class="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                >
                  skills.sh
                </span>
              </div>
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">{{ skill.description }}</p>
              <a
                v-if="skill.sourceUrl"
                :href="skill.sourceUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="text-xs text-blue-500 hover:underline mt-1 inline-block"
              >
                {{ skill.sourceUrl }}
              </a>
              <div v-if="skill.tags && skill.tags.length > 0" class="flex gap-1 mt-1">
                <span
                  v-for="tag in skill.tags"
                  :key="tag"
                  class="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                >
                  {{ tag }}
                </span>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <a-switch
                :checked="skillsEnabled[skill.id] ?? skill.enabled"
                size="small"
                @change="value => toggleSkill(skill.id, value as boolean)"
              />
              <a-button size="small" danger @click="deleteCustomSkill(skill.id)">删除</a-button>
            </div>
          </div>
        </div>
      </div>

      <!-- Skill Chains (工作流) -->
      <div v-if="activeTab === 'chains'">
        <div
          v-if="skillChains.length === 0"
          class="text-center py-8 text-gray-500 dark:text-gray-400"
        >
          暂无工作流，点击"新建工作流"创建
        </div>

        <div v-else class="space-y-2">
          <div
            v-for="chain in skillChains"
            :key="chain.id"
            class="p-3 rounded border border-gray-200 dark:border-gray-700"
          >
            <div class="flex items-center justify-between">
              <div>
                <span class="text-sm font-medium dark:text-white">{{ chain.name }}</span>
                <p class="text-xs text-gray-500 dark:text-gray-400">{{ chain.description }}</p>
              </div>
              <div class="flex items-center gap-2">
                <a-switch :checked="chain.enabled" size="small" />
                <a-button size="small" danger @click="deleteSkillChain(chain.id)">删除</a-button>
              </div>
            </div>
            <div class="mt-2 flex items-center gap-2 text-xs text-gray-500">
              <span
                v-for="(step, index) in chain.steps"
                :key="index"
                class="flex items-center gap-1"
              >
                <span class="px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700">
                  {{
                    allSelectableSkills.find(s => s.value === step.skillId)?.label || step.skillId
                  }}
                </span>
                <span v-if="index < chain.steps.length - 1">→</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- 统计 -->
      <div v-if="activeTab === 'stats'">
        <div
          v-if="Object.keys(skillStats).length === 0"
          class="text-center py-8 text-gray-500 dark:text-gray-400"
        >
          暂无使用统计
        </div>

        <div v-else class="space-y-2">
          <div
            class="grid grid-cols-4 gap-4 text-xs font-medium text-gray-500 dark:text-gray-400 pb-2 border-b dark:border-gray-700"
          >
            <span>Skill</span>
            <span>调用次数</span>
            <span>成功率</span>
            <span>平均耗时</span>
          </div>
          <div
            v-for="(stats, skillId) in skillStats"
            :key="skillId"
            class="grid grid-cols-4 gap-4 text-sm py-2 border-b border-gray-100 dark:border-gray-700"
          >
            <span class="dark:text-white truncate">
              {{ skills.find(s => s.id === skillId)?.name || skillId }}
            </span>
            <span class="text-gray-600 dark:text-gray-300">{{ stats.totalCalls }}</span>
            <span
              :class="
                stats.successCalls / stats.totalCalls > 0.8 ? 'text-green-600' : 'text-yellow-600'
              "
            >
              {{ ((stats.successCalls / stats.totalCalls) * 100).toFixed(1) }}%
            </span>
            <span class="text-gray-600 dark:text-gray-300">
              {{ formatDuration(stats.avgDuration) }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- 从 skills.sh 导入 Skill Modal -->
    <a-modal
      v-model:open="showImportSkillModal"
      title="从 skills.sh 导入 Skill"
      :confirm-loading="importingSkill"
      @ok="importFromSkillsSh"
    >
      <div class="space-y-3">
        <a-input
          v-model:value="skillsShInput"
          placeholder="https://skills.sh/owner/repo/skill"
          @press-enter="importFromSkillsSh"
        />
        <p class="text-xs text-gray-500 dark:text-gray-400">
          也支持 `owner/repo/skill` 或 `owner/repo@skill`
        </p>
      </div>
    </a-modal>

    <!-- 新建自定义 Skill Modal -->
    <a-modal v-model:open="showCustomSkillModal" title="新建自定义 Skill" @ok="createCustomSkill">
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium dark:text-white mb-1">名称</label>
          <a-input v-model:value="newCustomSkill.name" placeholder="Skill 名称" />
        </div>
        <div>
          <label class="block text-sm font-medium dark:text-white mb-1">描述</label>
          <a-input v-model:value="newCustomSkill.description" placeholder="Skill 描述" />
        </div>
        <div>
          <label class="block text-sm font-medium dark:text-white mb-1">类别</label>
          <a-select
            v-model:value="newCustomSkill.category"
            :options="categoryOptions"
            class="w-full"
          />
        </div>
        <div>
          <label class="block text-sm font-medium dark:text-white mb-1">提示词模板</label>
          <a-textarea
            v-model:value="newCustomSkill.promptTemplate"
            :rows="3"
            placeholder="自定义提示词模板，使用 {{input}} 作为用户输入占位符"
          />
        </div>
        <div>
          <label class="block text-sm font-medium dark:text-white mb-1">标签</label>
          <a-input v-model:value="newCustomSkill.tags" placeholder="用逗号分隔的标签" />
        </div>
      </div>
    </a-modal>

    <!-- 新建工作流 Modal -->
    <a-modal v-model:open="showChainModal" title="新建工作流" width="600px" @ok="createSkillChain">
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium dark:text-white mb-1">名称</label>
          <a-input v-model:value="newChain.name" placeholder="工作流名称" />
        </div>
        <div>
          <label class="block text-sm font-medium dark:text-white mb-1">描述</label>
          <a-input v-model:value="newChain.description" placeholder="工作流描述" />
        </div>
        <div>
          <label class="block text-sm font-medium dark:text-white mb-1">步骤</label>
          <div class="space-y-2">
            <div
              v-for="(step, index) in newChain.steps"
              :key="index"
              class="flex items-center gap-2"
            >
              <span class="text-sm text-gray-500 w-6">{{ index + 1 }}.</span>
              <a-select
                v-model:value="step.skillId"
                :options="allSelectableSkills"
                placeholder="选择 Skill"
                class="flex-1"
              />
              <a-input v-model:value="step.staticArgs" placeholder="参数 (JSON)" class="w-32" />
              <a-button size="small" danger @click="removeChainStep(index)">删除</a-button>
            </div>
          </div>
          <a-button type="dashed" block class="mt-2" @click="addChainStep">添加步骤</a-button>
        </div>
      </div>
    </a-modal>

    <!-- Skill 统计 Modal -->
    <a-modal
      v-model:open="showStatsModal"
      :title="`${selectedSkillForStats?.name} 统计`"
      :footer="null"
    >
      <div v-if="selectedSkillForStats" class="space-y-4">
        <div class="grid grid-cols-2 gap-4">
          <div class="p-3 rounded bg-gray-50 dark:bg-gray-700">
            <div class="text-2xl font-bold dark:text-white">
              {{ getStats(selectedSkillForStats.id)?.totalCalls || 0 }}
            </div>
            <div class="text-xs text-gray-500 dark:text-gray-400">总调用次数</div>
          </div>
          <div class="p-3 rounded bg-gray-50 dark:bg-gray-700">
            <div class="text-2xl font-bold text-green-600">
              {{ getStats(selectedSkillForStats.id)?.successCalls || 0 }}
            </div>
            <div class="text-xs text-gray-500 dark:text-gray-400">成功次数</div>
          </div>
          <div class="p-3 rounded bg-gray-50 dark:bg-gray-700">
            <div class="text-2xl font-bold text-red-600">
              {{ getStats(selectedSkillForStats.id)?.failedCalls || 0 }}
            </div>
            <div class="text-xs text-gray-500 dark:text-gray-400">失败次数</div>
          </div>
          <div class="p-3 rounded bg-gray-50 dark:bg-gray-700">
            <div class="text-2xl font-bold dark:text-white">
              {{ formatDuration(getStats(selectedSkillForStats.id)?.avgDuration || 0) }}
            </div>
            <div class="text-xs text-gray-500 dark:text-gray-400">平均耗时</div>
          </div>
        </div>
        <div
          v-if="getStats(selectedSkillForStats.id)?.lastUsed"
          class="text-xs text-gray-500 dark:text-gray-400"
        >
          最后使用：{{ new Date(getStats(selectedSkillForStats.id)!.lastUsed!).toLocaleString() }}
        </div>
      </div>
    </a-modal>

    <!-- Skill 预设 Modal -->
    <a-modal
      v-model:open="showPresetsModal"
      :title="`${selectedSkillForPresets?.name} 预设`"
      :footer="null"
      width="500px"
    >
      <div v-if="selectedSkillForPresets" class="space-y-4">
        <!-- 现有预设 -->
        <div v-if="skillPresets.length > 0" class="space-y-2">
          <div
            v-for="preset in skillPresets"
            :key="preset.id"
            class="flex items-center justify-between p-2 rounded border border-gray-200 dark:border-gray-700"
          >
            <div>
              <div class="text-sm font-medium dark:text-white">{{ preset.name }}</div>
              <div v-if="preset.description" class="text-xs text-gray-500">
                {{ preset.description }}
              </div>
              <code class="text-xs text-gray-400">{{ JSON.stringify(preset.args) }}</code>
            </div>
            <a-button size="small" danger @click="deleteSkillPreset(preset.id)">删除</a-button>
          </div>
        </div>

        <div v-else class="text-center py-4 text-gray-500 dark:text-gray-400 text-sm">暂无预设</div>

        <!-- 添加新预设 -->
        <div class="border-t dark:border-gray-700 pt-4">
          <div class="text-sm font-medium dark:text-white mb-2">添加新预设</div>
          <div class="space-y-2">
            <a-input v-model:value="newPreset.name" placeholder="预设名称" />
            <a-input v-model:value="newPreset.description" placeholder="描述（可选）" />
            <a-textarea
              v-model:value="newPreset.args"
              :rows="2"
              placeholder='参数 JSON，如 {"query": "最新新闻"}'
            />
            <a-button type="primary" block @click="createSkillPreset">添加预设</a-button>
          </div>
        </div>
      </div>
    </a-modal>
  </div>
</template>
