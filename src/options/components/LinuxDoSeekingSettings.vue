<script setup lang="ts">
import { ref, computed, isRef, type Ref } from 'vue'
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons-vue'

import type { AppSettings } from '../../types/type'

import SettingSwitch from './SettingSwitch.vue'

const props = defineProps<{ settings: AppSettings | Ref<AppSettings> }>()

const emit = defineEmits([
  'update:enableLinuxDoSeeking',
  'update:linuxDoSeekingUsers',
  'update:enableLinuxDoSeekingDanmaku',
  'update:enableLinuxDoSeekingSysNotify',
  'update:enableLinuxDoSeekingNtfy',
  'update:linuxDoSeekingNtfyTopic',
  'update:linuxDoSeekingNtfyServer',
  'update:linuxDoSeekingRefreshInterval',
  'update:linuxDoSeekingPosition',
  'update:linuxDoSeekingActionFilter'
])

const getSetting = (key: keyof AppSettings, defaultValue: any = false) => {
  try {
    const s = props.settings
    if (isRef(s)) return (s.value && s.value[key]) ?? defaultValue
    return (s && (s as AppSettings)[key]) ?? defaultValue
  } catch {
    return defaultValue
  }
}

// 用户列表
const userList = computed(() => {
  const list = getSetting('linuxDoSeekingUsers', []) as string[]
  return Array.isArray(list) ? list : []
})

// 新用户输入
const newUsername = ref('')

// 添加用户
const addUser = () => {
  const username = newUsername.value.trim()
  if (!username) return

  if (userList.value.includes(username)) {
    newUsername.value = ''
    return
  }

  if (userList.value.length >= 5) {
    // 限制最多 5 个用户
    return
  }

  emit('update:linuxDoSeekingUsers', [...userList.value, username])
  newUsername.value = ''
}

// 移除用户
const removeUser = (username: string) => {
  const newList = userList.value.filter(u => u !== username)
  emit('update:linuxDoSeekingUsers', newList)
}

// 输入框回车添加
const handleEnter = () => {
  addUser()
}
</script>

