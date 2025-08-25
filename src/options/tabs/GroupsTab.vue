<template>
  <a-card title="表情组管理">
    <div style="display: flex; justify-content: flex-end; margin-bottom: 8px">
      <a-button type="primary" @click="createGroup">新建分组</a-button>
    </div>

    <a-list bordered>
      <a-list-item v-for="g in groups" :key="g.UUID">
        <a-list-item-meta
          :title="g.displayName"
          :description="'UUID: ' + g.UUID + ' — ' + (g.emojis?.length || 0) + ' emojis'"
        />
        <template #actions>
          <a-button size="small" @click="editGroup(g)">编辑</a-button>
          <a-button size="small" danger @click="deleteGroup(g)">删除</a-button>
        </template>
      </a-list-item>
    </a-list>
  </a-card>
</template>

<script lang="ts">
import { defineComponent, ref, onMounted } from 'vue'
import emojiGroupsStore from '../../data/update/emojiGroupsStore'

export default defineComponent({
  setup() {
    const groups = ref<any[]>([])

    function load() {
      groups.value = emojiGroupsStore.getEmojiGroups()
    }

    function createGroup() {
      const id =
        typeof crypto !== 'undefined' && (crypto as any).randomUUID
          ? (crypto as any).randomUUID()
          : String(Date.now())
      const group = { UUID: id, displayName: 'New Group', emojis: [], icon: '', order: 0 }
      emojiGroupsStore.addGroup(group)
      load()
    }

    function editGroup(item: any) {
      const name = window.prompt('新的分组名称', item.displayName)
      if (name == null) return
      const g = groups.value.find((x: any) => x.UUID === item.UUID)
      if (g) g.displayName = name
      emojiGroupsStore.setEmojiGroups(groups.value)
      load()
    }

    function deleteGroup(item: any) {
      if (!window.confirm('确认删除分组: ' + item.displayName + ' ?')) return
      emojiGroupsStore.removeGroup(item.UUID)
      load()
    }

    onMounted(load)

    return { groups, createGroup, editGroup, deleteGroup }
  },
})
</script>
