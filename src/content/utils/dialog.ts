import { createE, DOA, DHA, DAEL } from './createEl'
import { Z_INDEX } from './constants'

/**
 * Custom alert dialog to replace window.alert
 */
export function customAlert(message: string): Promise<void> {
  return new Promise(resolve => {
    // Create backdrop
    const backdrop = createE('div', {
      style: `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        z-index: ${Z_INDEX.DIALOG};
        display: flex;
        align-items: center;
        justify-content: center;
        animation: fadeIn 0.15s ease-out;
      `
    })

    // Create dialog
    const dialog = createE('div', {
      style: `
        background: var(--primary-very-low, #ffffff);
        border-radius: 12px;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
        min-width: 300px;
        max-width: 500px;
        padding: 24px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        animation: slideIn 0.2s ease-out;
      `
    })

    // Create message
    const messageEl = createE('div', {
      text: message,
      style: `
        color: var(--primary, #333);
        font-size: 15px;
        line-height: 1.5;
        margin-bottom: 20px;
        word-break: break-word;
      `
    })

    // Create button
    const button = createE('button', {
      text: '确定',
      style: `
        width: 100%;
        padding: 10px 20px;
        background: #3b82f6;
        color: white;
        border: none;
        border-radius: 6px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: background 0.2s;
      `,
      on: {
        mouseenter: () => {
          button.style.background = '#2563eb'
        },
        mouseleave: () => {
          button.style.background = '#3b82f6'
        }
      }
    }) as HTMLButtonElement

    const cleanup = () => {
      backdrop.style.opacity = '0'
      dialog.style.transform = 'scale(0.95)'
      setTimeout(() => {
        if (backdrop.parentElement) {
          backdrop.parentElement.removeChild(backdrop)
        }
        resolve()
      }, 150)
    }

    button.addEventListener('click', cleanup)
    backdrop.addEventListener('click', e => {
      if (e.target === backdrop) {
        cleanup()
      }
    })

    // Handle Escape key
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        cleanup()
        document.removeEventListener('keydown', handleEscape)
      }
    }
    DAEL('keydown', handleEscape)

    dialog.appendChild(messageEl)
    dialog.appendChild(button)
    backdrop.appendChild(dialog)

    // Add animations
    const style = document.createElement('style')
    style.textContent = `
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes slideIn {
        from {
          opacity: 0;
          transform: scale(0.95);
        }
        to {
          opacity: 1;
          transform: scale(1);
        }
      }
    `
    DHA(style)

    DOA(backdrop)

    // Auto focus button
    setTimeout(() => button.focus(), 100)
  })
}

/**
 * Custom confirm dialog to replace window.confirm
 */
export function customConfirm(message: string): Promise<boolean> {
  return new Promise(resolve => {
    // Create backdrop
    const backdrop = createE('div', {
      style: `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        z-index: ${Z_INDEX.DIALOG};
        display: flex;
        align-items: center;
        justify-content: center;
        animation: fadeIn 0.15s ease-out;
      `
    })

    // Create dialog
    const dialog = createE('div', {
      style: `
        background: var(--primary-very-low, #ffffff);
        border-radius: 12px;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
        min-width: 300px;
        max-width: 500px;
        padding: 24px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        animation: slideIn 0.2s ease-out;
      `
    })

    // Create message
    const messageEl = createE('div', {
      text: message,
      style: `
        color: var(--primary, #333);
        font-size: 15px;
        line-height: 1.5;
        margin-bottom: 20px;
        word-break: break-word;
      `
    })

    // Create button container
    const buttonContainer = createE('div', {
      style: `
        display: flex;
        gap: 10px;
        justify-content: flex-end;
      `
    })

    // Create cancel button
    const cancelButton = createE('button', {
      text: '取消',
      style: `
        padding: 10px 20px;
        background: var(--primary-low, #f3f4f6);
        color: var(--primary, #333);
        border: 1px solid var(--primary-low-mid, #d1d5db);
        border-radius: 6px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
      `
    }) as HTMLButtonElement

    cancelButton.addEventListener('mouseenter', () => {
      cancelButton.style.background = 'var(--primary-low-mid, #e5e7eb)'
    })
    cancelButton.addEventListener('mouseleave', () => {
      cancelButton.style.background = 'var(--primary-low, #f3f4f6)'
    })

    // Create confirm button
    const confirmButton = createE('button', {
      text: '确定',
      style: `
        padding: 10px 20px;
        background: #3b82f6;
        color: white;
        border: none;
        border-radius: 6px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: background 0.2s;
      `
    }) as HTMLButtonElement

    confirmButton.addEventListener('mouseenter', () => {
      confirmButton.style.background = '#2563eb'
    })
    confirmButton.addEventListener('mouseleave', () => {
      confirmButton.style.background = '#3b82f6'
    })

    const cleanup = (result: boolean) => {
      backdrop.style.opacity = '0'
      dialog.style.transform = 'scale(0.95)'
      setTimeout(() => {
        if (backdrop.parentElement) {
          backdrop.parentElement.removeChild(backdrop)
        }
        resolve(result)
      }, 150)
    }

    cancelButton.addEventListener('click', () => cleanup(false))
    confirmButton.addEventListener('click', () => cleanup(true))
    backdrop.addEventListener('click', e => {
      if (e.target === backdrop) {
        cleanup(false)
      }
    })

    // Handle Escape key
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        cleanup(false)
        document.removeEventListener('keydown', handleEscape)
      }
    }
    DAEL('keydown', handleEscape)

    buttonContainer.appendChild(cancelButton)
    buttonContainer.appendChild(confirmButton)
    dialog.appendChild(messageEl)
    dialog.appendChild(buttonContainer)
    backdrop.appendChild(dialog)

    // Add animations
    const style = document.createElement('style')
    style.textContent = `
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes slideIn {
        from {
          opacity: 0;
          transform: scale(0.95);
        }
        to {
          opacity: 1;
          transform: scale(1);
        }
      }
    `
    DHA(style)

    DOA(backdrop)

    // Auto focus confirm button
    setTimeout(() => confirmButton.focus(), 100)
  })
}

