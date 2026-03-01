import { defineComponent } from 'vue'
import type { PropType, Ref } from 'vue'
import { Select, Switch } from 'ant-design-vue'

import type { PreferencesPayload } from './types'

type Option = { value: number; label: string }

export default defineComponent({
  name: 'SettingsEmailSection',
  props: {
    form: {
      type: Object as PropType<Ref<PreferencesPayload>>,
      required: true
    },
    emailLevelOptions: {
      type: Array as PropType<Option[]>,
      required: true
    },
    emailPreviousRepliesOptions: {
      type: Array as PropType<Option[]>,
      required: true
    },
    digestFrequencyOptions: {
      type: Array as PropType<Option[]>,
      required: true
    },
    mailingListModeOptions: {
      type: Array as PropType<Option[]>,
      required: true
    }
  },
  setup(props) {
    return () => (
      <div class="border-t border-gray-200/70 dark:border-gray-700 pt-3">
        <div class="text-xs font-semibold text-gray-400 mb-2">邮件</div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs items-center">
          <div class="text-gray-500">邮件通知级别</div>
          <Select
            allowClear
            size="small"
            class="w-full"
            placeholder="选择级别"
            options={props.emailLevelOptions}
            value={props.form.value.email_level}
            onUpdate:value={value => (props.form.value.email_level = value as number | undefined)}
          />
          <div class="text-gray-500">私信邮件级别</div>
          <Select
            allowClear
            size="small"
            class="w-full"
            placeholder="选择级别"
            options={props.emailLevelOptions}
            value={props.form.value.email_messages_level}
            onUpdate:value={value =>
              (props.form.value.email_messages_level = value as number | undefined)
            }
          />
          <div class="text-gray-500">邮件包含回复</div>
          <Select
            allowClear
            size="small"
            class="w-full"
            placeholder="选择策略"
            options={props.emailPreviousRepliesOptions}
            value={props.form.value.email_previous_replies}
            onUpdate:value={value =>
              (props.form.value.email_previous_replies = value as number | undefined)
            }
          />
          <div class="text-gray-500">邮件中包含回复指向链接</div>
          <Switch
            size="small"
            class="justify-self-start md:justify-self-end"
            checked={props.form.value.email_in_reply_to}
            onChange={checked => (props.form.value.email_in_reply_to = Boolean(checked))}
          />
          <div class="text-gray-500">邮件摘要</div>
          <Switch
            size="small"
            class="justify-self-start md:justify-self-end"
            checked={props.form.value.email_digests}
            onChange={checked => (props.form.value.email_digests = Boolean(checked))}
          />
          <div class="text-gray-500">摘要频率</div>
          <Select
            allowClear
            size="small"
            class="w-full"
            disabled={!props.form.value.email_digests}
            placeholder="选择频率"
            options={props.digestFrequencyOptions}
            value={props.form.value.digest_after_minutes}
            onUpdate:value={value =>
              (props.form.value.digest_after_minutes = value as number | undefined)
            }
          />
          <div class="text-gray-500">摘要包含 TL0</div>
          <Switch
            size="small"
            class="justify-self-start md:justify-self-end"
            checked={props.form.value.include_tl0_in_digests}
            disabled={!props.form.value.email_digests}
            onChange={checked => (props.form.value.include_tl0_in_digests = Boolean(checked))}
          />
          <div class="text-gray-500">邮件列表模式</div>
          <Switch
            size="small"
            class="justify-self-start md:justify-self-end"
            checked={props.form.value.mailing_list_mode}
            onChange={checked => (props.form.value.mailing_list_mode = Boolean(checked))}
          />
          <div class="text-gray-500">邮件列表模式频率</div>
          <Select
            allowClear
            size="small"
            class="w-full"
            disabled={!props.form.value.mailing_list_mode}
            placeholder="选择方式"
            options={props.mailingListModeOptions}
            value={props.form.value.mailing_list_mode_frequency}
            onUpdate:value={value =>
              (props.form.value.mailing_list_mode_frequency = value as number | undefined)
            }
          />
        </div>
      </div>
    )
  }
})
