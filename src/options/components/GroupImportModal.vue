<template>
  <a-modal v-model:open="visible" title="导入分组表情" :width="1000" :bodyStyle="{ maxHeight: '72vh', overflow: 'auto' }" @ok="onOk" @cancel="close">
      <a-form layout="vertical">
        <a-form-item label="输入要导入的内容 (支持单个 URL / Markdown / BBCode / HTML / 或分组导出 JSON)">
          <a-textarea v-model:value="text" rows="6" />
        </a-form-item>
        <a-form-item label="导入格式">
          <a-select v-model:value="format" style="width:220px">
            <a-select-option value="auto">自动检测</a-select-option>
            <a-select-option value="text">纯文本 / URL 列表 / BBCode</a-select-option>
            <a-select-option value="markdown">Markdown 图片语法</a-select-option>
            <a-select-option value="html">HTML（img / a.lightbox）</a-select-option>
            <a-select-option value="group-json">分组导出 JSON</a-select-option>
          </a-select>
          <a-button style="margin-left:12px" @click="parse">解析预览</a-button>
        </a-form-item>
      <a-list v-if="preview.length" :dataSource="preview" bordered>
        <a-list-item v-for="(p, idx) in preview" :key="p.id">
          <template #avatar>
            <img :src="selected[idx] || p.displayUrl || p.realUrl" style="width:56px; height:56px; object-fit:cover; border-radius:6px" />
          </template>
          <a-list-item-meta :title="p.displayName || p.realUrl" :description="p.realUrl" />
          <template #actions>
            <div style="display:flex; flex-direction:column; gap:8px; width:420px">
              <div class="variant-grid" :style="{ gridTemplateColumns: `repeat(${gridCols}, 1fr)` }">
                <div
                  v-for="(v, vi) in variantList(p)"
                  :key="vi"
                  class="variant-item"
                  :class="{ selected: selected[idx] === v.url }"
                >
                  <img :src="v.url" alt="variant" />
                  <div class="variant-label">{{ v.label }}</div>
                </div>
              </div>
              <a-select v-model:value="selected[idx]" style="width:100%" placeholder="选择作为预览 URL">
                <a-select-option v-for="(v, vi) in variantList(p)" :key="vi" :value="v.url">{{ v.label }} — {{ truncate(v.url) }}</a-select-option>
              </a-select>
              <div style="font-size:12px; color:var(--ant-text-color-secondary)">使用上方下拉选择要作为条目的预览 URL</div>
            </div>
          </template>
        </a-list-item>
      </a-list>
    </a-form>
        <a-form-item style="display:flex; gap:8px; align-items:center;">
          <div style="margin-left:auto; display:flex; gap:8px; align-items:center">
            <span style="font-size:12px; color:var(--ant-text-color-secondary)">网格列数</span>
            <a-input-number v-model:value="gridCols" :min="2" :max="6" />
          </div>
        </a-form-item>
  </a-modal>
</template>

<script lang="ts">
import { defineComponent, ref, watch } from 'vue'
import { parseEmojisFromText } from '../utils/parser'