/**
 * Custom prompt dialog to replace window.prompt
 */
export function customPrompt(message: string, defaultValue: string = ''): Promise<string | null> {
  return new Promise(resolve => {
    // Create backdrop
    const backdrop = createE('div', {
      style: `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        z-index: ${Z_INDEX.DIALOG};
        display: flex;
        align-items: center;
        justify-content: center;
        animation: fadeIn 0.15s ease-out;
      `
    })

    // Create dialog
    const dialog = createE('div', {
      style: `
        background: var(--primary-very-low, #ffffff);
        border-radius: 12px;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
        min-width: 300px;
        max-width: 500px;
        padding: 24px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        animation: slideIn 0.2s ease-out;
      `
    })

    // Create message
    const messageEl = createE('div', {
      text: message,
      style: `
        color: var(--primary, #333);
        font-size: 15px;
        line-height: 1.5;
        margin-bottom: 16px;
        word-break: break-word;
      `
    })

    // Create input
    const input = createE('input', {
      type: 'text',
      val: defaultValue,
      style: `
        width: 100%;
        padding: 10px 12px;
        border: 1px solid var(--primary-low-mid, #d1d5db);
        border-radius: 6px;
        font-size: 14px;
        margin-bottom: 16px;
        box-sizing: border-box;
        font-family: inherit;
      `
    }) as HTMLInputElement

    input.addEventListener('focus', () => {
      input.style.outline = '2px solid #3b82f6'
      input.style.outlineOffset = '0'
    })
    input.addEventListener('blur', () => {
      input.style.outline = 'none'
    })

    // Create button container
    const buttonContainer = createE('div', {
      style: `
        display: flex;
        gap: 10px;
        justify-content: flex-end;
      `
    })

    // Create cancel button
    const cancelButton = createE('button', {
      text: '取消',
      style: `
        padding: 10px 20px;
        background: var(--primary-low, #f3f4f6);
        color: var(--primary, #333);
        border: 1px solid var(--primary-low-mid, #d1d5db);
        border-radius: 6px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
      `,
      on: {
        mouseenter: () => {
          cancelButton.style.background = 'var(--primary-low-mid, #e5e7eb)'
        },
        mouseleave: () => {
          cancelButton.style.background = 'var(--primary-low, #f3f4f6)'
        },
        click: () => {
          cleanup(null)
        }
      }
    }) as HTMLButtonElement

    const cleanup = (result: string | null) => {
      backdrop.style.opacity = '0'
      dialog.style.transform = 'scale(0.95)'
      setTimeout(() => {
        if (backdrop.parentElement) {
          backdrop.parentElement.removeChild(backdrop)
        }
        resolve(result)
      }, 150)
    }

    // Create confirm button
    const confirmButton = createE('button', {
      text: '确定',
      style: `
        padding: 10px 20px;
        background: #3b82f6;
        color: white;
        border: none;
        border-radius: 6px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: background 0.2s;
      `,
      on: {
        mouseenter: () => {
          confirmButton.style.background = '#2563eb'
        },
        mouseleave: () => {
          confirmButton.style.background = '#3b82f6'
        },
        click: () => {
          cleanup(input.value)
        }
      }
    }) as HTMLButtonElement

    backdrop.addEventListener('click', e => {
      if (e.target === backdrop) {
        cleanup(null)
      }
    })

    // Handle Enter and Escape keys
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        cleanup(input.value)
        document.removeEventListener('keydown', handleKeydown)
      } else if (e.key === 'Escape') {
        cleanup(null)
        document.removeEventListener('keydown', handleKeydown)
      }
    }
    DAEL('keydown', handleKeydown)

    buttonContainer.appendChild(cancelButton)
    buttonContainer.appendChild(confirmButton)
    dialog.appendChild(messageEl)
    dialog.appendChild(input)
    dialog.appendChild(buttonContainer)
    backdrop.appendChild(dialog)

    // Add animations
    const style = document.createElement('style')
    style.textContent = `
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes slideIn {
        from {
          opacity: 0;
          transform: scale(0.95);
        }
        to {
          opacity: 1;
          transform: scale(1);
        }
      }
    `
    DHA(style)

    DOA(backdrop)

    // Auto focus input and select text
    setTimeout(() => {
      input.focus()
      input.select()
    }, 100)
  })
}
