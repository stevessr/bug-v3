import { defineComponent } from 'vue'
import type { PropType, Ref } from 'vue'
import { Select, Switch } from 'ant-design-vue'

import type { PreferencesPayload } from './types'

type Option = { value: number; label: string }

export default defineComponent({
  name: 'SettingsNotificationSection',
  props: {
    form: {
      type: Object as PropType<Ref<PreferencesPayload>>,
      required: true
    },
    likeNotificationOptions: {
      type: Array as PropType<Option[]>,
      required: true
    }
  },
  setup(props) {
    return () => (
      <div class="user-settings-section">
        <div class="user-settings-section__title">通知</div>
        <div class="user-settings-grid">
          <div class="user-settings-label">点赞通知频率</div>
          <Select
            allowClear
            size="small"
            class="user-settings-control"
            placeholder="选择频率"
            options={props.likeNotificationOptions}
            value={props.form.value.like_notification_frequency}
            onUpdate:value={value =>
              (props.form.value.like_notification_frequency = value as number | undefined)
            }
          />
          <div class="user-settings-label">引用回复提醒</div>
          <Switch
            size="small"
            class="user-settings-switch"
            checked={props.form.value.notify_on_linked_posts}
            onChange={checked => (props.form.value.notify_on_linked_posts = Boolean(checked))}
          />
        </div>
      </div>
    )
  }
})
