import { defineComponent } from 'vue'
import type { PropType, Ref } from 'vue'
import { Select } from 'ant-design-vue'

import type { EmojiShortcode } from '../../bbcode'

import type { PreferencesPayload } from './types'

export default defineComponent({
  name: 'SettingsEmojiSection',
  props: {
    form: {
      type: Object as PropType<Ref<PreferencesPayload>>,
      required: true
    },
    reactionTypeOptions: {
      type: Array as PropType<Array<{ value: string; label: string }>>,
      required: true
    },
    emojiOptions: {
      type: Object as PropType<Ref<EmojiShortcode[]>>,
      required: true
    },
    emojiLoading: {
      type: Object as PropType<Ref<boolean>>,
      required: true
    },
    getEmojiOption: {
      type: Function as PropType<(value: string) => EmojiShortcode | null>,
      required: true
    },
    onEmojiSearch: {
      type: Function as PropType<(query: string) => void>,
      required: true
    },
    onEmojiDropdown: {
      type: Function as PropType<(open: boolean) => void>,
      required: true
    }
  },
  setup(props) {
    const renderEmoji = (value: string) => {
      const emoji = props.getEmojiOption(value)
      if (!emoji) {
        return <span>:{value}:</span>
      }
      return (
        <span class="inline-flex items-center gap-2">
          <img src={emoji.url} alt={emoji.name} class="w-4 h-4" loading="lazy" />
          <span>:{emoji.name}:</span>
        </span>
      )
    }

    const renderTag = ({ value, closable, onClose }: any) => (
      <span class="inline-flex items-center gap-1 mr-1">
        {renderEmoji(String(value))}
        {closable ? (
          <button
            type="button"
            class="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            onMousedown={(event: Event) => event.preventDefault()}
            onClick={onClose}
          >
            ×
          </button>
        ) : null}
      </span>
    )

    const renderOptions = () =>
      props.emojiOptions.value.map(emoji => (
        <Select.Option key={emoji.name} value={emoji.name}>
          {renderEmoji(emoji.name)}
        </Select.Option>
      ))

    return () => (
      <div class="border-t border-gray-200/70 dark:border-gray-700 pt-3">
        <div class="text-xs font-semibold text-gray-400 mb-2">表情偏好</div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs items-center">
          <div class="text-gray-500">快速表情来源</div>
          <Select
            size="small"
            class="w-full"
            placeholder="选择策略"
            options={props.reactionTypeOptions}
            value={props.form.value.chat_quick_reaction_type}
            onUpdate:value={(value: string | undefined) =>
              (props.form.value.chat_quick_reaction_type = value)
            }
          />
          <div class="text-gray-500">自定义快速表情</div>
          <Select
            mode="multiple"
            size="small"
            class="w-full"
            placeholder="搜索表情名称"
            filterOption={false}
            notFoundContent={props.emojiLoading.value ? '加载中...' : '无结果'}
            value={props.form.value.chat_quick_reactions_custom}
            onSearch={props.onEmojiSearch}
            onDropdownVisibleChange={props.onEmojiDropdown}
            onUpdate:value={(value: string[]) =>
              (props.form.value.chat_quick_reactions_custom = value || [])
            }
            disabled={props.form.value.chat_quick_reaction_type !== 'custom'}
            v-slots={{
              tagRender: renderTag,
              default: renderOptions
            }}
          />
        </div>
      </div>
    )
  }
})
