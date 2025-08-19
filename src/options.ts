import { emojiSet as defaultEmojiSet } from './emoji-data.js';
import { promptDialog, confirmDialog, editEmojiDialog } from './dialog';
import { attachTouchDrag } from './touch-drag';

declare const chrome: any;

export const EMOJI_STORAGE_KEY = 'emojiData';
let emojiData: any[] = [];
let status = '';
// prefer chrome.storage.sync when available (Chromium sync API), fallback to local
export const storage = (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) ? chrome.storage.sync : (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) || {
  async get(_k: any) { return {}; },
  async set(_v: any) {}
};

async function getEmojiData() {
  const data = await storage.get(EMOJI_STORAGE_KEY);
  if (data && data[EMOJI_STORAGE_KEY]) {
    emojiData = data[EMOJI_STORAGE_KEY];
  } else {
    const initialData = [{ group: 'Default Emojis', emojis: defaultEmojiSet }];
    emojiData = initialData;
    await saveEmojiData(initialData);
  }
}

async function saveEmojiData(data: any) {
  await storage.set({ [EMOJI_STORAGE_KEY]: data });
  status = '已保存';
  renderStatus();
  setTimeout(() => { status = ''; renderStatus(); }, 1200);
}

export async function addNewGroup() {
  const name = await promptDialog('Enter group name');
  if (name) {
    emojiData.push({ group: name, emojis: [] });
    await saveEmojiData(emojiData);
    renderGroups();
  }
}

export async function deleteGroup(groupIndex: number) {
  const ok = await confirmDialog('Are you sure you want to delete this group?');
  if (ok) {
    emojiData.splice(groupIndex, 1);
    await saveEmojiData(emojiData);
    renderGroups();
  }
}

export function updateGroupName(groupIndex: number, newName: string) {
  emojiData[groupIndex].group = newName;
  saveEmojiData(emojiData);
}

export function updateGroupIcon(groupIndex: number, v: string) {
  emojiData[groupIndex].icon = v;
  saveEmojiData(emojiData);
}

export async function addNewEmoji(groupIndex: number) {
  const edited = await editEmojiDialog('', '');
  if (!edited) return;
  const { name, url } = edited;
  emojiData[groupIndex].emojis.push({ name, url, packet: Date.now() });
  await saveEmojiData(emojiData);
  renderGroups();
}

export async function deleteEmoji(groupIndex: number, emojiIndex: number) {
  const ok = await confirmDialog('Delete this emoji?');
  if (ok) {
    emojiData[groupIndex].emojis.splice(emojiIndex, 1);
    await saveEmojiData(emojiData);
    renderGroups();
  }
}

export function updateEmoji(groupIndex: number, emojiIndex: number, field: string, value: any) {
  emojiData[groupIndex].emojis[emojiIndex][field] = value;
  saveEmojiData(emojiData);
}

export function onGroupDragEnd() {
  saveEmojiData(emojiData);
}

export function onEmojiDragEnd(_groupIndex: number) {
  saveEmojiData(emojiData);
}

export function resetToDefault() {
  emojiData = [{ group: 'Default Emojis', emojis: defaultEmojiSet }];
  saveEmojiData(emojiData);
  renderGroups();
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
    status = '无法打开链接';
    renderStatus();
    setTimeout(() => { status = ''; renderStatus(); }, 1500);
  }
}

export async function copyUrl(url: string) {
  try {
    await navigator.clipboard.writeText(url);
    status = '已复制到剪贴板';
    renderStatus();
    setTimeout(() => { status = ''; renderStatus(); }, 1200);
  } catch (e) {
    status = '复制失败';
    renderStatus();
    setTimeout(() => { status = ''; renderStatus(); }, 1200);
  }
}

function renderStatus() {
  const el = document.querySelector('.status');
  if (el) el.textContent = status || '';
}

