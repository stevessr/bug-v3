import { defineComponent } from 'vue'
import type { PropType, Ref } from 'vue'
import { Select, Switch } from 'ant-design-vue'

import type { PreferencesPayload } from './types'

type Option = { value: number | string; label: string }

export default defineComponent({
  name: 'SettingsInterfaceSection',
  props: {
    form: {
      type: Object as PropType<Ref<PreferencesPayload>>,
      required: true
    },
    titleCountModeOptions: {
      type: Array as PropType<Option[]>,
      required: true
    },
    textSizeOptions: {
      type: Array as PropType<Option[]>,
      required: true
    },
    homepageOptions: {
      type: Array as PropType<Option[]>,
      required: true
    }
  },
  setup(props) {
    return () => (
      <div class="user-settings-section">
        <div class="user-settings-section__title">界面与其他</div>
        <div class="user-settings-grid">
          <div class="user-settings-label">新标签页打开外链</div>
          <Switch
            size="small"
            class="user-settings-switch"
            checked={props.form.value.external_links_in_new_tab}
            onChange={checked => (props.form.value.external_links_in_new_tab = Boolean(checked))}
          />
          <div class="user-settings-label">引用回复</div>
          <Switch
            size="small"
            class="user-settings-switch"
            checked={props.form.value.enable_quoting}
            onChange={checked => (props.form.value.enable_quoting = Boolean(checked))}
          />
          <div class="user-settings-label">智能列表</div>
          <Switch
            size="small"
            class="user-settings-switch"
            checked={props.form.value.enable_smart_lists}
            onChange={checked => (props.form.value.enable_smart_lists = Boolean(checked))}
          />
          <div class="user-settings-label">延迟加载</div>
          <Switch
            size="small"
            class="user-settings-switch"
            checked={props.form.value.enable_defer}
            onChange={checked => (props.form.value.enable_defer = Boolean(checked))}
          />
          <div class="user-settings-label">等宽字体显示 Markdown</div>
          <Switch
            size="small"
            class="user-settings-switch"
            checked={props.form.value.enable_markdown_monospace_font}
            onChange={checked =>
              (props.form.value.enable_markdown_monospace_font = Boolean(checked))
            }
          />
          <div class="user-settings-label">自动取消置顶</div>
          <Switch
            size="small"
            class="user-settings-switch"
            checked={props.form.value.automatically_unpin_topics}
            onChange={checked => (props.form.value.automatically_unpin_topics = Boolean(checked))}
          />
          <div class="user-settings-label">动态图标</div>
          <Switch
            size="small"
            class="user-settings-switch"
            checked={props.form.value.dynamic_favicon}
            onChange={checked => (props.form.value.dynamic_favicon = Boolean(checked))}
          />
          <div class="user-settings-label">标题计数模式</div>
          <Select
            allowClear
            size="small"
            class="user-settings-control"
            placeholder="选择模式"
            options={props.titleCountModeOptions}
            value={props.form.value.title_count_mode}
            onUpdate:value={value =>
              (props.form.value.title_count_mode = value as string | undefined)
            }
          />
          <div class="user-settings-label">文字大小</div>
          <Select
            allowClear
            size="small"
            class="user-settings-control"
            placeholder="选择大小"
            options={props.textSizeOptions}
            value={props.form.value.text_size}
            onUpdate:value={value => (props.form.value.text_size = value as string | undefined)}
          />
          <div class="user-settings-label">主页</div>
          <Select
            allowClear
            size="small"
            class="user-settings-control"
            placeholder="选择主页"
            options={props.homepageOptions}
            value={props.form.value.homepage_id}
            onUpdate:value={value => (props.form.value.homepage_id = value as number | undefined)}
          />
        </div>
      </div>
    )
  }
})
