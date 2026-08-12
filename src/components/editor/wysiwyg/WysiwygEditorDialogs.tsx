/* @jsxImportSource vue */
import { defineComponent, PropType } from 'vue'

export type DialogState = {
  showLinkPanel: boolean
  showImagePanel: boolean
  showTableAssistant: boolean
  showPollAssistant: boolean
  showFormulaAssistant: boolean
  linkUrl: string
  linkText: string
  imageUrl: string
  imageAlt: string
  tableRows: number
  tableColumns: number
  tableHasHeader: boolean
  pollQuestion: string
  pollOptions: string
  pollType: 'regular' | 'multiple' | 'number'
  pollResults: 'always' | 'on_close'
  formula: string
  formulaDisplay: 'inline' | 'block'
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
  closeTableAssistant: () => void
  insertTable: () => void
  onTableRowsInput: (value: number) => void
  onTableColumnsInput: (value: number) => void
  onTableHeaderChange: (value: boolean) => void
  closePollAssistant: () => void
  insertPoll: () => void
  onPollQuestionInput: (value: string) => void
  onPollOptionsInput: (value: string) => void
  onPollTypeInput: (value: 'regular' | 'multiple' | 'number') => void
  onPollResultsInput: (value: 'always' | 'on_close') => void
  closeFormulaAssistant: () => void
  insertFormula: () => void
  onFormulaInput: (value: string) => void
  onFormulaDisplayInput: (value: 'inline' | 'block') => void
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
              <div class="editor-modal-field">
                <span class="editor-modal-field__label">链接地址</span>
                <input
                  class="editor-modal-field__input"
                  value={props.state.linkUrl}
                  onInput={event =>
                    props.actions.onLinkInput((event.target as HTMLInputElement).value)
                  }
                  placeholder="https://"
                />
              </div>
              <div class="editor-modal-field">
                <span class="editor-modal-field__label">显示文本（可选）</span>
                <input
                  class="editor-modal-field__input"
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
              <div class="editor-modal-field">
                <span class="editor-modal-field__label">图片地址</span>
                <input
                  class="editor-modal-field__input"
                  value={props.state.imageUrl}
                  onInput={event =>
                    props.actions.onImageInput((event.target as HTMLInputElement).value)
                  }
                  placeholder="https://"
                />
              </div>
              <div class="editor-modal-field">
                <span class="editor-modal-field__label">描述（可选）</span>
                <input
                  class="editor-modal-field__input"
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
        {props.state.showTableAssistant ? (
          <div class="editor-modal-backdrop" onClick={props.actions.closeTableAssistant}>
            <div
              class="editor-modal-card editor-modal-card--assistant"
              onClick={event => event.stopPropagation()}
            >
              <div class="editor-modal-header">
                <span>制表辅助</span>
              </div>
              <p class="editor-modal-helper">选择行列与表头后插入可编辑的论坛表格。</p>
              <div class="editor-modal-grid-fields">
                <label class="editor-modal-field">
                  <span class="editor-modal-field__label">数据行</span>
                  <input
                    class="editor-modal-field__input"
                    type="number"
                    min="1"
                    max="20"
                    value={props.state.tableRows}
                    onInput={event =>
                      props.actions.onTableRowsInput(
                        Number((event.target as HTMLInputElement).value) || 1
                      )
                    }
                  />
                </label>
                <label class="editor-modal-field">
                  <span class="editor-modal-field__label">列数</span>
                  <input
                    class="editor-modal-field__input"
                    type="number"
                    min="1"
                    max="12"
                    value={props.state.tableColumns}
                    onInput={event =>
                      props.actions.onTableColumnsInput(
                        Number((event.target as HTMLInputElement).value) || 1
                      )
                    }
                  />
                </label>
              </div>
              <label class="editor-modal-checkbox">
                <input
                  type="checkbox"
                  checked={props.state.tableHasHeader}
                  onChange={event =>
                    props.actions.onTableHeaderChange((event.target as HTMLInputElement).checked)
                  }
                />
                <span>首行作为表头</span>
              </label>
              <div class="editor-modal-preview editor-modal-assistant-preview">
                <span class="editor-modal-preview-label">将插入：</span>
                <span>
                  {props.state.tableHasHeader ? '带表头的 ' : ''}
                  {props.state.tableRows} × {props.state.tableColumns} 表格
                </span>
              </div>
              <div class="editor-modal-actions">
                <button class="editor-modal-btn" onClick={props.actions.closeTableAssistant}>
                  取消
                </button>
                <button class="editor-modal-btn primary" onClick={props.actions.insertTable}>
                  插入表格
                </button>
              </div>
            </div>
          </div>
        ) : null}
        {props.state.showPollAssistant ? (
          <div class="editor-modal-backdrop" onClick={props.actions.closePollAssistant}>
            <div
              class="editor-modal-card editor-modal-card--assistant"
              onClick={event => event.stopPropagation()}
            >
              <div class="editor-modal-header">
                <span>Discourse 投票制作</span>
              </div>
              <p class="editor-modal-helper">
                生成兼容 Discourse 的投票块；发布后由论坛处理投票和统计。
              </p>
              <label class="editor-modal-field">
                <span class="editor-modal-field__label">投票问题</span>
                <input
                  class="editor-modal-field__input"
                  value={props.state.pollQuestion}
                  onInput={event =>
                    props.actions.onPollQuestionInput((event.target as HTMLInputElement).value)
                  }
                  placeholder="例如：你更倾向哪个方案？"
                />
              </label>
              <label class="editor-modal-field">
                <span class="editor-modal-field__label">选项（每行一个，至少两个）</span>
                <textarea
                  class="editor-modal-field__input editor-modal-field__textarea"
                  value={props.state.pollOptions}
                  onInput={event =>
                    props.actions.onPollOptionsInput((event.target as HTMLTextAreaElement).value)
                  }
                  placeholder={'选项一\n选项二'}
                />
              </label>
              <div class="editor-modal-grid-fields">
                <label class="editor-modal-field">
                  <span class="editor-modal-field__label">投票类型</span>
                  <select
                    class="editor-modal-field__input"
                    value={props.state.pollType}
                    onChange={event =>
                      props.actions.onPollTypeInput(
                        (event.target as HTMLSelectElement).value as
                          'regular' | 'multiple' | 'number'
                      )
                    }
                  >
                    <option value="regular">单选</option>
                    <option value="multiple">多选</option>
                    <option value="number">数字评分</option>
                  </select>
                </label>
                <label class="editor-modal-field">
                  <span class="editor-modal-field__label">结果可见时间</span>
                  <select
                    class="editor-modal-field__input"
                    value={props.state.pollResults}
                    onChange={event =>
                      props.actions.onPollResultsInput(
                        (event.target as HTMLSelectElement).value as 'always' | 'on_close'
                      )
                    }
                  >
                    <option value="always">始终可见</option>
                    <option value="on_close">关闭后可见</option>
                  </select>
                </label>
              </div>
              <div class="editor-modal-actions">
                <button class="editor-modal-btn" onClick={props.actions.closePollAssistant}>
                  取消
                </button>
                <button
                  class="editor-modal-btn primary"
                  onClick={props.actions.insertPoll}
                  disabled={
                    !props.state.pollQuestion.trim() ||
                    props.state.pollOptions.split(/\r?\n/).filter(Boolean).length < 2
                  }
                >
                  插入投票
                </button>
              </div>
            </div>
          </div>
        ) : null}
        {props.state.showFormulaAssistant ? (
          <div class="editor-modal-backdrop" onClick={props.actions.closeFormulaAssistant}>
            <div
              class="editor-modal-card editor-modal-card--assistant"
              onClick={event => event.stopPropagation()}
            >
              <div class="editor-modal-header">
                <span>公式辅助</span>
              </div>
              <p class="editor-modal-helper">
                使用 LaTeX；行内公式会与文字同行，块级公式单独展示。
              </p>
              <label class="editor-modal-field">
                <span class="editor-modal-field__label">LaTeX 公式</span>
                <textarea
                  class="editor-modal-field__input editor-modal-field__textarea editor-modal-field__textarea--code"
                  value={props.state.formula}
                  onInput={event =>
                    props.actions.onFormulaInput((event.target as HTMLTextAreaElement).value)
                  }
                  placeholder="E = mc^2"
                />
              </label>
              <div class="editor-modal-segmented" role="group" aria-label="公式显示方式">
                <button
                  type="button"
                  class={props.state.formulaDisplay === 'inline' ? 'is-selected' : ''}
                  onClick={() => props.actions.onFormulaDisplayInput('inline')}
                >
                  行内公式
                </button>
                <button
                  type="button"
                  class={props.state.formulaDisplay === 'block' ? 'is-selected' : ''}
                  onClick={() => props.actions.onFormulaDisplayInput('block')}
                >
                  块级公式
                </button>
              </div>
              <div class="editor-modal-actions">
                <button class="editor-modal-btn" onClick={props.actions.closeFormulaAssistant}>
                  取消
                </button>
                <button
                  class="editor-modal-btn primary"
                  onClick={props.actions.insertFormula}
                  disabled={!props.state.formula.trim()}
                >
                  插入公式
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </>
    )
  }
})
