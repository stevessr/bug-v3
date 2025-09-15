<script setup lang="ts">
/* eslint-disable @typescript-eslint/no-explicit-any */
import { ref, watch, toRefs, reactive, computed } from 'vue'
import { DownOutlined } from '@ant-design/icons-vue'

import { useEmojiStore } from '../../stores/emojiStore'

const props = defineProps<{ show: boolean; groups: unknown[]; defaultGroupId?: string }>()

// expose props as refs for template and internal use
const { groups, show, defaultGroupId } = toRefs(props as any)

const emits = defineEmits(['update:show', 'added'])

const onVariantSelectForItem = (index: number, info: { key: string | number }) => {
  const item = parsedItems.value[index]
  if (item) setItemSelectedVariant(item, info)
}

const onParsedImageError = (e: Event) => {
  const target = e.target as HTMLImageElement
  target.style.display = 'none'
}

const name = ref('')
const url = ref('')
const displayUrl = ref('')
const inputMode = ref<'url' | 'markdown' | 'html'>('url')
const pasteText = ref('')
const parsedItems = ref<ImageVariant[]>([])
// initialize groupId from reactive props
const groupId = ref(
  (defaultGroupId?.value as string) || (groups?.value && groups.value[0]?.id) || ''
)

// Keep groupId in sync when defaultGroupId prop changes
watch(defaultGroupId, v => {
  if (v) groupId.value = v
})

// If groups list changes (e.g. first load), ensure we have a sensible default
watch(
  groups,
  g => {
    const list = g as any[]
    if (
      (!groupId.value || !list?.find((x: any) => x.id === groupId.value)) &&
      list &&
      list.length
    ) {
      groupId.value = (defaultGroupId?.value as string) || list[0].id || ''
    }
  },
  { immediate: true }
)

// Reset fields when the modal opens so repeated opens work without refresh
watch(show, v => {
  if (v) {
    name.value = ''
    url.value = ''
    groupId.value = (defaultGroupId?.value as string) || (groups.value && groups.value[0]?.id) || ''
    pasteText.value = ''
    parsedItems.value = []
    inputMode.value = 'url'
  }
})

const emojiStore = useEmojiStore()

// Antd dropdown already imported above

const onInputModeSelect = (info: any) => {
  inputMode.value = String(info.key) as 'url' | 'markdown' | 'html'
}

const onGroupSelect = (info: any) => {
  groupId.value = String(info.key)
}

const selectedGroupLabel = computed(() => {
  const list = (groups.value as any[]) || []
  const g = list.find((x: { id?: string }) => x.id === groupId.value) as any
  return g ? `${g.icon ? g.icon + ' ' : ''}${g.name}` : '选择分组'
})

const handleImageError = (event: Event) => {
  const target = event.target as HTMLImageElement
  target.src = ''
}

