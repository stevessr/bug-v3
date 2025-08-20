<template>
  <div class="container">
    <h1>Emoji Management</h1>
    <Button type="primary" @click="showAddModal" style="margin-bottom: 20px;">Add Emoji</Button>
    
    <Table :columns="columns" :data-source="emojiStore.emojis" row-key="packet">
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'url'">
          <img :src="record.url" :alt="record.name" style="width: 50px; height: auto;" />
        </template>
        <template v-if="column.key === 'action'">
          <Space>
            <Button type="link" @click="showEditModal(record)">Edit</Button>
            <Popconfirm
              title="Are you sure you want to delete this emoji?"
              @confirm="deleteEmoji(record.packet)"
            >
              <Button type="link" danger>Delete</Button>
            </Popconfirm>
          </Space>
        </template>
      </template>
    </Table>

    <Modal v-model:open="isModalVisible" :title="modalTitle" @ok="handleOk">
      <Form :model="formState" layout="vertical">
        <FormItem label="Name" name="name">
          <Input v-model:value="formState.name" />
        </FormItem>
        <FormItem label="URL" name="url">
          <Input v-model:value="formState.url" />
        </FormItem>
         <FormItem label="Width" name="width">
          <InputNumber v-model:value="formState.width" />
        </FormItem>
        <FormItem label="Height" name="height">
          <InputNumber v-model:value="formState.height" />
        </FormItem>
      </Form>
    </Modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue';
import { useEmojiStore } from '../store/useEmojiStore';
import { Emoji } from '../store/emoji-data';
import { Button, Table, Modal, Form, Input, InputNumber, Space, Popconfirm } from 'ant-design-vue';
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
