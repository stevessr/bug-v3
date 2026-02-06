import { defineComponent, PropType } from 'vue'

export type DialogState = {
  showLinkPanel: boolean
  showImagePanel: boolean
  linkUrl: string
  linkText: string
  imageUrl: string
  imageAlt: string
}

export type DialogActions = {
  openLinkPanel: () => void
  openImagePanel: () => void
  closePanels: () => void
  insertLink: () => void
  insertImage: () => void
  onLinkInput: (value: string) => void
  onLinkTextInput: (value: string) => void
  onImageInput: (value: string) => void
  onImageAltInput: (value: string) => void
}

export default defineComponent({
  name: 'WysiwygEditorDialogs',
  props: {
    state: { type: Object as PropType<DialogState>, required: true },
    actions: { type: Object as PropType<DialogActions>, required: true }
  },
  setup(props) {
    return () => (
      <>
        {props.state.showLinkPanel ? (
          <div class="editor-modal-backdrop" onClick={props.actions.closePanels}>
            <div class="editor-modal-card" onClick={event => event.stopPropagation()}>
              <div class="editor-modal-header">
                <span>插入链接</span>
              </div>
              <div class="editor-modal-row">
                <label class="editor-modal-label">链接地址</label>
                <input
                  class="editor-modal-input"
                  value={props.state.linkUrl}
                  onInput={event =>
                    props.actions.onLinkInput((event.target as HTMLInputElement).value)
                  }
                  placeholder="https://"
                />
              </div>
              <div class="editor-modal-row">
                <label class="editor-modal-label">显示文本（可选）</label>
                <input
                  class="editor-modal-input"
                  value={props.state.linkText}
                  onInput={event =>
                    props.actions.onLinkTextInput((event.target as HTMLInputElement).value)
                  }
                  placeholder="显示文本（可选）"
                />
              </div>
              <div class="editor-modal-preview">
                <span class="editor-modal-preview-label">预览：</span>
                {props.state.linkUrl.trim() ? (
                  <a
                    href={props.state.linkUrl.trim()}
                    target="_blank"
                    rel="nofollow noopener"
                    class="editor-modal-preview-link"
                  >
                    {props.state.linkText.trim() || props.state.linkUrl.trim()}
                  </a>
                ) : (
                  <span class="editor-modal-preview-placeholder">未填写链接</span>
                )}
              </div>
              <div class="editor-modal-actions">
                <button class="editor-modal-btn" onClick={props.actions.closePanels} title="取消">
                  取消
                </button>
                <button
                  class="editor-modal-btn primary"
                  onClick={props.actions.insertLink}
                  title="插入"
                  disabled={!props.state.linkUrl.trim()}
                >
                  插入
                </button>
              </div>
            </div>
          </div>
        ) : null}
        {props.state.showImagePanel ? (
          <div class="editor-modal-backdrop" onClick={props.actions.closePanels}>
            <div class="editor-modal-card" onClick={event => event.stopPropagation()}>
              <div class="editor-modal-header">
                <span>插入图片</span>
              </div>
              <div class="editor-modal-row">
                <label class="editor-modal-label">图片地址</label>
                <input
                  class="editor-modal-input"
                  value={props.state.imageUrl}
                  onInput={event =>
                    props.actions.onImageInput((event.target as HTMLInputElement).value)
                  }
                  placeholder="https://"
                />
              </div>
              <div class="editor-modal-row">
                <label class="editor-modal-label">描述（可选）</label>
                <input
                  class="editor-modal-input"
                  value={props.state.imageAlt}
                  onInput={event =>
                    props.actions.onImageAltInput((event.target as HTMLInputElement).value)
                  }
                  placeholder="描述（可选）"
                />
              </div>
              <div class="editor-modal-preview">
                <span class="editor-modal-preview-label">预览：</span>
                {props.state.imageUrl.trim() ? (
                  <img
                    src={props.state.imageUrl.trim()}
                    alt={props.state.imageAlt.trim() || 'image'}
                    class="editor-modal-preview-image"
                  />
                ) : (
                  <span class="editor-modal-preview-placeholder">未填写图片地址</span>
                )}
              </div>
              <div class="editor-modal-actions">
                <button class="editor-modal-btn" onClick={props.actions.closePanels} title="取消">
                  取消
                </button>
                <button
                  class="editor-modal-btn primary"
                  onClick={props.actions.insertImage}
                  title="插入"
                  disabled={!props.state.imageUrl.trim()}
                >
                  插入
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </>
    )
  }
})