const parseMarkdownImages = (text: string): ImageVariant[] => {
  const items: ImageVariant[] = []
  if (!text) return items
  const re = /!\[([^\]]*)\]\(([^)]+)\)/g
  let match: RegExpExecArray | null = null
  while ((match = re.exec(text)) !== null) {
    const alt = (match[1] || '').trim()
    let urlRaw = (match[2] || '').trim()
    // strip optional title after space: (url "title")
    urlRaw = urlRaw
      .split(/\s+/)[0]
      .replace(/^['"]|['"]$/g, '')
      .trim()
    const namePart = (alt || '').split('|')[0].trim()
    const nameVal =
      namePart || decodeURIComponent((urlRaw.split('/').pop() || '').split('?')[0]) || '未命名'
    const item = reactive({
      name: nameVal,
      url: urlRaw,
      variants: [{ label: '默认', url: urlRaw }],
      selectedVariant: urlRaw
    })
    items.push(item)
  }
  return items
}

interface ImageVariant {
  name: string
  url: string
  variants: Array<{ label: string; url: string }>
  selectedVariant: string
}

const parseHTMLImages = (text: string): ImageVariant[] => {
  const items: ImageVariant[] = []
  if (!text) return items
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(text, 'text/html')

    // prefer lightbox wrappers
    const lightboxWrappers = Array.from(doc.querySelectorAll('.lightbox-wrapper')) as HTMLElement[]
    if (lightboxWrappers.length) {
      lightboxWrappers.forEach(wrapper => {
        const anchor = wrapper.querySelector('a.lightbox') as HTMLAnchorElement | null
        const img = wrapper.querySelector('img') as HTMLImageElement | null

        if (!anchor || !img) return

        const title = anchor.getAttribute('title') || ''
        const originalUrl = anchor.getAttribute('href') || ''
        const downloadUrl = anchor.getAttribute('data-download-href') || ''
        const imgSrc = img.getAttribute('src') || ''
        const srcset = img.getAttribute('srcset') || ''

        const nameVal =
          title ||
          img.getAttribute('alt') ||
          decodeURIComponent((originalUrl.split('/').pop() || '').split('?')[0]) ||
          '未命名'

        const variants: Array<{ label: string; url: string }> = []

        // 添加原始URL（最高质量）
        if (originalUrl) {
          variants.push({ label: '原始 (最高质量)', url: originalUrl })
        }

        // 添加下载URL
        if (downloadUrl && downloadUrl !== originalUrl) {
          variants.push({ label: '下载链接', url: downloadUrl })
        }

        // 解析srcset中的变种
        if (srcset) {
          const srcsetParts = srcset.split(',').map(s => s.trim())
          srcsetParts.forEach(part => {
            const [url, descriptor] = part.split(' ')
            if (url && descriptor) {
              const scale = descriptor.replace('x', '')
              // 尝试从URL中提取尺寸信息
              const sizeMatch = url.match(/_(\d+)x(\d+)\./)
              const sizeInfo = sizeMatch ? ` (${sizeMatch[1]}×${sizeMatch[2]})` : ''
              variants.push({
                label: `${scale}x 缩放${sizeInfo}`,
                url: url.startsWith('http')
                  ? url
                  : originalUrl
                    ? new URL(url, originalUrl).href
                    : url
              })
            }
          })
        }

        // 添加当前显示的图片URL
        if (imgSrc && !variants.some(v => v.url === imgSrc)) {
          const sizeMatch = imgSrc.match(/_(\d+)x(\d+)\./)
          const sizeInfo = sizeMatch ? ` (${sizeMatch[1]}×${sizeMatch[2]})` : ''
          variants.push({
            label: `当前显示${sizeInfo}`,
            url: imgSrc.startsWith('http')
              ? imgSrc
              : originalUrl
                ? new URL(imgSrc, originalUrl).href
                : imgSrc
          })
        }

        if (variants.length > 0) {
          const item = reactive({
            name: nameVal,
            url: variants[0].url, // 默认选择第一个（通常是原始URL）
            variants,
            selectedVariant: variants[0].url
          })
          items.push(item)
        }
      })
      return items
    }

    // prefer anchors with class lightbox (兼容旧格式)
    const anchors = Array.from(doc.querySelectorAll('a.lightbox')) as HTMLAnchorElement[]
    if (anchors.length) {
      anchors.forEach(a => {
        const title = a.getAttribute('title') || ''
        const img = a.querySelector('img') as HTMLImageElement | null
        const href = (
          a.getAttribute('href') ||
          a.getAttribute('data-download-href') ||
          (img && img.src) ||
          ''
        ).trim()
        const nameVal =
          title ||
          (img && img.alt) ||
          decodeURIComponent((href.split('/').pop() || '').split('?')[0]) ||
          '未命名'

        const variants: Array<{ label: string; url: string }> = []
        if (href) variants.push({ label: '默认', url: href })

        if (href) {
          const item = reactive({
            name: nameVal,
            url: href,
            variants,
            selectedVariant: href
          })
          items.push(item)
        }
      })
      return items
    }

    // fallback: parse img tags
    const imgs = Array.from(doc.querySelectorAll('img')) as HTMLImageElement[]
    imgs.forEach(img => {
      const src = (img.getAttribute('src') || '').trim()
      const alt = img.getAttribute('alt') || ''
      const nameVal =
        alt || decodeURIComponent((src.split('/').pop() || '').split('?')[0]) || '未命名'

      const variants: Array<{ label: string; url: string }> = []
      if (src) variants.push({ label: '默认', url: src })

      if (src) {
        const item = reactive({
          name: nameVal,
          url: src,
          variants,
          selectedVariant: src
        })
        items.push(item)
      }
    })
  } catch {
    // parsing failed, return empty
  }
  return items
}

