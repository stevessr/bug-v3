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

    <!-- 卡片视图仅在“表情组顺序管理”标签中显示 -->

    <!-- Tabs: default list and group order management -->
    <a-tabs v-model:value="activeTab">
      <a-tab-pane key="list" tab="默认视图">
        <a-collapse>
          <GroupPanel
            v-for="g in groups"
            :key="g.UUID"
            :group="g"
            :gridCols="gridCols"
            :editMode="editMode"
            :setContainer="setContainer"
            :isLikelyUrl="isLikelyUrl"
            @edit="onEdit"
            @add-emoji="onAddEmoji"
            @import="onImport"
            @export="onExport"
            @delete="onDelete"
            @edit-emoji="onEditEmoji"
          />
        </a-collapse>
      </a-tab-pane>

      <a-tab-pane key="order" tab="表情组顺序管理">
        <draggable v-model="groups" class="group-cards" item-key="UUID" @end="onDragEnd">
          <template #item="{ element: g }">
            <CustomDraggableCard :group="g" />
          </template>
        </draggable>
      </a-tab-pane>
    </a-tabs>
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
<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick, defineExpose } from 'vue'
import draggable from 'vuedraggable'
import CustomDraggableCard from '../components/CustomDraggableCard.vue'
import GroupPanel from '../components/GroupPanel.vue'
import { Modal } from 'ant-design-vue'
import store from '../../data/store/main'
import { createOptionsCommService } from '../../services/communication'
import { isLikelyUrl } from '../utils/isLikelyUrl'
import type { EmojiGroup } from '../../data/type/emoji/emoji'

const groups = ref<EmojiGroup[]>([])
const gridCols = ref<number>(
  (() => {
    try {
      const settings = store.getSettings()
      return (settings && settings.gridColumns) || 4
    } catch (_) {
      return 4
    }
  })(),
)
const editMode = ref<boolean>(false)
const activeTab = ref<string>('list')

const showNew = ref(false)
const showEdit = ref(false)
const showAddEmoji = ref(false)
const showImport = ref(false)
const showConflict = ref(false)
const currentConflicts = ref<any[]>([])

const editingGroup = ref<any | null>(null)
const addingGroup = ref<any | null>(null)
const editingEmoji = ref<any | null>(null)
const importGroupUUID = ref('')

const commService = createOptionsCommService()

function toggleEditMode() {
  editMode.value = !editMode.value
}

function load() {
  groups.value = store.getGroups()
}

function onDragEnd() {
  store.importPayload({ emojiGroups: groups.value })
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
if (typeof window !== 'undefined') window.addEventListener('app:settings-changed', onSettingsChange)

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
      if (key) existingMap.set(key.toString(), e)
    }
    const conflicts: any[] = []
    const nonConflicts: any[] = []
    const incoming = Array.isArray(p.emojis) ? p.emojis : []
    for (const inc of incoming) {
      const key = inc.UUID || inc.id || inc.realUrl || inc.displayUrl
      if (!key) continue
      if (existingMap.has(key.toString())) {
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
      (e: any) => (e.UUID || e.id || e.realUrl || e.displayUrl).toString() === d.key,
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
  // dynamic import to avoid compile-time type complaints
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
              const [movedItem] = src.emojis.splice(fromIndex, 1)
              dst.emojis.splice(toIndex, 0, movedItem)
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

// watch edit mode: when entering edit mode initialize sortables
watch(editMode, async (v) => {
  if (v) {
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

// re-init sortables when grid column count changes
watch(gridCols, async (v) => {
  try {
    Object.keys(sortableMap).forEach((k) => {
      const inst = (sortableMap as any)[k]
      if (inst && typeof inst.destroy === 'function') inst.destroy()
      delete (sortableMap as any)[k]
    })
  } catch (_) {}

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
})

onUnmounted(() => {
  try {
    Object.keys(sortableMap).forEach((k) => {
      const inst = (sortableMap as any)[k]
      if (inst && typeof inst.destroy === 'function') inst.destroy()
      delete (sortableMap as any)[k]
    })
  } catch (_) {}
})

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

onMounted(() => {
  load()

  // listen for comm updates
  commService.onSettingsChanged((newSettings: any) => {
    const newGridCols = (newSettings && newSettings.gridColumns) || 4
    if (newGridCols !== gridCols.value) {
      gridCols.value = newGridCols
    }
  })

  commService.onGroupsChanged((newGroups: any) => {
    groups.value = newGroups
  })

  commService.onUsageRecorded((_data: any) => {})
})

// remove listener on unmount
onUnmounted(() => {
  try {
    window.removeEventListener('app:settings-changed', onSettingsChange)
  } catch (_) {}
})

defineExpose({
  gridCols,
})
</script>

<style scoped>
/* Styles for group/emoji grid moved to GroupPanel.vue to avoid duplication */
</style>

<style scoped>
.group-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
}
.group-card {
  background: var(--ant-card-background);
  border: 1px solid var(--ant-border-color);
  border-radius: 8px;
  padding: 12px;
  cursor: grab;
}
.group-card:active {
  cursor: grabbing;
}
.group-card-header {
  display: flex;
  align-items: center;
}
</style>
