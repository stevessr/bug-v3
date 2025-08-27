<template>
  <template v-if="asCard">
    <a-card :key="group.UUID" :data-group="group.UUID" class="group-card">
      <div style="display: flex; align-items: center; justify-content: space-between; width: 100%">
        <div style="display: flex; align-items: center; gap: 8px">
          <template v-if="group.icon">
            <img
              v-if="isLikelyUrl && isLikelyUrl(group.icon)"
              :src="group.icon"
              style="width: 24px; height: 24px; object-fit: cover"
            />
            <div
              v-else
              style="
                min-width: 24px;
                min-height: 24px;
                padding: 2px 6px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 4px;
                background: var(--ant-btn-default-bg);
                font-size: 12px;
                font-weight: 600;
              "
            >
              {{ group.icon }}
            </div>
          </template>
          <div>
            <div style="font-weight: 600">{{ group.displayName }}</div>
            <div style="font-size: 12px; color: var(--ant-text-color-secondary)">
              {{ group.UUID }} • {{ group.emojis?.length || 0 }} 表情
            </div>
          </div>
        </div>
        <div style="display: flex; gap: 8px">
          <a-button size="small" @click.stop="$emit('edit', group)">编辑</a-button>
          <a-button size="small" @click.stop="$emit('add-emoji', group)">添加表情</a-button>
          <a-button size="small" @click.stop="$emit('import', group)">导入</a-button>
          <a-button size="small" @click.stop="$emit('export', group)">导出</a-button>
          <a-button size="small" danger @click.stop="$emit('delete', group)">删除</a-button>
        </div>
      </div>

      <div style="margin-top: 8px">
        <div
          class="emoji-grid"
          :style="{ gridTemplateColumns: `repeat(${gridCols}, 1fr)` }"
          :data-group="group.UUID"
          :ref="(el) => setContainer && setContainer(el, group.UUID)"
        >
          <div
            v-for="(e, i) in group.emojis"
            :key="e.UUID"
            class="emoji-cell"
            @click.stop="editMode ? $emit('edit-emoji', group, e, i) : null"
            :draggable="editMode"
            :style="{ cursor: editMode ? 'pointer' : 'grab' }"
          >
            <img
              :src="e.displayUrl || e.realUrl"
              style="
                width: 100%;
                height: 100%;
                object-fit: cover;
                border-radius: 6px;
                display: block;
              "
            />

            <!-- controls shown in edit mode -->
            <div v-if="editMode" class="emoji-controls">
              <button class="emoji-control-btn" @click.stop="$emit('edit-emoji', group, e, i)">
                编辑
              </button>
              <button
                class="emoji-control-btn"
                style="color: #b91c1c; border-color: rgba(185, 28, 28, 0.12)"
                @click.stop="$emit('delete-emoji', group, e, i)"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      </div>
    </a-card>
  </template>

  <template v-else>
    <a-collapse-panel :key="group.UUID">
      <template #header>
        <div
          style="display: flex; align-items: center; justify-content: space-between; width: 100%"
        >
          <div style="display: flex; align-items: center; gap: 8px">
            <template v-if="group.icon">
              <img
                v-if="isLikelyUrl && isLikelyUrl(group.icon)"
                :src="group.icon"
                style="width: 24px; height: 24px; object-fit: cover"
              />
              <div
                v-else
                style="
                  min-width: 24px;
                  min-height: 24px;
                  padding: 2px 6px;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  border-radius: 4px;
                  background: var(--ant-btn-default-bg);
                  font-size: 12px;
                  font-weight: 600;
                "
              >
                {{ group.icon }}
              </div>
            </template>
            <div>
              <div style="font-weight: 600">{{ group.displayName }}</div>
              <div style="font-size: 12px; color: var(--ant-text-color-secondary)">
                {{ group.UUID }} • {{ group.emojis?.length || 0 }} 表情
              </div>
            </div>
          </div>
          <div style="display: flex; gap: 8px">
            <a-button size="small" @click.stop="$emit('edit', group)">编辑</a-button>
            <a-button size="small" @click.stop="$emit('add-emoji', group)">添加表情</a-button>
            <a-button size="small" @click.stop="$emit('import', group)">导入</a-button>
            <a-button size="small" @click.stop="$emit('export', group)">导出</a-button>
            <a-button size="small" danger @click.stop="$emit('delete', group)">删除</a-button>
          </div>
        </div>
      </template>

      <div style="margin-top: 8px">
        <div
          class="emoji-grid"
          :style="{ gridTemplateColumns: `repeat(${gridCols}, 1fr)` }"
          :data-group="group.UUID"
          :ref="(el) => setContainer && setContainer(el, group.UUID)"
        >
          <div
            v-for="(e, i) in group.emojis"
            :key="e.UUID"
            class="emoji-cell"
            @click.stop="editMode ? $emit('edit-emoji', group, e, i) : null"
            :draggable="editMode"
            :style="{ cursor: editMode ? 'pointer' : 'grab' }"
          >
            <img
              :src="e.displayUrl || e.realUrl"
              style="
                width: 100%;
                height: 100%;
                object-fit: cover;
                border-radius: 6px;
                display: block;
              "
            />
          </div>
        </div>
      </div>
    </a-collapse-panel>
  </template>
</template>

<script lang="ts">
import { defineComponent } from 'vue'

export default defineComponent({
  name: 'GroupPanel',
  props: {
    group: { type: Object, required: true },
    gridCols: { type: Number, required: true },
    editMode: { type: Boolean, default: false },
    setContainer: { type: Function, required: false },
    isLikelyUrl: { type: Function, required: false },
    asCard: { type: Boolean, default: false },
  },
  emits: ['edit', 'add-emoji', 'import', 'export', 'delete', 'edit-emoji', 'delete-emoji'],
})
</script>

<style scoped>
.emoji-grid {
  display: grid;
  gap: 8px;
}
.emoji-cell {
  cursor: grab;
  transition: all 0.2s ease;
  position: relative;
}

.emoji-cell[style*='cursor: pointer'] {
  cursor: pointer !important;
}

.emoji-cell:hover {
  transform: scale(1.05);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.emoji-cell:active {
  cursor: grabbing;
}

.emoji-cell[style*='cursor: pointer']:active {
  cursor: pointer !important;
}

.emoji-cell::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  border: 2px solid transparent;
  border-radius: 6px;
  pointer-events: none;
  transition: border-color 0.2s ease;
}

.emoji-cell:hover::after {
  border-color: var(--ant-primary-color);
}

.emoji-controls {
  position: absolute;
  top: 6px;
  right: 6px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  z-index: 10;
}

.emoji-control-btn {
  background: rgba(255, 255, 255, 0.85);
  border: 1px solid rgba(0, 0, 0, 0.08);
  padding: 2px 6px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.emoji-cell {
  width: 100%;
}
.emoji-cell > img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 6px;
  display: block;
}
.emoji-cell {
  aspect-ratio: 1 / 1;
}
.emoji-cell::before {
  content: '';
  display: block;
  padding-top: 100%;
  width: 100%;
  height: 0;
}
.emoji-cell > img {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
}
</style>