const previewParse = () => {
  let newItems: ImageVariant[] = []
  if (inputMode.value === 'markdown') {
    newItems = parseMarkdownImages(pasteText.value)
  } else if (inputMode.value === 'html') {
    newItems = parseHTMLImages(pasteText.value)
  }

  // 保持现有项目的selectedVariant值，如果名称和URL匹配的话
  const existingItems = parsedItems.value

  // 清空数组但保持响应性
  parsedItems.value.splice(0)

  // 添加新项目，尝试保持之前的选择
  newItems.forEach(newItem => {
    const existingItem = existingItems.find(
      existing => existing.name === newItem.name && existing.url === newItem.url
    )

    if (existingItem && newItem.variants.some(v => v.url === existingItem.selectedVariant)) {
      // 保持之前的选择
      newItem.selectedVariant = existingItem.selectedVariant
    }

    parsedItems.value.push(newItem)
  })
}

const setItemSelectedVariant = (item: ImageVariant, info: { key: string | number }) => {
  item.selectedVariant = String(info.key)
}

const close = () => {
  emits('update:show', false)
}

const add = () => {
  // If non-url mode, use already parsed items
  if (inputMode.value !== 'url') {
    if (parsedItems.value.length > 0) {
      if (!groupId.value) return
      emojiStore.beginBatch()
      try {
        parsedItems.value.forEach(it => {
          // debug log removed
          const selectedUrl = it.selectedVariant || it.url
          // debug log removed
          const emojiData = { packet: Date.now(), name: it.name, url: selectedUrl }
          emojiStore.addEmojiWithoutSave(groupId.value, emojiData)
          emits('added', { groupId: groupId.value, name: emojiData.name })
        })
        // IndexedDB removed: flushBuffer not needed
      } finally {
        void emojiStore.endBatch()
      }
      emits('update:show', false)
      pasteText.value = ''
      parsedItems.value = []
      return
    }
  }

  if (!name.value.trim() || !url.value.trim() || !groupId.value) return
  const emojiData = {
    packet: Date.now(),
    name: name.value.trim(),
    url: url.value.trim(),
    ...(displayUrl.value.trim() && { displayUrl: displayUrl.value.trim() })
  }
  emojiStore.addEmoji(groupId.value, emojiData)
  // IndexedDB removed: flushBuffer not needed
  emits('added', { groupId: groupId.value, name: emojiData.name })
  emits('update:show', false)
  name.value = ''
  url.value = ''
  displayUrl.value = ''
  groupId.value = groups.value?.[0]?.id || ''
}

const importParsed = () => {
  if (parsedItems.value.length === 0) return
  if (!groupId.value) return
  emojiStore.beginBatch()
  try {
    parsedItems.value.forEach(it => {
      // debug log removed
      const selectedUrl = it.selectedVariant || it.url
      // debug log removed
      const emojiData = { packet: Date.now(), name: it.name, url: selectedUrl }
      emojiStore.addEmojiWithoutSave(groupId.value, emojiData)
      emits('added', { groupId: groupId.value, name: emojiData.name })
    })
    // IndexedDB removed: flushBuffer not needed
  } finally {
    void emojiStore.endBatch()
  }
  pasteText.value = ''
  parsedItems.value = []
  emits('update:show', false)
}
</script>

