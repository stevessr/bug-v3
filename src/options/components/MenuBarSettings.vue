<script setup lang="ts">
import { reactive, ref, watch, isRef, type Ref } from 'vue'

import type { AppSettings } from '../../types/type'

const props = defineProps<{ settings: AppSettings | Ref<AppSettings> }>()
const settings = props.settings as AppSettings | Ref<AppSettings>

const emit = defineEmits(['update:uploadMenuItems'])

const getUploadMenuItems = () => {
  try {
    if (isRef(settings)) return (settings.value && (settings.value as any).uploadMenuItems) || null
    return (settings && (settings as AppSettings).uploadMenuItems) || null
  } catch {
    return null
  }
}

const _initialUploadMenuItems = getUploadMenuItems() || {
  autoItems: [],
  iframes: [],
  sides: []
}

/** 深拷贝菜单项数组（保证与源数据引用隔离，避免直接改动 settings） */
const cloneMenuItems = (val: unknown) => (Array.isArray(val) ? structuredClone(val) : [])

const localUploadMenuItems = reactive<any>({
  autoItems: cloneMenuItems(_initialUploadMenuItems.autoItems),
  iframes: cloneMenuItems(_initialUploadMenuItems.iframes),
  sides: cloneMenuItems(_initialUploadMenuItems.sides)
})

watch(
  () => getUploadMenuItems(),
  v => {
    const val = v || { autoItems: [], iframes: [], sides: [] }
    localUploadMenuItems.autoItems = cloneMenuItems(val.autoItems)
    localUploadMenuItems.iframes = cloneMenuItems(val.iframes)
    localUploadMenuItems.sides = cloneMenuItems(val.sides)
  }
)

const dirty = ref(false)

const markDirty = () => {
  dirty.value = true
}

const emitUploadMenuItems = () => {
  emit('update:uploadMenuItems', {
    autoItems: localUploadMenuItems.autoItems,
    iframes: localUploadMenuItems.iframes,
    sides: localUploadMenuItems.sides
  })
}

const saveUploadMenuItems = () => {
  emitUploadMenuItems()
  dirty.value = false
}

const cancelUploadMenuItems = () => {
  const val = getUploadMenuItems() || { autoItems: [], iframes: [], sides: [] }
  localUploadMenuItems.autoItems = cloneMenuItems(val.autoItems)
  localUploadMenuItems.iframes = cloneMenuItems(val.iframes)
  localUploadMenuItems.sides = cloneMenuItems(val.sides)
  dirty.value = false
}

const addAutoItem = () => {
  localUploadMenuItems.autoItems.push(['新项', '🔗', 'https://example.com'])
  markDirty()
}
const removeAutoItem = (i: number) => {
  localUploadMenuItems.autoItems.splice(i, 1)
  markDirty()
}

const addIframeItem = () => {
  localUploadMenuItems.iframes.push(['新 iframe', '🌐', 'https://example.com', ''])
  markDirty()
}
const removeIframeItem = (i: number) => {
  localUploadMenuItems.iframes.splice(i, 1)
  markDirty()
}

const addSideItem = () => {
  localUploadMenuItems.sides.push(['新 侧边', '📎', 'https://example.com', ''])
  markDirty()
}
const removeSideItem = (i: number) => {
  localUploadMenuItems.sides.splice(i, 1)
  markDirty()
}
</script>

