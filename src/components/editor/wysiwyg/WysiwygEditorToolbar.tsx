/* @jsxImportSource vue */
import { defineComponent, onBeforeUnmount, onMounted, ref, Teleport, type PropType } from 'vue'
import {
  ApartmentOutlined,
  AppstoreOutlined,
  BarChartOutlined,
  BlockOutlined,
  BoldOutlined,
  CodeOutlined,
  DownOutlined,
  EyeInvisibleOutlined,
  FileTextOutlined,
  FontSizeOutlined,
  FunctionOutlined,
  InfoCircleOutlined,
  ItalicOutlined,
  LinkOutlined,
  MoreOutlined,
  OrderedListOutlined,
  PictureOutlined,
  RedoOutlined,
  RollbackOutlined,
  StrikethroughOutlined,
  TableOutlined,
  UnderlineOutlined,
  UnorderedListOutlined,
  UploadOutlined,
  VerticalAlignMiddleOutlined
} from '@ant-design/icons-vue'

export type ToolbarActions = {
  undo: () => void
  redo: () => void
  toggleBold: () => void
  toggleItalic: () => void
  toggleUnderline: () => void
  toggleStrike: () => void
  openEmojiPicker: (event?: MouseEvent) => void
  openPluginEmojiPicker: (event?: MouseEvent) => void
  handleUploadClick: () => void
  openLinkPanel: () => void
  openImagePanel: () => void
  insertCode: () => void
  insertBlockquote: () => void
  insertOrderedList: () => void
  insertUnorderedList: () => void
  insertHeadingLevel: (level: number) => void
  openTableAssistant: () => void
  insertDetails: () => void
  insertSpoiler: () => void
  openPollAssistant: () => void
  insertFootnote: () => void
  openTemplatePicker: () => void
  openFormulaAssistant: () => void
  insertMermaid: () => void
  insertScrollable: () => void
  insertAppWrap: () => void
}

type ToolbarMenu = 'headings' | 'advanced' | null

