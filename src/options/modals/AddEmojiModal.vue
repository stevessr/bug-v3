<script setup lang="ts">
import { ref, watch, toRefs, reactive, computed } from 'vue'
import { DownOutlined, DeleteOutlined, RobotOutlined } from '@ant-design/icons-vue'

import { useEmojiStore } from '../../stores/emojiStore'
import { getEmojiImageUrlSync } from '../../utils/imageUrlHelper'
import CachedImage from '../../components/CachedImage.vue'

import GeminiNamingModal from './GeminiNamingModal.vue'

const props = defineProps<{ show: boolean; groups: unknown[]; defaultGroupId?: string }>()

// expose props as refs for template and internal use
const { groups, show, defaultGroupId } = toRefs(props as any)

const emits = defineEmits(['update:show', 'added'])

const onVariantSelectForItem = (index: number, info: { key: string | number }) => {
  const item = parsedItems.value[index]
  if (item) setItemSelectedVariant(item, info)
}

const removeParsedItem = (index: number) => {
  parsedItems.value.splice(index, 1)
}

const name = ref('')
const url = ref('')
const displayUrl = ref('')
const customOutput = ref('')
const tagsInput = ref('')
const showGeminiModal = ref(false)
const inputMode = ref<'url' | 'markdown' | 'html'>('url')
const pasteText = ref('')
const parsedItems = ref<ImageVariant[]>([])
const autoPreview = ref(false)
const isAdding = ref(false)
let previewTimer: number | null = null
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
    displayUrl.value = ''
    customOutput.value = ''
    tagsInput.value = ''
    groupId.value = (defaultGroupId?.value as string) || (groups.value && groups.value[0]?.id) || ''
    pasteText.value = ''
    parsedItems.value = []
    inputMode.value = 'url'
    imageLoadError.value = false // 重置图片错误状态
    isLoadingViaProxy.value = false
    // 释放旧的代理 blob URL
    if (proxyBlobUrl.value) {
      URL.revokeObjectURL(proxyBlobUrl.value)
      proxyBlobUrl.value = null
    }
  }
})

// 监听 URL 变化，重置图片错误状态
watch(
  () => [url.value, displayUrl.value],
  () => {
    imageLoadError.value = false
    // 释放旧的代理 blob URL
    if (proxyBlobUrl.value) {
      URL.revokeObjectURL(proxyBlobUrl.value)
      proxyBlobUrl.value = null
    }
  }
)

// 自动预览防抖：当 autoPreview 开启并且 pasteText 变化时，延迟执行 previewParse
watch(
  () => pasteText.value,
  () => {
    if (!autoPreview.value) return
    if (previewTimer) window.clearTimeout(previewTimer)
    // use window.setTimeout to get numeric id
    previewTimer = window.setTimeout(() => {
      previewParse()
      previewTimer = null
    }, 400)
  }
)

const emojiStore = useEmojiStore()

// Antd dropdown already imported above

const onGroupSelect = (info: any) => {
  groupId.value = String(info.key)
}

const selectedGroupIcon = computed(() => {
  if (!groupId.value || groupId.value === 'ungrouped') {
    return '📝'
  }
  const list = (groups.value as any[]) || []
  const g = list.find((x: { id?: string }) => x.id === groupId.value) as any
  return g ? g.icon : ''
})

const selectedGroupName = computed(() => {
  if (!groupId.value || groupId.value === 'ungrouped') {
    return '未分组表情'
  }
  const list = (groups.value as any[]) || []
  const g = list.find((x: { id?: string }) => x.id === groupId.value) as any
  return g ? g.name : '选择分组'
})

// 图片加载状态
const imageLoadError = ref(false)
const proxyBlobUrl = ref<string | null>(null)
const isLoadingViaProxy = ref(false)

function handleImageLoad() {
  imageLoadError.value = false
}

async function handleImageError() {
  // 如果已经在加载代理或者已经有代理 URL，不再处理
  if (isLoadingViaProxy.value || proxyBlobUrl.value) {
    return
  }

  const srcUrl = displayUrl.value || url.value
  if (!srcUrl) {
    imageLoadError.value = true
    return
  }

  // 尝试通过代理获取图片（不创建缓存）
  isLoadingViaProxy.value = true
  try {
    const { fetchImageForPreview } = await import('@/utils/imageCache')
    const blobUrl = await fetchImageForPreview(srcUrl)
    if (blobUrl) {
      proxyBlobUrl.value = blobUrl
      imageLoadError.value = false
    } else {
      imageLoadError.value = true
    }
  } catch {
    imageLoadError.value = true
  } finally {
    isLoadingViaProxy.value = false
  }
}

