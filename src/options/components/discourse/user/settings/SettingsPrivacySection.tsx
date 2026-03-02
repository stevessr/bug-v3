import { defineComponent } from 'vue'
import type { PropType, Ref } from 'vue'
import { Switch } from 'ant-design-vue'

import type { PreferencesPayload } from './types'

export default defineComponent({
  name: 'SettingsPrivacySection',
  props: {
    form: {
      type: Object as PropType<Ref<PreferencesPayload>>,
      required: true
    }
  },
  setup(props) {
    return () => (
      <div class="user-settings-section">
        <div class="user-settings-section__title">隐私与私信</div>
        <div class="user-settings-grid">
          <div class="user-settings-label">允许私信</div>
          <Switch
            size="small"
            class="user-settings-switch"
            checked={props.form.value.allow_private_messages}
            onChange={checked => (props.form.value.allow_private_messages = Boolean(checked))}
          />
          <div class="user-settings-label">仅允许指定用户私信</div>
          <Switch
            size="small"
            class="user-settings-switch"
            checked={props.form.value.enable_allowed_pm_users}
            disabled={!props.form.value.allow_private_messages}
            onChange={checked => (props.form.value.enable_allowed_pm_users = Boolean(checked))}
          />
          <div class="user-settings-label">隐藏个人资料</div>
          <Switch
            size="small"
            class="user-settings-switch"
            checked={props.form.value.hide_profile}
            onChange={checked => (props.form.value.hide_profile = Boolean(checked))}
          />
          <div class="user-settings-label">隐藏在线状态</div>
          <Switch
            size="small"
            class="user-settings-switch"
            checked={props.form.value.hide_presence}
            onChange={checked => (props.form.value.hide_presence = Boolean(checked))}
          />
        </div>
      </div>
    )
  }
})
