<script setup lang="ts">
import { computed, ref, watch } from 'vue'

type Selection = { x: number; y: number; width: number; height: number }

const props = defineProps<{
  open: boolean
  imageDataUrl: string
}>()

const emit = defineEmits<{
  close: []
  confirm: [payload: { dataUrl: string; cropped: boolean }]
}>()

const imageRef = ref<HTMLImageElement | null>(null)
const stageRef = ref<HTMLDivElement | null>(null)
const dragStart = ref<{ x: number; y: number } | null>(null)
const selection = ref<Selection | null>(null)

watch(
  () => [props.open, props.imageDataUrl] as const,
  () => {
    dragStart.value = null
    selection.value = null
  }
)

const selectionStyle = computed(() => {
  const current = selection.value
  const image = imageRef.value
  if (!current || !image) return undefined
  return {
    left: `${image.offsetLeft + current.x}px`,
    top: `${image.offsetTop + current.y}px`,
    width: `${current.width}px`,
    height: `${current.height}px`
  }
})

const hasUsefulSelection = computed(() =>
  Boolean(selection.value && selection.value.width >= 8 && selection.value.height >= 8)
)

const pointInImage = (event: PointerEvent) => {
  const image = imageRef.value
  if (!image) return null
  const rect = image.getBoundingClientRect()
  if (
    event.clientX < rect.left ||
    event.clientX > rect.right ||
    event.clientY < rect.top ||
    event.clientY > rect.bottom
  ) {
    return null
  }
  return {
    x: Math.max(0, Math.min(rect.width, event.clientX - rect.left)),
    y: Math.max(0, Math.min(rect.height, event.clientY - rect.top))
  }
}

const startSelection = (event: PointerEvent) => {
  const point = pointInImage(event)
  if (!point) return
  stageRef.value?.setPointerCapture(event.pointerId)
  dragStart.value = point
  selection.value = { ...point, width: 0, height: 0 }
}

const updateSelection = (event: PointerEvent) => {
  const start = dragStart.value
  const point = pointInImage(event)
  if (!start || !point) return
  selection.value = {
    x: Math.min(start.x, point.x),
    y: Math.min(start.y, point.y),
    width: Math.abs(point.x - start.x),
    height: Math.abs(point.y - start.y)
  }
}

const finishSelection = (event: PointerEvent) => {
  if (stageRef.value?.hasPointerCapture(event.pointerId)) {
    stageRef.value.releasePointerCapture(event.pointerId)
  }
  dragStart.value = null
}

const useFullImage = () => emit('confirm', { dataUrl: props.imageDataUrl, cropped: false })

const useSelection = () => {
  const image = imageRef.value
  const current = selection.value
  if (!image || !current || !hasUsefulSelection.value) return
  const rect = image.getBoundingClientRect()
  const scaleX = image.naturalWidth / rect.width
  const scaleY = image.naturalHeight / rect.height
  const sourceX = Math.max(0, Math.round(current.x * scaleX))
  const sourceY = Math.max(0, Math.round(current.y * scaleY))
  const sourceWidth = Math.max(
    1,
    Math.min(image.naturalWidth - sourceX, Math.round(current.width * scaleX))
  )
  const sourceHeight = Math.max(
    1,
    Math.min(image.naturalHeight - sourceY, Math.round(current.height * scaleY))
  )
  const canvas = document.createElement('canvas')
  canvas.width = sourceWidth
  canvas.height = sourceHeight
  const context = canvas.getContext('2d')
  if (!context) return
  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    sourceWidth,
    sourceHeight
  )
  emit('confirm', { dataUrl: canvas.toDataURL('image/png'), cropped: true })
}
</script>

<template>
  <a-modal
    :open="open"
    title="共享视觉上下文"
    :footer="null"
    :mask-closable="false"
    width="min(720px, calc(100vw - 24px))"
    root-class-name="agent-image-crop-modal-root"
    data-testid="agent-image-crop-modal"
    @cancel="emit('close')"
  >
    <p class="agent-image-crop-copy">
      拖动框选需要助手
      关注的区域，或直接使用整张可见页面截图。图片只发送给本次模型请求，不写入本地会话历史。
    </p>
    <div
      ref="stageRef"
      class="agent-image-crop-stage"
      @pointerdown.prevent.stop="startSelection"
      @pointermove.prevent.stop="updateSelection"
      @pointerup.prevent.stop="finishSelection"
      @pointercancel.stop="finishSelection"
    >
      <img ref="imageRef" :src="imageDataUrl" alt="待共享的页面截图" draggable="false" />
      <div v-if="selection" class="agent-image-crop-selection" :style="selectionStyle"></div>
    </div>
    <div class="agent-image-crop-actions">
      <a-button @click="emit('close')">取消</a-button>
      <a-button @click="useFullImage">使用整张</a-button>
      <a-button type="primary" :disabled="!hasUsefulSelection" @click="useSelection">
        添加选区
      </a-button>
    </div>
  </a-modal>
</template>

<style scoped>
.agent-image-crop-copy {
  margin: 0 0 12px;
  color: var(--md3-on-surface-variant);
  font-size: 12px;
  line-height: 1.6;
}

.agent-image-crop-stage {
  position: relative;
  display: flex;
  overflow: auto;
  max-height: 58vh;
  align-items: flex-start;
  justify-content: center;
  border: 1px solid var(--md3-outline-variant);
  border-radius: 14px;
  background:
    linear-gradient(45deg, rgb(127 127 127 / 8%) 25%, transparent 25%),
    linear-gradient(-45deg, rgb(127 127 127 / 8%) 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, rgb(127 127 127 / 8%) 75%),
    linear-gradient(-45deg, transparent 75%, rgb(127 127 127 / 8%) 75%);
  background-position:
    0 0,
    0 8px,
    8px -8px,
    -8px 0;
  background-size: 16px 16px;
  touch-action: none;
}

.agent-image-crop-stage img {
  display: block;
  max-width: 100%;
  height: auto;
  cursor: crosshair;
  user-select: none;
}

.agent-image-crop-selection {
  position: absolute;
  z-index: 1;
  box-sizing: border-box;
  border: 2px solid var(--md3-primary);
  border-radius: 7px;
  background: color-mix(in srgb, var(--md3-primary) 18%, transparent);
  box-shadow: 0 0 0 9999px rgb(0 0 0 / 25%);
  pointer-events: none;
}

.agent-image-crop-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 14px;
}
</style>