export default defineComponent({
  name: 'WysiwygEditorToolbar',
  props: {
    actions: { type: Object as PropType<ToolbarActions>, required: true }
  },
  setup(props) {
    const activeMenu = ref<ToolbarMenu>(null)
    const menuRef = ref<HTMLElement | null>(null)
    const headingTriggerRef = ref<HTMLButtonElement | null>(null)
    const advancedTriggerRef = ref<HTMLButtonElement | null>(null)
    const menuPosition = ref({ left: 8, top: 8 })

    const closeMenu = () => {
      activeMenu.value = null
    }

    const openMenu = (menu: Exclude<ToolbarMenu, null>, event: MouseEvent) => {
      if (activeMenu.value === menu) {
        closeMenu()
        return
      }
      const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
      menuPosition.value = {
        left: Math.max(8, Math.min(rect.left, window.innerWidth - 240)),
        top: Math.min(rect.bottom + 8, window.innerHeight - 8)
      }
      activeMenu.value = menu
    }

    const preserveSelection = (event: MouseEvent) => event.preventDefault()
    const run = (action: () => void) => {
      action()
      closeMenu()
    }
    const containsMenuTarget = (target: EventTarget | null) =>
      target instanceof Node &&
      Boolean(
        menuRef.value?.contains(target) ||
        headingTriggerRef.value?.contains(target) ||
        advancedTriggerRef.value?.contains(target)
      )
    const onPointerDown = (event: PointerEvent) => {
      if (!containsMenuTarget(event.target)) closeMenu()
    }
    const onKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMenu()
    }

    onMounted(() => {
      document.addEventListener('pointerdown', onPointerDown, true)
      document.addEventListener('keydown', onKeydown)
      window.addEventListener('resize', closeMenu)
      window.addEventListener('scroll', closeMenu, true)
    })
    onBeforeUnmount(() => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKeydown)
      window.removeEventListener('resize', closeMenu)
      window.removeEventListener('scroll', closeMenu, true)
    })

    const menuStyle = () => ({
      left: `${menuPosition.value.left}px`,
      top: `${menuPosition.value.top}px`
    })

    const renderHeadingMenu = () => (
      <div
        ref={menuRef}
        class="advanced-syntax-menu editor-extension-menu editor-extension-menu--headings"
        style={menuStyle()}
        role="menu"
        aria-label="标题级别"
      >
        {[
          [1, '一级标题', '页面主标题'],
          [2, '二级标题', '内容分段'],
          [3, '三级标题', '小节标题']
        ].map(([level, label, description]) => (
          <button
            key={level}
            type="button"
            role="menuitem"
            onMousedown={preserveSelection}
            onClick={() => run(() => props.actions.insertHeadingLevel(Number(level)))}
          >
            <span class="syntax-menu-icon">H{level}</span>
            <span class="editor-extension-menu__copy">
              <strong>{label}</strong>
              <small>{description}</small>
            </span>
          </button>
        ))}
      </div>
    )

    const renderAdvancedMenu = () => {
      const entries = [
        ['制表', '行列和表头辅助', TableOutlined, props.actions.openTableAssistant],
        ['详细信息', '可折叠内容块', InfoCircleOutlined, props.actions.insertDetails],
        ['剧透', '隐藏敏感内容', EyeInvisibleOutlined, props.actions.insertSpoiler],
        ['投票', '创建 Discourse 投票', BarChartOutlined, props.actions.openPollAssistant],
        ['公式', '行内或块级 LaTeX', FunctionOutlined, props.actions.openFormulaAssistant],
        ['论坛模板', '插入论坛可复用模板', FileTextOutlined, props.actions.openTemplatePicker],
        ['脚注', '补充说明引用', FileTextOutlined, props.actions.insertFootnote],
        ['Mermaid 图表', '插入流程图代码块', ApartmentOutlined, props.actions.insertMermaid],
        [
          '滚动内容',
          '可滚动的长内容区',
          VerticalAlignMiddleOutlined,
          props.actions.insertScrollable
        ],
        ['应用包装', 'Discourse 应用容器', AppstoreOutlined, props.actions.insertAppWrap]
      ] as const
      return (
        <div
          ref={menuRef}
          class="advanced-syntax-menu editor-extension-menu"
          style={menuStyle()}
          role="menu"
          aria-label="高级功能"
        >
          <div class="editor-extension-menu__title">
            <MoreOutlined aria-hidden="true" />
            <span>高级功能</span>
          </div>
          {entries.map(([label, description, Icon, action]) => (
            <button
              key={label}
              type="button"
              role="menuitem"
              onMousedown={preserveSelection}
              onClick={() => run(action)}
            >
              <Icon aria-hidden="true" />
              <span class="editor-extension-menu__copy">
                <strong>{label}</strong>
                <small>{description}</small>
              </span>
            </button>
          ))}
        </div>
      )
    }

    return () => (
      <>
        <div class="prosemirror-toolbar" role="toolbar" aria-label="编辑器工具栏">
          <div class="toolbar-group">
            <button
              class="toolbar-btn"
              onMousedown={preserveSelection}
              onClick={props.actions.undo}
              title="撤销 (Ctrl+Z)"
              aria-label="撤销"
            >
              <RollbackOutlined />
            </button>
            <button
              class="toolbar-btn"
              onMousedown={preserveSelection}
              onClick={props.actions.redo}
              title="重做 (Ctrl+Y)"
              aria-label="重做"
            >
              <RedoOutlined />
            </button>
          </div>
          <div class="toolbar-divider" />
          <div class="toolbar-group">
            <button
              class="toolbar-btn"
              onMousedown={preserveSelection}
              onClick={props.actions.toggleBold}
              title="粗体 (Ctrl+B)"
              aria-label="粗体"
            >
              <BoldOutlined />
            </button>
            <button
              class="toolbar-btn"
              onMousedown={preserveSelection}
              onClick={props.actions.toggleItalic}
              title="斜体 (Ctrl+I)"
              aria-label="斜体"
            >
              <ItalicOutlined />
            </button>
            <button
              class="toolbar-btn"
              onMousedown={preserveSelection}
              onClick={props.actions.toggleUnderline}
              title="下划线 (Ctrl+U)"
              aria-label="下划线"
            >
              <UnderlineOutlined />
            </button>
            <button
              class="toolbar-btn"
              onMousedown={preserveSelection}
              onClick={props.actions.toggleStrike}
              title="删除线 (Ctrl+Alt+S)"
              aria-label="删除线"
            >
              <StrikethroughOutlined />
            </button>
          </div>
          <div class="toolbar-divider" />
          <div class="toolbar-group">
            <button
              class="toolbar-btn"
              onMousedown={preserveSelection}
              onClick={(event: MouseEvent) => props.actions.openEmojiPicker(event)}
              title="论坛表情"
              aria-label="论坛表情"
            >
              🙂
            </button>
            <button
              class="toolbar-btn"
              onMousedown={preserveSelection}
              onClick={(event: MouseEvent) => props.actions.openPluginEmojiPicker(event)}
              title="插件表情"
              aria-label="插件表情"
            >
              🐟
            </button>
            <button
              class="toolbar-btn"
              onMousedown={preserveSelection}
              onClick={props.actions.handleUploadClick}
              title="上传文件"
              aria-label="上传文件"
            >
              <UploadOutlined />
            </button>
            <button
              class="toolbar-btn"
              onMousedown={preserveSelection}
              onClick={props.actions.openLinkPanel}
              title="插入链接"
              aria-label="插入链接"
            >
              <LinkOutlined />
            </button>
            <button
              class="toolbar-btn"
              onMousedown={preserveSelection}
              onClick={props.actions.openImagePanel}
              title="插入图片"
              aria-label="插入图片"
            >
              <PictureOutlined />
            </button>
            <button
              class="toolbar-btn"
              onMousedown={preserveSelection}
              onClick={props.actions.insertCode}
              title="代码块"
              aria-label="代码块"
            >
              <CodeOutlined />
            </button>
          </div>
          <div class="toolbar-divider" />
          <div class="toolbar-group">
            <button
              class="toolbar-btn"
              onMousedown={preserveSelection}
              onClick={props.actions.insertBlockquote}
              title="引用"
              aria-label="引用"
            >
              <BlockOutlined />
            </button>
            <button
              class="toolbar-btn"
              onMousedown={preserveSelection}
              onClick={props.actions.insertOrderedList}
              title="有序列表"
              aria-label="有序列表"
            >
              <OrderedListOutlined />
            </button>
            <button
              class="toolbar-btn"
              onMousedown={preserveSelection}
              onClick={props.actions.insertUnorderedList}
              title="无序列表"
              aria-label="无序列表"
            >
              <UnorderedListOutlined />
            </button>
          </div>
          <div class="toolbar-divider" />
          <div class="toolbar-group">
            <button
              ref={headingTriggerRef}
              class={[
                'toolbar-btn',
                'toolbar-btn--advanced',
                activeMenu.value === 'headings' ? 'is-active' : ''
              ]}
              onMousedown={preserveSelection}
              onClick={(event: MouseEvent) => openMenu('headings', event)}
              title="标题级别"
              aria-label="标题级别"
              aria-haspopup="menu"
              aria-expanded={activeMenu.value === 'headings'}
            >
              <FontSizeOutlined />
              <DownOutlined class="toolbar-btn__chevron" />
            </button>
            <button
              ref={advancedTriggerRef}
              class={[
                'toolbar-btn',
                'toolbar-btn--advanced',
                activeMenu.value === 'advanced' ? 'is-active' : ''
              ]}
              onMousedown={preserveSelection}
              onClick={(event: MouseEvent) => openMenu('advanced', event)}
              title="高级功能"
              aria-label="高级功能"
              aria-haspopup="menu"
              aria-expanded={activeMenu.value === 'advanced'}
            >
              <MoreOutlined />
              <DownOutlined class="toolbar-btn__chevron" />
            </button>
          </div>
        </div>
        <Teleport to="body">
          {activeMenu.value === 'headings' ? renderHeadingMenu() : null}
          {activeMenu.value === 'advanced' ? renderAdvancedMenu() : null}
        </Teleport>
      </>
    )
  }
})
