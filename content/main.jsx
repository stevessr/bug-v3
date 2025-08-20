import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './src/App';

function insertTextAtCursor(text) {
  const activeElement = document.activeElement;
  if (activeElement.tagName === 'TEXTAREA' || activeElement.tagName === 'INPUT') {
    const start = activeElement.selectionStart;
    const end = activeElement.selectionEnd;
    const value = activeElement.value;
    activeElement.value = value.substring(0, start) + text + value.substring(end);
    activeElement.selectionStart = activeElement.selectionEnd = start + text.length;
  }
}

function init() {
  const composerButton = document.querySelector('.d-editor-button-bar');
  if (composerButton) {
    const emojiButtonContainer = document.createElement('div');
    emojiButtonContainer.className = 'emoji-button-container';
    composerButton.appendChild(emojiButtonContainer);

    const root = ReactDOM.createRoot(emojiButtonContainer);
    let menuVisible = false;

    const EmojiButton = () => {
      const [showMenu, setShowMenu] = React.useState(false);

      const handleEmojiSelect = (markdown) => {
        insertTextAtCursor(markdown);
        setShowMenu(false);
        menuVisible = false;
      };

      const toggleMenu = () => {
        setShowMenu(!showMenu);
        menuVisible = !menuVisible;
      };

      return (
        <div style={{ position: 'relative' }}>
          <button onClick={toggleMenu} className="btn btn-default">😀</button>
          {showMenu && (
            <div style={{ position: 'absolute', bottom: '100%', left: 0, zIndex: 100 }}>
              <App onEmojiSelect={handleEmojiSelect} />
            </div>
          )}
        </div>
      );
    };

    root.render(<EmojiButton />);

    document.addEventListener('click', (event) => {
      if (menuVisible && !emojiButtonContainer.contains(event.target)) {
        root.render(<EmojiButton />);
        menuVisible = false;
      }
    });
  }
}

// Observe DOM changes to detect when the composer is opened
const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    if (mutation.addedNodes.length > 0) {
      const composer = document.querySelector('.d-editor-button-bar');
      if (composer && !composer.querySelector('.emoji-button-container')) {
        init();
        break;
      }
    }
  }
});

observer.observe(document.body, { childList: true, subtree: true });

// Initial check
init();
