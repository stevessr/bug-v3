// Styles for emoji picker hover preview and theme-adaptive rules
import { injectGlobalThemeStyles } from '../utils/themeSupport'
import { ensureStyleInjected } from '../utils/injectStyles'

export function injectEmojiPickerStyles(): void {
  if (typeof document === 'undefined') return
  if (document.getElementById('emoji-picker-styles')) return

  // Inject global theme variables first
  injectGlobalThemeStyles()

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
  background:var(--emoji-preview-bg);
  padding:8px;
  transition:opacity .3s ease, transform .12s ease;
  border: 1px solid var(--emoji-preview-border);
  backdrop-filter: blur(10px);
}
.emoji-picker-hover-preview img.emoji-picker-hover-img{
  display:block;
  max-width:100%;
  max-height:220px;
  object-fit:contain;
}
.emoji-picker-hover-preview .emoji-picker-hover-label{
  font-size:12px;
  color:var(--emoji-preview-text);
  margin-top:8px;
  text-align:center;
  word-break:break-word;
  font-weight: 500;
}
`
  ensureStyleInjected('emoji-picker-styles', css)
}
