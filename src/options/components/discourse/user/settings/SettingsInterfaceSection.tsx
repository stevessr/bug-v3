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
      <div class="border-t border-gray-200/70 dark:border-gray-700 pt-3">
        <div class="text-xs font-semibold text-gray-400 mb-2">界面与其他</div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs items-center">
          <div class="text-gray-500">新标签页打开外链</div>
          <Switch
            size="small"
            checked={props.form.value.external_links_in_new_tab}
            onChange={(val: boolean) => (props.form.value.external_links_in_new_tab = val)}
          />
          <div class="text-gray-500">引用回复</div>
          <Switch
            size="small"
            checked={props.form.value.enable_quoting}
            onChange={(val: boolean) => (props.form.value.enable_quoting = val)}
          />
          <div class="text-gray-500">智能列表</div>
          <Switch
            size="small"
            checked={props.form.value.enable_smart_lists}
            onChange={(val: boolean) => (props.form.value.enable_smart_lists = val)}
          />
          <div class="text-gray-500">延迟加载</div>
          <Switch
            size="small"
            checked={props.form.value.enable_defer}
            onChange={(val: boolean) => (props.form.value.enable_defer = val)}
          />
          <div class="text-gray-500">等宽字体显示 Markdown</div>
          <Switch
            size="small"
            checked={props.form.value.enable_markdown_monospace_font}
            onChange={(val: boolean) => (props.form.value.enable_markdown_monospace_font = val)}
          />
          <div class="text-gray-500">自动取消置顶</div>
          <Switch
            size="small"
            checked={props.form.value.automatically_unpin_topics}
            onChange={(val: boolean) => (props.form.value.automatically_unpin_topics = val)}
          />
          <div class="text-gray-500">动态图标</div>
          <Switch
            size="small"
            checked={props.form.value.dynamic_favicon}
            onChange={(val: boolean) => (props.form.value.dynamic_favicon = val)}
          />
          <div class="text-gray-500">标题计数模式</div>
          <Select
            allowClear
            size="small"
            class="w-full"
            placeholder="选择模式"
            options={props.titleCountModeOptions}
            value={props.form.value.title_count_mode}
            onUpdate:value={(value: string | undefined) => (props.form.value.title_count_mode = value)}
          />
          <div class="text-gray-500">文字大小</div>
          <Select
            allowClear
            size="small"
            class="w-full"
            placeholder="选择大小"
            options={props.textSizeOptions}
            value={props.form.value.text_size}
            onUpdate:value={(value: string | undefined) => (props.form.value.text_size = value)}
          />
          <div class="text-gray-500">主页</div>
          <Select
            allowClear
            size="small"
            class="w-full"
            placeholder="选择主页"
            options={props.homepageOptions}
            value={props.form.value.homepage_id}
            onUpdate:value={(value: number | undefined) => (props.form.value.homepage_id = value)}
          />
        </div>
      </div>
    )
  }
})
