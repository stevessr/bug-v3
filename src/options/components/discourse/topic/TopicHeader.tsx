import { defineComponent, nextTick, ref, watch } from 'vue'
import { message } from 'ant-design-vue'

import type { DiscourseTopicDetail } from '../types'
import { updateTopicTitle } from '../actions'
import { formatTime } from '../utils'

export default defineComponent({
  name: 'TopicHeader',
  props: {
    topic: { type: Object as () => DiscourseTopicDetail, required: true },
    baseUrl: { type: String, required: true }
  },
  setup(props) {
    const editing = ref(false)
    const draftTitle = ref(props.topic.title)
    const saving = ref(false)
    const inputRef = ref<HTMLInputElement | null>(null)

    watch(
      () => [props.topic.id, props.topic.title] as const,
      ([, title]) => {
        if (!editing.value) draftTitle.value = title
      }
    )

    const beginEdit = () => {
      draftTitle.value = props.topic.title
      editing.value = true
      void nextTick(() => inputRef.value?.focus())
    }

    const cancelEdit = () => {
      if (saving.value) return
      draftTitle.value = props.topic.title
      editing.value = false
    }

    const saveTitle = async () => {
      const title = draftTitle.value.trim()
      if (!title || saving.value) return
      if (title === props.topic.title) {
        editing.value = false
        return
      }
      saving.value = true
      const originalTitle = props.topic.title
      try {
        const data = await updateTopicTitle(props.baseUrl, props.topic.id, title, originalTitle)
        props.topic.title = String(data?.title || title)
        props.topic.fancy_title = String(data?.fancy_title || data?.title || title)
        editing.value = false
        message.success('话题标题已更新')
      } catch (error) {
        message.error(error instanceof Error ? error.message : '修改话题标题失败')
      } finally {
        saving.value = false
      }
    }

    return () => (
      <header class="topic-header">
        <span class="topic-header__eyebrow">讨论主题</span>
        {editing.value ? (
          <form
            class="topic-header__editor"
            onSubmit={(event: Event) => {
              event.preventDefault()
              void saveTitle()
            }}
          >
            <input
              ref={inputRef}
              value={draftTitle.value}
              maxlength="255"
              aria-label="话题标题"
              disabled={saving.value}
              onInput={(event: Event) => {
                draftTitle.value = (event.target as HTMLInputElement).value
              }}
              onKeydown={(event: KeyboardEvent) => {
                if (event.key === 'Escape') cancelEdit()
              }}
            />
            <button type="submit" disabled={saving.value || !draftTitle.value.trim()}>
              {saving.value ? '保存中…' : '保存'}
            </button>
            <button type="button" disabled={saving.value} onClick={cancelEdit}>
              取消
            </button>
          </form>
        ) : (
          <div class="topic-header__title-row">
            <h1 class="topic-header__title">{props.topic.fancy_title || props.topic.title}</h1>
            {props.topic.details?.can_edit && (
              <button
                type="button"
                class="topic-header__edit"
                title="编辑话题标题"
                aria-label="编辑话题标题"
                onClick={beginEdit}
              >
                ✎
              </button>
            )}
          </div>
        )}
        <div class="topic-header__meta">
          <span class="topic-header__meta-item">{props.topic.posts_count} 回复</span>
          <span class="topic-header__meta-item">
            创建于{' '}
            <time datetime={props.topic.created_at}>{formatTime(props.topic.created_at)}</time>
          </span>
        </div>
      </header>
    )
  }
})
