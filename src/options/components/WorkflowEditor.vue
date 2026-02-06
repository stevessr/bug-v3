<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  PlayCircleOutlined,
  SaveOutlined,
  ArrowDownOutlined,
  ThunderboltOutlined
} from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'
import { nanoid } from 'nanoid'

import type { SkillChain, SkillChainStep, Skill } from '@/agent/skills'

// Props
const props = defineProps<{
  chain?: SkillChain
  skills: Skill[]
  mode?: 'create' | 'edit'
}>()

// Emits
const emit = defineEmits<{
  save: [chain: SkillChain]
  cancel: []
  test: [chain: SkillChain]
}>()

// 编辑状态
const chainName = ref('')
const chainDescription = ref('')
const steps = ref<SkillChainStep[]>([])
const enabled = ref(true)

// 当前编辑的步骤
const editingStepIndex = ref<number | null>(null)
const editingStep = ref<SkillChainStep | null>(null)

// 初始化
onMounted(() => {
  if (props.chain) {
    chainName.value = props.chain.name
    chainDescription.value = props.chain.description
    steps.value = [...props.chain.steps]
    enabled.value = props.chain.enabled
  }
})

// 获取 Skill 信息
const getSkillById = (skillId: string): Skill | undefined => {
  return props.skills.find(s => s.id === skillId)
}

// 添加步骤
const addStep = (skillId?: string) => {
  const newStep: SkillChainStep = {
    skillId: skillId || '',
    staticArgs: {},
    argMapping: {}
  }
  steps.value.push(newStep)
  // 自动打开编辑
  editingStepIndex.value = steps.value.length - 1
  editingStep.value = { ...newStep }
}

// 删除步骤
const removeStep = (index: number) => {
  steps.value.splice(index, 1)
  if (editingStepIndex.value === index) {
    editingStepIndex.value = null
    editingStep.value = null
  }
}

// 开始编辑步骤
const startEditStep = (index: number) => {
  editingStepIndex.value = index
  editingStep.value = { ...steps.value[index] }
}

// 保存步骤编辑
const saveStepEdit = () => {
  if (editingStepIndex.value !== null && editingStep.value) {
    steps.value[editingStepIndex.value] = { ...editingStep.value }
  }
  editingStepIndex.value = null
  editingStep.value = null
}

// 取消步骤编辑
const cancelStepEdit = () => {
  editingStepIndex.value = null
  editingStep.value = null
}

// 移动步骤
const moveStep = (index: number, direction: 'up' | 'down') => {
  const newIndex = direction === 'up' ? index - 1 : index + 1
  if (newIndex < 0 || newIndex >= steps.value.length) return

  const temp = steps.value[index]
  steps.value[index] = steps.value[newIndex]
  steps.value[newIndex] = temp
}

// 验证
const isValid = computed(() => {
  if (!chainName.value.trim()) return false
  if (steps.value.length === 0) return false
  return steps.value.every(step => step.skillId)
})

// 保存
const save = () => {
  if (!isValid.value) {
    message.warning('请填写完整信息')
    return
  }

  const chain: SkillChain = {
    id: props.chain?.id || `chain-${nanoid()}`,
    name: chainName.value.trim(),
    description: chainDescription.value.trim(),
    steps: steps.value,
    enabled: enabled.value
  }

  emit('save', chain)
}

// 测试运行
const testRun = () => {
  if (!isValid.value) {
    message.warning('请先完成工作流配置')
    return
  }

  const chain: SkillChain = {
    id: props.chain?.id || `chain-test-${nanoid()}`,
    name: chainName.value.trim(),
    description: chainDescription.value.trim(),
    steps: steps.value,
    enabled: true
  }

  emit('test', chain)
}

// 获取 Skill 的参数 Schema
const getSkillInputSchema = (skillId: string) => {
  const skill = getSkillById(skillId)
  return skill?.inputSchema?.properties || {}
}

// 参数来源选项
const argSourceOptions = computed(() => {
  const options = [
    { value: '$previous', label: '上一步结果' },
    { value: '$userInput', label: '用户输入' }
  ]

  // 添加之前步骤的结果
  steps.value.forEach((step, index) => {
    if (editingStepIndex.value !== null && index < editingStepIndex.value) {
      const skill = getSkillById(step.skillId)
      if (skill) {
        options.push({
          value: `$state.${step.skillId}`,
          label: `步骤 ${index + 1}: ${skill.name} 的结果`
        })
      }
    }
  })

  return options
})
</script>

