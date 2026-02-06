<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'

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
  type Skill,
  type BuiltinMcpServer
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
        <p class="text-xs text-gray-500 dark:text-gray-400">
          配置内置 MCP 服务所需的 API Keys
        </p>
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
              :checked="builtinMcpEnabled[server.id]"
              :disabled="server.requiresApiKey && !isMcpAvailable(server)"
              @change="value => toggleBuiltinMcp(server.id, value as boolean)"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Skills 列表 -->
    <div class="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-4 space-y-4">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-base font-medium dark:text-white">Skills</h3>
          <p class="text-xs text-gray-500 dark:text-gray-400">
            基于 MCP 工具自动生成的技能，可单独开关
          </p>
        </div>
        <a-button size="small" :loading="skillsLoading" @click="refreshSkills">
          刷新 Skills
        </a-button>
      </div>

      <div v-if="skillsLoading" class="text-center py-8 text-gray-500 dark:text-gray-400">
        正在发现可用 Skills...
      </div>

      <div v-else-if="skills.length === 0" class="text-center py-8 text-gray-500 dark:text-gray-400">
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
              <div class="flex items-center gap-2">
                <span v-if="skill.icon" class="text-lg">{{ skill.icon }}</span>
                <div>
                  <span class="text-sm dark:text-white">{{ skill.name }}</span>
                  <span
                    v-if="skill.source === 'mcp'"
                    class="ml-2 text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                  >
                    MCP
                  </span>
                  <p class="text-xs text-gray-500 dark:text-gray-400">{{ skill.description }}</p>
                </div>
              </div>
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
</template>
