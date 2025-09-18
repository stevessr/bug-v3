// Centralized theme support utilities for userscript
let themeStylesInjected = false

export function injectGlobalThemeStyles(): void {
  if (themeStylesInjected || typeof document === 'undefined') return
  themeStylesInjected = true

  const style = document.createElement('style')
  style.id = 'emoji-extension-theme-globals'
  style.textContent = `
    /* Global CSS variables for emoji extension theme support */
    :root {
      /* Light theme (default) */
      --emoji-modal-bg: #ffffff;
      --emoji-modal-text: #333333;
      --emoji-modal-border: #dddddd;
      --emoji-modal-input-bg: #ffffff;
      --emoji-modal-label: #555555;
      --emoji-modal-button-bg: #f5f5f5;
      --emoji-modal-primary-bg: #1890ff;
      
      --emoji-preview-bg: #ffffff;
      --emoji-preview-text: #222222;
      --emoji-preview-border: rgba(0,0,0,0.08);
      
      --emoji-button-gradient-start: #667eea;
      --emoji-button-gradient-end: #764ba2;
      --emoji-button-shadow: rgba(0, 0, 0, 0.15);
      --emoji-button-hover-shadow: rgba(0, 0, 0, 0.2);
    }
    
    /* Dark theme */
    @media (prefers-color-scheme: dark) {
      :root {
        --emoji-modal-bg: #2d2d2d;
        --emoji-modal-text: #e6e6e6;
        --emoji-modal-border: #444444;
        --emoji-modal-input-bg: #3a3a3a;
        --emoji-modal-label: #cccccc;
        --emoji-modal-button-bg: #444444;
        --emoji-modal-primary-bg: #1677ff;
        
        --emoji-preview-bg: rgba(32,33,36,0.94);
        --emoji-preview-text: #e6e6e6;
        --emoji-preview-border: rgba(255,255,255,0.12);
        
        --emoji-button-gradient-start: #4a5568;
        --emoji-button-gradient-end: #2d3748;
        --emoji-button-shadow: rgba(0, 0, 0, 0.3);
        --emoji-button-hover-shadow: rgba(0, 0, 0, 0.4);
      }
    }
  `
  document.head.appendChild(style)
}

export function getThemeAwareStyle(property: string): string {
  return `var(--emoji-${property})`
}
