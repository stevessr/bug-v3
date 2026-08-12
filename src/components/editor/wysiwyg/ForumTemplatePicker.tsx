/* @jsxImportSource vue */
import {
  computed,
  defineComponent,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  Teleport,
  watch
} from 'vue'

import {
  loadForumTemplates,
  markForumTemplateUsed,
  type DiscourseForumTemplate
} from '@/options/components/discourse/routes/templates'

// The picker is also used by the lazy-loaded chat composer. Keep its portal
// styles attached to the reusable component so chat does not depend on the
// WYSIWYG editor chunk having been loaded first.
import './styles/ProseMirrorEditor.css'

export default defineComponent({
  name: 'ForumTemplatePicker',
  props: {
    show: { type: Boolean, required: true },
    baseUrl: { type: String, default: '' },
    anchorEl: { type: Object as () => HTMLElement | null, default: null }
  },
  emits: ['close', 'select'],
  setup(props, { emit }) {
    const pickerRef = ref<HTMLElement | null>(null)
    const searchQuery = ref('')
    const templates = ref<DiscourseForumTemplate[]>([])
    const loading = ref(false)
    const error = ref('')
    const loaded = ref(false)
    const position = ref({ left: 12, top: 12 })
    let requestSequence = 0

    const visibleTemplates = computed(() => {
      const query = searchQuery.value.trim().toLowerCase()
      if (!query) return templates.value
      const terms = query.split(/\s+/).filter(Boolean)

      return templates.value
        .map(template => {
          const title = template.title.toLowerCase()
          const tags = template.tags.join(' ').toLowerCase()
          const content = template.content.toLowerCase()
          if (
            !terms.every(
              term => title.includes(term) || tags.includes(term) || content.includes(term)
            )
          ) {
            return { template, score: -1 }
          }
          const score = terms.reduce(
            (total, term) => total + (title.includes(term) ? 3 : tags.includes(term) ? 2 : 1),
            0
          )
          return { template, score }
        })
        .filter(item => item.score >= 0)
        .sort((a, b) => b.score - a.score || a.template.title.localeCompare(b.template.title))
        .map(item => item.template)
    })

    const updatePosition = () => {
      if (!props.show || typeof window === 'undefined') return
      const width = Math.min(420, window.innerWidth - 24)
      const height = Math.min(560, window.innerHeight - 24)
      const anchor = props.anchorEl
      if (!anchor) {
        position.value = {
          left: Math.max(12, Math.round((window.innerWidth - width) / 2)),
          top: Math.max(12, Math.round((window.innerHeight - height) / 2))
        }
        return
      }

      const rect = anchor.getBoundingClientRect()
      const gap = 8
      const below = window.innerHeight - rect.bottom - gap - 12
      const top = below >= height ? rect.bottom + gap : Math.max(12, rect.top - height - gap)
      position.value = {
        left: Math.max(12, Math.min(Math.round(rect.left), window.innerWidth - width - 12)),
        top: Math.max(12, Math.min(Math.round(top), window.innerHeight - height - 12))
      }
    }

    const load = async (force = false) => {
      if (!props.show || loading.value || (loaded.value && !force)) return
      if (!props.baseUrl) {
        error.value = '请先连接论坛后再使用模板'
        return
      }
      const requestId = ++requestSequence
      loading.value = true
      error.value = ''
      try {
        const result = await loadForumTemplates(props.baseUrl)
        if (requestId !== requestSequence) return
        templates.value = result
        loaded.value = true
      } catch (reason) {
        if (requestId !== requestSequence) return
        error.value = reason instanceof Error ? reason.message : '加载论坛模板失败'
      } finally {
        if (requestId === requestSequence) loading.value = false
      }
    }

    const excerpt = (content: string) =>
      content
        .replace(/\[\/?[^\]]*\]/g, ' ')
        .replace(/[*_`>#]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 150)

    const selectTemplate = (template: DiscourseForumTemplate, event: MouseEvent) => {
      event.preventDefault()
      event.stopPropagation()
      emit('select', template)
      void markForumTemplateUsed(props.baseUrl, template.id).catch(() => {
        // The usage counter is best effort and must not block insertion.
      })
      emit('close')
    }

    const onPointerDown = (event: PointerEvent) => {
      if (!props.show || !(event.target instanceof Node)) return
      if (pickerRef.value?.contains(event.target)) return
      emit('close')
    }

    const onKeydown = (event: KeyboardEvent) => {
      if (props.show && event.key === 'Escape') emit('close')
    }

    onMounted(() => {
      document.addEventListener('pointerdown', onPointerDown, true)
      document.addEventListener('keydown', onKeydown)
      window.addEventListener('resize', updatePosition)
      document.addEventListener('scroll', updatePosition, true)
    })

    onBeforeUnmount(() => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKeydown)
      window.removeEventListener('resize', updatePosition)
      document.removeEventListener('scroll', updatePosition, true)
    })

    watch(
      () => props.show,
      visible => {
        if (!visible) return
        searchQuery.value = ''
        void load()
        void nextTick(updatePosition)
      }
    )

    return () =>
      props.show ? (
        <Teleport to="body">
          <div
            ref={pickerRef}
            class="forum-template-picker"
            style={{ left: `${position.value.left}px`, top: `${position.value.top}px` }}
            role="dialog"
            aria-label="插入论坛模板"
            aria-busy={loading.value}
          >
            <div class="forum-template-picker__header">
              <div>
                <strong class="forum-template-picker__title">插入论坛模板</strong>
                <span class="forum-template-picker__hint">从论坛模板中快速填充当前编辑器</span>
              </div>
              <button
                type="button"
                class="forum-template-picker__close"
                title="关闭"
                aria-label="关闭论坛模板"
                onClick={() => emit('close')}
              >
                ×
              </button>
            </div>
            <div class="forum-template-picker__search-wrap">
              <input
                class="forum-template-picker__search"
                value={searchQuery.value}
                placeholder="搜索标题、内容或标签"
                aria-label="搜索论坛模板"
                onInput={event => (searchQuery.value = (event.target as HTMLInputElement).value)}
              />
            </div>
            <div class="forum-template-picker__body">
              {loading.value ? (
                <div class="forum-template-picker__state">加载论坛模板中…</div>
              ) : error.value ? (
                <div class="forum-template-picker__state forum-template-picker__state--error">
                  <span>{error.value}</span>
                  <button type="button" onClick={() => void load(true)}>
                    重试
                  </button>
                </div>
              ) : visibleTemplates.value.length === 0 ? (
                <div class="forum-template-picker__state">
                  {templates.value.length === 0 ? '暂无可用的论坛模板' : '没有匹配的模板'}
                </div>
              ) : (
                visibleTemplates.value.map(template => (
                  <details key={template.id} class="forum-template-item">
                    <summary class="forum-template-item__summary">
                      <span class="forum-template-item__title">{template.title}</span>
                      <button
                        type="button"
                        class="forum-template-item__insert"
                        title={`插入模板：${template.title}`}
                        aria-label={`插入模板：${template.title}`}
                        onClick={(event: MouseEvent) => selectTemplate(template, event)}
                      >
                        <span aria-hidden="true">▣</span>
                      </button>
                    </summary>
                    <div class="forum-template-item__content">
                      {template.tags.length > 0 ? (
                        <div class="forum-template-item__tags">
                          {template.tags.map(tag => (
                            <span key={tag} class="forum-template-item__tag">
                              #{tag}
                            </span>
                          ))}
                        </div>
                      ) : null}
                      <p>{excerpt(template.content) || '（模板内容为空）'}</p>
                    </div>
                  </details>
                ))
              )}
            </div>
          </div>
        </Teleport>
      ) : null
  }
})
