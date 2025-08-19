<template>
  <n-message-provider>
    <n-dialog-provider>
      <div style="padding: 20px;">
        <n-space vertical :size="20">
          <n-button type="primary" @click="addNewGroup">Add New Group</n-button>
          <n-grid :x-gap="12" :y-gap="12" :cols="'1 600:2 900:3'">
            <n-gi v-for="(groupData, groupIndex) in emojiData" :key="groupIndex">
              <n-card :title="groupData.group" closable @close="deleteGroup(groupIndex)">
                <template #header-extra>
                  <n-input
                    :value="groupData.group"
                    @update:value="(v) => updateGroupName(groupIndex, v)"
                    placeholder="Group Name"
                    size="small"
                    style="width: 120px;"
                  />
                </template>
                <n-list hoverable clickable>
                  <n-list-item v-for="(emoji, emojiIndex) in groupData.emojis" :key="emojiIndex">
                    <n-space align="center">
                      <template v-if="isLinux(emoji.url)">
                        <img :src="emoji.url" :alt="emoji.name" width="24" height="24" />
                      </template>
                      <template v-else>
                        <n-popover trigger="click">
                          <template #trigger>
                            <n-button size="tiny" circle>{/* 外部资源 */}外</n-button>
                          </template>
                          <div style="display:flex;flex-direction:column;gap:8px;min-width:180px;">
                            <div style="font-size:12px;word-break:break-all;color:var(--n-text-color);">{{ emoji.name }}</div>
                            <div style="font-size:11px;color:var(--n-text-color-2);word-break:break-all;">{{ emoji.url }}</div>
                            <div style="display:flex;gap:8px;justify-content:flex-end;">
                              <n-button size="small" @click="openExternal(emoji.url)">打开</n-button>
                              <n-button size="small" @click="copyUrl(emoji.url)">复制 URL</n-button>
                            </div>
                          </div>
                        </n-popover>
                      </template>
                      <n-input
                        :value="emoji.name"
                        @update:value="(v) => updateEmoji(groupIndex, emojiIndex, 'name', v)"
                        placeholder="Name"
                        size="small"
                        style="width: 80px;"
                      />
                      <n-input
                        :value="emoji.url"
                        @update:value="(v) => updateEmoji(groupIndex, emojiIndex, 'url', v)"
                        placeholder="URL"
                        size="small"
                        style="width: 150px;"
                      />
                      <n-button type="error" size="tiny" @click="deleteEmoji(groupIndex, emojiIndex)">Delete</n-button>
                    </n-space>
                  </n-list-item>
                </n-list>
                <template #action>
                  <n-button type="info" @click="addNewEmoji(groupIndex)">Add Emoji</n-button>
                </template>
              </n-card>
            </n-gi>
          </n-grid>
        </n-space>
      </div>
    </n-dialog-provider>
  </n-message-provider>
</template>

<script setup>
import { ref, onMounted, h } from 'vue';
import { useDialog, useMessage } from 'naive-ui';
import { emojiSet as defaultEmojiSet } from './emoji-data.js';

const EMOJI_STORAGE_KEY = 'emojiData';
const emojiData = ref([]);
const dialog = useDialog();
const message = useMessage();

async function getEmojiData() {
  const data = await chrome.storage.local.get(EMOJI_STORAGE_KEY);
  if (data && data[EMOJI_STORAGE_KEY]) {
    emojiData.value = data[EMOJI_STORAGE_KEY];
  } else {
    const initialData = [{ group: 'Default Emojis', emojis: defaultEmojiSet }];
    emojiData.value = initialData;
    await saveEmojiData(initialData);
  }
}

async function saveEmojiData(data) {
  await chrome.storage.local.set({ [EMOJI_STORAGE_KEY]: data });
}

function addNewGroup() {
  let inputValue = '';
  dialog.create({
    title: 'Add New Group',
    content: () => h('div', null, [h('input', { placeholder: 'Enter group name', onInput: (e) => (inputValue = e.target.value) })]),
    positiveText: 'Add',
    negativeText: 'Cancel',
    onPositiveClick: async () => {
      if (inputValue) {
        emojiData.value.push({ group: inputValue, emojis: [] });
        await saveEmojiData(emojiData.value);
        message.success('Group added successfully!');
      }
    },
  });
}

function deleteGroup(groupIndex) {
  dialog.warning({
    title: 'Delete Group',
    content: 'Are you sure you want to delete this group?',
    positiveText: 'Delete',
    negativeText: 'Cancel',
    onPositiveClick: async () => {
      emojiData.value.splice(groupIndex, 1);
      await saveEmojiData(emojiData.value);
      message.success('Group deleted successfully!');
    },
  });
}

function updateGroupName(groupIndex, newName) {
  emojiData.value[groupIndex].group = newName;
  saveEmojiData(emojiData.value);
}

function addNewEmoji(groupIndex) {
  let name = '';
  let url = '';
  dialog.create({
    title: 'Add New Emoji',
    content: () =>
      h('div', null, [
        h('input', { placeholder: 'Emoji Name', onInput: (e) => (name = e.target.value) }),
        h('input', { placeholder: 'Emoji URL', onInput: (e) => (url = e.target.value) }),
      ]),
    positiveText: 'Add',
    negativeText: 'Cancel',
    onPositiveClick: async () => {
      if (name && url) {
        emojiData.value[groupIndex].emojis.push({ name, url, packet: Date.now() });
        await saveEmojiData(emojiData.value);
        message.success('Emoji added successfully!');
      }
    },
  });
}

function deleteEmoji(groupIndex, emojiIndex) {
  dialog.warning({
    title: 'Delete Emoji',
    content: 'Are you sure you want to delete this emoji?',
    positiveText: 'Delete',
    negativeText: 'Cancel',
    onPositiveClick: async () => {
      emojiData.value[groupIndex].emojis.splice(emojiIndex, 1);
      await saveEmojiData(emojiData.value);
      message.success('Emoji deleted successfully!');
    },
  });
}

function updateEmoji(groupIndex, emojiIndex, field, value) {
  emojiData.value[groupIndex].emojis[emojiIndex][field] = value;
  saveEmojiData(emojiData.value);
}

onMounted(() => {
  getEmojiData();
});

function isLinux(url) {
  try {
    return typeof url === 'string' && url.includes('linux.do');
  } catch (e) {
    return false;
  }
}

function openExternal(url) {
  try {
    window.open(url, '_blank', 'noopener');
  } catch (e) {
    message.error('无法打开链接');
  }
}

async function copyUrl(url) {
  try {
    await navigator.clipboard.writeText(url);
    message.success('已复制到剪贴板');
  } catch (e) {
    message.error('复制失败');
  }
}
</script>
