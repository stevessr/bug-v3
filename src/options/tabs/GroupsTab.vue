<template>
  <a-card title="表情组管理">
    <div style="display: flex; justify-content: flex-end; margin-bottom: 8px">
      <a-button type="primary" @click="showNew = true">新建分组</a-button>
    </div>

    <a-collapse>
      <a-collapse-panel v-for="g in groups" :key="g.UUID">
        <template #header>
          <div
            style="display: flex; align-items: center; justify-content: space-between; width: 100%"
          >
            <div style="display: flex; align-items: center; gap: 8px">
                  <template v-if="g.icon">
                    <img v-if="isLikelyUrl(g.icon)" :src="g.icon" style="width:24px; height:24px; object-fit:cover" />
                    <div v-else style="min-width:24px; min-height:24px; padding:2px 6px; display:flex; align-items:center; justify-content:center; border-radius:4px; background:var(--ant-btn-default-bg); font-size:12px; font-weight:600">{{ g.icon }}</div>
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
        <div style="margin-top: 8px; display: flex; flex-wrap: wrap; gap: 8px">
          <div v-for="(e, i) in g.emojis" :key="e.UUID" style="display:flex; flex-direction:column; align-items:center; gap:4px">
            <img :src="e.displayUrl || e.realUrl" style="width:48px; height:48px; object-fit:cover; border-radius:4px" />
            <div style="display:flex; gap:4px">
              <a-button size="small" @click.stop="moveUp(g, i)" :disabled="i === 0">上移</a-button>
              <a-button size="small" @click.stop="moveDown(g, i)" :disabled="i === (g.emojis.length - 1)">下移</a-button>
            </div>
          </div>
        </div>
      </a-collapse-panel>
    </a-collapse>

    <new-group-modal v-model:modelValue="showNew" @created="onCreated" />
    <edit-group-modal v-model:modelValue="showEdit" :group="editingGroup" @save="onSaved" />
    <add-emoji-modal v-model:modelValue="showAddEmoji" @added="onEmojiAdded" />
    <group-import-modal
      v-model:modelValue="showImport"
      :groupUUID="importGroupUUID"
      @imported="onImported"
    />
  <import-conflict-modal v-if="showConflict" v-model:modelValue="showConflict" :conflicts="currentConflicts" @resolved="onResolved" />
  </a-card>
</template>

<script lang="ts">
import { defineComponent, ref, onMounted } from 'vue'
import store from '../../data/store/main'
import { Modal } from 'ant-design-vue'

export default defineComponent({
  components: {
    NewGroupModal: () => import('../components/NewGroupModal.vue'),
    EditGroupModal: () => import('../components/EditGroupModal.vue'),
    AddEmojiModal: () => import('../components/AddEmojiModal.vue'),
  GroupImportModal: () => import('../components/GroupImportModal.vue'),
  ImportConflictModal: () => import('../components/ImportConflictModal.vue'),
  },
  setup() {
    const groups = ref<any[]>([])
    const showNew = ref(false)
    const showEdit = ref(false)
    const showAddEmoji = ref(false)
    const showImport = ref(false)
  const showConflict = ref(false)
  const currentConflicts = ref<any[]>([])
    const editingGroup = ref<any | null>(null)
    const addingGroup = ref<any | null>(null)
    const importGroupUUID = ref('')

    function load() {
      groups.value = store.getGroups()
    }

    function isLikelyUrl(s: string) {
      if (!s) return false
      return /^https?:\/\//i.test(s) || s.startsWith('//')
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

    function onExport(g: any) {
      const metadata = {
        displayName: g.displayName || '',
        UUID: g.UUID,
        emojiCount: Array.isArray(g.emojis) ? g.emojis.length : 0,
        exportedAt: Date.now(),
        version: 1,
      }
      const payload = { metadata, group: g }
      const s = JSON.stringify(payload, null, 2)
      const blob = new Blob([s], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const safeName = (g.displayName || 'group').replace(/[^a-z0-9_-]/gi, '_')
      a.download = `group-${safeName}-${g.UUID}.json`
      a.click()
      URL.revokeObjectURL(url)
    }

    function onImported(p: any) {
      if (!p || !p.emojis) return
      const g = groups.value.find((x: any) => x.UUID === p.groupUUID)
      if (g) {
        g.emojis = g.emojis || []
        // identify conflicts between incoming and existing
        const existingMap = new Map<string, any>()
        for (const e of g.emojis) {
          const key = e.UUID || e.id || e.realUrl || e.displayUrl
          if (key) existingMap.set(key, e)
        }
        const conflicts: any[] = []
        const nonConflicts: any[] = []
        for (const inc of p.emojis) {
          const key = inc.UUID || inc.id || inc.realUrl || inc.displayUrl
          if (!key) continue
          if (existingMap.has(key)) {
            conflicts.push({ key, existing: existingMap.get(key), incoming: inc, displayName: inc.displayName || inc.realUrl })
          } else {
            nonConflicts.push(inc)
          }
        }
        // add non-conflicting directly
        for (const nc of nonConflicts) g.emojis.push(nc)
        if (conflicts.length === 0) {
          store.importPayload({ emojiGroups: groups.value })
          load()
          try {
            Modal.info({ title: '导入完成', content: `已导入 ${nonConflicts.length} 个表情。` })
          } catch (_) {}
          return
        }
        // otherwise present conflict resolver
        currentConflicts.value = conflicts
        showConflict.value = true
      }
    }

    function onResolved(decisions: any[]) {
      // decisions: [{ key, decision, incoming }]
      const g = groups.value.find((x: any) => x.UUID === importGroupUUID.value)
      if (!g) return
      for (const d of decisions) {
        if (d.decision === 'skip') continue
        // overwrite: replace existing by key
        const idx = g.emojis.findIndex((e: any) => (e.UUID || e.id || e.realUrl || e.displayUrl) === d.key)
        if (idx >= 0) {
          g.emojis.splice(idx, 1, d.incoming)
        } else {
          g.emojis.push(d.incoming)
        }
      }
      store.importPayload({ emojiGroups: groups.value })
      load()
      try {
        Modal.info({ title: '导入完成', content: `已处理 ${decisions.length} 个冲突（覆盖 ${decisions.filter((x: any) => x.decision === 'overwrite').length} 个）。` })
      } catch (_) {}
      currentConflicts.value = []
      showConflict.value = false
    }

    function onAddEmoji(g: any) {
      addingGroup.value = g
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

    onMounted(load)

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
    }
  },
})
</script>
