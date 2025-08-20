import { emojiSet as defaultEmojiSet } from './emoji-data.js';
import { promptDialog, confirmDialog, editEmojiDialog } from './dialog';
import { attachTouchDrag, isTouchDevice } from './touch-drag';
import htmx from 'htmx.org';

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
  const el = document.getElementById('status');
  if (el) {
    if (status) {
      el.textContent = status;
      el.classList.remove('hidden');
    } else {
      el.classList.add('hidden');
    }
  }
}

function renderGroups() {
  const container = document.getElementById('groups');
  if (!container) return;
  container.innerHTML = '';
  emojiData.forEach((group, groupIndex) => {
    const card = document.createElement('div');
    card.className = 'group-card bg-white rounded-xl shadow-md overflow-hidden border border-gray-200 hover:shadow-lg transition-shadow duration-300';
    card.setAttribute('draggable', 'true');
    card.dataset.groupIndex = String(groupIndex);
    
    // drag handlers for reordering groups
    card.addEventListener('dragstart', (ev: DragEvent) => {
      ev.dataTransfer?.setData('text/group-index', String(groupIndex));
      card.style.opacity = '0.5';
    });
    card.addEventListener('dragend', () => { 
      card.style.opacity = ''; 
    });
    card.addEventListener('dragover', (ev) => { ev.preventDefault(); });
    card.addEventListener('drop', (ev) => {
      ev.preventDefault();
      const src = ev.dataTransfer?.getData('text/group-index');
      if (src != null) {
        const from = Number(src);
        const to = Number(card.dataset.groupIndex);
        if (!Number.isNaN(from) && !Number.isNaN(to) && from !== to) {
          const moved = emojiData.splice(from, 1);
          emojiData.splice(to, 0, moved);
          saveEmojiData(emojiData);
          // 重新渲染界面以反映新的顺序
          renderGroups();
        }
      }
    });
    
    // Card header
    const header = document.createElement('div');
    header.className = 'p-4 border-b border-gray-200 bg-gray-50';
    
    const headerTop = document.createElement('div');
    headerTop.className = 'flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3';
    
    const left = document.createElement('div');
    left.className = 'flex items-center gap-3 flex-1';
    
    if (group.icon) {
      const img = document.createElement('img');
      img.src = group.icon;
      img.alt = group.group;
      img.className = 'w-10 h-10 object-cover rounded-lg';
      left.appendChild(img);
    }
    
    const nameInput = document.createElement('input');
    nameInput.value = group.group || '';
    nameInput.placeholder = '分组名称';
    nameInput.className = 'flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500';
    nameInput.addEventListener('input', (e: any) => updateGroupName(groupIndex, e.target.value));
    left.appendChild(nameInput);
    
    headerTop.appendChild(left);
    
    const right = document.createElement('div');
    const delBtn = document.createElement('button');
    delBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-red-500 hover:text-red-700" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
      </svg>
    `;
    delBtn.className = 'p-2 rounded-full hover:bg-red-100 transition-colors duration-200';
    delBtn.title = '删除分组';
    delBtn.addEventListener('click', () => deleteGroup(groupIndex));
    right.appendChild(delBtn);
    
    headerTop.appendChild(right);
    header.appendChild(headerTop);
    
    const iconInput = document.createElement('input');
    iconInput.value = group.icon || '';
    iconInput.placeholder = '图标URL (可选)';
    iconInput.className = 'mt-3 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm';
    iconInput.addEventListener('input', (e: any) => updateGroupIcon(groupIndex, e.target.value));
    header.appendChild(iconInput);
    
    card.appendChild(header);
    
    // Group preview
    if (group.icon) {
      const preview = document.createElement('div');
      preview.className = 'px-4 py-3 flex items-center gap-3 border-b border-gray-100';
      const img = document.createElement('img');
      img.src = group.icon;
      img.alt = group.group;
      img.className = 'w-12 h-12 object-cover rounded-lg';
      preview.appendChild(img);
      const title = document.createElement('div');
      title.className = 'font-semibold text-gray-800';
      title.textContent = group.group;
      preview.appendChild(title);
      card.appendChild(preview);
    }
    
    // Emoji list
    const ul = document.createElement('ul');
    ul.className = 'emoji-list divide-y divide-gray-100 max-h-96 overflow-y-auto';
    
    group.emojis.forEach((emoji: any, emojiIndex: number) => {
      const li = document.createElement('li');
      li.className = 'p-3 flex justify-between items-center touch-draggable-item hover:bg-gray-50 transition-colors duration-150';
      li.setAttribute('draggable', 'true');
      li.dataset.emojiIndex = String(emojiIndex);
      
      // drag handlers for emojis within same group
      li.addEventListener('dragstart', (ev: DragEvent) => {
        ev.dataTransfer?.setData('text/emoji', JSON.stringify({ fromGroup: groupIndex, fromIndex: emojiIndex }));
        li.style.opacity = '0.5';
      });
      li.addEventListener('dragend', () => { 
        li.style.opacity = ''; 
      });
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
              const moved = emojiData[groupIndex].emojis.splice(fromIndex, 1);
              emojiData[groupIndex].emojis.splice(toIndex, 0, moved);
              saveEmojiData(emojiData);
              // 重新渲染界面以反映新的顺序
              renderGroups();
            } else {
              // move between groups
              const moved = emojiData[fromGroup].emojis.splice(fromIndex, 1);
              emojiData[groupIndex].emojis.splice(toIndex, 0, moved);
              saveEmojiData(emojiData);
              // 重新渲染界面以反映新的顺序
              renderGroups();
            }
          } catch (e) {
            // ignore
          }
        }
      });
      
      const left = document.createElement('div');
      left.className = 'flex items-center gap-3 flex-1 min-w-0';
      
      if (isLinux(emoji.url)) {
        const img = document.createElement('img');
        img.src = emoji.url;
        img.alt = emoji.name;
        img.className = 'w-9 h-9 rounded-lg object-cover flex-shrink-0';
        left.appendChild(img);
      }
      
      const meta = document.createElement('div');
      meta.className = 'min-w-0';
      const nm = document.createElement('div');
      nm.className = 'font-medium text-gray-800 truncate';
      nm.textContent = emoji.name;
      meta.appendChild(nm);
      left.appendChild(meta);
      
      const right = document.createElement('div');
      right.className = 'flex gap-1 items-center';
      
      // drag handle for touch devices
      const handle = document.createElement('button');
      handle.className = 'drag-handle p-1.5 rounded-lg hover:bg-gray-200 transition-colors duration-200';
      handle.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clip-rule="evenodd" />
        </svg>
      `;
      handle.title = '拖拽排序';
      // 阻止点击事件冒泡到父元素
      handle.addEventListener('click', (e) => {
        e.stopPropagation();
      });
      right.appendChild(handle);
      
      const openBtn = document.createElement('button');
      openBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-blue-500 hover:text-blue-700" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z" clip-rule="evenodd" />
        </svg>
      `;
      openBtn.className = 'p-1.5 rounded-lg hover:bg-blue-100 transition-colors duration-200';
      openBtn.title = '打开链接';
      openBtn.addEventListener('click', () => openExternal(emoji.url));
      right.appendChild(openBtn);
      
      const copyBtn = document.createElement('button');
      copyBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-500 hover:text-gray-700" viewBox="0 0 20 20" fill="currentColor">
          <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
          <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
        </svg>
      `;
      copyBtn.className = 'p-1.5 rounded-lg hover:bg-gray-200 transition-colors duration-200';
      copyBtn.title = '复制链接';
      copyBtn.addEventListener('click', () => copyUrl(emoji.url));
      right.appendChild(copyBtn);
      
      const delEmojiBtn = document.createElement('button');
      delEmojiBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-red-500 hover:text-red-700" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
        </svg>
      `;
      delEmojiBtn.className = 'p-1.5 rounded-lg hover:bg-red-100 transition-colors duration-200';
      delEmojiBtn.title = '删除表情';
      delEmojiBtn.addEventListener('click', () => deleteEmoji(groupIndex, emojiIndex));
      right.appendChild(delEmojiBtn);
      
      li.appendChild(left);
      li.appendChild(right);
      ul.appendChild(li);
    });
    
    card.appendChild(ul);
    
    // Add emoji button
    const addWrap = document.createElement('div');
    addWrap.className = 'p-4 bg-gray-50 border-t border-gray-200';
    const addBtn = document.createElement('button');
    addBtn.innerHTML = `
      <div class="flex items-center justify-center gap-2 text-gray-600 hover:text-gray-800">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clip-rule="evenodd" />
        </svg>
        添加表情
      </div>
    `;
    addBtn.className = 'w-full py-2 rounded-lg hover:bg-gray-100 transition-colors duration-200';
    addBtn.addEventListener('click', () => addNewEmoji(groupIndex));
    addWrap.appendChild(addBtn);
    card.appendChild(addWrap);
    
    container.appendChild(card);
  });
  
  // attach touch drag support for emoji items (mobile/touch)
  try {
    attachTouchDrag(document, '.touch-draggable-item', {
      handleSelector: '.drag-handle',
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
          const moved = emojiData[fromGroupIndex].emojis.splice(safeFrom, 1);
          emojiData[toGroupIndex].emojis.splice(safeTo, 0, moved);
        } else {
          const moved = emojiData[fromGroupIndex].emojis.splice(safeFrom, 1);
          emojiData[toGroupIndex].emojis.splice(safeTo, 0, moved);
        }
        saveEmojiData(emojiData);
        // 重新渲染界面以反映新的顺序
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
  // add a root class when touch is available so we can show touch-only UI (like drag handles)
  try {
    if (isTouchDevice() && document && document.documentElement) {
      document.documentElement.classList.add('has-touch');
    } else if (document && document.documentElement) {
      document.documentElement.classList.remove('has-touch');
    }
  } catch (e) {
    // ignore
  }
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