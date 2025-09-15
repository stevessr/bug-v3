// Styles for emoji picker hover preview and theme-adaptive rules
export function injectEmojiPickerStyles(): void {
  if (typeof document === 'undefined') return
  if (document.getElementById('emoji-picker-styles')) return
  const css = `
.emoji-picker-hover-preview{
  position:fixed;
  pointer-events:none;
  display:none;
  z-index:1000002;
  max-width:320px;
  max-height:320px;
  overflow:hidden;
  border-radius:8px;
  box-shadow:0 6px 20px rgba(0,0,0,0.32);
  background:var(--emoji-preview-bg, #ffffff);
  padding:8px;
  transition:opacity .3s ease, transform .12s ease;
  border: 1px solid var(--emoji-preview-border, rgba(0,0,0,0.08));
}
.emoji-picker-hover-preview img.emoji-picker-hover-img{
  display:block;
  max-width:100%;
  max-height:220px;
  object-fit:contain;
}
.emoji-picker-hover-preview .emoji-picker-hover-label{
  font-size:12px;
  color:var(--emoji-preview-text, #222);
  margin-top:8px;
  text-align:center;
  word-break:break-word;
  font-weight: 500;
}

/* Dark theme adaptation */
@media (prefers-color-scheme: dark) {
  :root {
    --emoji-preview-bg: rgba(32,33,36,0.94);
    --emoji-preview-text: #e6e6e6;
    --emoji-preview-border: rgba(255,255,255,0.12);
  }
  
  .emoji-picker-hover-preview{
    background: var(--emoji-preview-bg);
    box-shadow: 0 6px 20px rgba(0,0,0,0.6);
    border: 1px solid var(--emoji-preview-border);
    backdrop-filter: blur(10px);
  }
  .emoji-picker-hover-preview .emoji-picker-hover-label{
    color: var(--emoji-preview-text);
  }
}

/* Light theme (explicit) */
@media (prefers-color-scheme: light) {
  :root {
    --emoji-preview-bg: #ffffff;
    --emoji-preview-text: #222;
    --emoji-preview-border: rgba(0,0,0,0.08);
  }
}
`
  const style = document.createElement('style')
  style.id = 'emoji-picker-styles'
  style.textContent = css
  document.head.appendChild(style)
}
