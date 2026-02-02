<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useEmojiStore } from '@/stores/emojiStore'
import ImageProxy from './ImageProxy.vue'

interface Props {
  show?: boolean
  position?: { x: number; y: number } | null
}

const emit = defineEmits<{
  (e: 'select', emoji: { name: string; url: string; shortcode: string }): void
  (e: 'close'): void
}>()

const props = withDefaults(defineProps<Props>(), {
  show: false,
  position: null
})

const emojiStore = useEmojiStore()
const searchQuery = ref('')
const activeGroup = ref<string>('')

// Load emoji data on mount
onMounted(async () => {
  await emojiStore.loadData()
  // Set first non-favorites group as active
  const firstGroup = emojiStore.groups.find(g => g.id !== 'favorites')
  if (firstGroup) {
    activeGroup.value = firstGroup.id
  }
})

// Computed filtered emojis based on search
const filteredEmojis = computed(() => {
  if (!searchQuery.value.trim()) {
    const group = emojiStore.groups.find(g => g.id === activeGroup.value)
    return group?.emojis || []
  }

  const query = searchQuery.value.toLowerCase()
  return emojiStore.groups.flatMap(g =>
    (g.emojis || []).filter(
      e =>
        e.name.toLowerCase().includes(query) ||
        e.id.toLowerCase().includes(query)
    )
  )
})

// Computed groups for tabs
const availableGroups = computed(() => {
  return emojiStore.groups.filter(g => g.id !== 'favorites')
})

const selectEmoji = (emoji: any) => {
  emit('select', {
    name: emoji.name,
    url: emoji.url,
    shortcode: `:${emoji.name}:`
  })
  emit('close')
}

const closePicker = () => {
  emit('close')
}

// Close on escape key
const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    closePicker()
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="emoji-picker">
      <div
        v-if="show"
        class="emoji-picker-overlay"
        @click.self="closePicker"
        @keydown="handleKeydown"
        tabindex="-1"
      >
        <div
          class="emoji-picker"
          :style="position ? { left: `${position.x}px`, top: `${position.y}px` } : {}"
        >
          <!-- Header with search -->
          <div class="emoji-picker-header">
            <input
              v-model="searchQuery"
              type="text"
              placeholder="搜索表情..."
              class="emoji-search-input"
              autofocus
            />
            <button class="emoji-close-btn" @click="closePicker">×</button>
          </div>

          <!-- Group tabs -->
          <div v-if="!searchQuery" class="emoji-groups-tabs">
            <button
              v-for="group in availableGroups"
              :key="group.id"
              :class="['emoji-group-tab', { active: activeGroup === group.id }]"
              @click="activeGroup = group.id"
              :title="group.name"
            >
              <span v-if="group.icon.startsWith('http')" class="group-icon-img">
                <ImageProxy :original-src="group.icon" :alt="group.name" :fallback-src="group.icon" :force-proxy="true" />
              </span>
              <span v-else class="group-icon-text">{{ group.icon }}</span>
            </button>
          </div>

          <!-- Emoji grid -->
          <div class="emoji-grid-container">
            <div v-if="filteredEmojis.length === 0" class="emoji-empty">
              没有找到表情
            </div>
            <div v-else class="emoji-grid">
              <button
                v-for="emoji in filteredEmojis"
                :key="emoji.id"
                class="emoji-item"
                :title="emoji.name"
                @click="selectEmoji(emoji)"
              >
                <ImageProxy :original-src="emoji.url" :alt="emoji.name" loading="lazy" :fallback-src="emoji.url" :force-proxy="true" />
              </button>
            </div>
          </div>

          <!-- Footer with shortcode hint -->
          <div class="emoji-picker-footer">
            <span class="emoji-hint">使用 :表情名称: 格式输入表情</span>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.emoji-picker-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 10vh;
}

.emoji-picker {
  position: relative;
  width: 400px;
  max-width: 90vw;
  max-height: 70vh;
  background: white;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.emoji-picker-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  border-bottom: 1px solid #e5e7eb;
  background: #f9fafb;
}

.emoji-search-input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  outline: none;
}

.emoji-search-input:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
}

.emoji-close-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: #e5e7eb;
  border-radius: 50%;
  font-size: 18px;
  cursor: pointer;
  color: #6b7280;
  transition: all 0.2s;
}

.emoji-close-btn:hover {
  background: #d1d5db;
  color: #374151;
}

.emoji-groups-tabs {
  display: flex;
  gap: 4px;
  padding: 8px 12px;
  border-bottom: 1px solid #e5e7eb;
  overflow-x: auto;
  scrollbar-width: thin;
}

.emoji-groups-tabs::-webkit-scrollbar {
  height: 4px;
}

.emoji-groups-tabs::-webkit-scrollbar-thumb {
  background: #d1d5db;
  border-radius: 2px;
}

.emoji-group-tab {
  padding: 6px 10px;
  border: none;
  background: transparent;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
}

.emoji-group-tab:hover {
  background: #f3f4f6;
}

.emoji-group-tab.active {
  background: #dbeafe;
  color: #1d4ed8;
}

.group-icon-img,
.group-icon-text {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
}

.group-icon-img img {
  width: 24px;
  height: 24px;
  object-fit: contain;
}

.emoji-grid-container {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

.emoji-empty {
  text-align: center;
  padding: 40px 20px;
  color: #9ca3af;
  font-size: 14px;
}

.emoji-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(48px, 1fr));
  gap: 8px;
}

.emoji-item {
  aspect-ratio: 1;
  padding: 4px;
  border: none;
  background: transparent;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.emoji-item:hover {
  background: #f3f4f6;
  transform: scale(1.1);
}

.emoji-item img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.emoji-picker-footer {
  padding: 8px 12px;
  border-top: 1px solid #e5e7eb;
  background: #f9fafb;
}

.emoji-hint {
  font-size: 12px;
  color: #9ca3af;
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .emoji-picker {
    background: #1f2937;
  }

  .emoji-picker-header,
  .emoji-picker-footer {
    background: #111827;
    border-color: #374151;
  }

  .emoji-search-input {
    background: #1f2937;
    border-color: #374151;
    color: #f9fafb;
  }

  .emoji-search-input:focus {
    border-color: #60a5fa;
  }

  .emoji-close-btn {
    background: #374151;
    color: #9ca3af;
  }

  .emoji-close-btn:hover {
    background: #4b5563;
    color: #f9fafb;
  }

  .emoji-groups-tabs {
    border-color: #374151;
  }

  .emoji-group-tab:hover {
    background: #374151;
  }

  .emoji-group-tab.active {
    background: #1e3a5f;
    color: #60a5fa;
  }

  .emoji-item:hover {
    background: #374151;
  }

  .emoji-hint {
    color: #6b7280;
  }
}

/* Transitions */
.emoji-picker-enter-active,
.emoji-picker-leave-active {
  transition: opacity 0.2s ease;
}

.emoji-picker-enter-active .emoji-picker,
.emoji-picker-leave-active .emoji-picker {
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.emoji-picker-enter-from,
.emoji-picker-leave-to {
  opacity: 0;
}

.emoji-picker-enter-from .emoji-picker,
.emoji-picker-leave-to .emoji-picker {
  transform: scale(0.95);
  opacity: 0;
}
</style>