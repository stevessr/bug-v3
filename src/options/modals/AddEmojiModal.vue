<template>
  <div v-if="show" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" @click="close">
    <div class="bg-white rounded-lg p-6 w-full max-w-md" @click.stop>
      <h3 class="text-lg font-semibold mb-4">添加表情</h3>
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">表情名称</label>
          <input v-model="name" type="text" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="输入表情名称" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">输入模式</label>
          <div class="flex items-center gap-2">
            <select v-model="inputMode" class="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="url">单个 URL</option>
              <option value="markdown">Markdown (批量)</option>
              <option value="html">HTML (批量)</option>
            </select>
            <div class="text-xs text-gray-500">已解析: {{ parsedItems.length }} 个</div>
          </div>
        </div>
        <div v-if="inputMode === 'url'">
          <label class="block text-sm font-medium text-gray-700 mb-1">图片URL</label>
          <input v-model="url" type="url" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="输入图片链接" />
        </div>
        <div v-else>
          <label class="block text-sm font-medium text-gray-700 mb-1">粘贴内容 (Markdown 或 HTML)</label>
          <textarea v-model="pasteText" rows="6" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" :placeholder="inputMode === 'markdown' ? '粘贴 Markdown 图片，如 ![name|512x512](url)...' : '粘贴 HTML 片段 (例如 discourse lightbox 的 HTML)'">
          </textarea>
          <div class="flex items-center justify-between mt-2">
            <div class="text-xs text-gray-500">预览会解析出: {{ parsedItems.length }} 个</div>
            <div class="flex gap-2">
              <button @click="previewParse" type="button" class="px-3 py-1 text-xs bg-gray-100 rounded">预览</button>
              <button @click="importParsed" type="button" class="px-3 py-1 text-xs bg-blue-600 text-white rounded">导入解析项</button>
            </div>
          </div>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">所属分组</label>
          <select v-model="groupId" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option v-for="g in groups" :key="g.id" :value="g.id">{{ g.name }}</option>
          </select>
        </div>
        <div v-if="url" class="text-center">
          <img :src="url" alt="预览" class="w-16 h-16 object-contain mx-auto border border-gray-200 rounded" @error="handleImageError" />
        </div>
      </div>
      <div class="flex justify-end gap-3 mt-6">
        <button @click="close" class="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded transition-colors">取消</button>
        <button @click="add" class="px-4 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors">添加</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, toRefs } from 'vue';
import { useEmojiStore } from '../../stores/emojiStore';
import { flushBuffer } from '../../utils/indexedDB';

const props = defineProps<{ show: boolean; groups: any[]; defaultGroupId?: string }>()

// expose groups as a reactive ref for template and internal use
const { groups } = toRefs(props as any);

const emits = defineEmits<{
  (e: 'update:show', value: boolean): void,
  (e: 'added', payload: { groupId: string; name: string }): void,
}>();

const name = ref('');
const url = ref('');
const inputMode = ref<'url' | 'markdown' | 'html'>('url');
const pasteText = ref('');
const parsedItems = ref<Array<{ name: string; url: string }>>([]);
// initialize groupId from reactive props; don't destructure props to keep reactivity
const groupId = ref(props.defaultGroupId || props.groups?.[0]?.id || '');

// Keep groupId in sync when defaultGroupId prop changes
watch(() => props.defaultGroupId, (v) => {
  if (v) groupId.value = v;
});

// If groups list changes (e.g. first load), ensure we have a sensible default
watch(() => props.groups, (g) => {
  if ((!groupId.value || !g?.find((x: any) => x.id === groupId.value)) && g && g.length) {
    groupId.value = props.defaultGroupId || g[0].id || '';
  }
}, { immediate: true });

// Reset fields when the modal opens so repeated opens work without refresh
watch(() => props.show, (v) => {
  if (v) {
    name.value = '';
    url.value = '';
  groupId.value = props.defaultGroupId || (groups.value && groups.value[0]?.id) || '';
  pasteText.value = '';
  parsedItems.value = [];
  inputMode.value = 'url';
  }
});

const emojiStore = useEmojiStore();

const handleImageError = (event: Event) => {
  const target = event.target as HTMLImageElement;
  target.src = '';
};

