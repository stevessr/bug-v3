import { ref, onMounted } from 'vue';
import { emojiSet as defaultEmojiSet } from './emoji-data.js';
import { promptDialog, confirmDialog } from './dialog';

declare const chrome: any;

export const EMOJI_STORAGE_KEY = 'emojiData';
export const emojiData = ref<any[]>([]);
export const status = ref('');
// prefer chrome.storage.sync when available (Chromium sync API), fallback to local
export const storage = (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) ? chrome.storage.sync : (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) || {
  async get(_k: any) { return {}; },
  async set(_v: any) {}
};

export async function getEmojiData() {
  const data = await storage.get(EMOJI_STORAGE_KEY);
  if (data && data[EMOJI_STORAGE_KEY]) {
    emojiData.value = data[EMOJI_STORAGE_KEY];
  } else {
    const initialData = [{ group: 'Default Emojis', emojis: defaultEmojiSet }];
    emojiData.value = initialData;
    await saveEmojiData(initialData);
  }
}

export async function saveEmojiData(data: any) {
  await storage.set({ [EMOJI_STORAGE_KEY]: data });
  status.value = '已保存';
  setTimeout(() => (status.value = ''), 1200);
}

export async function addNewGroup() {
  const name = await promptDialog('Enter group name');
  if (name) {
    emojiData.value.push({ group: name, emojis: [] });
    saveEmojiData(emojiData.value);
  }
}

export async function deleteGroup(groupIndex: number) {
  const ok = await confirmDialog('Are you sure you want to delete this group?');
  if (ok) {
    emojiData.value.splice(groupIndex, 1);
    saveEmojiData(emojiData.value);
  }
}

export function updateGroupName(groupIndex: number, newName: string) {
  emojiData.value[groupIndex].group = newName;
  saveEmojiData(emojiData.value);
}

export function updateGroupIcon(groupIndex: number, v: string) {
  emojiData.value[groupIndex].icon = v;
  saveEmojiData(emojiData.value);
}

export async function addNewEmoji(groupIndex: number) {
  const name = await promptDialog('Emoji name');
  if (!name) return;
  const url = await promptDialog('Emoji url');
  if (name && url) {
    emojiData.value[groupIndex].emojis.push({ name, url, packet: Date.now() });
    saveEmojiData(emojiData.value);
  }
}

export async function deleteEmoji(groupIndex: number, emojiIndex: number) {
  const ok = await confirmDialog('Delete this emoji?');
  if (ok) {
    emojiData.value[groupIndex].emojis.splice(emojiIndex, 1);
    saveEmojiData(emojiData.value);
  }
}

export function updateEmoji(groupIndex: number, emojiIndex: number, field: string, value: any) {
  emojiData.value[groupIndex].emojis[emojiIndex][field] = value;
  saveEmojiData(emojiData.value);
}

onMounted(() => {
  getEmojiData();
});

export function onGroupDragEnd() {
  saveEmojiData(emojiData.value);
}

export function onEmojiDragEnd(_groupIndex: number) {
  saveEmojiData(emojiData.value);
}

export function resetToDefault() {
  emojiData.value = [{ group: 'Default Emojis', emojis: defaultEmojiSet }];
  saveEmojiData(emojiData.value);
}

export function isLinux(url: string) {
  try {
    return typeof url === 'string' && url.includes('linux.do');
  } catch (e) {
    return false;
  }
}

export function openExternal(url: string) {
  try {
    window.open(url, '_blank', 'noopener');
  } catch (e) {
    status.value = '无法打开链接';
    setTimeout(() => (status.value = ''), 1500);
  }
}

export async function copyUrl(url: string) {
  try {
    await navigator.clipboard.writeText(url);
    status.value = '已复制到剪贴板';
    setTimeout(() => (status.value = ''), 1200);
  } catch (e) {
    status.value = '复制失败';
    setTimeout(() => (status.value = ''), 1200);
  }
}
