<script setup lang="ts">
import { ref, onMounted } from 'vue'
import {
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  PlayCircleOutlined,
  ThunderboltOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
  CodeOutlined,
  FileAddOutlined
} from '@ant-design/icons-vue'
import { message, Modal } from 'ant-design-vue'

import WorkflowEditor from '../components/WorkflowEditor.vue'

import {
  loadSkillChains,
  addSkillChain,
  updateSkillChain,
  removeSkillChain,
  executeSkillChain,
  discoverAllSkills,
  loadCustomSkills,
  addCustomSkill,
  removeCustomSkill
} from '@/agent/skills'
import { SCRIPT_TEMPLATES, validateScript } from '@/agent/scriptRunner'
import type { SkillChain, Skill, CustomSkill, SkillChainStep } from '@/agent/skills'

// 状态
const chains = ref<SkillChain[]>([])
const skills = ref<Skill[]>([])
const customSkills = ref<CustomSkill[]>([])
const loading = ref(false)

// 编辑状态
const showEditor = ref(false)
const editingChain = ref<SkillChain | null>(null)
const editorMode = ref<'create' | 'edit'>('create')

// 测试运行状态
const testingChainId = ref<string | null>(null)
const testResults = ref<Record<string, { success: boolean; result?: unknown; error?: string }>>({})

// 脚本编辑器状态
const showScriptEditor = ref(false)
const scriptName = ref('')
const scriptDescription = ref('')
const scriptContent = ref('')
const scriptCategory = ref<'web' | 'data' | 'automation' | 'other'>('automation')
const editingScriptId = ref<string | null>(null)

// 加载数据
const loadData = async () => {
  loading.value = true
  try {
    chains.value = loadSkillChains()
    customSkills.value = loadCustomSkills()
    skills.value = await discoverAllSkills()
  } catch (error) {
    console.error('Failed to load data:', error)
    message.error('加载数据失败')
  } finally {
    loading.value = false
  }
}

onMounted(loadData)

// 创建工作流
const createChain = () => {
  editingChain.value = null
  editorMode.value = 'create'
  showEditor.value = true
}

// 编辑工作流
const editChain = (chain: SkillChain) => {
  editingChain.value = chain
  editorMode.value = 'edit'
  showEditor.value = true
}

// 保存工作流
const handleSaveChain = (chain: SkillChain) => {
  if (editorMode.value === 'edit') {
    updateSkillChain(chain.id, chain)
    message.success('工作流已更新')
  } else {
    addSkillChain(chain)
    message.success('工作流已创建')
  }
  chains.value = loadSkillChains()
  showEditor.value = false
}

// 删除工作流
const deleteChain = (chain: SkillChain) => {
  Modal.confirm({
    title: '确认删除',
    content: `确定要删除工作流 "${chain.name}" 吗？`,
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    onOk() {
      removeSkillChain(chain.id)
      chains.value = loadSkillChains()
      message.success('工作流已删除')
    }
  })
}

