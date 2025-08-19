export function handleInsert(emoji) {
    const { alt, src } = emoji;
    const match = src.match(/_(\d{3,})x(\d{3,})\.|original\/4X\/\w\/\w\/\w\/\w+\.png/);
    let width = emoji.width || '500';
    let height = emoji.height || '500';
    if (match && !emoji.width) {
        const size = src.match(/_(\d{3,})x(\d{3,})\./);
        if(size){
            width = size[1];
            height = size[2];
        }
    }

    const textArea = document.querySelector('textarea.d-editor-input');
    const richEle = document.querySelector('.ProseMirror.d-editor-input');

    if (!textArea && !richEle) { 
        console.log('[Nachoneko] No textarea or rich editor found.');
        return; 
    }

    if (textArea) {
        console.log('[Nachoneko] Textarea found.', textArea);
        const emojiMarkdown = `![${alt}|${width}x${height},30%](${src}) `;
        console.log('[Nachoneko] Emoji Markdown:', emojiMarkdown);
        const startPos = textArea.selectionStart;
        const endPos = textArea.selectionEnd;
        console.log('[Nachoneko] Selection Start/End:', startPos, endPos);
                        textArea.value = textArea.value.substring(0, startPos) + emojiMarkdown + textArea.value.substring(endPos);
        console.log('[Nachoneko] Textarea value after modification:', textArea.value);
        textArea.selectionStart = textArea.selectionEnd = startPos + emojiMarkdown.length;
        textArea.focus();
        const inputEvent = new Event('input', { bubbles: true, cancelable: true });
        textArea.dispatchEvent(inputEvent);
        const changeEvent = new Event('change', { bubbles: true, cancelable: true });
        textArea.dispatchEvent(changeEvent);
        console.log('[Nachoneko] Input and Change events dispatched.');
    } else if (richEle) {
        console.log('[Nachoneko] Rich editor found.', richEle);
        const imgTemplate = `<img src="${src}" alt="${alt}" width="${width}" height="${height}" data-scale="30" style="width: ${Math.round(width * 0.3)}px">`;
        console.log('[Nachoneko] Rich editor imgTemplate:', imgTemplate);
        try {
            const dt = new DataTransfer();
            dt.setData("text/html", imgTemplate);
            const evt = new ClipboardEvent("paste", { clipboardData: dt, bubbles: true });
            richEle.dispatchEvent(evt);
            console.log('[Nachoneko] Rich editor paste event dispatched.');
        } catch (_) {
            document.execCommand("insertHTML", false, imgTemplate);
            console.log('[Nachoneko] Rich editor document.execCommand used.');
        }
    }
    // Close the picker by clicking the active button again
    const activeEmojiButton = document.querySelector('.d-editor-button-bar .active .emoji-picker-btn');
    if (activeEmojiButton) activeEmojiButton.click();
}

