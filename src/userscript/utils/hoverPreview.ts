// Shared hover preview singleton used by userscript modules
import { createEl } from './createEl'

let _sharedPreview: HTMLElement | null = null

export function ensureHoverPreview(): HTMLElement {
  if (_sharedPreview && document.body.contains(_sharedPreview)) return _sharedPreview
  _sharedPreview = createEl('div', {
    className: 'emoji-picker-hover-preview',
    style:
      'position:fixed;pointer-events:none;display:none;z-index:1000002;max-width:300px;max-height:300px;overflow:hidden;border-radius:6px;box-shadow:0 4px 12px rgba(0,0,0,0.25);background:transparent;padding:6px;'
  }) as HTMLElement

  const img = createEl('img', {
    className: 'emoji-picker-hover-img',
    style: 'display:block;max-width:100%;max-height:220px;object-fit:contain;'
  }) as HTMLImageElement

  const label = createEl('div', {
    className: 'emoji-picker-hover-label',
    style: 'font-size:12px;color:var(--primary);margin-top:6px;text-align:center;'
  }) as HTMLDivElement

  _sharedPreview.appendChild(img)
  _sharedPreview.appendChild(label)
  document.body.appendChild(_sharedPreview)
  return _sharedPreview
}