<template>
  <div class="workflow-editor">
    <!-- 基本信息 -->
    <div class="mb-6 p-4 bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700">
      <h3 class="text-lg font-semibold mb-4 dark:text-white">
        {{ mode === 'edit' ? '编辑工作流' : '创建工作流' }}
      </h3>

      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium mb-1 dark:text-gray-300">工作流名称</label>
          <a-input v-model:value="chainName" placeholder="输入工作流名称" :maxlength="50" />
        </div>

        <div>
          <label class="block text-sm font-medium mb-1 dark:text-gray-300">描述</label>
          <a-textarea
            v-model:value="chainDescription"
            placeholder="描述这个工作流的用途"
            :rows="2"
            :maxlength="200"
          />
        </div>

        <div>
          <a-checkbox v-model:checked="enabled">启用工作流</a-checkbox>
        </div>
      </div>
    </div>

    <!-- 步骤列表 -->
    <div class="mb-6">
      <div class="flex items-center justify-between mb-4">
        <h4 class="text-md font-medium dark:text-white">工作流步骤</h4>
        <a-button type="primary" size="small" @click="addStep()">
          <template #icon><PlusOutlined /></template>
          添加步骤
        </a-button>
      </div>

      <div
        v-if="steps.length === 0"
        class="text-center py-8 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
      >
        <ThunderboltOutlined class="text-3xl mb-2" />
        <p>暂无步骤，点击上方按钮添加</p>
      </div>

      <div v-else class="space-y-3">
        <div v-for="(step, index) in steps" :key="index" class="relative">
          <!-- 连接线 -->
          <div v-if="index > 0" class="absolute left-1/2 -top-3 transform -translate-x-1/2">
            <ArrowDownOutlined class="text-gray-400" />
          </div>

          <!-- 步骤卡片 -->
          <div
            class="p-4 bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 transition-all"
            :class="{
              'ring-2 ring-blue-500': editingStepIndex === index,
              'hover:border-blue-400': editingStepIndex !== index
            }"
          >
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <span
                  class="w-6 h-6 flex items-center justify-center bg-blue-500 text-white text-sm rounded-full"
                >
                  {{ index + 1 }}
                </span>

                <div v-if="step.skillId">
                  <span class="font-medium dark:text-white">
                    {{ getSkillById(step.skillId)?.icon }}
                    {{ getSkillById(step.skillId)?.name || step.skillId }}
                  </span>
                  <p class="text-xs text-gray-500 dark:text-gray-400">
                    {{ getSkillById(step.skillId)?.description }}
                  </p>
                </div>
                <span v-else class="text-gray-400">未选择 Skill</span>
              </div>

              <div class="flex items-center gap-1">
                <a-button
                  size="small"
                  type="text"
                  @click="moveStep(index, 'up')"
                  :disabled="index === 0"
                >
                  ↑
                </a-button>
                <a-button
                  size="small"
                  type="text"
                  @click="moveStep(index, 'down')"
                  :disabled="index === steps.length - 1"
                >
                  ↓
                </a-button>
                <a-button size="small" type="text" @click="startEditStep(index)">
                  <template #icon><EditOutlined /></template>
                </a-button>
                <a-button size="small" type="text" danger @click="removeStep(index)">
                  <template #icon><DeleteOutlined /></template>
                </a-button>
              </div>
            </div>

            <!-- 条件显示 -->
            <div v-if="step.condition" class="mt-2 text-xs text-gray-500 dark:text-gray-400">
              条件: {{ step.condition.field }} {{ step.condition.operator }}
              {{ step.condition.value }}
            </div>

            <!-- 参数映射显示 -->
            <div v-if="step.argMapping && Object.keys(step.argMapping).length > 0" class="mt-2">
              <div class="flex flex-wrap gap-1">
                <span
                  v-for="(source, target) in step.argMapping"
                  :key="target"
                  class="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs rounded"
                >
                  {{ target }} ← {{ source }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 步骤编辑弹窗 -->
    <a-modal
      :open="editingStepIndex !== null"
      title="编辑步骤"
      @ok="saveStepEdit"
      @cancel="cancelStepEdit"
      width="600px"
    >
      <div v-if="editingStep" class="space-y-4">
        <!-- Skill 选择 -->
        <div>
          <label class="block text-sm font-medium mb-1">选择 Skill</label>
          <a-select
            v-model:value="editingStep.skillId"
            placeholder="选择一个 Skill"
            class="w-full"
            show-search
            :filter-option="
              (input: string, option: any) =>
                option.label?.toLowerCase().includes(input.toLowerCase())
            "
          >
            <a-select-opt-group
              v-for="category in [
                'search',
                'knowledge',
                'code',
                'web',
                'data',
                'automation',
                'other'
              ]"
              :key="category"
              :label="
                {
                  search: '搜索',
                  knowledge: '知识',
                  code: '代码',
                  web: '网页',
                  data: '数据',
                  automation: '自动化',
                  other: '其他'
                }[category]
              "
            >
              <a-select-option
                v-for="skill in skills.filter(s => s.category === category && s.enabled)"
                :key="skill.id"
                :value="skill.id"
                :label="skill.name"
              >
                {{ skill.icon }} {{ skill.name }}
              </a-select-option>
            </a-select-opt-group>
          </a-select>
        </div>

        <!-- 静态参数 -->
        <div v-if="editingStep.skillId">
          <label class="block text-sm font-medium mb-2">静态参数</label>
          <div class="space-y-2">
            <div
              v-for="(schema, paramName) in getSkillInputSchema(editingStep.skillId)"
              :key="paramName"
              class="flex items-center gap-2"
            >
              <span class="w-24 text-sm text-gray-600 dark:text-gray-400">{{ paramName }}:</span>
              <a-input
                v-model:value="(editingStep.staticArgs as any)[paramName]"
                :placeholder="(schema as any).description || paramName"
                class="flex-1"
              />
            </div>
          </div>
        </div>

        <!-- 参数映射 -->
        <div v-if="editingStep.skillId && editingStepIndex !== null && editingStepIndex > 0">
          <label class="block text-sm font-medium mb-2">参数映射（从上一步获取）</label>
          <div class="space-y-2">
            <div
              v-for="(_schema, paramName) in getSkillInputSchema(editingStep.skillId)"
              :key="paramName"
              class="flex items-center gap-2"
            >
              <span class="w-24 text-sm text-gray-600 dark:text-gray-400">{{ paramName }}:</span>
              <a-select
                v-model:value="(editingStep.argMapping as any)[paramName]"
                placeholder="选择来源"
                class="flex-1"
                allow-clear
              >
                <a-select-option
                  v-for="opt in argSourceOptions"
                  :key="opt.value"
                  :value="opt.value"
                >
                  {{ opt.label }}
                </a-select-option>
              </a-select>
            </div>
          </div>
        </div>

        <!-- 条件执行 -->
        <div>
          <a-collapse>
            <a-collapse-panel key="condition" header="条件执行（可选）">
              <div class="space-y-2">
                <div class="flex items-center gap-2">
                  <a-input
                    v-model:value="((editingStep.condition as any) || {}).field"
                    placeholder="字段名"
                    class="flex-1"
                  />
                  <a-select
                    v-model:value="((editingStep.condition as any) || {}).operator"
                    placeholder="条件"
                    class="w-32"
                  >
                    <a-select-option value="eq">等于</a-select-option>
                    <a-select-option value="neq">不等于</a-select-option>
                    <a-select-option value="contains">包含</a-select-option>
                    <a-select-option value="exists">存在</a-select-option>
                  </a-select>
                  <a-input
                    v-model:value="((editingStep.condition as any) || {}).value"
                    placeholder="值"
                    class="flex-1"
                  />
                </div>
                <p class="text-xs text-gray-500">只有当条件满足时才执行此步骤</p>
              </div>
            </a-collapse-panel>
          </a-collapse>
        </div>
      </div>
    </a-modal>

    <!-- 底部操作栏 -->
    <div class="flex items-center justify-between pt-4 border-t dark:border-gray-700">
      <a-button @click="emit('cancel')">取消</a-button>
      <div class="flex items-center gap-2">
        <a-button @click="testRun" :disabled="!isValid">
          <template #icon><PlayCircleOutlined /></template>
          测试运行
        </a-button>
        <a-button type="primary" @click="save" :disabled="!isValid">
          <template #icon><SaveOutlined /></template>
          保存工作流
        </a-button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.workflow-editor {
  max-width: 800px;
  margin: 0 auto;
}
</style>