<template>
  <div
    v-if="show"
    class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
    @click="close"
  >
    <div
      class="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto border dark:border-gray-700"
      @click.stop
    >
      <h3 class="text-lg font-semibold mb-4">添加表情</h3>
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">表情名称</label>
          <input
            v-model="name"
            type="text"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="输入表情名称"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">输入模式</label>
          <div class="flex items-center gap-2">
            <a-dropdown>
              <template #overlay>
                <a-menu @click="onInputModeSelect">
                  <a-menu-item key="url">单个 URL</a-menu-item>
                  <a-menu-item key="markdown">Markdown (批量)</a-menu-item>
                  <a-menu-item key="html">HTML (批量)</a-menu-item>
                </a-menu>
              </template>
              <AButton>
                {{ inputMode }}
                <DownOutlined />
              </AButton>
            </a-dropdown>
            <div class="text-xs text-gray-500">已解析: {{ parsedItems.length }} 个</div>
          </div>
        </div>
        <div v-if="inputMode === 'url'">
          <label class="block text-sm font-medium text-gray-700 mb-1">输出链接 (必填)</label>
          <input
            v-model="url"
            type="url"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="插入到编辑器时使用的链接"
          />
          <label class="block text-sm font-medium text-gray-700 mb-1 mt-3">显示链接 (可选)</label>
          <input
            v-model="displayUrl"
            type="url"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="表情选择器中显示的链接，留空则使用输出链接"
          />
        </div>
        <div v-else>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            粘贴内容 (Markdown 或 HTML)
          </label>
          <textarea
            v-model="pasteText"
            rows="6"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            :placeholder="
              inputMode === 'markdown'
                ? '粘贴 Markdown 图片，如 ![name|512x512](url)...'
                : '粘贴 HTML 片段 (例如 discourse lightbox 的 HTML)'
            "
          ></textarea>
          <div class="flex items-center justify-between mt-2">
            <div class="text-xs text-gray-500">预览会解析出: {{ parsedItems.length }} 个</div>
            <div class="flex gap-2">
              <button
                @click="previewParse"
                type="button"
                class="px-3 py-1 text-xs bg-gray-100 rounded"
              >
                预览
              </button>
              <button
                @click="importParsed"
                type="button"
                class="px-3 py-1 text-xs bg-blue-600 text-white rounded"
              >
                导入解析项
              </button>
            </div>
          </div>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">所属分组</label>
          <a-dropdown>
            <template #overlay>
              <a-menu @click="onGroupSelect">
                <a-menu-item v-for="g in groups" :key="g.id" :value="g.id" :title="g.id">
                  {{ g.name }}
                </a-menu-item>
              </a-menu>
            </template>
            <AButton>
              {{ selectedGroupLabel }}
              <DownOutlined />
            </AButton>
          </a-dropdown>
        </div>

        <!-- 解析结果预览和URL变种选择 -->
        <div
          v-if="parsedItems.length > 0 && inputMode !== 'url'"
          class="bg-gray-50 dark:bg-gray-700 rounded-lg p-4"
        >
          <div class="flex items-center justify-between mb-3">
            <h4 class="text-sm font-medium text-gray-700">
              解析结果 ({{ parsedItems.length }} 个)
            </h4>
            <button
              @click="parsedItems = []"
              type="button"
              class="text-xs text-gray-500 hover:text-gray-700"
            >
              清空
            </button>
          </div>
          <div class="max-h-64 overflow-y-auto space-y-3">
            <div
              v-for="(item, index) in parsedItems"
              :key="index"
              class="bg-white dark:bg-gray-800 rounded border dark:border-gray-700 p-3"
            >
              <div class="flex items-start gap-3">
                <img
                  :src="item.selectedVariant || item.url"
                  :alt="item.name"
                  class="w-12 h-12 object-cover rounded border flex-shrink-0"
                  @error="onParsedImageError"
                />
                <div class="flex-1 min-w-0">
                  <div class="text-sm font-medium text-gray-900 truncate">{{ item.name }}</div>
                  <div v-if="item.variants.length > 1" class="mt-2">
                    <label class="block text-xs text-gray-600 mb-1">选择URL变种:</label>
                    <a-dropdown>
                      <template #overlay>
                        <a-menu @click="onVariantSelectForItem(index, $event)">
                          <a-menu-item
                            v-for="variant in item.variants"
                            :key="variant.url"
                            :value="variant.url"
                          >
                            {{ variant.label }}
                          </a-menu-item>
                        </a-menu>
                      </template>
                      <AButton>
                        {{ item.selectedVariant || item.variants[0].url }}
                        <DownOutlined />
                      </AButton>
                    </a-dropdown>
                  </div>
                  <div v-else class="mt-1">
                    <span class="text-xs text-gray-500">
                      {{ item.variants[0]?.label || '默认' }}
                    </span>
                  </div>
                  <div class="mt-1 text-xs text-gray-500 break-all">
                    {{ item.selectedVariant || item.url }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-if="url" class="text-center">
          <img
            :src="displayUrl || url"
            alt="预览"
            class="w-16 h-16 object-contain mx-auto border border-gray-200 rounded"
            @error="handleImageError"
          />
        </div>
      </div>
      <div class="flex justify-end gap-3 mt-6">
        <button
          @click="close"
          class="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded transition-colors"
        >
          取消
        </button>
        <button
          @click="add"
          class="px-4 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
        >
          添加
        </button>
      </div>
    </div>
  </div>
</template>
