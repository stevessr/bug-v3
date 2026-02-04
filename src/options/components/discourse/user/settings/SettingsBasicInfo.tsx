import { defineComponent } from 'vue'
import type { PropType } from 'vue'

import type { DiscourseUserPreferences } from '../../types'

export default defineComponent({
  name: 'SettingsBasicInfo',
  props: {
    preferences: {
      type: Object as PropType<DiscourseUserPreferences>,
      required: true
    }
  },
  setup(props) {
    return () => (
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
        <div class="text-gray-500">邮箱</div>
        <div class="dark:text-gray-300">{props.preferences.email || '-'}</div>
        <div class="text-gray-500">语言</div>
        <div class="dark:text-gray-300">{props.preferences.locale || '-'}</div>
        <div class="text-gray-500">时区</div>
        <div class="dark:text-gray-300">{props.preferences.timezone || '-'}</div>
      </div>
    )
  }
})
