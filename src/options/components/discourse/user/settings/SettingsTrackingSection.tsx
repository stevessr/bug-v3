import { defineComponent } from 'vue'
import type { PropType, Ref } from 'vue'
import { Select, Switch } from 'ant-design-vue'

import type { PreferencesPayload } from './types'

type Option = { value: number; label: string }

export default defineComponent({
  name: 'SettingsTrackingSection',
  props: {
    form: {
      type: Object as PropType<Ref<PreferencesPayload>>,
      required: true
    },
    newTopicDurationOptions: {
      type: Array as PropType<Option[]>,
      required: true
    },
    autoTrackOptions: {
      type: Array as PropType<Option[]>,
      required: true
    },
    notificationLevelOptions: {
      type: Array as PropType<Option[]>,
      required: true
    }
  },
  setup(props) {
    return () => (
      <div class="border-t border-gray-200/70 dark:border-gray-700 pt-3">
        <div class="text-xs font-semibold text-gray-400 mb-2">追踪</div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs items-center">
          <div class="text-gray-500">新话题判定为新</div>
          <Select
            allowClear
            size="small"
            class="w-full"
            placeholder="选择范围"
            options={props.newTopicDurationOptions}
            value={props.form.value.new_topic_duration_minutes}
            onUpdate:value={value =>
              (props.form.value.new_topic_duration_minutes = value as number | undefined)
            }
          />
          <div class="text-gray-500">自动追踪话题</div>
          <Select
            allowClear
            size="small"
            class="w-full"
            placeholder="选择延迟"
            options={props.autoTrackOptions}
            value={props.form.value.auto_track_topics_after_msecs}
            onUpdate:value={value =>
              (props.form.value.auto_track_topics_after_msecs = value as number | undefined)
            }
          />
          <div class="text-gray-500">回复时通知级别</div>
          <Select
            allowClear
            size="small"
            class="w-full"
            placeholder="选择级别"
            options={props.notificationLevelOptions}
            value={props.form.value.notification_level_when_replying}
            onUpdate:value={value =>
              (props.form.value.notification_level_when_replying = value as number | undefined)
            }
          />
          <div class="text-gray-500">关闭话题仍显示未读</div>
          <Switch
            size="small"
            class="justify-self-start md:justify-self-end"
            checked={props.form.value.topics_unread_when_closed}
            onChange={checked => (props.form.value.topics_unread_when_closed = Boolean(checked))}
          />
          <div class="text-gray-500">关注优先于静音</div>
          <Switch
            size="small"
            class="justify-self-start md:justify-self-end"
            checked={props.form.value.watched_precedence_over_muted}
            onChange={checked => (props.form.value.watched_precedence_over_muted = Boolean(checked))}
          />
        </div>
      </div>
    )
  }
})
