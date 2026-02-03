/**
 * Color Picker for BBCode
 * Provides a custom color selection dialog
 */

export interface ColorPickerOptions {
  onSelect: (color: string) => void
  onCancel: () => void
  defaultColor?: string
  position?: { x: number; y: number }
}

/**
 * Create and show a color picker dialog
 */
export function showColorPicker(options: ColorPickerOptions): () => void {
  const { onSelect, onCancel, defaultColor = '#ff0000', position } = options

  // Create color picker modal
  const modal = document.createElement('div')
  modal.className = 'color-picker-modal'
  modal.style.cssText = `
    position: fixed;
    z-index: 9999;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 12px;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
    min-width: 200px;
  `

  // Set position
  if (position) {
    modal.style.left = `${position.x}px`
    modal.style.top = `${position.y}px`
  }

  // Create header
  const header = document.createElement('div')
  header.className = 'color-picker-header'
  header.textContent = '选择颜色'
  header.style.cssText = `
    font-size: 14px;
    font-weight: 500;
    margin-bottom: 10px;
    color: #374151;
  `
  modal.appendChild(header)

  // Create color input wrapper
  const colorWrapper = document.createElement('div')
  colorWrapper.style.cssText = `
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 12px;
  `

  const colorInput = document.createElement('input')
  colorInput.type = 'color'
  colorInput.value = defaultColor
  colorInput.style.cssText = `
    width: 50px;
    height: 40px;
    border: 1px solid #e5e7eb;
    border-radius: 4px;
    cursor: pointer;
    padding: 2px;
  `

  const colorValue = document.createElement('input')
  colorValue.type = 'text'
  colorValue.value = defaultColor
  colorValue.style.cssText = `
    flex: 1;
    padding: 8px;
    border: 1px solid #e5e7eb;
    border-radius: 4px;
    font-size: 14px;
  `

  // Sync color input and text input
  colorInput.addEventListener('input', () => {
    colorValue.value = colorInput.value
  })

  colorValue.addEventListener('input', () => {
    if (/^#[0-9A-Fa-f]{6}$/.test(colorValue.value)) {
      colorInput.value = colorValue.value
    }
  })

  colorWrapper.appendChild(colorInput)
  colorWrapper.appendChild(colorValue)
  modal.appendChild(colorWrapper)

  // Create buttons
  const buttons = document.createElement('div')
  buttons.style.cssText = `
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  `

  const cancelButton = document.createElement('button')
  cancelButton.textContent = '取消'
  cancelButton.style.cssText = `
    padding: 6px 16px;
    border: 1px solid #e5e7eb;
    background: white;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    color: #6b7280;
  `

  const confirmButton = document.createElement('button')
  confirmButton.textContent = '确定'
  confirmButton.style.cssText = `
    padding: 6px 16px;
    border: none;
    background: #3b82f6;
    color: white;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
  `

  // Close function
  const close = () => {
    document.removeEventListener('click', handleOutsideClick)
    if (document.body.contains(modal)) {
      document.body.removeChild(modal)
    }
  }

  cancelButton.addEventListener('click', () => {
    close()
    onCancel()
  })

  confirmButton.addEventListener('click', () => {
    close()
    onSelect(colorInput.value)
  })

  buttons.appendChild(cancelButton)
  buttons.appendChild(confirmButton)
  modal.appendChild(buttons)

  // Close on click outside
  const handleOutsideClick = (e: MouseEvent) => {
    if (!modal.contains(e.target as Node)) {
      close()
      onCancel()
    }
  }

  setTimeout(() => {
    document.addEventListener('click', handleOutsideClick)
  }, 0)

  // Add to DOM
  document.body.appendChild(modal)
  colorInput.focus()

  return close
}

/**
 * Show color picker at button position
 */
export function showColorPickerAtButton(
  buttonSelector: string,
  onSelect: (color: string) => void,
  onCancel: () => void,
  defaultColor?: string
): () => void {
  const button = document.querySelector(buttonSelector) as HTMLElement
  if (!button) {
    onCancel()
    return () => {}
  }

  const rect = button.getBoundingClientRect()
  const position = { x: rect.left, y: rect.bottom + 8 }

  return showColorPicker({ onSelect, onCancel, defaultColor, position })
}
