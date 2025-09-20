import { ensureStyleInjected } from '../utils/injectStyles'

let __managerStylesInjected = false
export function injectManagerStyles() {
  if (__managerStylesInjected) return
  __managerStylesInjected = true
  const css = `
    /* Modal backdrop */
    .emoji-manager-wrapper { 
      position: fixed; 
      top: 0; 
      left: 0; 
      right: 0; 
      bottom: 0; 
      z-index: 999999; 
      display: flex; 
      align-items: center; 
      justify-content: center; 
    }
    
    /* Main modal panel */
    .emoji-manager-panel { 
      border-radius: 8px; 
      width: 90%; 
      height: 95%; 
      display: grid; 
      grid-template-columns: 300px 1fr; 
      grid-template-rows: 1fr auto;
      overflow: hidden; 
      box-shadow: 0 10px 40px rgba(0,0,0,0.3); 
    }
    
    /* Left panel - groups list */
    .emoji-manager-left { 
      background: var(--primary-very-low) 
      border-right: 1px solid #e9ecef; 
      display: flex; 
      flex-direction: column; 
      overflow: hidden; 
    }
    
    .emoji-manager-left-header { 
      display: flex; 
      align-items: center; 
      padding: 16px; 
      background: var(--primary-low); 
    }
    
    .emoji-manager-addgroup-row { 
      display: flex; 
      padding: 12px; 
    }
    
    .emoji-manager-groups-list { 
      background: var(--primary-very-low);
      flex: 1; 
      overflow-y: auto; 
      padding: 8px; 
    }
    
    .emoji-manager-groups-list > div { 
      margin-bottom: 4px; 
      transition: background-color 0.2s; 
    }
    
    .emoji-manager-groups-list > div:hover { 
      background: var(--primary); 
    }
    
    .emoji-manager-groups-list > div:focus { 
      outline: none; 
      box-shadow: inset 0 0 0 2px #007bff; 
      background: var(--primary); 
    }
    
    /* Right panel - emoji display and editing */
    .emoji-manager-right { 
      background: var(--primary-low); 
      display: flex; 
      flex-direction: column; 
      overflow: hidden; 
    }
    
    .emoji-manager-right-header { 
      display: flex; 
      align-items: center; 
      justify-content: space-between; 
      padding: 16px; 
    }
    
    .emoji-manager-right-main { 
      flex: 1; 
      overflow-y: auto; 
    }
    
    .emoji-manager-emojis { 
      display: grid; 
      grid-template-columns: repeat(auto-fill, minmax(25%, 1fr)); 
      gap: 12px; 
    }
    
    .emoji-manager-card { 
      display: flex; 
      flex-direction: column; 
      align-items: center; 
      padding: 12px; 
      background: var(--primary-medium); 
    }
    
    .emoji-manager-card:hover { 
      transform: translateY(-2px); 
      box-shadow: 0 4px 12px rgba(0,0,0,0.1); 
    }
    
    .emoji-manager-card-img { 
      max-width: 90%;
      max-height: 100%; /* allow tall images but cap at viewport height */
      object-fit: contain; 
      border-radius: 6px; 
      background: white; 
    }
    
    .emoji-manager-card-name { 
      font-size: 12px; 
      color: var(--primary); 
      text-align: center; 
      width: 100%; 
      overflow: hidden; 
      white-space: nowrap; 
      text-overflow: ellipsis; 
      font-weight: 500; 
    }
    
    .emoji-manager-card-actions { 
      display: flex; 
      gap: 6px; 
    }
    
    /* Add emoji form */
    .emoji-manager-add-emoji-form { 
      padding: 16px; 
      background: var(--primary-very-low) 
      border-top: 1px solid #e9ecef; 
      display: flex; 
      gap: 8px; 
      align-items: center; 
    }
    
    /* Footer */
    .emoji-manager-footer { 
      grid-column: 1 / -1;
      display: flex; 
      justify-content: space-between; 
      padding: 16px; 
      background: var(--primary-very-low); 
    }
    
    /* Editor panel - popup modal */
    .emoji-manager-editor-panel { 
      position: fixed; 
      top: 50%; 
      left: 50%; 
      transform: translate(-50%, -50%); 
      background: var( --primary-medium ); 
      padding: 2%; 
      z-index: 1000000; 
    }
    
    .emoji-manager-editor-preview { 
      max-width: 100%;
      max-height: 40vh;
    }

    /* Hover preview (moved from inline styles) */
    .emoji-manager-hover-preview {
      position: fixed;
      pointer-events: none;
      z-index: 1000002;
      display: none;
      max-width: 60%;
      max-height: 60%;
      border: 1px solid rgba(0,0,0,0.1);
      object-fit: contain;
      background: var(--primary);
      padding: 4px;
      border-radius: 6px;
      box-shadow: 0 6px 18px rgba(0,0,0,0.12);
    }
    
    /* Form styling */
    .form-control { 
      width: 100%; 
      display: flex;
    }
    
    .btn { 
      padding: 8px 16px; 
      border: 1px solid transparent; 
      border-radius: 4px; 
      font-size: 14px; 
      cursor: pointer; 
      transition: all 0.2s; 
    }
    
    .btn-primary { 
      background-color: var(--primary);
      color: white; 
    }
    
    .btn-primary:hover { 
      background-color: var(--primary-high);
    }
    
    .btn-sm { 
      padding: 4px 8px; 
      font-size: 12px; 
    }
  `
  ensureStyleInjected('emoji-manager-styles', css)
}
