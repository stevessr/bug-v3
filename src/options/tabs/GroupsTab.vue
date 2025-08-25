<template>
  <a-card title="表情组管理">
    <div
      style="
        display: flex;
        justify-content: flex-end;
        margin-bottom: 8px;
        gap: 8px;
        align-items: center;
      "
    >
      <a-button type="primary" @click="showNew = true">新建分组</a-button>
      <a-button size="small" @click="toggleEditMode" :type="editMode ? 'primary' : 'default'">
        {{ editMode ? '退出编辑模式' : '进入编辑模式' }}
      </a-button>
    </div>

    <a-collapse>
      <a-collapse-panel v-for="g in groups" :key="g.UUID">
        <template #header>
          <div
            style="display: flex; align-items: center; justify-content: space-between; width: 100%"
          >
            <div style="display: flex; align-items: center; gap: 8px">
              <template v-if="g.icon">
                <img
                  v-if="isLikelyUrl(g.icon)"
                  :src="g.icon"
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
                  {{ g.icon }}
                </div>
              </template>
              <div>
                <div style="font-weight: 600">{{ g.displayName }}</div>
                <div style="font-size: 12px; color: var(--ant-text-color-secondary)">
                  {{ g.UUID }} • {{ g.emojis?.length || 0 }} 表情
                </div>
              </div>
            </div>
            <div style="display: flex; gap: 8px">
              <a-button size="small" @click.stop="onEdit(g)">编辑</a-button>
              <a-button size="small" @click.stop="onAddEmoji(g)">添加表情</a-button>
              <a-button size="small" @click.stop="onImport(g)">导入</a-button>
              <a-button size="small" @click.stop="onExport(g)">导出</a-button>
              <a-button size="small" danger @click.stop="onDelete(g)">删除</a-button>
            </div>
          </div>
        </template>
        <div style="margin-top: 8px">
          <div
            class="emoji-grid"
            :style="{ gridTemplateColumns: `repeat(${gridCols}, 1fr)`, gap: '8px' }"
            :data-group="g.UUID"
            :ref="(el) => setContainer(el, g.UUID)"
          >
            <div
              v-for="(e, i) in g.emojis"
              :key="e.UUID"
              class="emoji-cell"
              @click.stop="editMode && onEditEmoji(g, e, i)"
              :draggable="!editMode"
            >
              <img
                :src="e.displayUrl || e.realUrl"
                style="width: 100%; aspect-ratio: 1/1; object-fit: cover; border-radius: 6px"
              />
            </div>
          </div>
        </div>
      </a-collapse-panel>
    </a-collapse>

    <new-group-modal v-model:modelValue="showNew" @created="onCreated" />
    <edit-group-modal v-model:modelValue="showEdit" :group="editingGroup" @save="onSaved" />
    <add-emoji-modal
      v-model:modelValue="showAddEmoji"
      :emoji="editingEmoji"
      @added="onEmojiAdded"
      @saved="onEmojiSaved"
    />
    <group-import-modal
      v-model:modelValue="showImport"
      :groupUUID="importGroupUUID"
      @imported="onImported"
    />
    <import-conflict-modal
      v-if="showConflict"
      v-model:modelValue="showConflict"
      :conflicts="currentConflicts"
      @resolved="onResolved"
    />
  </a-card>
</template>

<script lang="ts">
import { defineComponent, ref, onMounted, onUnmounted, nextTick, watch } from 'vue'
import store from '../../data/store/main'
import { Modal } from 'ant-design-vue'
import { createOptionsCommService } from '../../services/communication'

