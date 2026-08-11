import { Teleport, defineComponent, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import {
  CopyOutlined,
  ExportOutlined,
  LinkOutlined,
  PlusSquareOutlined
} from '@ant-design/icons-vue'

import '../css/DiscourseContextMenu.css'

export default defineComponent({
  name: 'DiscourseContextMenu',
  props: {
    open: { type: Boolean, required: true },
    x: { type: Number, default: 0 },
    y: { type: Number, default: 0 },
    url: { type: String, default: '' },
    selectedText: { type: String, default: '' },
    targetType: { type: String as () => 'link' | 'image' | 'text', default: 'link' }
  },
  emits: [
    'close',
    'openCurrent',
    'openForumTab',
    'openBrowserTab',
    'copy',
    'copyText',
    'copyImage'
  ],
  setup(props, { emit }) {
    const menuRef = ref<HTMLElement | null>(null)
    const position = ref({ left: 0, top: 0 })

    const updatePosition = async () => {
      await nextTick()
      const menu = menuRef.value
      if (!menu) return
      const padding = 8
      const rect = menu.getBoundingClientRect()
      position.value = {
        left: Math.max(padding, Math.min(props.x, window.innerWidth - rect.width - padding)),
        top: Math.max(padding, Math.min(props.y, window.innerHeight - rect.height - padding))
      }
    }

    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target
      if (target instanceof Node && menuRef.value?.contains(target)) return
      emit('close')
    }

    const closeOnKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') emit('close')
    }

    const removeListeners = () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer, true)
      document.removeEventListener('keydown', closeOnKeydown)
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }

    watch(
      () => [props.open, props.x, props.y] as const,
      ([open]) => {
        removeListeners()
        if (!open) return
        void updatePosition()
        document.addEventListener('pointerdown', closeOnOutsidePointer, true)
        document.addEventListener('keydown', closeOnKeydown)
        window.addEventListener('resize', updatePosition)
        window.addEventListener('scroll', updatePosition, true)
      },
      { immediate: true, flush: 'post' }
    )

    onBeforeUnmount(removeListeners)

    const run = (
      eventName:
        'openCurrent' | 'openForumTab' | 'openBrowserTab' | 'copy' | 'copyText' | 'copyImage'
    ) => {
      emit(eventName)
      emit('close')
    }

    return () => (
      <Teleport to="body">
        {props.open && (props.url || props.selectedText) ? (
          <div
            ref={menuRef}
            class="discourse-context-menu"
            role="menu"
            aria-label={props.targetType === 'text' ? '文字操作' : '链接操作'}
            style={{ left: `${position.value.left}px`, top: `${position.value.top}px` }}
            onContextmenu={(event: MouseEvent) => event.preventDefault()}
          >
            {props.selectedText ? (
              <>
                <div
                  class="discourse-context-menu__url discourse-context-menu__selection"
                  title={props.selectedText}
                >
                  已选择：{props.selectedText}
                </div>
                <button type="button" role="menuitem" onClick={() => run('copyText')}>
                  <CopyOutlined />
                  <span>复制选中文字</span>
                </button>
              </>
            ) : null}
            {props.url ? (
              <>
                <div class="discourse-context-menu__url" title={props.url}>
                  {props.targetType === 'image' ? '图片：' : ''}
                  {props.url}
                </div>
                <button type="button" role="menuitem" onClick={() => run('openCurrent')}>
                  <LinkOutlined />
                  <span>{props.targetType === 'image' ? '查看图片' : '在当前标签页打开'}</span>
                </button>
                <button type="button" role="menuitem" onClick={() => run('openForumTab')}>
                  <PlusSquareOutlined />
                  <span>在新论坛标签页打开</span>
                </button>
                <button type="button" role="menuitem" onClick={() => run('openBrowserTab')}>
                  <ExportOutlined />
                  <span>在浏览器新标签页打开</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => run(props.targetType === 'image' ? 'copyImage' : 'copy')}
                >
                  <CopyOutlined />
                  <span>{props.targetType === 'image' ? '复制图片地址' : '复制链接'}</span>
                </button>
              </>
            ) : null}
          </div>
        ) : null}
      </Teleport>
    )
  }
})