const parseMarkdownImages = (text: string) => {
  const items: Array<{ name: string; url: string }> = [];
  if (!text) return items;
  const re = /!\[([^\]]*)\]\(([^)]+)\)/g;
  let match: RegExpExecArray | null = null;
  while ((match = re.exec(text)) !== null) {
    const alt = (match[1] || '').trim();
    let urlRaw = (match[2] || '').trim();
    // strip optional title after space: (url "title")
    urlRaw = urlRaw.split(/\s+/)[0].replace(/^['"]|['"]$/g, '').trim();
    const namePart = (alt || '').split('|')[0].trim();
    const nameVal = namePart || decodeURIComponent((urlRaw.split('/').pop() || '').split('?')[0]) || '\u672a\u547d\u540d';
    items.push({ name: nameVal, url: urlRaw });
  }
  return items;
}

const parseHTMLImages = (text: string) => {
  const items: Array<{ name: string; url: string }> = [];
  if (!text) return items;
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'text/html');
    // prefer anchors with class lightbox
    const anchors = Array.from(doc.querySelectorAll('a.lightbox')) as HTMLAnchorElement[];
    if (anchors.length) {
      anchors.forEach((a) => {
        const title = a.getAttribute('title') || '';
        const img = a.querySelector('img') as HTMLImageElement | null;
        const href = (a.getAttribute('data-download-href') || a.getAttribute('href') || (img && img.src) || '').trim();
        const nameVal = title || (img && img.alt) || decodeURIComponent((href.split('/').pop() || '').split('?')[0]) || '\u672a\u547d\u540d';
        if (href) items.push({ name: nameVal, url: href });
      });
      return items;
    }

    // fallback: parse img tags
    const imgs = Array.from(doc.querySelectorAll('img')) as HTMLImageElement[];
    imgs.forEach((img) => {
      const src = (img.getAttribute('src') || '').trim();
      const alt = img.getAttribute('alt') || '';
      const nameVal = alt || decodeURIComponent((src.split('/').pop() || '').split('?')[0]) || '\u672a\u547d\u540d';
      if (src) items.push({ name: nameVal, url: src });
    });
  } catch (e) {
    // parsing failed, return empty
  }
  return items;
}

const previewParse = () => {
  if (inputMode.value === 'markdown') {
    parsedItems.value = parseMarkdownImages(pasteText.value);
  } else if (inputMode.value === 'html') {
    parsedItems.value = parseHTMLImages(pasteText.value);
  } else {
    parsedItems.value = [];
  }
}

const close = () => {
  emits('update:show', false);
};

const add = () => {
  // If non-url mode, parse pasteText and import parsed items
  if (inputMode.value !== 'url') {
    previewParse();
    if (parsedItems.value.length > 0) {
      if (!groupId.value) return;
      emojiStore.beginBatch();
      try {
        parsedItems.value.forEach((it) => {
          const emojiData = { packet: Date.now(), name: it.name, url: it.url };
          emojiStore.addEmojiWithoutSave(groupId.value, emojiData);
          emits('added', { groupId: groupId.value, name: emojiData.name });
        });
        void flushBuffer(true).then(() => console.log('[AddEmojiModal] bulk addEmoji flushed'));
      } finally {
        void emojiStore.endBatch();
      }
      emits('update:show', false);
      pasteText.value = '';
      parsedItems.value = [];
      return;
    }
  }

  if (!name.value.trim() || !url.value.trim() || !groupId.value) return;
  const emojiData = { packet: Date.now(), name: name.value.trim(), url: url.value.trim() };
  emojiStore.addEmoji(groupId.value, emojiData);
  void flushBuffer(true).then(() => console.log('[AddEmojiModal] addEmoji flushed'));
  emits('added', { groupId: groupId.value, name: emojiData.name });
  emits('update:show', false);
  name.value = '';
  url.value = '';
  groupId.value = groups.value?.[0]?.id || '';
}

const importParsed = () => {
  previewParse();
  if (parsedItems.value.length === 0) return;
  if (!groupId.value) return;
  emojiStore.beginBatch();
  try {
    parsedItems.value.forEach((it) => {
      const emojiData = { packet: Date.now(), name: it.name, url: it.url };
      emojiStore.addEmojiWithoutSave(groupId.value, emojiData);
      emits('added', { groupId: groupId.value, name: emojiData.name });
    });
    void flushBuffer(true).then(() => console.log('[AddEmojiModal] importParsed flushed'));
  } finally {
    void emojiStore.endBatch();
  }
  pasteText.value = '';
  parsedItems.value = [];
  emits('update:show', false);
}
</script>
