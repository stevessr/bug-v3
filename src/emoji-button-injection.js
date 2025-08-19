export function injectEmojiButton(nachoCustomPicker) {
    // 4. Robust injection: observe DOM for the toolbar and inject once when available.
    //    If this frame is sandboxed without allow-scripts we cannot inject here.
    try {
        const frameElem = window.frameElement;
        if (frameElem && frameElem.sandbox) {
            const sandboxAttr = frameElem.getAttribute('sandbox') || '';
            if (!sandboxAttr.includes('allow-scripts')) {
                console.warn('[Nachoneko] Current frame is sandboxed without allow-scripts — skipping injection in this frame.');
                return;
            }
        }
    } catch (e) {
        // Accessing frameElement may throw in some contexts — just continue and attempt injection.
        console.warn('[Nachoneko] Could not read frameElement/sandbox:', e);
    }

    let injected = false;
    const injectOnce = (toolbar) => {
        if (!toolbar || injected) return;
        if (toolbar.querySelector('.nacho-toolbar-btn')) {
            injected = true;
            return;
        }
        const emojiButton = document.createElement('button');
        emojiButton.className = 'btn no-text btn-icon toolbar__button nacho-toolbar-btn';
        emojiButton.title = "智慧的表情包";
        emojiButton.type = "button";
        emojiButton.innerHTML = `🐈‍⬛`;
        toolbar.appendChild(emojiButton);
        injected = true;
        console.info('[Nachoneko] Injected toolbar button.');
    };

    // Try immediate injection in case toolbar already exists
    const existing = document.querySelector('.d-editor-button-bar[role="toolbar"]');
    if (existing) injectOnce(existing);

    // Observe DOM changes to inject when toolbar appears
    const observer = new MutationObserver((mutations) => {
        if (injected) return;
        for (const m of mutations) {
            if (m.addedNodes && m.addedNodes.length) {
                const toolbar = document.querySelector('.d-editor-button-bar[role="toolbar"]');
                if (toolbar) {
                    injectOnce(toolbar);
                    if (injected) {
                        observer.disconnect();
                        break;
                    }
                }
            }
        }
    });

    observer.observe(document.documentElement || document.body, { childList: true, subtree: true });

    // 5. Toolbar button click handler (toggles independent picker)
    document.addEventListener('click', (e) => {
        const toolbarButton = e.target.closest('.nacho-toolbar-btn');
        if (toolbarButton) {
            e.stopPropagation(); // Prevent event from bubbling up
            e.preventDefault(); // Prevent default button action

            console.log('[Nachoneko] Toolbar button clicked. Toggling independent picker.');
            if (!nachoCustomPicker) {
                console.warn('[Nachoneko] nachoCustomPicker is not available; skipping toggle.');
                return;
            }

            try {
                nachoCustomPicker.classList.toggle('show-picker');

                if (nachoCustomPicker.classList.contains('show-picker')) {
                    // Activate Nacho section by default when opening
                    const nachoSectionButton = nachoCustomPicker.querySelector('.nacho-section-btn');
                    const nachoSectionContainer = nachoCustomPicker.querySelector('.nacho-section-container');

                    const allSections = nachoCustomPicker.querySelectorAll('.emoji-picker__section');
                    const allNavButtons = nachoCustomPicker.querySelectorAll('.emoji-picker__section-btn');

                    // hide sections safely
                    if (allSections && allSections.length) {
                        allSections.forEach(s => {
                            if (s && s.style) s.style.display = 'none';
                        });
                    }

                    if (nachoSectionContainer && nachoSectionContainer.style) {
                        nachoSectionContainer.style.display = 'block';
                    } else {
                        console.warn('[Nachoneko] nachoSectionContainer not found');
                    }

                    if (allNavButtons && allNavButtons.length) {
                        allNavButtons.forEach(b => b.classList && b.classList.remove('active'));
                    }

                    if (nachoSectionButton && nachoSectionButton.classList) {
                        nachoSectionButton.classList.add('active');
                    } else {
                        console.warn('[Nachoneko] nachoSectionButton not found');
                    }
                }
            } catch (err) {
                console.error('[Nachoneko] Error toggling picker or updating sections:', err);
            }
        }
    });
}