<template>
  <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700">
    <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
      <h2 class="text-lg font-semibold dark:text-white">菜单栏设置</h2>
      <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
        管理上传菜单和 iframe / 侧边链接（保存后会同步到后台）
      </p>
    </div>
    <div class="p-6 space-y-6">
      <!-- Auto items -->
      <div>
        <div class="flex items-center justify-between mb-2">
          <div class="text-sm font-medium dark:text-white">自动项 (autoItems)</div>
          <a-button size="small" @click="addAutoItem" title="添加自动项">添加</a-button>
        </div>
        <div
          v-for="(item, i) in localUploadMenuItems.autoItems"
          :key="'auto-' + i"
          class="flex gap-2 items-center mb-2"
        >
          <input
            class="border rounded px-2 py-1 flex-1"
            :value="item[0]"
            @input="
              e => {
                localUploadMenuItems.autoItems[i][0] = (e.target as HTMLInputElement).value
                markDirty()
              }
            "
            :title="'自动项名称 ' + (Number(i) + 1)"
          />
          <input
            class="border rounded px-2 py-1 w-20"
            :value="item[1]"
            @input="
              e => {
                localUploadMenuItems.autoItems[i][1] = (e.target as HTMLInputElement).value
                markDirty()
              }
            "
            :title="'自动项图标 ' + (Number(i) + 1)"
          />
          <input
            class="border rounded px-2 py-1 flex-1"
            :value="item[2]"
            @input="
              e => {
                localUploadMenuItems.autoItems[i][2] = (e.target as HTMLInputElement).value
                markDirty()
              }
            "
            :title="'自动项 URL ' + (Number(i) + 1)"
          />
          <a-button
            size="small"
            danger
            @click="removeAutoItem(Number(i))"
            :title="'删除第 ' + (Number(i) + 1) + ' 项'"
          >
            删除
          </a-button>
        </div>
      </div>

      <!-- Iframes -->
      <div>
        <div class="flex items-center justify-between mb-2">
          <div class="text-sm font-medium dark:text-white">Iframe 模态 (iframes)</div>
          <a-button size="small" @click="addIframeItem" title="添加 Iframe 模态项">添加</a-button>
        </div>
        <div
          v-for="(item, i) in localUploadMenuItems.iframes"
          :key="'iframe-' + i"
          class="flex gap-2 items-center mb-2"
        >
          <input
            class="border rounded px-2 py-1 w-40"
            :value="item[0]"
            @input="
              e => {
                localUploadMenuItems.iframes[i][0] = (e.target as HTMLInputElement).value
                markDirty()
              }
            "
            :title="'Iframe 模态名称 ' + (Number(i) + 1)"
          />
          <input
            class="border rounded px-2 py-1 w-16"
            :value="item[1]"
            @input="
              e => {
                localUploadMenuItems.iframes[i][1] = (e.target as HTMLInputElement).value
                markDirty()
              }
            "
            :title="'Iframe 模态图标 ' + (Number(i) + 1)"
          />
          <input
            class="border rounded px-2 py-1 flex-1"
            :value="item[2]"
            @input="
              e => {
                localUploadMenuItems.iframes[i][2] = (e.target as HTMLInputElement).value
                markDirty()
              }
            "
            :title="'Iframe 模态 URL ' + (Number(i) + 1)"
          />
          <input
            class="border rounded px-2 py-1 w-48"
            :value="item[3]"
            placeholder="className"
            @input="
              e => {
                localUploadMenuItems.iframes[i][3] = (e.target as HTMLInputElement).value
                markDirty()
              }
            "
            :title="'Iframe 模态 CSS 类名 ' + (Number(i) + 1)"
          />
          <a-button
            size="small"
            danger
            @click="removeIframeItem(Number(i))"
            :title="'删除第 ' + (Number(i) + 1) + ' 项'"
          >
            删除
          </a-button>
        </div>
      </div>

      <!-- Sides -->
      <div>
        <div class="flex items-center justify-between mb-2">
          <div class="text-sm font-medium dark:text-white">侧边 iframe (sides)</div>
          <a-button size="small" @click="addSideItem" title="添加侧边 Iframe 项">添加</a-button>
        </div>
        <div
          v-for="(item, i) in localUploadMenuItems.sides"
          :key="'side-' + i"
          class="flex gap-2 items-center mb-2"
        >
          <input
            class="border rounded px-2 py-1 w-40"
            :value="item[0]"
            @input="
              e => {
                localUploadMenuItems.sides[i][0] = (e.target as HTMLInputElement).value
                markDirty()
              }
            "
            :title="'侧边 iframe 名称 ' + (Number(i) + 1)"
          />
          <input
            class="border rounded px-2 py-1 w-16"
            :value="item[1]"
            @input="
              e => {
                localUploadMenuItems.sides[i][1] = (e.target as HTMLInputElement).value
                markDirty()
              }
            "
            :title="'侧边 iframe 图标 ' + (Number(i) + 1)"
          />
          <input
            class="border rounded px-2 py-1 flex-1"
            :value="item[2]"
            @input="
              e => {
                localUploadMenuItems.sides[i][2] = (e.target as HTMLInputElement).value
                markDirty()
              }
            "
            :title="'侧边 iframe URL ' + (Number(i) + 1)"
          />
          <input
            class="border rounded px-2 py-1 w-48"
            :value="item[3]"
            placeholder="className"
            @input="
              e => {
                localUploadMenuItems.sides[i][3] = (e.target as HTMLInputElement).value
                markDirty()
              }
            "
            :title="'侧边 iframe CSS 类名 ' + (Number(i) + 1)"
          />
          <a-button
            size="small"
            danger
            @click="removeSideItem(Number(i))"
            :title="'删除第 ' + (Number(i) + 1) + ' 项'"
          >
            删除
          </a-button>
        </div>
      </div>

      <!-- Save / Cancel bar -->
      <div class="flex justify-end gap-2 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <a-button @click="cancelUploadMenuItems" :disabled="!dirty" title="取消上传菜单项更改">
          取消
        </a-button>
        <a-button
          type="primary"
          @click="saveUploadMenuItems"
          :disabled="!dirty"
          title="保存上传菜单项更改"
        >
          保存
        </a-button>
      </div>
    </div>
  </div>
</template>
