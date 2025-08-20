<template>
  <div class="container">
    <h1>Emoji Management</h1>
    <a-button type="primary" @click="showAddModal" style="margin-bottom: 20px;">Add Emoji</a-button>
    
    <a-table :columns="columns" :data-source="emojiStore.emojis" row-key="packet">
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'url'">
          <img :src="record.url" :alt="record.name" style="width: 50px; height: auto;" />
        </template>
        <template v-if="column.key === 'action'">
          <a-space>
            <a-button type="link" @click="showEditModal(record)">Edit</a-button>
            <a-popconfirm
              title="Are you sure you want to delete this emoji?"
              @confirm="deleteEmoji(record.packet)"
            >
              <a-button type="link" danger>Delete</a-button>
            </a-popconfirm>
          </a-space>
        </template>
      </template>
    </a-table>

    <a-modal v-model:open="isModalVisible" :title="modalTitle" @ok="handleOk">
      <a-form :model="formState" layout="vertical">
        <a-form-item label="Name" name="name">
          <a-input v-model:value="formState.name" />
        </a-form-item>
        <a-form-item label="URL" name="url">
          <a-input v-model:value="formState.url" />
        </a-form-item>
         <a-form-item label="Width" name="width">
          <a-input-number v-model:value="formState.width" />
        </a-form-item>
        <a-form-item label="Height" name="height">
          <a-input-number v-model:value="formState.height" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue';
import { useEmojiStore } from '../store/useEmojiStore';
import { Emoji } from '../store/emoji-data';
import 'ant-design-vue/dist/reset.css';

const emojiStore = useEmojiStore();

const columns = [
  { title: 'Name', dataIndex: 'name', key: 'name' },
  { title: 'Image', dataIndex: 'url', key: 'url' },
  { title: 'Action', key: 'action' },
];

const isModalVisible = ref(false);
const isEditing = ref(false);
const editingPacket = ref<number | null>(null);

const formState = reactive<Omit<Emoji, 'packet'>>({
  name: '',
  url: '',
  width: undefined,
  height: undefined,
});

const modalTitle = computed(() => (isEditing.value ? 'Edit Emoji' : 'Add Emoji'));

function showAddModal() {
  isEditing.value = false;
  Object.assign(formState, { name: '', url: '', width: undefined, height: undefined });
  isModalVisible.value = true;
}

function showEditModal(emoji: Emoji) {
  isEditing.value = true;
  editingPacket.value = emoji.packet;
  Object.assign(formState, emoji);
  isModalVisible.value = true;
}

function handleOk() {
  if (isEditing.value && editingPacket.value !== null) {
    emojiStore.updateEmoji({ ...formState, packet: editingPacket.value });
  } else {
    emojiStore.addEmoji(formState);
  }
  isModalVisible.value = false;
}

function deleteEmoji(packet: number) {
  emojiStore.deleteEmoji(packet);
}
</script>

<style>
.container {
  padding: 20px;
}
</style>
