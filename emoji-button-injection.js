export function injectEmojiButton(nachoCustomPicker) {
    // 4. Inject the main toolbar button
    setInterval(() => {
        const toolbar = document.querySelector('.d-editor-button-bar[role="toolbar"]');
        if (toolbar && !toolbar.querySelector('.nacho-toolbar-btn')) {
            const emojiButton = document.createElement('button');
            emojiButton.className = 'btn no-text btn-icon toolbar__button nacho-toolbar-btn';
            emojiButton.title = "Nachoneko表情包";
            emojiButton.type = "button";
            emojiButton.innerHTML = `🐈‍⬛`;
            toolbar.appendChild(emojiButton);
        }
    }, 500);

    // 5. Toolbar button click handler (toggles independent picker)
    document.addEventListener('click', (e) => {
        const toolbarButton = e.target.closest('.nacho-toolbar-btn');
        if (toolbarButton) {
            e.stopPropagation(); // Prevent event from bubbling up
            e.preventDefault(); // Prevent default button action

            console.log('[Nachoneko] Toolbar button clicked. Toggling independent picker.');

            nachoCustomPicker.classList.toggle('show-picker');

            if (nachoCustomPicker.classList.contains('show-picker')) {

                // Activate Nacho section by default when opening
                const nachoSectionButton = nachoCustomPicker.querySelector('.nacho-section-btn');
                const nachoSectionContainer = nachoCustomPicker.querySelector('.nacho-section-container');

                const allSections = nachoCustomPicker.querySelectorAll('.emoji-picker__section');
                const allNavButtons = nachoCustomPicker.querySelectorAll('.emoji-picker__section-btn');

                allSections.forEach(s => s.style.display = 'none');
                nachoSectionContainer.style.display = 'block';
                allNavButtons.forEach(b => b.classList.remove('active'));
                nachoSectionButton.classList.add('active');
            }
        }
    });
}
