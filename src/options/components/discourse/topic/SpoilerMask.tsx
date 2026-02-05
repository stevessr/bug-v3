import { defineComponent } from 'vue'

export default defineComponent({
  name: 'SpoilerMask',
  props: {
    label: {
      type: String,
      default: '点击显示隐藏内容'
    }
  },
  setup(props) {
    return () => (
      <span class="spoiler-mask" aria-hidden="true">
        {props.label}
      </span>
    )
  }
})
