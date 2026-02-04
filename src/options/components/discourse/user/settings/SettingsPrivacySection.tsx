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
      <div class="border-t border-gray-200/70 dark:border-gray-700 pt-3">
        <div class="text-xs font-semibold text-gray-400 mb-2">隐私与私信</div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs items-center">
          <div class="text-gray-500">允许私信</div>
          <Switch
            size="small"
            checked={props.form.value.allow_private_messages}
            onChange={(val: boolean) => (props.form.value.allow_private_messages = val)}
          />
          <div class="text-gray-500">仅允许指定用户私信</div>
          <Switch
            size="small"
            checked={props.form.value.enable_allowed_pm_users}
            disabled={!props.form.value.allow_private_messages}
            onChange={(val: boolean) => (props.form.value.enable_allowed_pm_users = val)}
          />
          <div class="text-gray-500">隐藏个人资料</div>
          <Switch
            size="small"
            checked={props.form.value.hide_profile}
            onChange={(val: boolean) => (props.form.value.hide_profile = val)}
          />
          <div class="text-gray-500">隐藏在线状态</div>
          <Switch
            size="small"
            checked={props.form.value.hide_presence}
            onChange={(val: boolean) => (props.form.value.hide_presence = val)}
          />
        </div>
      </div>
    )
  }
})
