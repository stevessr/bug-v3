/* @jsxImportSource vue */
import { defineComponent, PropType } from 'vue'

export type DialogState = {
  showLinkPanel: boolean
  showImagePanel: boolean
  showTableAssistant: boolean
  showPollAssistant: boolean
  showFormulaAssistant: boolean
  showWrapAssistant: boolean
  linkUrl: string
  linkText: string
  imageUrl: string
  imageAlt: string
  tableRows: number
  tableColumns: number
  tableHasHeader: boolean
  tableGrid: string[][]
  tableContextMenu: { open: boolean; x: number; y: number; row: number; column: number }
  pollQuestion: string
  pollOptions: string
  pollType: 'regular' | 'multiple' | 'number'
  pollResults: 'always' | 'on_close'
  formula: string
  formulaDisplay: 'inline' | 'block'
  formulaWysiwyg: boolean
  formulaPreviewHtml: string
  wrapMode: string
  wrapContent: string
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
  onTableCellInput: (row: number, column: number, value: string) => void
  onTableContextMenu: (event: MouseEvent, row: number, column: number) => void
  closeTableContextMenu: () => void
  tableContextAction: (
    action:
      | 'insert-row-before'
      | 'insert-row-after'
      | 'delete-row'
      | 'move-row-up'
      | 'move-row-down'
      | 'copy-row'
      | 'paste-row'
      | 'insert-column-before'
      | 'insert-column-after'
      | 'delete-column'
      | 'move-column-left'
      | 'move-column-right'
      | 'copy-column'
      | 'paste-column'
  ) => void
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
  onFormulaWysiwygInput: (value: boolean) => void
  closeWrapAssistant: () => void
  insertWrap: () => void
  onWrapModeInput: (value: string) => void
  onWrapContentInput: (value: string) => void
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
              <p class="editor-modal-helper">
                直接编辑单元格；在单元格上右键可移动、添加、插入、复制或粘贴行列。
              </p>
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
              <div
                class="wysiwyg-table-assistant-preview"
                onContextmenu={event => event.preventDefault()}
              >
                <table class="wysiwyg-table-assistant-grid">
                  <tbody>
                    {props.state.tableGrid.map((row, rowIndex) => (
                      <tr key={`table-row-${rowIndex}`}>
                        {row.map((cell, columnIndex) => {
                          const isHeader = props.state.tableHasHeader && rowIndex === 0
                          return (
                            <td key={`table-cell-${rowIndex}-${columnIndex}`}>
                              <input
                                class={isHeader ? 'is-header' : ''}
                                value={cell}
                                aria-label={`${isHeader ? '表头' : '单元格'} ${rowIndex + 1}-${columnIndex + 1}`}
                                onInput={event =>
                                  props.actions.onTableCellInput(
                                    rowIndex,
                                    columnIndex,
                                    (event.target as HTMLInputElement).value
                                  )
                                }
                                onContextmenu={event =>
                                  props.actions.onTableContextMenu(event, rowIndex, columnIndex)
                                }
                              />
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
              {props.state.tableContextMenu.open ? (
                <div
                  class="wysiwyg-table-context-menu"
                  style={{
                    left: `${props.state.tableContextMenu.x}px`,
                    top: `${props.state.tableContextMenu.y}px`
                  }}
                  role="menu"
                  aria-label="表格行列操作"
                  onContextmenu={event => event.preventDefault()}
                >
                  <div class="wysiwyg-table-context-menu__title">
                    行 {props.state.tableContextMenu.row + 1} · 列{' '}
                    {props.state.tableContextMenu.column + 1}
                  </div>
                  <div class="wysiwyg-table-context-menu__group">
                    <button
                      type="button"
                      onClick={() => props.actions.tableContextAction('insert-row-before')}
                    >
                      在上方插入行
                    </button>
                    <button
                      type="button"
                      onClick={() => props.actions.tableContextAction('insert-row-after')}
                    >
                      在下方插入行
                    </button>
                    <button
                      type="button"
                      onClick={() => props.actions.tableContextAction('delete-row')}
                    >
                      删除行
                    </button>
                    <button
                      type="button"
                      onClick={() => props.actions.tableContextAction('move-row-up')}
                    >
                      上移行
                    </button>
                    <button
                      type="button"
                      onClick={() => props.actions.tableContextAction('move-row-down')}
                    >
                      下移行
                    </button>
                    <button
                      type="button"
                      onClick={() => props.actions.tableContextAction('copy-row')}
                    >
                      复制行
                    </button>
                    <button
                      type="button"
                      onClick={() => props.actions.tableContextAction('paste-row')}
                    >
                      粘贴行
                    </button>
                  </div>
                  <div class="wysiwyg-table-context-menu__group">
                    <button
                      type="button"
                      onClick={() => props.actions.tableContextAction('insert-column-before')}
                    >
                      在左侧插入列
                    </button>
                    <button
                      type="button"
                      onClick={() => props.actions.tableContextAction('insert-column-after')}
                    >
                      在右侧插入列
                    </button>
                    <button
                      type="button"
                      onClick={() => props.actions.tableContextAction('delete-column')}
                    >
                      删除列
                    </button>
                    <button
                      type="button"
                      onClick={() => props.actions.tableContextAction('move-column-left')}
                    >
                      左移列
                    </button>
                    <button
                      type="button"
                      onClick={() => props.actions.tableContextAction('move-column-right')}
                    >
                      右移列
                    </button>
                    <button
                      type="button"
                      onClick={() => props.actions.tableContextAction('copy-column')}
                    >
                      复制列
                    </button>
                    <button
                      type="button"
                      onClick={() => props.actions.tableContextAction('paste-column')}
                    >
                      粘贴列
                    </button>
                  </div>
                </div>
              ) : null}
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
              <div class="editor-modal-segmented" role="group" aria-label="公式编辑模式">
                <button
                  type="button"
                  class={props.state.formulaWysiwyg ? 'is-selected' : ''}
                  onClick={() => props.actions.onFormulaWysiwygInput(true)}
                >
                  所见即所得
                </button>
                <button
                  type="button"
                  class={!props.state.formulaWysiwyg ? 'is-selected' : ''}
                  onClick={() => props.actions.onFormulaWysiwygInput(false)}
                >
                  LaTeX 源码
                </button>
              </div>
              {props.state.formulaWysiwyg ? (
                <div
                  class="editor-modal-formula-preview"
                  aria-label="公式所见即所得预览"
                  innerHTML={props.state.formulaPreviewHtml || '<span>输入公式后显示预览</span>'}
                />
              ) : null}
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
        {props.state.showWrapAssistant ? (
          <div class="editor-modal-backdrop" onClick={props.actions.closeWrapAssistant}>
            <div
              class="editor-modal-card editor-modal-card--assistant"
              onClick={event => event.stopPropagation()}
            >
              <div class="editor-modal-header">
                <span>Discourse 包装辅助</span>
              </div>
              <p class="editor-modal-helper">
                选择包装类型并编辑内容；发布时会还原为官方 [wrap] 语法。
              </p>
              <label class="editor-modal-field">
                <span class="editor-modal-field__label">包装类型</span>
                <select
                  class="editor-modal-field__input"
                  value={props.state.wrapMode}
                  onChange={event =>
                    props.actions.onWrapModeInput((event.target as HTMLSelectElement).value)
                  }
                >
                  <option value="scrollable">可滚动内容（scrollable）</option>
                  <option value="app">应用容器（app）</option>
                </select>
              </label>
              <label class="editor-modal-field">
                <span class="editor-modal-field__label">包装内容</span>
                <textarea
                  class="editor-modal-field__input editor-modal-field__textarea"
                  value={props.state.wrapContent}
                  onInput={event =>
                    props.actions.onWrapContentInput((event.target as HTMLTextAreaElement).value)
                  }
                  placeholder="在这里填写内容"
                />
              </label>
              <div class="editor-modal-actions">
                <button class="editor-modal-btn" onClick={props.actions.closeWrapAssistant}>
                  取消
                </button>
                <button
                  class="editor-modal-btn primary"
                  onClick={props.actions.insertWrap}
                  disabled={!props.state.wrapContent.trim()}
                >
                  插入包装
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </>
    )
  }
})
