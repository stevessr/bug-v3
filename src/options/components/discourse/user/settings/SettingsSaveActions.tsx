import { defineComponent } from 'vue'
import type { PropType } from 'vue'
import { Button } from 'ant-design-vue'

export default defineComponent({
  name: 'SettingsSaveActions',
  props: {
    saving: {
      type: Boolean,
      required: true
    },
    onSave: {
      type: Function as PropType<() => void>,
      required: true
    }
  },
  setup(props) {
    return () => (
      <div class="flex justify-end">
        <Button type="primary" size="small" onClick={props.onSave} loading={props.saving}>
          保存设置
        </Button>
      </div>
    )
  }
})
