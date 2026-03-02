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
      <div class="user-settings-section user-settings-section--basic">
        <div class="user-settings-section__title">基本信息</div>
        <div class="user-settings-grid">
          <div class="user-settings-label">邮箱</div>
          <div class="user-settings-value">{props.preferences.email || '-'}</div>
          <div class="user-settings-label">语言</div>
          <div class="user-settings-value">{props.preferences.locale || '-'}</div>
          <div class="user-settings-label">时区</div>
          <div class="user-settings-value">{props.preferences.timezone || '-'}</div>
        </div>
      </div>
    )
  }
})
