import { DQS } from '../dom'

// Function to parse image filenames from markdown text
export function parseImageFilenamesFromMarkdown(markdownText: string): string[] {
  const imageRegex = /!\[([^\]]*)\]\([^)]+\)/g
  const filenames: string[] = []
  let match

  while ((match = imageRegex.exec(markdownText)) !== null) {
    const filename = match[1]
    if (filename && filename.trim()) {
      filenames.push(filename.trim())
    }
  }

  return filenames
}

// Generic function to insert text into editor
export function insertIntoEditor(text: string) {
  // Priority 1: Chat composer (highest priority)
  const chatComposer = DQS(
    'textarea#channel-composer.chat-composer__input'
  ) as HTMLTextAreaElement | null
  // Priority 2: Standard editor textarea
  const textArea = DQS('textarea.d-editor-input') as HTMLTextAreaElement | null
  // Priority 3: Rich text editor
  const richEle = DQS('.ProseMirror.d-editor-input') as HTMLElement | null

  if (!chatComposer && !textArea && !richEle) {
    console.error('找不到输入框')
    return
  }

  if (chatComposer) {
    const start = chatComposer.selectionStart
    const end = chatComposer.selectionEnd
    const value = chatComposer.value

    chatComposer.value = value.substring(0, start) + text + value.substring(end)
    chatComposer.setSelectionRange(start + text.length, start + text.length)
    chatComposer.focus()

    // Trigger input event to notify any listeners
    const event = new Event('input', { bubbles: true })
    chatComposer.dispatchEvent(event)
  } else if (textArea) {
    const start = textArea.selectionStart
    const end = textArea.selectionEnd
    const value = textArea.value

    textArea.value = value.substring(0, start) + text + value.substring(end)
    textArea.setSelectionRange(start + text.length, start + text.length)
    textArea.focus()

    // Trigger input event to notify any listeners
    const event = new Event('input', { bubbles: true })
    textArea.dispatchEvent(event)
  } else if (richEle) {
    // For rich text editor, insert at current cursor position
    const selection = window.getSelection()
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0)
      const textNode = document.createTextNode(text)
      range.insertNode(textNode)

      // Move cursor after inserted text
      range.setStartAfter(textNode)
      range.setEndAfter(textNode)
      selection.removeAllRanges()
      selection.addRange(range)
    }
    richEle.focus()
  }
}