// 测试运行工作流
const testChain = async (chain: SkillChain) => {
  testingChainId.value = chain.id
  testResults.value[chain.id] = { success: false }

  try {
    const result = await executeSkillChain(chain, {}, skills.value)
    testResults.value[chain.id] = {
      success: result.success,
      result: result.result,
      error: result.error
    }
    if (result.success) {
      message.success('工作流执行成功')
    } else {
      message.error('工作流执行失败: ' + result.error)
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    testResults.value[chain.id] = { success: false, error: errorMsg }
    message.error('工作流执行出错: ' + errorMsg)
  } finally {
    testingChainId.value = null
  }
}

// ============ 脚本 Skill 管理 ============

const openScriptEditor = (script?: CustomSkill) => {
  if (script) {
    editingScriptId.value = script.id
    scriptName.value = script.name
    scriptDescription.value = script.description
    scriptContent.value = script.script || ''
    scriptCategory.value = script.category as any
  } else {
    editingScriptId.value = null
    scriptName.value = ''
    scriptDescription.value = ''
    scriptContent.value = SCRIPT_TEMPLATES.simple
    scriptCategory.value = 'automation'
  }
  showScriptEditor.value = true
}

const saveScript = () => {
  if (!scriptName.value.trim()) {
    message.warning('请输入脚本名称')
    return
  }

  const validation = validateScript(scriptContent.value)
  if (!validation.valid) {
    message.error('脚本语法错误: ' + validation.error)
    return
  }

  if (editingScriptId.value) {
    // 更新现有脚本
    const existing = customSkills.value.find(s => s.id === editingScriptId.value)
    if (existing) {
      const updated: CustomSkill = {
        ...existing,
        name: scriptName.value.trim(),
        description: scriptDescription.value.trim(),
        script: scriptContent.value,
        category: scriptCategory.value,
        updatedAt: Date.now()
      }
      const allCustom = customSkills.value.map(s => (s.id === editingScriptId.value ? updated : s))
      import('@/agent/skills')
        .then(mod => {
          mod.saveCustomSkills(allCustom)
          customSkills.value = mod.loadCustomSkills()
          message.success('脚本已更新')
        })
        .catch(err => {
          message.error('保存失败: ' + (err instanceof Error ? err.message : String(err)))
        })
    }
  } else {
    // 创建新脚本
    addCustomSkill({
      name: scriptName.value.trim(),
      description: scriptDescription.value.trim() || '自定义脚本 Skill',
      category: scriptCategory.value,
      source: 'custom',
      enabled: true,
      script: scriptContent.value
    })
    customSkills.value = loadCustomSkills()
    message.success('脚本已创建')
  }

  showScriptEditor.value = false
}

const deleteScript = (script: CustomSkill) => {
  Modal.confirm({
    title: '确认删除',
    content: `确定要删除脚本 "${script.name}" 吗？`,
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    onOk() {
      removeCustomSkill(script.id)
      customSkills.value = loadCustomSkills()
      message.success('脚本已删除')
    }
  })
}

const insertTemplate = (templateKey: keyof typeof SCRIPT_TEMPLATES) => {
  scriptContent.value = SCRIPT_TEMPLATES[templateKey]
}

// 内置工作流模板
const builtinTemplates: Array<{ name: string; description: string; steps: SkillChainStep[] }> = [
  {
    name: '搜索并总结',
    description: '搜索网页内容并生成摘要',
    steps: [
      { skillId: 'skill-web-search', staticArgs: {}, argMapping: {} },
      { skillId: 'skill-summarize', staticArgs: {}, argMapping: { content: '$previous' } }
    ]
  },
  {
    name: 'GitHub 仓库探索',
    description: '获取仓库文档并提问',
    steps: [
      { skillId: 'skill-github-docs', staticArgs: {}, argMapping: {} },
      {
        skillId: 'skill-ask-repo',
        staticArgs: {},
        argMapping: { repoName: '$state.skill-github-docs' }
      }
    ]
  },
  {
    name: '网页内容提取',
    description: '抓取网页并提取关键内容',
    steps: [
      { skillId: 'skill-extract-content', staticArgs: {}, argMapping: {} },
      {
        skillId: 'skill-summarize',
        staticArgs: { format: 'bullets' },
        argMapping: { content: '$previous' }
      }
    ]
  }
]

const createFromTemplate = (template: (typeof builtinTemplates)[0]) => {
  const chain: SkillChain = {
    id: '',
    name: template.name,
    description: template.description,
    steps: template.steps,
    enabled: true
  }
  editingChain.value = chain
  editorMode.value = 'create'
  showEditor.value = true
}
</script>

<template>
  <div class="workflow-page p-6">
    <div class="max-w-6xl mx-auto">
      <!-- 页面标题 -->
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-2xl font-bold dark:text-white">工作流管理</h1>
          <p class="text-gray-500 dark:text-gray-400 mt-1">
            创建和管理 Skill 工作流，实现自动化任务链
          </p>
        </div>
        <div class="flex gap-2">
          <a-button @click="openScriptEditor()">
            <template #icon><CodeOutlined /></template>
            新建脚本
          </a-button>
          <a-button type="primary" @click="createChain">
            <template #icon><PlusOutlined /></template>
            新建工作流
          </a-button>
        </div>
      </div>

      <!-- 编辑器视图 -->
      <div v-if="showEditor" class="mb-8">
        <WorkflowEditor
          :chain="editingChain || undefined"
          :skills="skills"
          :mode="editorMode"
          @save="handleSaveChain"
          @cancel="showEditor = false"
          @test="testChain"
        />
      </div>

      <!-- 主内容区域 -->
      <div v-else>
        <!-- 模板区域 -->
        <div class="mb-8">
          <h2 class="text-lg font-semibold mb-4 dark:text-white">快速开始</h2>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div
              v-for="template in builtinTemplates"
              :key="template.name"
              class="p-4 bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 hover:border-blue-400 cursor-pointer transition-all"
              @click="createFromTemplate(template)"
            >
              <div class="flex items-center gap-2 mb-2">
                <FileAddOutlined class="text-blue-500" />
                <span class="font-medium dark:text-white">{{ template.name }}</span>
              </div>
              <p class="text-sm text-gray-500 dark:text-gray-400">{{ template.description }}</p>
              <p class="text-xs text-gray-400 mt-2">{{ template.steps.length }} 个步骤</p>
            </div>
          </div>
        </div>

        <!-- 工作流列表 -->
        <div class="mb-8">
          <h2 class="text-lg font-semibold mb-4 dark:text-white">我的工作流</h2>

          <div v-if="loading" class="text-center py-8">
            <LoadingOutlined class="text-2xl text-blue-500" />
            <p class="text-gray-500 mt-2">加载中...</p>
          </div>

          <div
            v-else-if="chains.length === 0"
            class="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-lg"
          >
            <ThunderboltOutlined class="text-4xl text-gray-400 mb-2" />
            <p class="text-gray-500 dark:text-gray-400">暂无工作流</p>
            <p class="text-sm text-gray-400 mt-1">点击上方按钮创建您的第一个工作流</p>
          </div>

          <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div
              v-for="chain in chains"
              :key="chain.id"
              class="p-4 bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700"
            >
              <div class="flex items-center justify-between mb-2">
                <div class="flex items-center gap-2">
                  <ThunderboltOutlined :class="chain.enabled ? 'text-blue-500' : 'text-gray-400'" />
                  <span class="font-medium dark:text-white">{{ chain.name }}</span>
                  <a-tag v-if="!chain.enabled" color="default">已禁用</a-tag>
                </div>
                <div class="flex items-center gap-1">
                  <a-button
                    size="small"
                    type="text"
                    :loading="testingChainId === chain.id"
                    @click="testChain(chain)"
                  >
                    <template #icon><PlayCircleOutlined /></template>
                  </a-button>
                  <a-button size="small" type="text" @click="editChain(chain)">
                    <template #icon><EditOutlined /></template>
                  </a-button>
                  <a-button size="small" type="text" danger @click="deleteChain(chain)">
                    <template #icon><DeleteOutlined /></template>
                  </a-button>
                </div>
              </div>

              <p class="text-sm text-gray-500 dark:text-gray-400 mb-2">{{ chain.description }}</p>

              <div class="flex items-center gap-2 text-xs text-gray-400">
                <span>{{ chain.steps.length }} 个步骤</span>
                <span v-if="testResults[chain.id]">
                  <CheckCircleOutlined
                    v-if="testResults[chain.id].success"
                    class="text-green-500"
                  />
                  <CloseCircleOutlined v-else class="text-red-500" />
                </span>
              </div>

              <!-- 步骤预览 -->
              <div class="mt-3 flex flex-wrap gap-1">
                <span
                  v-for="(step, index) in chain.steps.slice(0, 3)"
                  :key="index"
                  class="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-xs rounded"
                >
                  {{ skills.find(s => s.id === step.skillId)?.name || step.skillId }}
                </span>
                <span v-if="chain.steps.length > 3" class="px-2 py-0.5 text-xs text-gray-400">
                  +{{ chain.steps.length - 3 }} 更多
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- 自定义脚本列表 -->
        <div>
          <h2 class="text-lg font-semibold mb-4 dark:text-white">自定义脚本</h2>

          <div
            v-if="customSkills.length === 0"
            class="text-center py-8 bg-gray-50 dark:bg-gray-800/50 rounded-lg"
          >
            <CodeOutlined class="text-4xl text-gray-400 mb-2" />
            <p class="text-gray-500 dark:text-gray-400">暂无自定义脚本</p>
          </div>

          <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div
              v-for="script in customSkills"
              :key="script.id"
              class="p-4 bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700"
            >
              <div class="flex items-center justify-between mb-2">
                <span class="font-medium dark:text-white">{{ script.name }}</span>
                <div class="flex items-center gap-1">
                  <a-button size="small" type="text" @click="openScriptEditor(script)">
                    <template #icon><EditOutlined /></template>
                  </a-button>
                  <a-button size="small" type="text" danger @click="deleteScript(script)">
                    <template #icon><DeleteOutlined /></template>
                  </a-button>
                </div>
              </div>
              <p class="text-sm text-gray-500 dark:text-gray-400">{{ script.description }}</p>
              <div class="mt-2 text-xs text-gray-400">
                创建于 {{ new Date(script.createdAt).toLocaleDateString() }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 脚本编辑器弹窗 -->
      <a-modal
        v-model:open="showScriptEditor"
        :title="editingScriptId ? '编辑脚本' : '新建脚本'"
        width="800px"
        :footer="null"
      >
        <div class="space-y-4 py-4">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium mb-1">脚本名称</label>
              <a-input v-model:value="scriptName" placeholder="输入脚本名称" />
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">分类</label>
              <a-select v-model:value="scriptCategory" class="w-full">
                <a-select-option value="web">网页</a-select-option>
                <a-select-option value="data">数据</a-select-option>
                <a-select-option value="automation">自动化</a-select-option>
                <a-select-option value="other">其他</a-select-option>
              </a-select>
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium mb-1">描述</label>
            <a-input v-model:value="scriptDescription" placeholder="描述脚本功能" />
          </div>

          <div>
            <div class="flex items-center justify-between mb-1">
              <label class="text-sm font-medium">脚本代码</label>
              <a-dropdown>
                <a-button size="small">插入模板</a-button>
                <template #overlay>
                  <a-menu>
                    <a-menu-item @click="insertTemplate('simple')">简单示例</a-menu-item>
                    <a-menu-item @click="insertTemplate('fetchExample')">网络请求</a-menu-item>
                    <a-menu-item @click="insertTemplate('mcpExample')">MCP 调用</a-menu-item>
                    <a-menu-item @click="insertTemplate('dataProcess')">数据处理</a-menu-item>
                    <a-menu-item @click="insertTemplate('storageExample')">存储操作</a-menu-item>
                    <a-menu-item @click="insertTemplate('chainExample')">链式处理</a-menu-item>
                  </a-menu>
                </template>
              </a-dropdown>
            </div>
            <a-textarea
              v-model:value="scriptContent"
              :rows="15"
              class="font-mono text-sm"
              placeholder="// 在此编写脚本代码..."
            />
          </div>

          <div class="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm">
            <p class="font-medium mb-1">可用 API:</p>
            <ul class="text-gray-600 dark:text-gray-400 space-y-0.5 text-xs">
              <li>
                <code>args</code>
                - 传入的参数对象
              </li>
              <li>
                <code>previousResult</code>
                - 上一步的结果
              </li>
              <li>
                <code>fetch(url, options)</code>
                - 发起网络请求
              </li>
              <li>
                <code>mcp.call(serverId, toolName, args)</code>
                - 调用 MCP 工具
              </li>
              <li>
                <code>storage.get/set/remove(key)</code>
                - 本地存储
              </li>
              <li>
                <code>log(...args)</code>
                - 日志输出
              </li>
              <li>
                <code>delay(ms)</code>
                - 延迟执行
              </li>
            </ul>
          </div>

          <div class="flex justify-end gap-2 pt-2">
            <a-button @click="showScriptEditor = false">取消</a-button>
            <a-button type="primary" @click="saveScript">保存脚本</a-button>
          </div>
        </div>
      </a-modal>
    </div>
  </div>
</template>

<style scoped>
.workflow-page {
  min-height: 100vh;
  background: var(--ant-color-bg-layout);
}
</style>
