// Custom dialog utilities for userscripts
import { createEl } from './createEl';

/**
 * Custom alert dialog to replace window.alert
 */
export function customAlert(message: string): Promise<void> {
  return new Promise(resolve => {
    // Create backdrop
    const backdrop = createEl('div', {
      style: `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        z-index: 2147483646;
        display: flex;
        align-items: center;
        justify-content: center;
      `
    }) as HTMLDivElement;

    // Create dialog container
    const dialog = createEl('div', {
      style: `
        background: #ffffff;
        color: #000000;
        padding: 20px;
        border-radius: 8px;
        max-width: 90vw;
        max-height: 80vh;
        overflow-y: auto;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        text-align: center;
        min-width: 300px;
      `
    }) as HTMLDivElement;

    // Create message element
    const messageEl = createEl('div', {
      text: message,
      style: 'margin-bottom: 20px; word-wrap: break-word;'
    }) as HTMLDivElement;

    // Create OK button
    const okButton = createEl('button', {
      text: '确定',
      className: 'btn btn-primary',
      style: 'padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer; background: #007bff; color: white;'
    }) as HTMLButtonElement;

    okButton.addEventListener('click', () => {
      backdrop.remove();
      resolve();
    });

    // Add elements to dialog
    dialog.appendChild(messageEl);
    dialog.appendChild(okButton);

    // Add dialog to backdrop
    backdrop.appendChild(dialog);

    // Add backdrop to document
    document.body.appendChild(backdrop);

    // Allow closing with Escape key
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        backdrop.remove();
        document.removeEventListener('keydown', handleEsc);
        resolve();
      }
    };
    document.addEventListener('keydown', handleEsc);

    // Allow closing by clicking backdrop
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        backdrop.remove();
        document.removeEventListener('keydown', handleEsc);
        resolve();
      }
    });
  });
}

/**
 * Custom confirm dialog to replace window.confirm
 */
export function customConfirm(message: string): Promise<boolean> {
  return new Promise(resolve => {
    // Create backdrop
    const backdrop = createEl('div', {
      style: `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        z-index: 2147483646;
        display: flex;
        align-items: center;
        justify-content: center;
      `
    }) as HTMLDivElement;

    // Create dialog container
    const dialog = createEl('div', {
      style: `
        background: #ffffff;
        color: #000000;
        padding: 20px;
        border-radius: 8px;
        max-width: 90vw;
        max-height: 80vh;
        overflow-y: auto;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        text-align: center;
        min-width: 300px;
      `
    }) as HTMLDivElement;

    // Create message element
    const messageEl = createEl('div', {
      text: message,
      style: 'margin-bottom: 20px; word-wrap: break-word;'
    }) as HTMLDivElement;

    // Create button container
    const buttonContainer = createEl('div', {
      style: 'display: flex; gap: 10px; justify-content: center;'
    }) as HTMLDivElement;

    // Create Cancel button
    const cancelButton = createEl('button', {
      text: '取消',
      className: 'btn',
      style: 'padding: 8px 16px; border: 1px solid #ccc; border-radius: 4px; cursor: pointer; background: #f8f9fa; color: #333;'
    }) as HTMLButtonElement;

    // Create OK button
    const okButton = createEl('button', {
      text: '确定',
      className: 'btn btn-primary',
      style: 'padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer; background: #007bff; color: white;'
    }) as HTMLButtonElement;

    cancelButton.addEventListener('click', () => {
      backdrop.remove();
      resolve(false);
    });

    okButton.addEventListener('click', () => {
      backdrop.remove();
      resolve(true);
    });

    // Add buttons to container
    buttonContainer.appendChild(cancelButton);
    buttonContainer.appendChild(okButton);

    // Add elements to dialog
    dialog.appendChild(messageEl);
    dialog.appendChild(buttonContainer);

    // Add dialog to backdrop
    backdrop.appendChild(dialog);

    // Add backdrop to document
    document.body.appendChild(backdrop);

    // Allow closing with Escape key
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        backdrop.remove();
        document.removeEventListener('keydown', handleEsc);
        resolve(false);
      }
    };
    document.addEventListener('keydown', handleEsc);
  });
}

/**
 * Custom prompt dialog to replace window.prompt
 */
export function customPrompt(message: string, defaultValue: string = ''): Promise<string | null> {
  return new Promise(resolve => {
    // Create backdrop
    const backdrop = createEl('div', {
      style: `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        z-index: 2147483646;
        display: flex;
        align-items: center;
        justify-content: center;
      `
    }) as HTMLDivElement;

    // Create dialog container
    const dialog = createEl('div', {
      style: `
        background: #ffffff;
        color: #000000;
        padding: 20px;
        border-radius: 8px;
        max-width: 90vw;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        text-align: center;
        min-width: 300px;
      `
    }) as HTMLDivElement;

    // Create message element
    const messageEl = createEl('div', {
      text: message,
      style: 'margin-bottom: 15px; word-wrap: break-word;'
    }) as HTMLDivElement;

    // Create input element
    const input = createEl('input', {
      attrs: { type: 'text', value: defaultValue },
      className: 'form-control',
      style: `
        width: 100%;
        padding: 8px 12px;
        margin-bottom: 15px;
        border: 1px solid #ccc;
        border-radius: 4px;
        box-sizing: border-box;
      `
    }) as HTMLInputElement;

    // Create button container
    const buttonContainer = createEl('div', {
      style: 'display: flex; gap: 10px; justify-content: center;'
    }) as HTMLDivElement;

    // Create Cancel button
    const cancelButton = createEl('button', {
      text: '取消',
      className: 'btn',
      style: 'padding: 8px 16px; border: 1px solid #ccc; border-radius: 4px; cursor: pointer; background: #f8f9fa; color: #333;'
    }) as HTMLButtonElement;

    // Create OK button
    const okButton = createEl('button', {
      text: '确定',
      className: 'btn btn-primary',
      style: 'padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer; background: #007bff; color: white;'
    }) as HTMLButtonElement;

    cancelButton.addEventListener('click', () => {
      backdrop.remove();
      resolve(null);
    });

    okButton.addEventListener('click', () => {
      backdrop.remove();
      resolve(input.value);
    });

    // Focus input and select text
    setTimeout(() => {
      input.focus();
      input.select();
    }, 10);

    // Add Enter key support
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        backdrop.remove();
        resolve(input.value);
      }
    });

    // Add buttons to container
    buttonContainer.appendChild(cancelButton);
    buttonContainer.appendChild(okButton);

    // Add elements to dialog
    dialog.appendChild(messageEl);
    dialog.appendChild(input);
    dialog.appendChild(buttonContainer);

    // Add dialog to backdrop
    backdrop.appendChild(dialog);

    // Add backdrop to document
    document.body.appendChild(backdrop);

    // Allow closing with Escape key
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        backdrop.remove();
        document.removeEventListener('keydown', handleEsc);
        resolve(null);
      }
    };
    document.addEventListener('keydown', handleEsc);
  });
}