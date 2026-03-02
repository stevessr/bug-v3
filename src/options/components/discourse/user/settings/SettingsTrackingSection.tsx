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
      <div class="user-settings-section">
        <div class="user-settings-section__title">追踪</div>
        <div class="user-settings-grid">
          <div class="user-settings-label">新话题判定为新</div>
          <Select
            allowClear
            size="small"
            class="user-settings-control"
            placeholder="选择范围"
            options={props.newTopicDurationOptions}
            value={props.form.value.new_topic_duration_minutes}
            onUpdate:value={value =>
              (props.form.value.new_topic_duration_minutes = value as number | undefined)
            }
          />
          <div class="user-settings-label">自动追踪话题</div>
          <Select
            allowClear
            size="small"
            class="user-settings-control"
            placeholder="选择延迟"
            options={props.autoTrackOptions}
            value={props.form.value.auto_track_topics_after_msecs}
            onUpdate:value={value =>
              (props.form.value.auto_track_topics_after_msecs = value as number | undefined)
            }
          />
          <div class="user-settings-label">回复时通知级别</div>
          <Select
            allowClear
            size="small"
            class="user-settings-control"
            placeholder="选择级别"
            options={props.notificationLevelOptions}
            value={props.form.value.notification_level_when_replying}
            onUpdate:value={value =>
              (props.form.value.notification_level_when_replying = value as number | undefined)
            }
          />
          <div class="user-settings-label">关闭话题仍显示未读</div>
          <Switch
            size="small"
            class="user-settings-switch"
            checked={props.form.value.topics_unread_when_closed}
            onChange={checked => (props.form.value.topics_unread_when_closed = Boolean(checked))}
          />
          <div class="user-settings-label">关注优先于静音</div>
          <Switch
            size="small"
            class="user-settings-switch"
            checked={props.form.value.watched_precedence_over_muted}
            onChange={checked =>
              (props.form.value.watched_precedence_over_muted = Boolean(checked))
            }
          />
        </div>
      </div>
    )
  }
})
