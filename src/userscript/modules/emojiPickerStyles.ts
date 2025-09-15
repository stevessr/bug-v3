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
  background:#ffffff;
  padding:8px;
  transition:opacity .12s ease, transform .12s ease;
}
.emoji-picker-hover-preview img.emoji-picker-hover-img{
  display:block;
  max-width:100%;
  max-height:220px;
  object-fit:contain;
}
.emoji-picker-hover-preview .emoji-picker-hover-label{
  font-size:12px;
  color:#222;
  margin-top:8px;
  text-align:center;
  word-break:break-word;
}

/* Dark theme adaptation */
@media (prefers-color-scheme: dark) {
  .emoji-picker-hover-preview{
    background: rgba(32,33,36,0.94);
    box-shadow: 0 6px 20px rgba(0,0,0,0.6);
    border: 1px solid rgba(255,255,255,0.04);
  }
  .emoji-picker-hover-preview .emoji-picker-hover-label{
    color: #e6e6e6;
  }
}
`
  const style = document.createElement('style')
  style.id = 'emoji-picker-styles'
  style.textContent = css
  document.head.appendChild(style)
}
