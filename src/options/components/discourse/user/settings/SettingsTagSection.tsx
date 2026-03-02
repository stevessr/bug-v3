import { defineComponent } from 'vue'
import type { PropType, Ref } from 'vue'
import { Select } from 'ant-design-vue'

import TagPill from '../../layout/TagPill'

import type { PreferencesPayload, TagOption } from './types'

export default defineComponent({
  name: 'SettingsTagSection',
  props: {
    form: {
      type: Object as PropType<Ref<PreferencesPayload>>,
      required: true
    },
    tagOptions: {
      type: Object as PropType<Ref<TagOption[]>>,
      required: true
    },
    tagsLoading: {
      type: Object as PropType<Ref<boolean>>,
      required: true
    },
    getTagOption: {
      type: Function as PropType<(value: string) => TagOption | null>,
      required: true
    },
    onTagSearch: {
      type: Function as PropType<(query: string) => void>,
      required: true
    },
    onTagDropdown: {
      type: Function as PropType<(open: boolean) => void>,
      required: true
    }
  },
  setup(props) {
    const renderTagOption = (value: string) =>
      props.getTagOption(value) || {
        value,
        label: value,
        description: null
      }

    const renderTag = ({ value, closable, onClose }: any) => (
      <span class="user-settings-tag-render">
        <TagPill
          name={String(value)}
          text={renderTagOption(String(value)).label || String(value)}
          description={renderTagOption(String(value)).description || undefined}
          compact
        />
        {closable ? (
          <button
            type="button"
            class="user-settings-tag-close"
            onMousedown={(event: Event) => event.preventDefault()}
            onClick={onClose}
          >
            ×
          </button>
        ) : null}
      </span>
    )

    const renderOptions = () =>
      props.tagOptions.value.map(tag => (
        <Select.Option key={tag.value} value={tag.value}>
          <TagPill
            name={tag.value}
            text={tag.label}
            description={tag.description || undefined}
            compact
          />
        </Select.Option>
      ))

    return () => {
      const commonProps = {
        mode: 'tags' as const,
        size: 'small' as const,
        placeholder: '搜索或输入标签',
        filterOption: false,
        notFoundContent: props.tagsLoading.value ? '加载中...' : '无结果',
        onSearch: props.onTagSearch,
        onDropdownVisibleChange: props.onTagDropdown,
        'v-slots': {
          tagRender: renderTag,
          default: renderOptions
        }
      }

      return (
        <div class="user-settings-section">
          <div class="user-settings-section__title">标签偏好</div>
          <div class="user-settings-grid">
            <div class="user-settings-label">关注</div>
            <Select
              {...commonProps}
              class="user-settings-control"
              value={props.form.value.watched_tags}
              onUpdate:value={value => (props.form.value.watched_tags = (value || []) as string[])}
            />
            <div class="user-settings-label">追踪</div>
            <Select
              {...commonProps}
              class="user-settings-control"
              value={props.form.value.tracked_tags}
              onUpdate:value={value => (props.form.value.tracked_tags = (value || []) as string[])}
            />
            <div class="user-settings-label">关注首帖</div>
            <Select
              {...commonProps}
              class="user-settings-control"
              value={props.form.value.watching_first_post_tags}
              onUpdate:value={value =>
                (props.form.value.watching_first_post_tags = (value || []) as string[])
              }
            />
            <div class="user-settings-label">静音</div>
            <Select
              {...commonProps}
              class="user-settings-control"
              value={props.form.value.muted_tags}
              onUpdate:value={value => (props.form.value.muted_tags = (value || []) as string[])}
            />
          </div>
        </div>
      )
    }
  }
})
