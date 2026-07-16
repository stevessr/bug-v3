import { defineComponent, onMounted, onUnmounted, ref, watch } from 'vue'

import { loadDiscourseIconSymbols, replaceDiscourseIconSymbols } from './iconSprite'

export default defineComponent({
  name: 'Icon',
  props: {
    baseUrl: { type: String, required: true }
  },
  setup(props) {
    const spriteElement = ref<SVGSVGElement | null>(null)
    let requestVersion = 0

    const loadSiteSprite = async () => {
      const element = spriteElement.value
      if (!element) return

      const version = ++requestVersion
      element.replaceChildren()

      try {
        const symbols = await loadDiscourseIconSymbols(props.baseUrl)
        if (version !== requestVersion || !spriteElement.value) return
        replaceDiscourseIconSymbols(spriteElement.value, symbols)
      } catch (error) {
        if (__ENABLE_LOGGING__ && version === requestVersion) {
          console.warn('[DiscourseBrowser] Failed to load site icon sprite:', error)
        }
      }
    }

    onMounted(() => void loadSiteSprite())
    watch(
      () => props.baseUrl,
      () => void loadSiteSprite()
    )
    onUnmounted(() => {
      requestVersion += 1
    })

    return () => (
      <svg
        ref={spriteElement}
        xmlns={SVG_NAMESPACE}
        aria-hidden="true"
        data-discourse-site-icon-sprite=""
        style="display: none"
      />
    )
  }
})

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg'
