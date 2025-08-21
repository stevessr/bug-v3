// Load CSS styles following simple.html structure
function addSimpleHTMLStyles() {
  return;
  const style = document.createElement('style');
  style.textContent = `
    .fk-d-menu.-animated.-expanded {
      position: fixed !important;
      background: white !important;
      border-radius: 8px !important;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15) !important;
      max-width: 400px !important;
      width: 90vw !important;
      z-index: 999999 !important;
      overflow: hidden !important;
    }
    
    .fk-d-menu__inner-content {
      background: white !important;
    }
  `;
  document.head.appendChild(style);
}