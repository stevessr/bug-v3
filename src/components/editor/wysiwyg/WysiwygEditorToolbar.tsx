/* @jsxImportSource vue */
import { defineComponent, PropType } from 'vue'
import {
  RollbackOutlined,
  RedoOutlined,
  BoldOutlined,
  ItalicOutlined,
  UnderlineOutlined,
  StrikethroughOutlined,
  LinkOutlined,
  PictureOutlined,
  CodeOutlined,
  BlockOutlined,
  OrderedListOutlined,
  UnorderedListOutlined,
  UploadOutlined
} from '@ant-design/icons-vue'
export type ToolbarActions = {
  undo: () => void
  redo: () => void
  toggleBold: () => void
  toggleItalic: () => void
  toggleUnderline: () => void
  toggleStrike: () => void
  openEmojiPicker: () => void
  openPluginEmojiPicker: () => void
  handleUploadClick: () => void
  openLinkPanel: () => void
  openImagePanel: () => void
  insertCode: () => void
  insertBlockquote: () => void
  insertOrderedList: () => void
  insertUnorderedList: () => void
  insertHeadingLevel: (level: number) => void
  insertTable: () => void
  insertDetails: () => void
  insertSpoiler: () => void
  insertPoll: () => void
  insertFootnote: () => void
  insertMathInline: () => void
  insertMathBlock: () => void
  insertMermaid: () => void
  insertScrollable: () => void
  insertAppWrap: () => void
}

export default defineComponent({
  name: 'WysiwygEditorToolbar',
  props: {
    actions: { type: Object as PropType<ToolbarActions>, required: true }
  },
  setup(props) {
    return () => (
      <div class="prosemirror-toolbar">
        <div class="toolbar-group">
          <button class="toolbar-btn" onClick={props.actions.undo} title="撤销 (Ctrl+Z)">
            <RollbackOutlined />
          </button>
          <button class="toolbar-btn" onClick={props.actions.redo} title="重做 (Ctrl+Y)">
            <RedoOutlined />
          </button>
        </div>
        <div class="toolbar-divider" />
        <div class="toolbar-group">
          <button class="toolbar-btn" onClick={props.actions.toggleBold} title="粗体 (Ctrl+B)">
            <BoldOutlined />
          </button>
          <button class="toolbar-btn" onClick={props.actions.toggleItalic} title="斜体 (Ctrl+I)">
            <ItalicOutlined />
          </button>
          <button
            class="toolbar-btn"
            onClick={props.actions.toggleUnderline}
            title="下划线 (Ctrl+U)"
          >
            <UnderlineOutlined />
          </button>
          <button
            class="toolbar-btn"
            onClick={props.actions.toggleStrike}
            title="删除线 (Ctrl+Alt+S)"
          >
            <StrikethroughOutlined />
          </button>
        </div>
        <div class="toolbar-divider" />
        <div class="toolbar-group">
          <button class="toolbar-btn" onClick={props.actions.openEmojiPicker} title="表情">
            🙂
          </button>
          <button
            class="toolbar-btn"
            onClick={props.actions.openPluginEmojiPicker}
            title="插件表情"
          >
            ⭐
          </button>
          <button class="toolbar-btn" onClick={props.actions.handleUploadClick} title="上传文件">
            <UploadOutlined />
          </button>
          <button class="toolbar-btn" onClick={props.actions.openLinkPanel} title="插入链接">
            <LinkOutlined />
          </button>
          <button class="toolbar-btn" onClick={props.actions.openImagePanel} title="插入图片">
            <PictureOutlined />
          </button>
          <button class="toolbar-btn" onClick={props.actions.insertCode} title="代码块">
            <CodeOutlined />
          </button>
        </div>
        <div class="toolbar-divider" />
        <div class="toolbar-group">
          <button class="toolbar-btn" onClick={props.actions.insertBlockquote} title="引用">
            <BlockOutlined />
          </button>
          <button class="toolbar-btn" onClick={props.actions.insertOrderedList} title="有序列表">
            <OrderedListOutlined />
          </button>
          <button class="toolbar-btn" onClick={props.actions.insertUnorderedList} title="无序列表">
            <UnorderedListOutlined />
          </button>
        </div>
        <div class="toolbar-divider" />
        <div class="toolbar-group">
          <button
            class="toolbar-btn"
            onClick={() => props.actions.insertHeadingLevel(1)}
            title="一级标题"
          >
            H1
          </button>
          <button
            class="toolbar-btn"
            onClick={() => props.actions.insertHeadingLevel(2)}
            title="二级标题"
          >
            H2
          </button>
          <button
            class="toolbar-btn"
            onClick={() => props.actions.insertHeadingLevel(3)}
            title="三级标题"
          >
            H3
          </button>
          <button class="toolbar-btn" onClick={props.actions.insertTable} title="表格">
            表格
          </button>
          <button class="toolbar-btn" onClick={props.actions.insertDetails} title="隐藏详细信息">
            详情
          </button>
          <button class="toolbar-btn" onClick={props.actions.insertSpoiler} title="剧透">
            剧透
          </button>
        </div>
        <div class="toolbar-divider" />
        <div class="toolbar-group">
          <button class="toolbar-btn" onClick={props.actions.insertPoll} title="投票">
            投票
          </button>
          <button class="toolbar-btn" onClick={props.actions.insertFootnote} title="脚注">
            脚注
          </button>
          <button class="toolbar-btn" onClick={props.actions.insertMathInline} title="公式（行内）">
            公式
          </button>
          <button class="toolbar-btn" onClick={props.actions.insertMathBlock} title="公式（块）">
            公式块
          </button>
          <button class="toolbar-btn" onClick={props.actions.insertMermaid} title="Mermaid 图表">
            Mermaid
          </button>
          <button class="toolbar-btn" onClick={props.actions.insertScrollable} title="滚动内容">
            滚动
          </button>
          <button class="toolbar-btn" onClick={props.actions.insertAppWrap} title="应用包装">
            应用
          </button>
        </div>
      </div>
    )
  }
})