<template>
  <div class="space-y-6">
    <!-- 功能开关 -->
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700 p-6">
      <SettingSwitch
        :model-value="getSetting('enableLinuxDoSeeking', false)"
        @update:model-value="emit('update:enableLinuxDoSeeking', $event)"
        label="启用 LinuxDo 追觅"
        description="监控 Linux.do 用户活动，在侧边栏显示实时动态（仅在 linux.do 站点生效）"
      />
    </div>

    <!-- 配置区域（仅在启用时显示） -->
    <template v-if="getSetting('enableLinuxDoSeeking', false)">
      <!-- 监控用户列表 -->
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700">
        <div
          class="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center"
        >
          <div>
            <h3 class="text-md font-semibold dark:text-white">监控用户</h3>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              添加要监控的 Linux.do 用户名（最多 5 个）
            </p>
          </div>
        </div>

        <div class="p-6">
          <!-- 添加用户输入框 -->
          <div class="flex gap-2 mb-4">
            <a-input
              v-model:value="newUsername"
              placeholder="输入用户名..."
              @keyup.enter="handleEnter"
              :disabled="userList.length >= 5"
            />
            <a-button
              type="primary"
              @click="addUser"
              :disabled="!newUsername.trim() || userList.length >= 5"
            >
              <template #icon><PlusOutlined /></template>
              添加
            </a-button>
          </div>

          <!-- 用户列表 -->
          <div v-if="userList.length === 0" class="text-center text-gray-500 py-8">
            暂无监控用户，请添加用户名
          </div>
          <div v-else class="space-y-2">
            <div
              v-for="username in userList"
              :key="username"
              class="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            >
              <div class="flex items-center gap-3">
                <span class="font-medium dark:text-white">{{ username }}</span>
              </div>
              <a-button
                type="text"
                danger
                size="small"
                @click="removeUser(username)"
                :icon="h(DeleteOutlined)"
              >
                移除
              </a-button>
            </div>
          </div>

          <div v-if="userList.length >= 10" class="mt-4 text-sm text-amber-600 dark:text-amber-400">
            ⚠️ 已达到最大监控用户数量限制（10 个）
          </div>
        </div>
      </div>

      <!-- 通知设置 -->
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700 p-6">
        <div class="space-y-4">
          <div>
            <h3 class="text-md font-semibold dark:text-white mb-4">通知设置</h3>
          </div>

          <SettingSwitch
            :model-value="getSetting('enableLinuxDoSeekingDanmaku', true)"
            @update:model-value="emit('update:enableLinuxDoSeekingDanmaku', $event)"
            label="弹幕通知"
            description="在页面上显示动态弹幕提醒"
          />

          <SettingSwitch
            :model-value="getSetting('enableLinuxDoSeekingSysNotify', true)"
            @update:model-value="emit('update:enableLinuxDoSeekingSysNotify', $event)"
            label="系统通知"
            description="当页面不在前台时发送系统通知"
          />

          <div class="pt-2 border-t border-gray-200 dark:border-gray-700">
            <SettingSwitch
              :model-value="getSetting('enableLinuxDoSeekingNtfy', false)"
              @update:model-value="emit('update:enableLinuxDoSeekingNtfy', $event)"
              label="ntfy 推送"
              description="将动态推送到 ntfy 主题"
            />

            <div class="mt-3 space-y-3">
              <a-input
                :value="getSetting('linuxDoSeekingNtfyServer', 'https://ntfy.sh')"
                placeholder="ntfy 服务器，例如 https://ntfy.sh"
                @change="emit('update:linuxDoSeekingNtfyServer', $event.target.value)"
              />
              <a-input
                :value="getSetting('linuxDoSeekingNtfyTopic', '')"
                placeholder="ntfy 主题，例如 linuxdo-seeking"
                @change="emit('update:linuxDoSeekingNtfyTopic', $event.target.value)"
              />
              <div class="text-xs text-gray-500 dark:text-gray-400">
                仅 Leader 标签页会发送 ntfy 推送，避免多标签重复
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- UI 设置 -->
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700 p-6">
        <div class="space-y-4">
          <div>
            <h3 class="text-md font-semibold dark:text-white mb-4">UI 设置</h3>
          </div>

          <div>
            <div class="text-sm text-gray-600 dark:text-gray-400 mb-2">轮询间隔</div>
            <div class="flex items-center gap-2">
              <a-input-number
                :value="getSetting('linuxDoSeekingRefreshIntervalMs', 60000)"
                :min="10000"
                :max="300000"
                :step="5000"
                class="w-32"
                :formatter="(value: string | number) => `${Math.round(Number(value) / 1000)}s`"
                :parser="(value: string) => Number(value.replace('s', '')) * 1000"
                @change="emit('update:linuxDoSeekingRefreshInterval', $event)"
              />
              <span class="text-xs text-gray-500 dark:text-gray-400">最小 10 秒</span>
            </div>
          </div>

          <div>
            <div class="text-sm text-gray-600 dark:text-gray-400 mb-2">侧边栏吸附位置</div>
            <a-radio-group
              :value="getSetting('linuxDoSeekingPosition', 'left')"
              @change="emit('update:linuxDoSeekingPosition', $event.target.value)"
              button-style="solid"
            >
              <a-radio-button value="left">左</a-radio-button>
              <a-radio-button value="right">右</a-radio-button>
              <a-radio-button value="top">上</a-radio-button>
              <a-radio-button value="bottom">下</a-radio-button>
            </a-radio-group>
          </div>

          <div>
            <div class="text-sm text-gray-600 dark:text-gray-400 mb-2">动态过滤</div>
            <a-radio-group
              :value="getSetting('linuxDoSeekingActionFilter', '1,5')"
              @change="emit('update:linuxDoSeekingActionFilter', $event.target.value)"
              button-style="solid"
            >
              <a-radio-button value="5">回复 (5)</a-radio-button>
              <a-radio-button value="4">点赞 (4)</a-radio-button>
              <a-radio-button value="1">互动 (1)</a-radio-button>
              <a-radio-button value="1,5">互动 + 回复 (1,5)</a-radio-button>
              <a-radio-button value="1,4,5">互动 + 点赞 + 回复 (1,4,5)</a-radio-button>
            </a-radio-group>
          </div>
        </div>
      </div>

      <!-- 使用说明 -->
      <div
        class="bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 p-4"
      >
        <h4 class="font-semibold text-blue-900 dark:text-blue-100 mb-2">💡 使用说明</h4>
        <ul class="text-sm text-blue-800 dark:text-blue-200 space-y-1 list-disc list-inside">
          <li>追觅功能仅在访问 linux.do 时生效</li>
          <li>侧边栏会实时显示监控用户的动态（发帖、回复、点赞等）</li>
          <li>可通过侧边栏右侧的切换按钮展开/收起</li>
          <li>系统会智能调整不同活跃度用户的刷新频率</li>
          <li>多个标签页同时打开时，会自动选出一个 Leader 标签页负责数据更新</li>
        </ul>
      </div>
    </template>
  </div>
</template>