export default defineComponent({
  props: {
    modelValue: { type: Boolean, required: true },
    groupUUID: { type: String, required: true },
  },
  emits: ['update:modelValue', 'imported'],
  setup(props, { emit }) {
    const visible = ref(!!props.modelValue)
    const text = ref('')
    const preview = ref<any[]>([])
  const format = ref<'auto' | 'text' | 'markdown' | 'html' | 'group-json'>('auto')

    watch(
      () => props.modelValue,
      (v) => (visible.value = !!v),
    )

    function close() {
      emit('update:modelValue', false)
    }

    const selected = ref<any[]>([])
    const gridCols = ref(3)

    function parse() {
      const t = (text.value || '').trim()

      // group-json explicit or auto-detected JSON payload
      if (format.value === 'group-json' || (format.value === 'auto' && (t.startsWith('{') || t.startsWith('[')))) {
        try {
          const j = JSON.parse(t)
          let arr: any[] = []
          if (Array.isArray(j)) arr = j
          else if (Array.isArray(j.emojiGroups) && j.emojiGroups.length === 1 && Array.isArray(j.emojiGroups[0].emojis)) arr = j.emojiGroups[0].emojis
          else if (j.group && Array.isArray(j.group.emojis)) arr = j.group.emojis
          else if (Array.isArray(j.emojis)) arr = j.emojis
          else if (Array.isArray(j.emojiGroups)) arr = j.emojiGroups.flatMap((gg: any) => Array.isArray(gg.emojis) ? gg.emojis : [])
          preview.value = arr || []
        } catch (err) {
          // fall back to best-effort text parsing
          preview.value = parseEmojisFromText(text.value)
        }
        selected.value = preview.value.map((p: any) => p.displayUrl || p.realUrl)
        return
      }

      // explicit html / markdown / text selection or auto fallback
      if (format.value === 'html') {
        preview.value = parseHtmlOnly(t)
      } else if (format.value === 'markdown') {
        preview.value = parseMarkdownOnly(t)
      } else if (format.value === 'text') {
        preview.value = parseTextOnly(t)
      } else {
        // auto: heuristics
        if (t.indexOf('<') >= 0 && t.indexOf('>') >= 0) preview.value = parseHtmlOnly(t)
        else if (/!\[[^\]]*\]\([^\)]+\)/.test(t)) preview.value = parseMarkdownOnly(t)
        else preview.value = parseTextOnly(t)
      }
      selected.value = preview.value.map((p: any) => p.displayUrl || p.realUrl)
    }

    function parseHtmlOnly(input: string) {
      const out: any[] = []
      try {
        const doc = new DOMParser().parseFromString(input, 'text/html')
        const anchors = Array.from(doc.querySelectorAll('a.lightbox'))
        if (anchors.length) {
          for (const a of anchors) {
            const href = (a.getAttribute('href') || '').trim()
            const img = a.querySelector('img')
            if (img) {
              const src = (img.getAttribute('src') || '').trim()
              const alt = (img.getAttribute('alt') || '').trim() || ''
              const srcset = img.getAttribute('srcset') || ''
              const variants: Record<string, string> = {}
              if (srcset) {
                const parts = srcset.split(',').map((s) => s.trim())
                for (const p of parts) {
                  const [u, q] = p.split(/\s+/)
                  if (!q) variants['1x'] = u
                  else if (q.endsWith('x')) variants[q] = u
                }
              }
              const displayUrl = src || variants['1x'] || ''
              const realUrl = href || displayUrl
              out.push({ UUID: '', id: '', displayName: alt || '', displayUrl, realUrl, variants })
            }
          }
        } else {
          const imgs = Array.from(doc.querySelectorAll('img'))
          imgs.forEach((img) => {
            const src = (img.getAttribute('src') || '').trim()
            const alt = (img.getAttribute('alt') || '').trim() || ''
            const href = (img.closest('a')?.getAttribute('href') || '').trim()
            out.push({ UUID: '', id: '', displayName: alt || '', displayUrl: src, realUrl: href || src, variants: {} })
          })
        }
      } catch (_) {}
      return out
    }

    function parseMarkdownOnly(input: string) {
      const out: any[] = []
      const mdRegex = /!\[([^\]]*)\]\(([^)]+)\)/g
      let m: RegExpExecArray | null
      while ((m = mdRegex.exec(input))) {
        const alt = m[1] || ''
        const url = m[2] || ''
        out.push({ UUID: '', id: '', displayName: alt, displayUrl: url, realUrl: url, variants: {} })
      }
      return out
    }

    function parseTextOnly(input: string) {
      const out: any[] = []
      const bbRegex = /\[img\]([^\[]+)\[\/img\]/gi
      let m: RegExpExecArray | null
      while ((m = bbRegex.exec(input))) {
        const url = (m[1] || '').trim()
        out.push({ UUID: '', id: '', displayName: '', displayUrl: url, realUrl: url, variants: {} })
      }
      if (out.length) return out
      const lines = input.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
      for (const line of lines) {
        if (/^https?:\/\//i.test(line)) {
          out.push({ UUID: '', id: '', displayName: '', displayUrl: line, realUrl: line, variants: {} })
        }
      }
      return out
    }

    function variantList(p: any) {
      const list: { url: string; label: string }[] = []
      if (p.displayUrl) list.push({ url: p.displayUrl, label: '显示' })
      if (p.variants && typeof p.variants === 'object') {
        Object.keys(p.variants).forEach((k) => {
          list.push({ url: p.variants[k], label: k })
        })
      }
      if (p.realUrl) list.push({ url: p.realUrl, label: '原始' })
      return list
    }

    function selectVariant(idx: number, url: string) {
      selected.value[idx] = url
    }

    function truncate(s: string | undefined, len = 60) {
      if (!s) return ''
      return s.length > len ? s.slice(0, len - 3) + '...' : s
    }

    function onOk() {
      if (preview.value.length) {
        const mapped = preview.value.map((p: any, i: number) => ({
          ...p,
          displayUrl: selected.value[i] || p.displayUrl,
        }))
        // dedupe by UUID or realUrl
        const seen = new Set<string>()
        const deduped: any[] = []
        let skipped = 0
        for (const e of mapped) {
          const key = e.UUID || e.id || e.realUrl || e.displayUrl
          if (!key) continue
          if (seen.has(key)) {
            skipped++
            continue
          }
          seen.add(key)
          deduped.push(e)
        }
        emit('imported', { groupUUID: props.groupUUID, emojis: deduped, skipped })
      }
      close()
    }

  return { visible, text, preview, parse, onOk, close, selected, gridCols, variantList, selectVariant, format, truncate }
  },
})
</script>

<style scoped>
.variant-grid {
  display: grid;
  gap: 8px;
}
.variant-item {
  border: 1px solid var(--ant-border-color);
  padding: 4px;
  border-radius: 4px;
  text-align: center;
  cursor: pointer;
}
.variant-item img {
  width: 100%;
  height: 64px;
  object-fit: cover;
  border-radius: 2px;
}
.variant-item .variant-label {
  font-size: 12px;
  color: var(--ant-text-color-secondary);
  margin-top: 4px;
}
.variant-item.selected {
  box-shadow: 0 0 0 2px var(--ant-primary-color);
}
</style>
