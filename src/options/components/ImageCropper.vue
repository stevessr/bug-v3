<script setup lang="ts">
import { ref, toRefs, computed } from 'vue'
import {
  CloseOutlined,
  CheckOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
  UndoOutlined,
  DeleteOutlined
} from '@ant-design/icons-vue'
import { theme } from 'ant-design-vue'

import { useImageCropper, type CroppedEmoji } from './useImageCropper'

import type { AppSettings } from '@/types/type'

interface Props {
  imageFile: File
  aiSettings?: AppSettings
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'upload', emojis: CroppedEmoji[]): void
}>()

// Component Refs needed by composable
const canvasRef = ref<HTMLCanvasElement>()
const containerRef = ref<HTMLDivElement>()
const imageElement = ref<HTMLImageElement>()

const { imageFile, aiSettings } = toRefs(props)

// Animation state
const isClosing = ref(false)

// Use the composable
const {
  activeTab,
  gridCols,
  gridRows,
  isLoading,
  isProcessing,
  showCropper,
  uploadedImageUrl,
  zoomLevel,
  minZoom,
  maxZoom,
  croppedEmojis,
  selectedEmojis,
  activeResultKey,
  displayScale,
  gridPositions,
  canProcess,
  handleZoom,
  resetZoom,
  handleWheel,
  toggleSelection,
  selectAll,
  deselectAll,
  deleteSection,
  processImage,
  updateEmojiName,
  confirmUpload,
  close,
  startDraw,
  startResize,
  startMove
} = useImageCropper({ imageFile, aiSettings }, emit, { canvasRef, containerRef, imageElement })

// Close with animation
const handleClose = () => {
  isClosing.value = true
  setTimeout(() => {
    close()
  }, 200)
}

// Theme
const { useToken } = theme
const { token } = useToken()

// Animation classes
const overlayClass = computed(() => ({
  'image-cropper-overlay': true,
  closing: isClosing.value
}))

const modalClass = computed(() => ({
  'image-cropper-modal': true,
  closing: isClosing.value
}))
</script>

