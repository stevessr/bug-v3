import { defineComponent } from 'vue'

// The extension's own icons come from Font Awesome. Site-provided Discourse
// category, theme and plugin icons continue to use the sanitized site sprite.
import '@fortawesome/fontawesome-free/css/fontawesome.min.css'
import '@fortawesome/fontawesome-free/css/solid.min.css'

export default defineComponent({
  name: 'DiscourseFaIcon',
  props: {
    name: { type: String, required: true },
    className: { type: String, default: '' }
  },
  setup(props) {
    return () => (
      <i class={['fa-solid', `fa-${props.name}`, props.className]} aria-hidden="true" />
    )
  }
})