function renderGroups() {
  const container = document.querySelector('.groups');
  if (!container) return;
  container.innerHTML = '';
  emojiData.forEach((group, groupIndex) => {
    const card = document.createElement('div');
    // use Tailwind-like utility classes (we also have plain CSS fallbacks)
  card.className = 'group-card card p-3 mb-3 rounded-md bg-white';
  // limit max width for a single group to avoid overly wide layouts on large screens
  card.style.maxWidth = '720px';
    card.setAttribute('draggable', 'true');
    card.dataset.groupIndex = String(groupIndex);
    // drag handlers for reordering groups
    card.addEventListener('dragstart', (ev: DragEvent) => {
      ev.dataTransfer?.setData('text/group-index', String(groupIndex));
      card.style.opacity = '0.5';
    });
    card.addEventListener('dragend', () => { card.style.opacity = ''; });
    card.addEventListener('dragover', (ev) => { ev.preventDefault(); });
    card.addEventListener('drop', (ev) => {
      ev.preventDefault();
      const src = ev.dataTransfer?.getData('text/group-index');
      if (src != null) {
        const from = Number(src);
        const to = Number(card.dataset.groupIndex);
        if (!Number.isNaN(from) && !Number.isNaN(to) && from !== to) {
          const moved = emojiData.splice(from, 1)[0];
          emojiData.splice(to, 0, moved);
          saveEmojiData(emojiData);
          renderGroups();
        }
      }
    });
    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';
    header.style.marginBottom = '8px';

  const left = document.createElement('div');
  left.className = 'flex items-center gap-2';

    if (group.icon) {
      const img = document.createElement('img');
      img.src = group.icon;
      img.alt = group.group;
      img.style.width = '32px';
      img.style.height = '32px';
      img.style.objectFit = 'cover';
      img.style.borderRadius = '4px';
      left.appendChild(img);
    }
  const nameInput = document.createElement('input');
  nameInput.value = group.group || '';
  nameInput.placeholder = 'Group Name';
  nameInput.className = 'px-2 py-1 border rounded';
  nameInput.addEventListener('input', (e: any) => updateGroupName(groupIndex, e.target.value));
    left.appendChild(nameInput);

    const iconInput = document.createElement('input');
    iconInput.value = group.icon || '';
    iconInput.placeholder = 'Icon URL';
    iconInput.style.width = '180px';
    iconInput.style.padding = '4px';
    iconInput.addEventListener('input', (e: any) => updateGroupIcon(groupIndex, e.target.value));
    left.appendChild(iconInput);

    header.appendChild(left);

  const right = document.createElement('div');
  right.className = 'flex items-center gap-2';
  const delBtn = document.createElement('button');
  delBtn.textContent = '删除分组';
  delBtn.className = 'btn btn-primary';
  delBtn.addEventListener('click', () => deleteGroup(groupIndex));
  right.appendChild(delBtn);
    header.appendChild(right);

    card.appendChild(header);

    if (group.icon) {
      const preview = document.createElement('div');
      preview.style.display = 'flex';
      preview.style.alignItems = 'center';
      preview.style.gap = '8px';
      preview.style.marginBottom = '8px';
      const img = document.createElement('img');
      img.src = group.icon;
      img.alt = group.group;
      img.style.width = '48px';
      img.style.height = '48px';
      img.style.objectFit = 'cover';
      img.style.borderRadius = '6px';
      preview.appendChild(img);
      const title = document.createElement('div');
      title.style.fontWeight = '600';
      title.textContent = group.group;
      preview.appendChild(title);
      card.appendChild(preview);
    }

    const ul = document.createElement('ul');
    ul.className = 'emoji-list';
    ul.style.listStyle = 'none';
    ul.style.padding = '0';
    ul.style.margin = '0';
    group.emojis.forEach((emoji: any, emojiIndex: number) => {
      const li = document.createElement('li');
  li.className = 'flex justify-between items-center p-2 border-b touch-draggable-item';
      li.setAttribute('draggable', 'true');
      li.dataset.emojiIndex = String(emojiIndex);
      // drag handlers for emojis within same group
      li.addEventListener('dragstart', (ev: DragEvent) => {
        ev.dataTransfer?.setData('text/emoji', JSON.stringify({ fromGroup: groupIndex, fromIndex: emojiIndex }));
        li.style.opacity = '0.5';
      });
      li.addEventListener('dragend', () => { li.style.opacity = ''; });
      li.addEventListener('dragover', (ev) => { ev.preventDefault(); });
      li.addEventListener('drop', (ev) => {
        ev.preventDefault();
        const data = ev.dataTransfer?.getData('text/emoji');
        if (data) {
          try {
            const parsed = JSON.parse(data);
            const { fromGroup, fromIndex } = parsed;
            const toIndex = Number(li.dataset.emojiIndex);
            if (fromGroup === groupIndex) {
              // reorder in same group
              const moved = emojiData[groupIndex].emojis.splice(fromIndex, 1)[0];
              emojiData[groupIndex].emojis.splice(toIndex, 0, moved);
              saveEmojiData(emojiData);
              renderGroups();
            } else {
              // move between groups
              const moved = emojiData[fromGroup].emojis.splice(fromIndex, 1)[0];
              emojiData[groupIndex].emojis.splice(toIndex, 0, moved);
              saveEmojiData(emojiData);
              renderGroups();
            }
          } catch (e) {
            // ignore
          }
        }
      });

      const left = document.createElement('div');
      left.style.display = 'flex';
      left.style.alignItems = 'center';
      left.style.gap = '8px';
      left.style.maxWidth = '70%';
      if (isLinux(emoji.url)) {
        const img = document.createElement('img');
        img.src = emoji.url;
        img.alt = emoji.name;
        img.width = 36;
        img.height = 36;
        img.style.borderRadius = '6px';
        img.style.objectFit = 'cover';
        left.appendChild(img);
      }
      const meta = document.createElement('div');
      meta.style.display = 'flex';
      meta.style.flexDirection = 'column';
      const nm = document.createElement('div');
      nm.style.fontWeight = '500';
      nm.textContent = emoji.name;
      const url = document.createElement('div');
      url.style.fontSize = '12px';
      url.style.color = '#666';
      url.style.wordBreak = 'break-all';
      url.style.maxWidth = '420px';
      url.textContent = emoji.url;
      meta.appendChild(nm);
      meta.appendChild(url);
      left.appendChild(meta);

      const right = document.createElement('div');
      right.className = 'flex gap-2 items-center';
      const editBtn = document.createElement('button');
      editBtn.textContent = '编辑';
      editBtn.className = 'btn';
      editBtn.addEventListener('click', async () => {
        const edited = await editEmojiDialog(emoji.name || '', emoji.url || '');
        if (!edited) return;
        updateEmoji(groupIndex, emojiIndex, 'name', edited.name);
        updateEmoji(groupIndex, emojiIndex, 'url', edited.url);
        renderGroups();
      });
      const copyBtn = document.createElement('button');
      copyBtn.textContent = '复制';
      copyBtn.className = 'btn';
      copyBtn.addEventListener('click', () => copyUrl(emoji.url));
      const delEmojiBtn = document.createElement('button');
      delEmojiBtn.textContent = '删除';
      delEmojiBtn.className = 'btn btn-primary';
      delEmojiBtn.addEventListener('click', () => deleteEmoji(groupIndex, emojiIndex));
      right.appendChild(editBtn);
      right.appendChild(copyBtn);
      right.appendChild(delEmojiBtn);

      li.appendChild(left);
      li.appendChild(right);
      ul.appendChild(li);
    });
    card.appendChild(ul);

  const addWrap = document.createElement('div');
  addWrap.style.marginTop = '8px';
  const addBtn = document.createElement('button');
  addBtn.textContent = 'Add Emoji';
  addBtn.className = 'btn';
  addBtn.addEventListener('click', () => addNewEmoji(groupIndex));
  addWrap.appendChild(addBtn);
  card.appendChild(addWrap);

    container.appendChild(card);
  });

  // attach touch drag support for emoji items (mobile/touch)
  try {
    attachTouchDrag(document, '.touch-draggable-item', {
      onDrop: ({ fromContainer, fromIndex, toContainer, toIndex, item }) => {
        // convert placeholder-based indices to emojiData operations
        if (!item) return;
        const fromGroupEl = fromContainer?.closest('.group-card') as HTMLElement | null;
        const toGroupEl = toContainer?.closest('.group-card') as HTMLElement | null;
        if (!fromGroupEl || !toGroupEl) {
          renderGroups();
          return;
        }
        const fromGroupIndex = Number(fromGroupEl.dataset.groupIndex);
        const toGroupIndex = Number(toGroupEl.dataset.groupIndex);
        // normalize indices (placeholder sits among children) — clamp
        const safeFrom = Math.max(0, Math.min((emojiData[fromGroupIndex]?.emojis?.length||0)-1, fromIndex));
        const safeTo = Math.max(0, Math.min((emojiData[toGroupIndex]?.emojis?.length||0), toIndex));
        if (fromGroupIndex === toGroupIndex) {
          const moved = emojiData[fromGroupIndex].emojis.splice(safeFrom, 1)[0];
          emojiData[toGroupIndex].emojis.splice(safeTo, 0, moved);
        } else {
          const moved = emojiData[fromGroupIndex].emojis.splice(safeFrom, 1)[0];
          emojiData[toGroupIndex].emojis.splice(safeTo, 0, moved);
        }
        saveEmojiData(emojiData);
        renderGroups();
      }
    });
  } catch (e) {
    // if touch-drag fails, just ignore — desktop drag still works
    console.warn('touch-drag attach failed', e);
  }
}

export async function initOptions() {
  console.log('[Nachoneko] initOptions running');
  await getEmojiData();
  // wire toolbar buttons
  const addBtn = document.getElementById('add-group');
  const resetBtn = document.getElementById('reset-default');
  const saveBtn = document.getElementById('save-data');
  if (addBtn) addBtn.addEventListener('click', () => addNewGroup());
  if (resetBtn) resetBtn.addEventListener('click', () => resetToDefault());
  if (saveBtn) saveBtn.addEventListener('click', () => saveEmojiData(emojiData));
  renderStatus();
  renderGroups();
}

// expose some helpers for external usage
export default {
  initOptions,
};

// Auto-init when loaded as a module in options.html
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { initOptions().catch(console.error); });
  } else {
    initOptions().catch(console.error);
  }
}
