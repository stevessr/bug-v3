console.log('Content script loaded.');

function injectEmojiPicker() {
  // Create a button to trigger the emoji picker
  const emojiButton = document.createElement('button');
  emojiButton.innerHTML = '😀';
  emojiButton.style.position = 'fixed';
  emojiButton.style.bottom = '10px';
  emojiButton.style.right = '10px';
  emojiButton.style.zIndex = '9999';
  document.body.appendChild(emojiButton);

  emojiButton.addEventListener('click', () => {
    // For now, just log a message
    console.log('Emoji button clicked!');
  });
}

injectEmojiPicker();