const handleParsedImageError = (event: Event) => {
  const target = event.target as HTMLImageElement
  target.src = ''
}

const parseTagsInput = (value: string): string[] => {
  if (!value) return []
  const normalized = value.replace(/\s+/g, ' ')
  return Array.from(
    new Set(
      normalized
        .split(/[，,\n]/)
        .map(item => item.trim())
        .filter(Boolean)
    )
  )
}

const fetchImageSize = async (src: string): Promise<{ width: number; height: number } | null> => {
  if (!src) return null
  return new Promise(resolve => {
    const img = new Image()
    img.onload = () => {
      const width = (img as HTMLImageElement).naturalWidth || (img as HTMLImageElement).width
      const height = (img as HTMLImageElement).naturalHeight || (img as HTMLImageElement).height
      if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
        resolve({ width, height })
      } else {
        resolve(null)
      }
    }
    img.onerror = () => resolve(null)
    img.src = src
  })
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
      ...(urlRaw.startsWith('upload://') && { short_url: urlRaw }),
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
  short_url?: string
  variants: Array<{ label: string; url: string }>
  selectedVariant: string
  displayUrl?: string
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

        // 添加原始 URL（最高质量）
        if (originalUrl) {
          variants.push({ label: '原始 (最高质量)', url: originalUrl })
        }

        // 添加下载 URL
        if (downloadUrl && downloadUrl !== originalUrl) {
          variants.push({ label: '下载链接', url: downloadUrl })
        }

        // 解析 srcset 中的变种
        if (srcset) {
          const srcsetParts = srcset.split(',').map(s => s.trim())
          srcsetParts.forEach(part => {
            const [url, descriptor] = part.split(' ')
            if (url && descriptor) {
              const scale = descriptor.replace('x', '')
              // 尝试从 URL 中提取尺寸信息
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

        // 添加当前显示的图片 URL
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
          // 优先选择 GIF（动画）变种，如果存在的话
          const gifIndex = variants.findIndex(v => /(^data:image\/gif)|\.gif(\?|$)/i.test(v.url))
          if (gifIndex > 0) {
            const [gif] = variants.splice(gifIndex, 1)
            variants.unshift(gif)
          }
          // url 应为原始链接（anchor href），displayUrl 用于缩略图展示（imgSrc）
          const original = originalUrl || variants[0].url
          const displaySrc = imgSrc || variants[0].url
          const item = reactive({
            name: nameVal,
            url: original, // 保持 url 为原始资源链接
            variants,
            selectedVariant: variants[0].url,
            displayUrl: displaySrc
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
          // 如果 href 指向 GIF，则优先
          const gifIndex = variants.findIndex(v => /(^data:image\/gif)|\.gif(\?|$)/i.test(v.url))
          if (gifIndex > 0) {
            const [gif] = variants.splice(gifIndex, 1)
            variants.unshift(gif)
          }
          // url 使用 href（原始链接），displayUrl 优先使用内嵌 img 的 src（页面上显示的图片）
          const displaySrc = (img && img.src) || href
          const item = reactive({
            name: nameVal,
            url: href,
            variants,
            selectedVariant: variants[0].url,
            displayUrl: displaySrc
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
        // 如果 src 是 GIF 或 data:image/gif，则确保它在首位
        const gifIndex = variants.findIndex(v => /(^data:image\/gif)|\.gif(\?|$)/i.test(v.url))
        if (gifIndex > 0) {
          const [gif] = variants.splice(gifIndex, 1)
          variants.unshift(gif)
        }
        const item = reactive({
          name: nameVal,
          url: src,
          variants,
          selectedVariant: variants[0].url,
          displayUrl: src
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

  // 保持现有项目的 selectedVariant 值，如果名称和 URL 匹配的话
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
  const val = String(info.key)
  item.selectedVariant = val
  // 根据全局设置决定是否同步所选变体到 displayUrl
  const shouldSync = !!(emojiStore.settings && (emojiStore.settings as any).syncVariantToDisplayUrl)
  if (shouldSync) {
    // always set displayUrl when enabled (if it's a valid http(s) URL)
    if (/^https?:\/\//i.test(val)) {
      item.displayUrl = val
    }
  } else {
    // conservative behavior: only populate displayUrl if it's currently empty
    if ((!item.displayUrl || item.displayUrl === '') && /^https?:\/\//i.test(val)) {
      item.displayUrl = val
    }
  }
}

const close = () => {
  emits('update:show', false)
}

const add = async () => {
  // If non-url mode, use already parsed items
  if (inputMode.value !== 'url') {
    return importParsed()
  }

  if (!name.value.trim() || !url.value.trim()) return
  if (isAdding.value) return
  isAdding.value = true
  try {
    // 允许未分组表情（groupId 为空或 'ungrouped'）
    const targetGroupId = groupId.value || 'ungrouped'
    const tags = parseTagsInput(tagsInput.value)
    const sizeSource = (displayUrl.value || url.value).trim()
    const sizeInfo = await fetchImageSize(sizeSource)
    const emojiData = {
      packet: Date.now(),
      name: name.value.trim(),
      url: url.value.trim(),
      ...(url.value.trim().startsWith('upload://') && { short_url: url.value.trim() }),
      ...(displayUrl.value.trim() && { displayUrl: displayUrl.value.trim() }),
      ...(customOutput.value.trim() && { customOutput: customOutput.value.trim() }),
      ...(tags.length > 0 && { tags }),
      ...(sizeInfo && { width: sizeInfo.width, height: sizeInfo.height })
    }
    emojiStore.addEmoji(targetGroupId, emojiData)
    // IndexedDB removed: flushBuffer not needed
    emits('added', { groupId: targetGroupId, name: emojiData.name })
    emits('update:show', false)
    name.value = ''
    url.value = ''
    displayUrl.value = ''
    customOutput.value = ''
    tagsInput.value = ''
    groupId.value = groups.value?.[0]?.id || ''
  } finally {
    isAdding.value = false
  }
}

const importParsed = () => {
  if (parsedItems.value.length === 0) return
  // 允许未分组表情（groupId 为空或 'ungrouped'）
  const targetGroupId = groupId.value || 'ungrouped'
  emojiStore.beginBatch()
  try {
    parsedItems.value.forEach(it => {
      // Always use original URL for emoji.url
      const originalUrl = it.url
      // For display, prefer the selectedVariant (what user chose), then parsed displayUrl
      const displayForEmoji =
        it.selectedVariant && it.selectedVariant !== originalUrl
          ? it.selectedVariant
          : it.displayUrl || undefined

      const emojiData: any = {
        packet: Date.now(),
        name: it.name,
        url: originalUrl
      }
      if (it.short_url) emojiData.short_url = it.short_url
      else if (typeof originalUrl === 'string' && originalUrl.startsWith('upload://')) {
        emojiData.short_url = originalUrl
      }
      if (displayForEmoji) emojiData.displayUrl = displayForEmoji

      emojiStore.addEmojiWithoutSave(targetGroupId, emojiData)
      emits('added', { groupId: targetGroupId, name: emojiData.name })
    })
    // IndexedDB removed: flushBuffer not needed
  } finally {
    void emojiStore.endBatch()
  }
  pasteText.value = ''
  parsedItems.value = []
  emits('update:show', false)
}

// Gemini naming handlers
const openGeminiNaming = () => {
  if (!url.value.trim()) {
    return
  }
  showGeminiModal.value = true
}

const handleGeminiNameSelected = (selectedName: string) => {
  name.value = selectedName
  showGeminiModal.value = false
}
</script>

<template>
  <div
    v-if="show"
    class="fixed inset-0 z-50 overflow-y-auto"
    aria-labelledby="modal-title"
    role="dialog"
    aria-modal="true"
  >
    <transition name="overlay-fade">
      <div class="fixed inset-0 bg-gray-500 bg-opacity-75" @click="close"></div>
    </transition>

    <div class="flex items-center justify-center min-h-screen p-4">
      <transition name="card-pop" appear>
        <ACard
          hoverable
          style="max-width: 90vw; width: 900px; max-height: 90vh; overflow-y: auto"
          @click.stop
        >
          <div class="flex flex-col gap-6">
            <!-- 上方编辑区 -->
            <div class="w-full">
              <div class="mb-4">
                <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-2">添加表情</h2>
                <div class="text-sm text-gray-500 dark:text-gray-400">
                  {{
                    inputMode === 'url'
                      ? '单个表情模式'
                      : `批量模式 (已解析：${parsedItems.length} 个)`
                  }}
                </div>
              </div>
              <form @submit.prevent="add" class="space-y-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1 dark:text-white">
                    输入模式
                  </label>
                  <div>
                    <a-tabs v-model:activeKey="inputMode" type="card">
                      <a-tab-pane key="url" tab="单个 URL" />
                      <a-tab-pane key="markdown" tab="Markdown (批量)" />
                      <a-tab-pane key="html" tab="HTML (批量)" />
                    </a-tabs>
                    <div class="text-xs text-gray-500 mt-1">
                      已解析：{{ parsedItems.length }} 个
                    </div>
                  </div>
                </div>

                <div v-if="inputMode === 'url'">
                  <div class="flex items-center justify-between mb-1">
                    <label class="block text-sm font-medium text-gray-700 dark:text-white">
                      表情名称
                    </label>
                    <a-button
                      v-if="url.trim()"
                      size="small"
                      type="link"
                      @click="openGeminiNaming"
                      title="使用 AI 智能命名"
                    >
                      <RobotOutlined />
                      AI 命名
                    </a-button>
                  </div>
                  <input
                    v-model="name"
                    type="text"
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-black dark:text-white dark:border-gray-600"
                    placeholder="输入表情名称"
                    title="表情名称"
                  />
                </div>
                <div v-if="inputMode === 'url'">
                  <label class="block text-sm font-medium text-gray-700 mb-1 dark:text-white">
                    输出链接 (必填)
                  </label>
                  <input
                    v-model="url"
                    type="url"
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-black dark:text-white dark:border-gray-600"
                    placeholder="插入到编辑器时使用的链接"
                    title="表情输出链接"
                  />
                  <label class="block text-sm font-medium text-gray-700 mb-1 mt-3 dark:text-white">
                    显示链接 (可选)
                  </label>
                  <input
                    v-model="displayUrl"
                    type="url"
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-black dark:text-white dark:border-gray-600"
                    placeholder="表情选择器中显示的链接，留空则使用输出链接"
                    title="表情显示链接 (可选)"
                  />
                  <label class="block text-sm font-medium text-gray-700 mb-1 mt-3 dark:text-white">
                    自定义输出内容 (可选)
                  </label>
                  <textarea
                    v-model="customOutput"
                    rows="2"
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-black dark:text-white dark:border-gray-600"
                    placeholder="点击表情时插入的自定义文本（留空使用默认格式）"
                    title="自定义输出内容 (可选)"
                  ></textarea>
                  <label class="block text-sm font-medium text-gray-700 mb-1 mt-3 dark:text-white">
                    表情标签 (可选)
                  </label>
                  <input
                    v-model="tagsInput"
                    type="text"
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-black dark:text-white dark:border-gray-600"
                    placeholder="标签用逗号分隔，例如：猫咪, 表情包"
                    title="表情标签 (可选)"
                  />
                  <div class="text-xs text-gray-500 mt-1">点击添加时会自动解析宽度/高度（px）</div>
                </div>
                <div v-else>
                  <label class="block text-sm font-medium text-gray-700 mb-1 dark:text-white">
                    粘贴内容 (Markdown 或 HTML)
                  </label>
                  <div class="space-y-2">
                    <textarea
                      v-model="pasteText"
                      rows="6"
                      class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-black dark:text-white dark:border-gray-600"
                      :placeholder="
                        inputMode === 'markdown'
                          ? '粘贴 Markdown 图片，如 ![name|512x512](url)...'
                          : '粘贴 HTML 片段 (例如 discourse lightbox 的 HTML)'
                      "
                      title="粘贴 Markdown 或 HTML 内容"
                    ></textarea>

                    <div class="flex items-center justify-between mt-2">
                      <div class="flex items-center gap-3">
                        <label class="flex items-center text-xs text-gray-500 dark:text-gray-400">
                          <input
                            type="checkbox"
                            v-model="autoPreview"
                            class="mr-1"
                            title="自动预览粘贴内容"
                          />
                          自动预览
                        </label>
                        <div class="text-xs text-gray-500">
                          预览会解析出：{{ parsedItems.length }} 个
                        </div>
                      </div>
                      <div class="flex gap-2">
                        <a-button
                          @click="((pasteText = ''), (parsedItems = []))"
                          htmlType="button"
                          class="px-3 py-1 text-xs bg-gray-100 dark:bg-gray-700 rounded"
                          title="清空粘贴内容"
                        >
                          清空内容
                        </a-button>
                        <a-button
                          @click="previewParse"
                          htmlType="button"
                          class="px-3 py-1 text-xs bg-gray-100 dark:bg-gray-700 rounded"
                          title="预览粘贴内容"
                        >
                          预览
                        </a-button>
                        <a-button
                          @click="importParsed"
                          htmlType="button"
                          class="px-3 py-1 text-xs bg-blue-600 text-white rounded"
                          title="导入所有解析出的表情"
                        >
                          导入解析项
                        </a-button>
                      </div>
                    </div>
                  </div>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1 dark:text-white">
                    所属分组
                  </label>
                  <a-dropdown>
                    <template #overlay>
                      <a-menu @click="onGroupSelect">
                        <a-menu-item key="ungrouped" value="ungrouped">📝 未分组表情</a-menu-item>
                        <a-menu-divider />
                        <a-menu-item v-for="g in groups" :key="g.id" :value="g.id" :title="g.id">
                          <CachedImage
                            v-if="g.icon && g.icon.startsWith('https://')"
                            :src="g.icon"
                            class="inline-block mr-1"
                            style="max-width: 20px"
                          />
                          <span v-else class="inline-block mr-1">{{ g.icon }}</span>
                          {{ g.name }}
                        </a-menu-item>
                      </a-menu>
                    </template>
                    <a-button class="dark:text-white dark:bg-gray-800" title="选择表情所属分组">
                      <CachedImage
                        v-if="selectedGroupIcon && selectedGroupIcon.startsWith('https://')"
                        :src="selectedGroupIcon"
                        class="inline-block mr-1"
                        style="max-width: 20px"
                      />
                      <span v-else class="inline-block mr-1">{{ selectedGroupIcon }}</span>
                      {{ selectedGroupName }}
                      <DownOutlined />
                    </a-button>
                  </a-dropdown>
                </div>

                <!-- 按钮区域 -->
                <div class="mt-6 space-y-3">
                  <!-- Save and Cancel buttons -->
                  <div class="grid grid-cols-2 gap-3">
                    <a-button
                      htmlType="button"
                      @click="add"
                      class="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:text-sm"
                      title="添加表情"
                    >
                      {{ inputMode === 'url' ? '添加' : '导入解析项' }}
                    </a-button>
                    <a-button
                      htmlType="button"
                      @click="close"
                      class="w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:text-sm dark:bg-black dark:text-white dark:border-gray-600"
                      title="取消添加表情"
                    >
                      取消
                    </a-button>
                  </div>
                </div>
              </form>
            </div>

            <!-- 下方预览区 -->
            <div class="w-full">
              <!-- 单图预览 (URL 模式) -->
              <div
                v-if="inputMode === 'url'"
                class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700"
              >
                <h4 class="text-sm font-medium text-gray-700 dark:text-white mb-3">图片预览</h4>
                <div class="flex items-center justify-center min-h-48">
                  <!-- 通过代理加载的图片 -->
                  <a-image
                    v-if="proxyBlobUrl"
                    :src="proxyBlobUrl"
                    class="object-contain w-full h-full max-h-96 rounded-lg border"
                    style="max-width: 500px"
                  />

                  <!-- 有 URL 且未出错时显示图片 -->
                  <a-image
                    v-else-if="(displayUrl || url) && !imageLoadError && !isLoadingViaProxy"
                    :src="getEmojiImageUrlSync({ id: 'preview', displayUrl: displayUrl, url: url })"
                    class="object-contain w-full h-full max-h-96 rounded-lg border"
                    style="max-width: 500px"
                    @load="handleImageLoad"
                    @error="handleImageError"
                  />

                  <!-- URL 为空时的占位符 -->
                  <div
                    v-else-if="!displayUrl && !url"
                    class="flex items-center justify-center bg-gray-100 dark:bg-gray-900 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 h-48 w-full"
                  >
                    <div class="text-center text-gray-500 dark:text-gray-400">
                      <div class="text-4xl mb-2">🖼️</div>
                      <div class="text-sm">请输入图片链接</div>
                    </div>
                  </div>

                  <!-- 正在通过代理加载 -->
                  <div
                    v-else-if="isLoadingViaProxy"
                    class="flex items-center justify-center bg-gray-100 dark:bg-gray-900 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 h-48 w-full"
                  >
                    <div class="text-center text-gray-500 dark:text-gray-400">
                      <div
                        class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"
                      ></div>
                      <div class="text-sm">正在通过代理加载...</div>
                    </div>
                  </div>

                  <!-- 图片加载失败时的占位符 -->
                  <div
                    v-else-if="imageLoadError"
                    class="flex items-center justify-center bg-gray-100 dark:bg-gray-900 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 h-48 w-full"
                  >
                    <div class="text-center text-gray-500 dark:text-gray-400">
                      <div class="text-4xl mb-2">📷</div>
                      <div class="text-sm">图片加载失败</div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 批量解析结果预览和 URL 变种选择 -->
              <div
                v-if="parsedItems.length > 0 && inputMode !== 'url'"
                class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700"
              >
                <div class="flex items-center justify-between mb-3">
                  <h4 class="text-sm font-medium text-gray-700 dark:text-white">
                    解析结果 ({{ parsedItems.length }} 个)
                  </h4>
                  <a-button
                    @click="parsedItems = []"
                    htmlType="button"
                    class="text-xs text-gray-500 hover:text-gray-700"
                    title="清空解析结果"
                  >
                    清空
                  </a-button>
                </div>
                <div class="max-h-96 overflow-y-auto">
                  <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    <ACard
                      v-for="(item, index) in parsedItems"
                      :key="index"
                      hoverable
                      class="p-2 bg-white dark:bg-gray-900 rounded border dark:border-gray-700 flex flex-col items-stretch"
                    >
                      <!-- Image on top -->
                      <div class="flex items-center justify-center pb-2">
                        <a-image
                          :src="getEmojiImageUrlSync({ id: `parsed-${index}`, ...item })"
                          :alt="item.name"
                          class="w-full h-32 object-contain rounded border"
                          @error="(e: Event | string) => handleParsedImageError(e as Event)"
                          preview
                        />
                      </div>

                      <!-- Name (multi-line) -->
                      <div class="mt-2">
                        <textarea
                          v-model="item.name"
                          rows="2"
                          class="w-full px-2 py-1 border border-gray-200 dark:border-gray-700 rounded text-sm bg-white dark:bg-gray-900 dark:text-white resize-none break-words whitespace-normal"
                          :title="'编辑表情名称 ' + item.name"
                        ></textarea>
                      </div>

                      <!-- Variant select -->
                      <div class="mt-2">
                        <div v-if="item.variants.length > 1">
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
                            <a-button
                              class="text-xs w-full flex items-center justify-between"
                              :title="'选择表情变体 ' + item.name"
                            >
                              <span>
                                {{
                                  item.variants.find(v => v.url === item.selectedVariant)?.label ||
                                  '默认'
                                }}
                              </span>
                              <DownOutlined />
                            </a-button>
                          </a-dropdown>
                        </div>
                        <div v-else class="text-xs text-gray-500 mt-1">
                          {{ item.variants[0]?.label || '默认' }}
                        </div>
                        <div class="mt-1 text-xs text-gray-500 dark:text-gray-400 break-all">
                          {{ item.selectedVariant || item.url }}
                        </div>
                      </div>

                      <!-- Delete button at bottom right -->
                      <div class="mt-3 flex justify-end">
                        <a-button
                          type="text"
                          class="text-red-500"
                          @click="removeParsedItem(index)"
                          title="删除此表情"
                        >
                          <DeleteOutlined />
                        </a-button>
                      </div>
                    </ACard>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </ACard>
      </transition>
    </div>

    <!-- Gemini Naming Modal -->
    <GeminiNamingModal
      :show="showGeminiModal"
      :image-url="url"
      @update:show="showGeminiModal = $event"
      @nameSelected="handleGeminiNameSelected"
    />
  </div>
</template>

<style scoped>
/* overlay fade */
.overlay-fade-enter-from,
.overlay-fade-leave-to {
  opacity: 0;
}
.overlay-fade-enter-active,
.overlay-fade-leave-active {
  transition: opacity 220ms cubic-bezier(0.4, 0, 0.2, 1);
}

/* card pop: fade + slight translate + scale */
.card-pop-enter-from {
  opacity: 0;
  transform: translateY(12px) scale(0.98);
}
.card-pop-enter-to {
  opacity: 1;
  transform: translateY(0) scale(1);
}
.card-pop-leave-from {
  opacity: 1;
  transform: translateY(0) scale(1);
}
.card-pop-leave-to {
  opacity: 0;
  transform: translateY(8px) scale(0.98);
}
.card-pop-enter-active,
.card-pop-leave-active {
  transition:
    opacity 220ms cubic-bezier(0.4, 0, 0.2, 1),
    transform 220ms cubic-bezier(0.4, 0, 0.2, 1);
}
</style>
