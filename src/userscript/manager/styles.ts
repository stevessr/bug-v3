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
      background: rgba(0, 0, 0, 0.5);
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
      background: var(--primary-low);
    }
    
    /* Mobile-specific styles */
    @media (max-width: 768px) {
      .emoji-manager-panel {
        width: 100%;
        height: 100%;
        border-radius: 0;
        grid-template-columns: 1fr;
        grid-template-rows: auto 1fr auto;
      }
    }
    
    /* Left panel - groups list */
    .emoji-manager-left { 
      background: var(--primary-very-low); 
      border-right: 1px solid #e9ecef; 
      display: flex; 
      flex-direction: column; 
      overflow: hidden; 
    }
    
    .emoji-manager-left-header { 
      display: flex; 
      align-items: center; 
      justify-content: space-between;
      padding: 16px; 
      background: var(--primary-low); 
    }
    
    .emoji-manager-left-header h3 {
      margin: 0;
      font-size: 18px;
      flex: 1;
    }
    
    /* Mobile: Left panel becomes a tab bar or collapsible section */
    @media (max-width: 768px) {
      .emoji-manager-left {
        border-right: none;
        border-bottom: 1px solid #e9ecef;
        max-height: 60vh;
        overflow-y: auto;
      }
      
      .emoji-manager-left-header {
        padding: 12px 16px;
        position: sticky;
        top: 0;
        z-index: 10;
      }
      
      .emoji-manager-left-header h3 {
        font-size: 16px;
      }
    }
    
    .emoji-manager-addgroup-row { 
      display: flex; 
      gap: 8px;
      padding: 12px; 
    }
    
    .emoji-manager-addgroup-row input {
      flex: 1;
      min-width: 0;
    }
    
    /* Mobile: Larger touch targets for add group */
    @media (max-width: 768px) {
      .emoji-manager-addgroup-row {
        padding: 12px 16px;
      }
      
      .emoji-manager-addgroup-row input,
      .emoji-manager-addgroup-row button {
        font-size: 16px;
        padding: 12px;
      }
    }
    
    .emoji-manager-groups-list { 
      background: var(--primary-very-low);
      flex: 1; 
      overflow-y: auto; 
      padding: 8px; 
    }
    
    .emoji-manager-groups-list > div { 
      margin-bottom: 4px; 
      padding: 12px;
      border-radius: 6px;
      cursor: pointer;
      transition: background-color 0.2s; 
    }
    
    .emoji-manager-groups-list > div:hover { 
      background: var(--d-selected); 
    }
    
    .emoji-manager-groups-list > div:focus { 
      outline: none; 
      box-shadow: inset 0 0 0 2px #007bff; 
      background: var(--d-selected); 
    }
    
    /* Mobile: Larger touch targets for group items */
    @media (max-width: 768px) {
      .emoji-manager-groups-list {
        padding: 8px 16px;
      }
      
      .emoji-manager-groups-list > div {
        padding: 16px 12px;
        margin-bottom: 8px;
        font-size: 15px;
      }
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
      background: var(--primary-very-low);
      border-bottom: 1px solid #e9ecef;
    }
    
    .emoji-manager-right-header h4 {
      margin: 0;
      font-size: 16px;
      flex: 1;
    }
    
    /* Mobile: Sticky header and larger buttons */
    @media (max-width: 768px) {
      .emoji-manager-right-header {
        padding: 12px 16px;
        position: sticky;
        top: 0;
        z-index: 10;
      }
      
      .emoji-manager-right-header h4 {
        font-size: 15px;
      }
      
      .emoji-manager-right-header button {
        padding: 10px 16px;
        font-size: 14px;
      }
    }
    
    .emoji-manager-right-main { 
      flex: 1; 
      overflow-y: auto; 
      padding: 16px;
    }
    
    .emoji-manager-emojis { 
      display: grid; 
      grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); 
      gap: 12px; 
      padding: 0;
    }
    
    /* Mobile: Optimize grid for smaller screens */
    @media (max-width: 768px) {
      .emoji-manager-right-main {
        padding: 12px;
      }
      
      .emoji-manager-emojis {
        grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
        gap: 10px;
      }
    }
    
    @media (max-width: 480px) {
      .emoji-manager-emojis {
        grid-template-columns: repeat(auto-fill, minmax(90px, 1fr));
        gap: 8px;
      }
    }
    
    .emoji-manager-card { 
      display: flex; 
      flex-direction: column; 
      align-items: center; 
      padding: 12px; 
      background: var(--primary-medium); 
      border-radius: 8px;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    
    .emoji-manager-card:hover { 
      transform: translateY(-2px); 
      box-shadow: 0 4px 12px rgba(0,0,0,0.1); 
    }
    
    /* Mobile: Better touch targets and spacing */
    @media (max-width: 768px) {
      .emoji-manager-card {
        padding: 10px;
        border-radius: 6px;
      }
      
      /* Disable hover effects on mobile */
      .emoji-manager-card:hover {
        transform: none;
        box-shadow: none;
      }
      
      /* Add active state for touch feedback */
      .emoji-manager-card:active {
        transform: scale(0.98);
        box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      }
    }
    
    .emoji-manager-card-img { 
      max-width: 90%;
      max-height: 80px;
      object-fit: contain; 
      border-radius: 6px; 
      background: white; 
      margin-bottom: 8px;
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
      margin-bottom: 8px;
    }
    
    .emoji-manager-card-actions { 
      display: flex; 
      gap: 6px; 
      width: 100%;
      justify-content: center;
    }
    
    /* Mobile: Larger buttons for touch */
    @media (max-width: 768px) {
      .emoji-manager-card-img {
        max-height: 70px;
        margin-bottom: 6px;
      }
      
      .emoji-manager-card-name {
        font-size: 11px;
        margin-bottom: 6px;
      }
      
      .emoji-manager-card-actions {
        gap: 8px;
      }
      
      .emoji-manager-card-actions button {
        padding: 8px 12px !important;
        font-size: 13px !important;
        min-height: 36px;
        flex: 1;
      }
    }
    
    /* Add emoji form */
    .emoji-manager-add-emoji-form { 
      padding: 16px; 
      background: var(--primary-very-low); 
      border-top: 1px solid #e9ecef; 
      display: flex; 
      flex-wrap: wrap;
      gap: 8px; 
      align-items: center; 
    }
    
    .emoji-manager-add-emoji-form input {
      flex: 1;
      min-width: 150px;
    }
    
    .emoji-manager-add-emoji-form button {
      white-space: nowrap;
    }
    
    /* Mobile: Stack inputs vertically */
    @media (max-width: 768px) {
      .emoji-manager-add-emoji-form {
        padding: 12px 16px;
        flex-direction: column;
        align-items: stretch;
      }
      
      .emoji-manager-add-emoji-form input {
        width: 100%;
        min-width: 0;
        font-size: 16px;
        padding: 12px;
      }
      
      .emoji-manager-add-emoji-form button {
        width: 100%;
        padding: 12px;
        font-size: 15px;
        min-height: 44px;
      }
    }
    
    /* Footer */
    .emoji-manager-footer { 
      grid-column: 1 / -1;
      display: flex; 
      flex-wrap: wrap;
      justify-content: space-between; 
      gap: 12px;
      padding: 16px; 
      background: var(--primary-very-low); 
      border-top: 1px solid #e9ecef;
    }
    
    .emoji-manager-footer button {
      flex: 0 1 auto;
    }
    
    /* Mobile: Stack footer buttons */
    @media (max-width: 768px) {
      .emoji-manager-footer {
        padding: 12px 16px;
        flex-direction: column;
      }
      
      .emoji-manager-footer button {
        width: 100%;
        padding: 12px;
        font-size: 15px;
        min-height: 44px;
      }
    }
    
    /* Editor panel - popup modal */
    .emoji-manager-editor-panel { 
      position: fixed; 
      top: 50%; 
      left: 50%; 
      transform: translate(-50%, -50%); 
      background: var(--primary-medium); 
      padding: 24px; 
      border-radius: 8px;
      z-index: 1000000; 
      max-width: 90%;
      max-height: 90vh;
      overflow-y: auto;
      box-shadow: 0 10px 40px rgba(0,0,0,0.3);
    }
    
    .emoji-manager-editor-panel input,
    .emoji-manager-editor-panel button {
      margin: 8px 0;
    }
    
    .emoji-manager-editor-preview { 
      max-width: 100%;
      max-height: 40vh;
      object-fit: contain;
      display: block;
      margin: 12px auto;
      border-radius: 6px;
      background: white;
    }
    
    /* Mobile: Full-width editor on small screens */
    @media (max-width: 768px) {
      .emoji-manager-editor-panel {
        width: calc(100% - 32px);
        max-width: none;
        padding: 20px;
        border-radius: 12px;
      }
      
      .emoji-manager-editor-panel input {
        font-size: 16px;
        padding: 12px;
        margin: 6px 0;
      }
      
      .emoji-manager-editor-panel button {
        padding: 12px;
        font-size: 15px;
        min-height: 44px;
      }
      
      .emoji-manager-editor-preview {
        max-height: 30vh;
      }
    }
    
    @media (max-width: 480px) {
      .emoji-manager-editor-panel {
        width: calc(100% - 16px);
        padding: 16px;
        max-height: 95vh;
      }
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
    
    /* Mobile: Disable hover preview */
    @media (max-width: 768px) {
      .emoji-manager-hover-preview {
        display: none !important;
      }
    }
    
    /* Form styling */
    .form-control { 
      width: 100%; 
      padding: 8px 12px;
      border: 1px solid #dee2e6;
      border-radius: 4px;
      font-size: 14px;
      line-height: 1.5;
      background: var(--primary-very-low);
      color: var(--primary);
    }
    
    .form-control:focus {
      outline: none;
      border-color: #007bff;
      box-shadow: 0 0 0 2px rgba(0,123,255,0.25);
    }
    
    .btn { 
      padding: 8px 16px; 
      border: 1px solid transparent; 
      border-radius: 4px; 
      font-size: 14px; 
      font-weight: 500;
      cursor: pointer; 
      transition: all 0.2s; 
      background: var(--primary-medium);
      color: var(--primary);
    }
    
    .btn:hover {
      transform: translateY(-1px);
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    
    .btn:active {
      transform: translateY(0);
    }
    
    .btn-primary {
      background: #007bff;
      color: #fff;
    }
    
    .btn-primary:hover {
      background: #0056b3;
    }
    
    .btn-sm { 
      padding: 6px 12px; 
      font-size: 13px; 
    }
    
    /* Mobile: Larger touch targets for buttons */
    @media (max-width: 768px) {
      .form-control {
        font-size: 16px;
        padding: 10px 12px;
      }
      
      .btn {
        min-height: 44px;
        padding: 10px 16px;
        font-size: 15px;
      }
      
      .btn:hover {
        transform: none;
      }
      
      .btn:active {
        transform: scale(0.98);
      }
      
      .btn-sm {
        padding: 8px 12px;
        font-size: 14px;
        min-height: 36px;
      }
    }
  `
  ensureStyleInjected('emoji-manager-styles', css)
}