export default defineComponent({
  components: {
    NewGroupModal: () => import('../components/NewGroupModal.vue'),
    EditGroupModal: () => import('../components/EditGroupModal.vue'),
    AddEmojiModal: () => import('../components/AddEmojiModal.vue'),
    GroupImportModal: () => import('../components/GroupImportModal.vue'),
    ImportConflictModal: () => import('../components/ImportConflictModal.vue'),
  },
  setup() {
    const commService = createOptionsCommService()
    const groups = ref<any[]>([])
    const settings = store.getSettings()
    const gridCols = ref((settings && settings.gridColumns) || 4)
    const editMode = ref(false)
    const showNew = ref(false)

    function toggleEditMode() {
      console.log('toggleEditMode called, current mode:', editMode.value)
      editMode.value = !editMode.value
    }
    const showEdit = ref(false)
    const showAddEmoji = ref(false)
    const showImport = ref(false)
    const showConflict = ref(false)
    const currentConflicts = ref<any[]>([])
    const editingGroup = ref<any | null>(null)
    const addingGroup = ref<any | null>(null)
    const editingEmoji = ref<any | null>(null)
    const importGroupUUID = ref('')

    function load() {
      groups.value = store.getGroups()
    }

    // react to settings changes
    function onSettingsChange(ev: any) {
      try {
        const s = ev && ev.detail ? ev.detail : store.getSettings()
        const newGridCols = (s && s.gridColumns) || 4
        if (newGridCols !== gridCols.value) {
          console.log(`GroupsTab updating gridCols from ${gridCols.value} to ${newGridCols}`)
          gridCols.value = newGridCols
        }
      } catch (_) {}
    }
    if (typeof window !== 'undefined')
      window.addEventListener('app:settings-changed', onSettingsChange)

    // use helper for icon parsing
    import('../components/iconHelper').then((m) => {})
    function isLikelyUrl(s: string) {
      try {
        return (s && /^https?:\/\//i.test(s)) || (s && s.startsWith('//'))
      } catch (_) {
        return false
      }
    }

    function onCreated(g: any) {
      store.importPayload({ emojiGroups: [...(groups.value || []), g] })
      load()
    }

    function onEdit(g: any) {
      editingGroup.value = { ...g }
      showEdit.value = true
    }

    function onSaved(g: any) {
      const idx = groups.value.findIndex((x: any) => x.UUID === g.UUID)
      if (idx >= 0) groups.value[idx] = g
      store.importPayload({ emojiGroups: groups.value })
      load()
    }

    function onDelete(g: any) {
      try {
        Modal.confirm({
          title: '确认',
          content: '确认删除分组: ' + g.displayName + ' ?',
          onOk() {
            const remaining = groups.value.filter((x: any) => x.UUID !== g.UUID)
            store.importPayload({ emojiGroups: remaining })
            load()
          },
        })
        return
      } catch (_) {}
      // fallback
      if (!window.confirm('确认删除分组: ' + g.displayName + ' ?')) return
      const remaining = groups.value.filter((x: any) => x.UUID !== g.UUID)
      store.importPayload({ emojiGroups: remaining })
      load()
    }

    function onImport(g: any) {
      importGroupUUID.value = g.UUID
      showImport.value = true
    }

    function onImported(p: any) {
      try {
        if (!p || !p.groupUUID) return
        const g = groups.value.find((x: any) => x.UUID === p.groupUUID)
        if (!g) return
        g.emojis = g.emojis || []
        const existingMap = new Map<string, any>()
        for (const e of g.emojis) {
          const key = e.UUID || e.id || e.realUrl || e.displayUrl
          if (key) existingMap.set(key, e)
        }
        const conflicts: any[] = []
        const nonConflicts: any[] = []
        const incoming = Array.isArray(p.emojis) ? p.emojis : []
        for (const inc of incoming) {
          const key = inc.UUID || inc.id || inc.realUrl || inc.displayUrl
          if (!key) continue
          if (existingMap.has(key)) {
            conflicts.push({
              key,
              existing: existingMap.get(key),
              incoming: inc,
              displayName: inc.displayName || inc.realUrl,
            })
          } else {
            nonConflicts.push(inc)
          }
        }
        for (const nc of nonConflicts) g.emojis.push(nc)
        if (conflicts.length === 0) {
          store.importPayload({ emojiGroups: groups.value })
          load()
          try {
            Modal.info({ title: '导入完成', content: `已导入 ${nonConflicts.length} 个表情。` })
          } catch (_) {}
          return
        }
        currentConflicts.value = conflicts
        showConflict.value = true
      } catch (_) {}
    }

    function onExport(g: any) {
      try {
        if (!g) return
        const payload = {
          emojiGroups: [{ displayName: g.displayName || '', UUID: g.UUID, emojis: g.emojis || [] }],
        }
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        const name = (g.displayName || g.UUID || 'group').toString().replace(/[^a-z0-9\-_]/gi, '_')
        a.download = `${name}.json`
        document.body.appendChild(a)
        a.click()
        a.remove()
        setTimeout(() => URL.revokeObjectURL(url), 5000)
      } catch (_) {}
    }

    function onResolved(decisions: any[]) {
      // decisions: [{ key, decision, incoming }]
      const g = groups.value.find((x: any) => x.UUID === importGroupUUID.value)
      if (!g) return
      for (const d of decisions) {
        if (d.decision === 'skip') continue
        // overwrite: replace existing by key
        const idx = g.emojis.findIndex(
          (e: any) => (e.UUID || e.id || e.realUrl || e.displayUrl) === d.key,
        )
        if (idx >= 0) {
          g.emojis.splice(idx, 1, d.incoming)
        } else {
          g.emojis.push(d.incoming)
        }
      }
      store.importPayload({ emojiGroups: groups.value })
      load()
      try {
        Modal.info({
          title: '导入完成',
          content: `已处理 ${decisions.length} 个冲突（覆盖 ${decisions.filter((x: any) => x.decision === 'overwrite').length} 个）。`,
        })
      } catch (_) {}
      currentConflicts.value = []
      showConflict.value = false
    }

    function onAddEmoji(g: any) {
      addingGroup.value = g
      editingEmoji.value = null
      showAddEmoji.value = true
    }

    // use sortablejs dynamically to avoid static type resolution issues
    const sortableMap: Record<string, any> = {}

    function setContainer(el: any, groupUUID: string) {
      // destroy existing instance
      try {
        const existing = sortableMap[groupUUID]
        if (existing && typeof existing.destroy === 'function') {
          existing.destroy()
          delete sortableMap[groupUUID]
        }
      } catch (_) {}

      if (!el) return
      // do not initialize sortable while in edit mode
      try {
        if (editMode && editMode.value) return
      } catch (_) {}
      // dynamic import to avoid compile-time type complaints
      // @ts-ignore - dynamic import to avoid static type resolution errors in some environments
      // @ts-ignore
      import('sortablejs')
        .then((m) => {
          const SortableLib: any = (m && (m as any).default) || m
          try {
            const inst = new SortableLib(el as HTMLElement, {
              group: 'emoji-groups',
              animation: 150,
              ghostClass: 'sortable-ghost',
              onEnd(evt: any) {
                try {
                  const fromGroupUUID = evt.from?.getAttribute('data-group')
                  const toGroupUUID = evt.to?.getAttribute('data-group')
                  const fromIndex = evt.oldIndex
                  const toIndex = evt.newIndex
                  if (!fromGroupUUID || !toGroupUUID) return
                  if (fromGroupUUID === toGroupUUID) {
                    const ok = store.reorderEmojiInGroup(fromGroupUUID, fromIndex, toIndex)
                    if (ok) load()
                    return
                  }
                  const src = groups.value.find((x: any) => x.UUID === fromGroupUUID)
                  const dst = groups.value.find((x: any) => x.UUID === toGroupUUID)
                  if (!src || !dst) return
                  if (!Array.isArray(src.emojis) || !Array.isArray(dst.emojis)) return
                  const [item] = src.emojis.splice(fromIndex, 1)
                  dst.emojis.splice(toIndex, 0, item)
                  store.importPayload({ emojiGroups: groups.value })
                  load()
                } catch (_) {}
              },
            })
            sortableMap[groupUUID] = inst
          } catch (_) {}
        })
        .catch(() => {})
    }

    // watch edit mode: when entering edit mode destroy all sortables; when leaving, re-init
    try {
      watch(editMode, async (v) => {
        if (v) {
          try {
            Object.keys(sortableMap).forEach((k) => {
              const inst = (sortableMap as any)[k]
              if (inst && typeof inst.destroy === 'function') inst.destroy()
              delete (sortableMap as any)[k]
            })
          } catch (_) {}
        } else {
          await nextTick()
          try {
            const els = document.querySelectorAll('.emoji-grid')
            els.forEach((el) => {
              try {
                const g = (el as HTMLElement).getAttribute('data-group')
                if (g) setContainer(el, g)
              } catch (_) {}
            })
          } catch (_) {}
        }
      })
    } catch (_) {}

    try {
      onUnmounted(() => {
        try {
          Object.keys(sortableMap).forEach((k) => {
            const inst = (sortableMap as any)[k]
            if (inst && typeof inst.destroy === 'function') inst.destroy()
            delete (sortableMap as any)[k]
          })
        } catch (_) {}
      })
    } catch (_) {}

    function onEditEmoji(g: any, e: any, i: number) {
      console.log('onEditEmoji called', { g, e, i, editMode: editMode.value })
      addingGroup.value = g
      editingEmoji.value = { ...e, __index: i }
      showAddEmoji.value = true
    }

    function onEmojiAdded(e: any) {
      if (!addingGroup.value) return
      const gv = groups.value.find((x: any) => x.UUID === addingGroup.value.UUID)
      if (gv) {
        gv.emojis = gv.emojis || []
        gv.emojis.push(e)
        store.importPayload({ emojiGroups: groups.value })
        load()
      }
      showAddEmoji.value = false
      addingGroup.value = null
    }

    function onEmojiSaved(e: any) {
      if (!addingGroup.value || !editingEmoji.value) return
      const gv = groups.value.find((x: any) => x.UUID === addingGroup.value.UUID)
      if (!gv || !Array.isArray(gv.emojis)) return
      const idx = gv.emojis.findIndex(
        (it: any) => (it.UUID || it.id) === (editingEmoji.value.UUID || editingEmoji.value.id),
      )
      if (idx >= 0) {
        gv.emojis.splice(idx, 1, e)
        store.importPayload({ emojiGroups: groups.value })
        load()
      }
      showAddEmoji.value = false
      addingGroup.value = null
      editingEmoji.value = null
    }

    function moveUp(g: any, idx: number) {
      if (!g || typeof idx !== 'number' || idx <= 0) return
      const ok = store.reorderEmojiInGroup(g.UUID, idx, idx - 1)
      if (ok) load()
    }

    function moveDown(g: any, idx: number) {
      if (!g || typeof idx !== 'number') return
      const ok = store.reorderEmojiInGroup(g.UUID, idx, idx + 1)
      if (ok) load()
    }

    onMounted(() => {
      load()

      // 监听来自其他页面的消息
      commService.onSettingsChanged((newSettings) => {
        const newGridCols = (newSettings && newSettings.gridColumns) || 4
        if (newGridCols !== gridCols.value) {
          console.log(`GroupsTab (comm) updating gridCols from ${gridCols.value} to ${newGridCols}`)
          gridCols.value = newGridCols
        }
      })

      commService.onGroupsChanged((newGroups) => {
        groups.value = newGroups
      })

      commService.onUsageRecorded((_data) => {
        // 可以在这里更新常用表情列表
        // hot.value = store.getHot()
      })
    })

    // remove listener on unmount
    try {
      onUnmounted(() => {
        try {
          window.removeEventListener('app:settings-changed', onSettingsChange)
        } catch (_) {}
      })
    } catch (_) {}

    return {
      groups,
      showNew,
      showEdit,
      showAddEmoji,
      showImport,
      showConflict,
      currentConflicts,
      importGroupUUID,
      editingGroup,
      editingEmoji,
      editMode,
      gridCols,
      toggleEditMode,
      onCreated,
      onEdit,
      onSaved,
      onDelete,
      onImport,
      onExport,
      onImported,
      onResolved,
      isLikelyUrl,
      onAddEmoji,
      onEmojiAdded,
      onEmojiSaved,
      setContainer,
      onEditEmoji,
    }
  },
})
</script>

<style scoped>
.emoji-cell {
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
}

.emoji-cell:hover {
  transform: scale(1.05);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
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
</style>
