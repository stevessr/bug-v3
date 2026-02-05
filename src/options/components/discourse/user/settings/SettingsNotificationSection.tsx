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
      <div class="border-t border-gray-200/70 dark:border-gray-700 pt-3">
        <div class="text-xs font-semibold text-gray-400 mb-2">通知</div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs items-center">
          <div class="text-gray-500">点赞通知频率</div>
          <Select
            allowClear
            size="small"
            class="w-full"
            placeholder="选择频率"
            options={props.likeNotificationOptions}
            value={props.form.value.like_notification_frequency}
            onUpdate:value={(value: number | undefined) =>
              (props.form.value.like_notification_frequency = value)
            }
          />
          <div class="text-gray-500">引用回复提醒</div>
          <Switch
            size="small"
            class="justify-self-start md:justify-self-end"
            checked={props.form.value.notify_on_linked_posts}
            onChange={(val: boolean) => (props.form.value.notify_on_linked_posts = val)}
          />
        </div>
      </div>
    )
  }
})