<template>
  <div :class="overlayClass">
    <div
      :class="modalClass"
      :style="{ background: token.colorBgContainer, color: token.colorText }"
    >
      <!-- 头部 -->
      <div class="cropper-header" :style="{ borderColor: token.colorBorderSecondary }">
        <h3 :style="{ color: token.colorTextHeading }">图片切割</h3>
        <a-button type="text" @click="handleClose">
          <CloseOutlined />
        </a-button>
      </div>

      <!-- 标签页 -->
      <div class="cropper-tabs" :style="{ borderColor: token.colorBorderSecondary }">
        <a-radio-group v-model:value="activeTab" button-style="solid">
          <a-radio-button value="manual">手动切割</a-radio-button>
          <a-radio-button value="custom">手动标注</a-radio-button>
          <a-radio-button value="ai" :disabled="!props.aiSettings?.geminiApiKey">
            AI 自动识别
          </a-radio-button>
        </a-radio-group>
      </div>

      <!-- 手动切割设置 -->
      <div
        v-if="activeTab === 'manual'"
        class="cropper-settings"
        :style="{ borderColor: token.colorBorderSecondary }"
      >
        <div class="setting-item">
          <label :style="{ color: token.colorText }">水平切割：</label>
          <a-input-number v-model:value="gridCols" :min="1" :max="100" />
          <label :style="{ color: token.colorText, marginLeft: '20px' }">垂直切割：</label>
          <a-input-number v-model:value="gridRows" :min="1" :max="100" />
        </div>

        <div class="setting-item">
          <label :style="{ color: token.colorText }">图片缩放：</label>
          <div class="zoom-controls">
            <a-space>
              <a-button
                shape="circle"
                size="small"
                @click="handleZoom(-0.1)"
                :disabled="zoomLevel <= minZoom"
              >
                <template #icon><ZoomOutOutlined /></template>
              </a-button>
              <span class="zoom-text">{{ Math.round(zoomLevel * 100) }}%</span>
              <a-button
                shape="circle"
                size="small"
                @click="handleZoom(0.1)"
                :disabled="zoomLevel >= maxZoom"
              >
                <template #icon><ZoomInOutlined /></template>
              </a-button>
              <a-button
                shape="circle"
                size="small"
                @click="resetZoom"
                v-if="zoomLevel !== 1"
                title="重置缩放"
              >
                <template #icon><UndoOutlined /></template>
              </a-button>
            </a-space>
          </div>
        </div>

        <div class="setting-item">
          <a-button @click="selectAll">全选</a-button>
          <a-button @click="deselectAll" class="ml-2">取消全选</a-button>
          <span class="selection-count" :style="{ color: token.colorTextSecondary }">
            已选择 {{ selectedEmojis.size }} / {{ gridPositions.length }} 个区域
          </span>
        </div>
      </div>

      <!-- AI 识别提示 -->
      <div
        v-if="activeTab === 'ai'"
        class="ai-notice"
        :style="{ borderColor: token.colorBorderSecondary }"
      >
        <a-alert
          v-if="!props.aiSettings?.geminiApiKey"
          message="需要配置 Gemini API 密钥"
          description="请在设置页面配置 AI 功能中的 Gemini API 密钥"
          type="warning"
          show-icon
        />
        <div v-else class="ai-info">
          <p :style="{ color: token.colorTextSecondary }">
            AI 将自动识别图片中的表情符号并生成名称
          </p>
        </div>
      </div>

      <!-- 图片展示区域 -->
      <div class="cropper-main">
        <div class="cropper-container" ref="containerRef">
          <div v-if="isLoading" class="loading-overlay">
            <a-spin size="large" />
          </div>

          <div v-if="showCropper" class="image-display" @wheel="handleWheel" @mousedown="startDraw">
            <img
              :src="uploadedImageUrl"
              :style="{
                width: (imageElement?.width || 0) * displayScale + 'px',
                height: (imageElement?.height || 0) * displayScale + 'px'
              }"
              class="main-image"
            />

            <!-- 网格覆盖层（手动模式） -->
            <div v-if="activeTab === 'manual'" class="grid-overlay">
              <div
                v-for="position in gridPositions"
                :key="position.id"
                class="grid-cell"
                :class="{ selected: position.isSelected }"
                :style="{
                  left: position.x + '%',
                  top: position.y + '%',
                  width: position.width + '%',
                  height: position.height + '%'
                }"
                @click="toggleSelection(position.id)"
              >
                <div v-if="position.isSelected" class="selection-mark">
                  <CheckOutlined />
                </div>
              </div>
            </div>

            <!-- AI 识别结果覆盖层 -->
            <div
              v-if="(activeTab === 'ai' || activeTab === 'custom') && croppedEmojis.length > 0"
              class="ai-overlay"
            >
              <div
                v-for="emoji in croppedEmojis"
                :key="emoji.id"
                class="ai-box"
                :class="{ selected: selectedEmojis.has(emoji.id) }"
                :style="{
                  left: emoji.x + '%',
                  top: emoji.y + '%',
                  width: emoji.width + '%',
                  height: emoji.height + '%'
                }"
                @mousedown="startMove($event, emoji.id)"
                @click.stop="toggleSelection(emoji.id)"
              >
                <div class="ai-box-name">
                  <span>{{ emoji.name }}</span>
                </div>
                <div v-if="selectedEmojis.has(emoji.id)" class="selection-mark">
                  <CheckOutlined />
                </div>

                <!-- Resize handles -->
                <div
                  v-if="selectedEmojis.has(emoji.id)"
                  class="resize-handle handle-tl"
                  @mousedown="startResize($event, emoji.id, 'tl')"
                ></div>
                <div
                  v-if="selectedEmojis.has(emoji.id)"
                  class="resize-handle handle-tr"
                  @mousedown="startResize($event, emoji.id, 'tr')"
                ></div>
                <div
                  v-if="selectedEmojis.has(emoji.id)"
                  class="resize-handle handle-bl"
                  @mousedown="startResize($event, emoji.id, 'bl')"
                ></div>
                <div
                  v-if="selectedEmojis.has(emoji.id)"
                  class="resize-handle handle-br"
                  @mousedown="startResize($event, emoji.id, 'br')"
                ></div>
              </div>
            </div>
          </div>
        </div>

        <!-- 隐藏的 canvas 用于图片处理 -->
        <canvas ref="canvasRef" style="display: none" />
      </div>

      <!-- 处理按钮 -->
      <div class="cropper-actions" :style="{ borderColor: token.colorBorderSecondary }">
        <div
          v-if="activeTab === 'custom'"
          class="custom-tip"
          :style="{ color: token.colorTextSecondary }"
        >
          在图片空白处拖拽以创建选区，点击选区可调整大小
        </div>
        <a-button
          v-else
          type="primary"
          @click="processImage"
          :loading="isProcessing"
          :disabled="!canProcess || (activeTab === 'manual' && selectedEmojis.size === 0)"
        >
          {{ activeTab === 'manual' ? '切割选中区域' : 'AI 识别' }}
        </a-button>
      </div>

      <!-- 切割结果 -->
      <div
        v-if="croppedEmojis.length > 0"
        class="cropper-results"
        :style="{ borderColor: token.colorBorderSecondary }"
      >
        <a-collapse v-model:activeKey="activeResultKey" ghost>
          <a-collapse-panel key="1" :header="`切割结果（${croppedEmojis.length} 个表情）`">
            <div class="results-grid">
              <div
                v-for="emoji in croppedEmojis"
                :key="emoji.id"
                class="result-item"
                :class="{ selected: selectedEmojis.has(emoji.id) }"
                :style="{
                  borderColor: selectedEmojis.has(emoji.id)
                    ? token.colorPrimary
                    : token.colorBorderSecondary,
                  background: selectedEmojis.has(emoji.id)
                    ? token.controlItemBgActive
                    : token.colorBgContainer
                }"
              >
                <div class="result-image">
                  <img :src="emoji.imageUrl" :alt="emoji.name" />
                  <a-checkbox
                    :checked="selectedEmojis.has(emoji.id)"
                    @change="() => toggleSelection(emoji.id)"
                    class="result-checkbox"
                  />
                  <a-button
                    type="text"
                    danger
                    size="small"
                    class="result-delete"
                    @click.stop="deleteSection(emoji.id)"
                    title="删除"
                  >
                    <template #icon><DeleteOutlined /></template>
                  </a-button>
                </div>

                <a-input
                  :value="emoji.name"
                  @change="(e: any) => updateEmojiName(emoji.id, e.target.value)"
                  placeholder="输入表情名称"
                  size="small"
                  class="result-name"
                />
              </div>
            </div>

            <div class="results-actions">
              <span class="selected-count" :style="{ color: token.colorTextSecondary }">
                已选择 {{ croppedEmojis.filter(e => selectedEmojis.has(e.id)).length }} 个表情
              </span>

              <a-button
                type="primary"
                @click="confirmUpload"
                :disabled="croppedEmojis.filter(e => selectedEmojis.has(e.id)).length === 0"
              >
                上传到缓冲区
              </a-button>
            </div>
          </a-collapse-panel>
        </a-collapse>
      </div>
    </div>
  </div>
</template>

<style scoped src="./ImageCropper.css" />
