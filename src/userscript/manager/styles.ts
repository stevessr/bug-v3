let __managerStylesInjected = false
export function injectManagerStyles() {
  if (__managerStylesInjected) return
  __managerStylesInjected = true
  const css = `
    .emoji-manager-wrapper { display:flex; flex-direction:column; height:100%; width:100%; overflow:hidden; }
    /* Fullscreen modal: panel fills the viewport */
    .emoji-manager-panel { position: fixed; top: 0; left: 0; right: 0; bottom: 0; display:grid; grid-template-columns: 300px 1fr; gap:12px; align-items:start; padding:12px; box-sizing:border-box; background: rgba(0,0,0,0.8); }
    .emoji-manager-left { overflow:auto; padding-right:8px; box-sizing:border-box; background: #fff; border-right:1px solid #eee; }
    .emoji-manager-left .emoji-manager-addgroup-row { display:flex; gap:8px; padding:8px; }
    .emoji-manager-groups-list > div { padding:6px; border-radius:4px; cursor:pointer; display:flex; justify-content:space-between; align-items:center; }
    .emoji-manager-groups-list > div:focus { outline: none; box-shadow: inset 0 0 0 2px #e6f2ff; }
    .emoji-manager-right { display:flex; flex-direction:column; }
    .emoji-manager-right-header { display:flex; align-items:center; gap:8px; padding-bottom:6px; border-bottom:1px solid #eee; }
    .emoji-manager-right-main { flex:1 1 auto; overflow:auto; display:flex; flex-direction:column; gap:8px; box-sizing:border-box; padding-left:8px; }
    .emoji-manager-emojis { display:grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap:8px; align-content:start; padding:6px; box-sizing:border-box; }
    .emoji-manager-card { display:flex; flex-direction:column; gap:6px; align-items:center; padding:8px; background:#fff; border:1px solid #eee; border-radius:8px; }
    .emoji-manager-card-img { width:96px; height:96px; object-fit:contain; border-radius:6px; background:#fafafa; }
    .emoji-manager-card-name { font-size:12px; color:#333; text-align:center; width:100%; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
    .emoji-manager-card-actions { display:flex; gap:6px; }
    .emoji-manager-footer { display:flex; gap:8px; justify-content:flex-end; padding:8px 12px; border-top:1px solid #eee; }
    /* Note: responsive stacking disabled - always two columns */
  `
  const style = document.createElement('style')
  style.setAttribute('data-emoji-manager-styles', '1')
  style.textContent = css
  document.head.appendChild(style)
}
