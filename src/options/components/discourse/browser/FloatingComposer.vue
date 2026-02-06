<script setup lang="ts">
import type { DiscourseCategory } from '../types'
import Composer from '../composer/Composer'

type Props = {
  composerMode: 'reply' | 'topic' | 'edit'
  baseUrl: string
  floatingStyle: Record<string, string>
  topicId?: number
  postId?: number
  initialRaw?: string | null
  originalRaw?: string | null
  replyToPostNumber?: number | null
  replyToUsername?: string | null
  categories: DiscourseCategory[]
  defaultCategoryId?: number | null
  currentCategory?: DiscourseCategory | null
}

defineProps<Props>()

defineEmits([
  'close',
  'startDrag',
  'startResize',
  'topicPosted',
  'editPosted',
  'replyPosted',
  'clearReply'
])
</script>

<template>
  <div class="floating-composer" :style="floatingStyle">
    <div class="floating-shell">
      <div
        class="floating-bar"
        @mousedown="$emit('startDrag', $event)"
        @touchstart.prevent="$emit('startDrag', $event)"
      >
        <span>
          {{
            composerMode === 'topic'
              ? '发帖编辑器'
              : composerMode === 'edit'
                ? '编辑帖子'
                : '回复编辑器'
          }}
        </span>
        <button class="floating-close" @click="$emit('close')">×</button>
      </div>
      <div class="floating-body">
        <Composer
          :mode="composerMode"
          :baseUrl="baseUrl"
          :topicId="topicId"
          :postId="postId"
          :initialRaw="initialRaw"
          :originalRaw="originalRaw"
          :replyToPostNumber="replyToPostNumber"
          :replyToUsername="replyToUsername"
          :categories="categories"
          :defaultCategoryId="defaultCategoryId"
          :currentCategory="currentCategory"
          @posted="
            composerMode === 'topic'
              ? $emit('topicPosted', $event)
              : composerMode === 'edit'
                ? $emit('editPosted', $event)
                : $emit('replyPosted', $event)
          "
          @clearReply="$emit('clearReply')"
        />
      </div>
      <div
        class="floating-resize"
        @mousedown="$emit('startResize', $event)"
        @touchstart.prevent="$emit('startResize', $event)"
      />
    </div>
  </div>
</template>

<style scoped>
.floating-composer {
  position: fixed;
  right: 20px;
  bottom: 24px;
  width: min(420px, calc(100vw - 40px));
  z-index: 50;
}

.floating-shell {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--theme-surface);
  border: 1px solid var(--theme-outline-variant);
  border-radius: 12px;
  box-shadow: 0 16px 30px rgba(15, 23, 42, 0.2);
  overflow: hidden;
}

.dark .floating-shell {
  background: var(--theme-surface);
  border-color: var(--theme-outline-variant);
}

.floating-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  font-size: 12px;
  color: var(--theme-on-surface-variant);
  background: var(--theme-surface-variant);
  cursor: move;
}

.dark .floating-bar {
  color: var(--theme-on-surface-variant);
  background: var(--theme-surface-variant);
}

.floating-close {
  border: none;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
}

.floating-body {
  flex: 1;
  overflow: auto;
}

.floating-resize {
  width: 16px;
  height: 16px;
  align-self: flex-end;
  cursor: se-resize;
  background: linear-gradient(
    135deg,
    transparent 50%,
    color-mix(in srgb, var(--theme-outline) 80%, transparent) 50%
  );
}
</style>
