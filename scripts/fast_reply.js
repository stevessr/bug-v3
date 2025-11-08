// ==UserScript==
// @name         Linux.do 快捷回复 (可自定义)
// @namespace    http://tampermonkey.net/
// @version      0.2
// @description  在 linux.do 帖子列表添加一个快捷回复按钮，允许自定义、添加、删除和保存预设回复。
// @author       Gemini
// @match        https://linux.do/*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @connect      linux.do
// ==/UserScript==

(function() {
    'use strict';

    // 默认的预设回复，如果用户没有设置过，则使用此列表
    const DEFAULT_REPLIES = [
        "我再也吃不下了 :distorted_face:",
        "感谢分享！",
        "学到了，很有用。",
        "这个帖子太棒了！",
        "顶一下！"
    ];

    let currentOpenUI = null; // 用于跟踪当前打开的 UI，确保同时只显示一个

    // 获取已保存的回复列表
    function getReplies() {
        return GM_getValue('presetReplies', DEFAULT_REPLIES);
    }

    // 保存回复列表
    function saveReplies(replies) {
        GM_setValue('presetReplies', replies);
    }

    // 发送回复的函数
    function sendReply(topicId, raw, postContainer) {
        // 显示加载状态
        const originalText = postContainer.textContent;
        postContainer.textContent = '发送中...';
        postContainer.style.pointerEvents = 'none';

        const csrfToken = document.querySelector('meta[name="csrf-token"]').content;
        const data = new URLSearchParams();
        data.append('raw', raw);
        data.append('unlist_topic', 'false');
        data.append('topic_id', topicId);
        data.append('is_warning', 'false');
        data.append('whisper', 'false');
        data.append('archetype', 'regular');
        data.append('typing_duration_msecs', '1900');
        data.append('composer_open_duration_msecs', '14710');
        data.append('draft_key', `topic_${topicId}`);
        data.append('nested_post', 'true');

        GM_xmlhttpRequest({
            method: 'POST',
            url: 'https://linux.do/posts',
            headers: {
                'accept': 'application/json, text/javascript, */*; q=0.01',
                'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'x-csrf-token': csrfToken,
                'x-requested-with': 'XMLHttpRequest'
            },
            data: data.toString(),
            onload: function(response) {
                if (response.status === 200) {
                    postContainer.textContent = '发送成功！';
                    setTimeout(() => {
                        if (currentOpenUI) currentOpenUI.style.display = 'none';
                    }, 800);
                } else {
                    alert('回复失败，请按 F12 查看控制台获取更多信息。');
                    postContainer.textContent = originalText; // 恢复原状
                    console.error('回复失败：', response);
                }
            },
            onerror: function(response) {
                alert('网络错误，请按 F12 查看控制台获取更多信息。');
                postContainer.textContent = originalText; // 恢复原状
                console.error('回复出错：', response);
            },
            ontimeout: function(response) {
                alert('请求超时，请检查您的网络连接。');
                postContainer.textContent = originalText; // 恢复原状
                console.error('请求超时：', response);
            }
        });
    }

    // 创建并管理快捷回复 UI
    function createReplyUI(topicId, button) {
        const uiContainer = document.createElement('div');
        uiContainer.className = 'quick-reply-ui';
        // --- 样式 ---
        Object.assign(uiContainer.style, {
            position: 'absolute',
            backgroundColor: '#fff',
            border: '1px solid #ddd',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            padding: '12px',
            zIndex: '1001',
            display: 'none',
            width: '250px',
            marginTop: '5px',
        });

        const presetListDiv = document.createElement('div');
        presetListDiv.style.maxHeight = '150px';
        presetListDiv.style.overflowY = 'auto';

        const populatePresets = () => {
            presetListDiv.innerHTML = ''; // 清空列表
            const replies = getReplies();
            replies.forEach((replyText, index) => {
                const presetItem = document.createElement('div');
                Object.assign(presetItem.style, {
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px',
                    cursor: 'pointer',
                    borderRadius: '4px',
                    borderBottom: '1px solid #eee'
                });
                presetItem.onmouseover = () => presetItem.style.backgroundColor = '#f0f0f0';
                presetItem.onmouseout = () => presetItem.style.backgroundColor = 'transparent';

                const textSpan = document.createElement('span');
                textSpan.textContent = replyText;
                textSpan.style.flexGrow = '1';
                textSpan.onclick = () => sendReply(topicId, replyText, presetItem);

                const deleteBtn = document.createElement('span');
                deleteBtn.textContent = '×';
                deleteBtn.title = '删除此条预设';
                Object.assign(deleteBtn.style, {
                    color: 'red',
                    fontWeight: 'bold',
                    marginLeft: '10px',
                    padding: '0 5px',
                });
                deleteBtn.onclick = (e) => {
                    e.stopPropagation();
                    if (confirm(`确定要删除预设回复 "${replyText}" 吗？`)) {
                        const currentReplies = getReplies();
                        currentReplies.splice(index, 1);
                        saveReplies(currentReplies);
                        populatePresets(); // 重新渲染列表
                    }
                };
                presetItem.appendChild(textSpan);
                presetItem.appendChild(deleteBtn);
                presetListDiv.appendChild(presetItem);
            });
        };

        // --- 自定义输入部分 ---
        const customInput = document.createElement('input');
        customInput.type = 'text';
        customInput.placeholder = '输入自定义回复...';
        Object.assign(customInput.style, {
            width: 'calc(100% - 10px)',
            padding: '5px',
            marginTop: '10px',
            border: '1px solid #ccc',
            borderRadius: '4px'
        });

        const buttonContainer = document.createElement('div');
        Object.assign(buttonContainer.style, {
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: '8px'
        });

        const sendCustomBtn = document.createElement('button');
        sendCustomBtn.textContent = '发送';
        sendCustomBtn.onclick = () => {
            if (customInput.value.trim()) {
                sendReply(topicId, customInput.value, sendCustomBtn);
                customInput.value = '';
            }
        };

        const addPresetBtn = document.createElement('button');
        addPresetBtn.textContent = '添加到预设';
        addPresetBtn.onclick = () => {
            const newReply = customInput.value.trim();
            if (newReply) {
                const replies = getReplies();
                if (!replies.includes(newReply)) {
                    replies.push(newReply);
                    saveReplies(replies);
                    populatePresets();
                    customInput.value = '';
                } else {
                    alert('该回复已存在！');
                }
            }
        };

        [sendCustomBtn, addPresetBtn].forEach(btn => Object.assign(btn.style, {
            padding: '5px 10px',
            border: '1px solid #ccc',
            borderRadius: '5px',
            cursor: 'pointer',
            backgroundColor: '#f7f7f7'
        }));


        buttonContainer.appendChild(addPresetBtn);
        buttonContainer.appendChild(sendCustomBtn);
        uiContainer.appendChild(presetListDiv);
        uiContainer.appendChild(customInput);
        uiContainer.appendChild(buttonContainer);

        // 绑定一个函数，用于在 UI 显示时刷新内容
        uiContainer.refresh = populatePresets;

        return uiContainer;
    }

    // 将按钮注入到页面
    function addReplyButtons() {
        document.querySelectorAll('tr[data-topic-id]').forEach(item => {
            if (item.querySelector('.quick-reply-button-container')) return; // 防止重复添加

            const topicId = item.getAttribute('data-topic-id');
            const mainLinkCell = item.querySelector('td.main-link');

            if (mainLinkCell) {
                const container = document.createElement('span');
                container.className = 'quick-reply-button-container';
                container.style.position = 'relative'; // 为绝对定位的 UI 提供参照

                const button = document.createElement('button');
                button.textContent = '快捷回复';
                button.className = 'quick-reply-toggle-button';
                Object.assign(button.style, {
                    marginLeft: '10px',
                    padding: '2px 8px',
                    border: '1px solid #ccc',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    verticalAlign: 'middle'
                });

                const replyUI = createReplyUI(topicId, button);
                container.appendChild(button);
                container.appendChild(replyUI);

                button.onclick = (e) => {
                    e.stopPropagation();
                    if (currentOpenUI && currentOpenUI !== replyUI) {
                        currentOpenUI.style.display = 'none';
                    }
                    const isVisible = replyUI.style.display === 'block';
                    replyUI.style.display = isVisible ? 'none' : 'block';
                    if (!isVisible) {
                        replyUI.refresh(); // 显示时刷新预设列表
                        currentOpenUI = replyUI;
                    } else {
                        currentOpenUI = null;
                    }
                };

                const linkBottomLine = mainLinkCell.querySelector('.link-bottom-line');
                if (linkBottomLine) {
                    linkBottomLine.style.display = 'flex';
                    linkBottomLine.style.alignItems = 'center';
                    linkBottomLine.appendChild(container);
                } else {
                    mainLinkCell.appendChild(container);
                }
            }
        });
    }

    // 点击页面其他地方关闭 UI
    document.addEventListener('click', (e) => {
        if (currentOpenUI && !currentOpenUI.contains(e.target) && !e.target.classList.contains('quick-reply-toggle-button')) {
            currentOpenUI.style.display = 'none';
            currentOpenUI = null;
        }
    });

    // 使用 MutationObserver 监视页面动态加载的内容
    const observer = new MutationObserver(addReplyButtons);
    observer.observe(document.body, { childList: true, subtree: true });

    addReplyButtons(); // 首次加载时运行
})();