<template>
  <n-message-provider>
    <n-dialog-provider>
      <div style="padding: 14px;">
        <n-space vertical :size="12">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
            <div style="display:flex;align-items:center;gap:8px;">
              <n-button type="primary" @click="addNewGroup">Add New Group</n-button>
            </div>
            <div style="display:flex;gap:8px;align-items:center;">
              <n-button @click="resetToDefault">恢复默认</n-button>
              <n-button @click="saveEmojiData(emojiData.value)">保存</n-button>
            </div>
          </div>

          <!-- groups container with drag-and-drop -->
          <div>
            <draggable v-model="emojiData" item-key="group" @end="onGroupDragEnd">
              <template #item="{element: group, index: groupIndex}">
                <n-card :title="group.group" closable @close="deleteGroup(groupIndex)" style="margin-bottom:12px;">
                      <template #header-extra>
                        <div style="display:flex;align-items:center;gap:8px;">
                          <img v-if="group.icon" :src="group.icon" :alt="group.group" style="width:32px;height:32px;object-fit:cover;border-radius:4px;" />
                          <n-input
                            :value="group.group"
                            @update:value="(v) => updateGroupName(groupIndex, v)"
                            placeholder="Group Name"
                            size="small"
                            style="width: 140px;"
                          />
                          <n-input
                            :value="group.icon || ''"
                            @update:value="(v) => updateGroupIcon(groupIndex, v)"
                            placeholder="Icon URL"
                            size="small"
                            style="width: 180px;"
                          />
                        </div>
                      </template>

                  <template v-if="group.icon">
                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
                      <img :src="group.icon" :alt="group.group" style="width:48px;height:48px;object-fit:cover;border-radius:6px;" />
                      <div style="font-weight:600">{{ group.group }}</div>
                    </div>
                  </template>

                  <n-list hoverable>
                    <draggable v-model="group.emojis" :group="{ name: 'emojis' }" item-key="url" @end="() => onEmojiDragEnd(groupIndex)">
                      <template #item="{element: emoji, index: emojiIndex}">
                        <n-list-item>
                          <n-space align="center" style="width:100%;justify-content:space-between;">
                            <div style="display:flex;align-items:center;gap:8px;">
                              <template v-if="isLinux(emoji.url)">
                                <img :src="emoji.url" :alt="emoji.name" width="36" height="36" style="border-radius:6px;object-fit:cover;" />
                              </template>
                              <div style="display:flex;flex-direction:column;">
                                <div style="font-weight:500">{{ emoji.name }}</div>
                                <div style="font-size:12px;color:var(--n-text-color-2);word-break:break-all;max-width:420px">{{ emoji.url }}</div>
                              </div>
                            </div>

                            <div style="display:flex;gap:8px;align-items:center;">
                              <n-button size="tiny" @click="openExternal(emoji.url)">打开</n-button>
                              <n-button size="tiny" @click="copyUrl(emoji.url)">复制</n-button>
                              <n-button type="error" size="tiny" @click="deleteEmoji(groupIndex, emojiIndex)">删除</n-button>
                            </div>
                          </n-space>
                        </n-list-item>
                      </template>
                    </draggable>
                  </n-list>

                  <template #action>
                    <n-button type="info" @click="addNewEmoji(groupIndex)">Add Emoji</n-button>
                  </template>
                </n-card>
              </template>
            </draggable>
          </div>
        </n-space>
      </div>
    </n-dialog-provider>
  </n-message-provider>
</template>

<script setup>
import { ref, onMounted, h } from 'vue';
import { useDialog, useMessage } from 'naive-ui';
import { emojiSet as defaultEmojiSet } from './emoji-data.js';
// draggable for reordering
import draggable from 'vuedraggable';

const EMOJI_STORAGE_KEY = 'emojiData';
const emojiData = ref([]);
const detailedView = ref(true);
const groupAsImage = ref(false);
// prefer chrome.storage.sync when available (Chromium sync API), fallback to local
const storage = (chrome && chrome.storage && chrome.storage.sync) ? chrome.storage.sync : chrome.storage.local;
const dialog = useDialog();
const message = useMessage();

async function getEmojiData() {
  const data = await storage.get(EMOJI_STORAGE_KEY);
  if (data && data[EMOJI_STORAGE_KEY]) {
    emojiData.value = data[EMOJI_STORAGE_KEY];
  } else {
    const initialData = [{ group: 'Default Emojis', emojis: defaultEmojiSet }];
    emojiData.value = initialData;
    await saveEmojiData(initialData);
  }
}

async function saveEmojiData(data) {
  await storage.set({ [EMOJI_STORAGE_KEY]: data });
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

function onGroupDragEnd() {
  // persist new order
  saveEmojiData(emojiData.value);
}

function onEmojiDragEnd(groupIndex) {
  // persist emoji reorder inside a group
  saveEmojiData(emojiData.value);
}

function resetToDefault() {
  emojiData.value = [{ group: 'Default Emojis', emojis: defaultEmojiSet }];
  saveEmojiData(emojiData.value);
  message.success('已恢复默认');
}

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
