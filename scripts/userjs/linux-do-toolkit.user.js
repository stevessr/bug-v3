// ==UserScript==
// @name         Linux.do 工具集
// @namespace    https://github.com/stevessr/bug-v3
// @version      1.0.0
// @description  Linux.do 增强工具集：定时发送、全员表情、用户表情助手
// @author       stevessr
// @match        https://linux.do/*
// @match        https://meta.discourse.org/*
// @match        https://*.discourse.org/*
// @match        http://localhost:5173/*
// @match        https://idcflare.com/*
// @exclude      https://linux.do/a/*
// @icon         https://linux.do/uploads/default/original/4X/f/2/2/f228b317d9c333833ccf3a81fee705024a548963.png
// @grant        none
// @license      MIT
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    // ==================== 通用工具函数 ====================
    function createEl(tag, opts) {
        const el = document.createElement(tag)
        if (!opts) return el
        if (opts.className) el.className = opts.className
        if (opts.text) el.textContent = opts.text
        if (opts.innerHTML) el.innerHTML = opts.innerHTML
        if (opts.title) el.title = opts.title
        if (opts.style) el.style.cssText = opts.style
        if (opts.attrs) for (const k in opts.attrs) el.setAttribute(k, opts.attrs[k])
        if (opts.on) {
            for (const [evt, handler] of Object.entries(opts.on)) {
                el.addEventListener(evt, handler)
            }
        }
        return el
    }

    const getCsrfToken = () => {
        const meta = document.querySelector('meta[name="csrf-token"]');
        return meta ? meta.content : '';
    };

    const sleep = (ms) => new Promise(r => setTimeout(r, ms));

    // ==================== 全局样式 ====================
    const GLOBAL_STYLES = `
    /* 定时发送相关 */
    .timer-btn-wrapper {
        margin-left: 8px;
        display: inline-flex;
        align-items: center;
    }
    .timer-container {
        position: fixed; bottom: 20px; right: 20px;
        display: flex; flex-direction: column; gap: 10px;
        z-index: 2147483649; pointer-events: none;
    }
    .timer-item {
        background: rgba(0,0,0,0.85); color: #fff;
        padding: 10px 15px; border-radius: 8px;
        font-size: 13px; pointer-events: auto;
        box-shadow: 0 4px 12px rgba(0,0,0,0.25);
        min-width: 220px; transition: all 0.3s;
        backdrop-filter: blur(4px); border: 1px solid rgba(255,255,255,0.1);
    }
    .timer-item.success { background: rgba(82, 196, 26, 0.95); }
    .timer-item.error { background: rgba(255, 77, 79, 0.95); cursor: pointer; }

    .timer-picker-overlay {
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.5); z-index: 2147483650;
        display: flex; align-items: center; justify-content: center;
    }
    .timer-picker-modal {
        background: var(--d-bg-color, #fff); color: var(--d-primary, #333);
        padding: 20px; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.2);
        width: 320px; font-family: system-ui, -apple-system, sans-serif;
    }
    .timer-picker-tabs { display: flex; border-bottom: 1px solid #ddd; margin-bottom: 15px; }
    .timer-picker-tab { flex: 1; text-align: center; padding: 8px; cursor: pointer; color: #666; }
    .timer-picker-tab.active { color: var(--tertiary, #0088cc); border-bottom: 2px solid var(--tertiary, #0088cc); font-weight: bold; }

    .timer-picker-content { margin-bottom: 15px; }
    .timer-field-group { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
    .timer-input { flex: 1; padding: 6px; border: 1px solid #ddd; border-radius: 4px; }
    .timer-label { width: 60px; font-size: 13px; }

    .timer-actions { display: flex; justify-content: flex-end; gap: 10px; }
    .timer-btn { padding: 6px 16px; border-radius: 4px; cursor: pointer; border: none; font-size: 13px; }
    .timer-btn-cancel { background: #eee; color: #333; }
    .timer-btn-confirm { background: var(--tertiary, #0088cc); color: #fff; }

    /* 全员表情按钮 */
    .ld-all-reaction-btn {
        position: fixed;
        bottom: 100px;
        right: 20px;
        z-index: 9999;
        padding: 10px 15px;
        background-color: #e74c3c;
        color: white;
        border: none;
        border-radius: 5px;
        cursor: pointer;
        font-weight: bold;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        transition: all 0.3s;
    }

    /* 用户表情助手面板 */
    .ld-user-panel {
        position: fixed;
        bottom: 20px;
        left: 20px;
        z-index: 9999;
        padding: 15px;
        background-color: #222;
        color: #fff;
        border: 1px solid #444;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        font-family: Arial, sans-serif;
        width: 300px;
        font-size: 14px;
    }
    .ld-user-panel h3 {
        margin:0 0 10px 0;
        color: #e74c3c;
        border-bottom: 1px solid #555;
        padding-bottom: 5px;
    }
    .ld-user-panel input {
        width: 100%;
        padding: 5px;
        box-sizing: border-box;
        margin-top: 4px;
        border-radius: 4px;
        border: 1px solid #555;
        background: #333;
        color: white;
    }
    .ld-user-panel button {
        padding: 6px;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
    }
    .ld-user-panel .ld-log {
        margin-top: 10px;
        padding: 8px;
        background: #111;
        height: 120px;
        overflow-y: auto;
        border: 1px solid #333;
        font-size: 12px;
        color: #ccc;
        white-space: pre-wrap;
    }
    `
    const styleEl = document.createElement('style')
    styleEl.textContent = GLOBAL_STYLES
    document.head.appendChild(styleEl)

    // ==================== 模块 1: 定时发送功能 ====================
    const ScheduledReply = {
        timerContainer: null,
        timers: new Map(),

        getTimerContainer() {
            if (!this.timerContainer) {
                this.timerContainer = createEl('div', { className: 'timer-container' })
                document.body.appendChild(this.timerContainer)
            }
            return this.timerContainer
        },

        showTimePicker(onConfirm) {
            const overlay = createEl('div', { className: 'timer-picker-overlay' })
            const modal = createEl('div', { className: 'timer-picker-modal' })

            const tabs = createEl('div', { className: 'timer-picker-tabs' })
            const tabCountdown = createEl('div', { className: 'timer-picker-tab active', text: '倒计时' })
            const tabSchedule = createEl('div', { className: 'timer-picker-tab', text: '定时发送' })
            tabs.append(tabCountdown, tabSchedule)

            const content = createEl('div', { className: 'timer-picker-content' })

            const viewCountdown = createEl('div', { className: 'timer-view-countdown' })
            viewCountdown.innerHTML = `
                <div class="timer-field-group">
                    <span class="timer-label">秒后:</span>
                    <input type="number" class="timer-input inp-sec" value="10" min="1">
                </div>
                <div class="timer-field-group">
                    <span class="timer-label">分钟后:</span>
                    <input type="number" class="timer-input inp-min" value="0" min="0">
                </div>
            `

            const viewSchedule = createEl('div', { className: 'timer-view-schedule', style: 'display:none' })
            const now = new Date()
            now.setMinutes(now.getMinutes() + 5)
            const defaultStr = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().slice(0, 16)
            viewSchedule.innerHTML = `
                <div class="timer-field-group">
                    <span class="timer-label">时间:</span>
                    <input type="datetime-local" class="timer-input inp-datetime" value="${defaultStr}">
                </div>
                <div style="font-size:12px;color:#999;margin-top:4px">请选择将来的时间</div>
            `

            content.append(viewCountdown, viewSchedule)

            tabCountdown.onclick = () => {
                tabCountdown.classList.add('active'); tabSchedule.classList.remove('active')
                viewCountdown.style.display = 'block'; viewSchedule.style.display = 'none'
            }
            tabSchedule.onclick = () => {
                tabSchedule.classList.add('active'); tabCountdown.classList.remove('active')
                viewSchedule.style.display = 'block'; viewCountdown.style.display = 'none'
            }

            const actions = createEl('div', { className: 'timer-actions' })
            const btnCancel = createEl('button', { className: 'timer-btn timer-btn-cancel', text: '取消' })
            const btnConfirm = createEl('button', { className: 'timer-btn timer-btn-confirm', text: '确认' })

            btnCancel.onclick = () => overlay.remove()
            btnConfirm.onclick = () => {
                let seconds = 0
                if (tabCountdown.classList.contains('active')) {
                    const s = parseInt(viewCountdown.querySelector('.inp-sec').value || 0)
                    const m = parseInt(viewCountdown.querySelector('.inp-min').value || 0)
                    seconds = s + (m * 60)
                } else {
                    const dtStr = viewSchedule.querySelector('.inp-datetime').value
                    if (!dtStr) return alert('请选择时间')
                    const target = new Date(dtStr)
                    const diff = target.getTime() - Date.now()
                    if (diff <= 0) return alert('请选择未来的时间')
                    seconds = Math.floor(diff / 1000)
                }

                if (seconds <= 0) return alert('无效的时间')
                onConfirm(seconds)
                overlay.remove()
            }

            actions.append(btnCancel, btnConfirm)
            modal.append(tabs, content, actions)
            overlay.appendChild(modal)
            document.body.appendChild(overlay)
        },

        discardDraft() {
            const discardBtn = document.querySelector('.discard-button');
            if (discardBtn) {
                discardBtn.click();
                setTimeout(() => {
                    const confirmBtn = document.querySelector('.discard-draft-modal__discard-btn');
                    if (confirmBtn) {
                        confirmBtn.click();
                    } else {
                        console.warn('Timer script: Confirm discard button not found');
                    }
                }, 300);
            } else {
                console.warn('Timer script: Discard button not found');
                try {
                    window.Discourse.__container__.lookup('controller:composer').cancel();
                } catch(e) {}
            }
        },

        addTimer(topicId, raw, seconds, replyToPostNumber, title, categoryId, tags) {
            const container = this.getTimerContainer()
            const timerId = Date.now() + Math.random().toString()

            let replyInfo = ''
            if (title) {
                replyInfo = `(发布主题：${title.substring(0, 10)}...)`
            } else {
                replyInfo = replyToPostNumber ? `(回复 #${replyToPostNumber})` : `(回复 Topic #${topicId})`
            }

            const el = createEl('div', {
                className: 'timer-item',
                innerHTML: `
                    <div style="font-weight:bold;margin-bottom:4px">定时发送 ${replyInfo}</div>
                    <div class="timer-status">等待中：<span class="countdown">${seconds}</span>s</div>
                    <div class="timer-content" style="font-size:12px;opacity:0.8;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:200px">${raw}</div>
                `
            })
            container.appendChild(el)

            this.discardDraft()

            let remaining = seconds
            const interval = setInterval(async () => {
                remaining--
                const cd = el.querySelector('.countdown')
                if (cd) cd.textContent = remaining

                if (remaining <= 0) {
                    clearInterval(interval)
                    el.querySelector('.timer-status').textContent = '正在发送...'

                    try {
                        const token = document.querySelector('meta[name="csrf-token"]')?.content
                        if (!token) throw new Error('Token not found')

                        const fd = new URLSearchParams()
                        fd.append('raw', raw)

                        if (title) {
                            fd.append('title', title)
                            if (categoryId) fd.append('category', categoryId)
                            if (tags && Array.isArray(tags)) {
                                tags.forEach(tag => fd.append('tags[]', tag))
                            }
                            fd.append('archetype', 'regular')
                        } else {
                            fd.append('topic_id', topicId)
                            fd.append('archetype', 'regular')
                            fd.append('nested_post', 'true')
                            if (replyToPostNumber) {
                                fd.append('reply_to_post_number', replyToPostNumber)
                            }
                        }

                        const res = await fetch('/posts', {
                            method: 'POST',
                            headers: {
                                'x-csrf-token': token,
                                'x-requested-with': 'XMLHttpRequest',
                                'content-type': 'application/x-www-form-urlencoded; charset=UTF-8'
                            },
                            body: fd.toString()
                        })

                        if (!res.ok) {
                            const txt = await res.text()
                            throw new Error(txt || res.statusText)
                        }

                        const json = await res.json()
                        const successTopicId = json.topic_id || topicId
                        const postUrl = json.post_url ? `<a href="${json.post_url}" target="_blank" style="color:#fff;text-decoration:underline">查看帖子</a>` : ''

                        el.classList.add('success')
                        el.innerHTML = `
                            <div style="font-weight:bold">✅ 发送成功</div>
                            <div style="font-size:12px">Topic #${successTopicId} ${postUrl}</div>
                        `
                        setTimeout(() => {
                            el.style.opacity = '0'
                            el.style.transform = 'translateY(20px)'
                            setTimeout(() => el.remove(), 300)
                        }, 5000)

                    } catch (err) {
                        el.classList.add('error')
                        el.innerHTML = `
                            <div style="font-weight:bold">❌ 发送失败 (点击查看)</div>
                            <div style="font-size:12px">Topic #${topicId}</div>
                        `
                        el.onclick = () => {
                            alert(`发送失败\n\nTopic: ${topicId}\nContent: ${raw}\nError: ${err.message}`)
                            el.remove()
                        }
                    }
                }
            }, 1000)

            this.timers.set(timerId, { interval, el })
        },

        getComposerModel() {
            try {
                if (window.Discourse && window.Discourse.__container__) {
                    const controller = window.Discourse.__container__.lookup('controller:composer')
                    if (controller && controller.model) return controller.model
                }
            } catch(e) {
                console.error('Failed to get composer model', e)
            }
            return null
        },

        injectTimerButton() {
            const replyBtn = document.querySelector('.save-or-cancel .create') || document.querySelector('.composer-controls .create');
            if (!replyBtn) {
                return
            }
            if (replyBtn.parentNode.querySelector('.timer-btn-wrapper')) return

            const wrapper = createEl('div', { className: 'timer-btn-wrapper' })

            const btn = createEl('button', {
                className: 'btn btn-icon-text btn-default',
                title: '定时发送',
                innerHTML: `<span class="d-button-label">⏱️</span>`
            })

            btn.onclick = (e) => {
                e.preventDefault()
                const model = this.getComposerModel()
                if (!model) {
                    alert('无法获取编辑器状态，Discourse 版本可能不兼容。')
                    return
                }

                const raw = model.reply || model.replyText
                const topicId = model.topic ? model.topic.id : model.topicId
                const title = model.title

                let categoryId = model.categoryId
                if (!categoryId && model.get) {
                    categoryId = model.get('categoryId')
                }

                let tags = model.tags
                if (!tags && model.get) {
                    tags = model.get('tags')
                }

                let replyToPostNumber = model.replyToPostNumber
                if (!replyToPostNumber && model.get) {
                    replyToPostNumber = model.get('replyToPostNumber')
                }

                if (!replyToPostNumber) {
                    const userLink = document.querySelector('.reply-details .user-link');
                    if (userLink) {
                        const match = userLink.href.match(/\/(\d+)$/);
                        if (match) replyToPostNumber = match[1];
                    }
                }

                if (!raw || !raw.trim()) {
                    alert('请输入回复内容')
                    return
                }
                if (!topicId && !title) {
                    alert('无法获取话题 ID 或 标题')
                    return
                }

                this.showTimePicker((seconds) => {
                    this.addTimer(topicId, raw, seconds, replyToPostNumber, title, categoryId, tags)
                })
            }

            wrapper.appendChild(btn)

            if (replyBtn.nextSibling) {
                replyBtn.parentNode.insertBefore(wrapper, replyBtn.nextSibling)
            } else {
                replyBtn.parentNode.appendChild(wrapper)
            }
        },

        init() {
            const observer = new MutationObserver(() => {
                this.injectTimerButton()
            })

            observer.observe(document.body, { childList: true, subtree: true })
            setInterval(() => this.injectTimerButton(), 1000)
            this.injectTimerButton()
        }
    }

    // ==================== 模块 2: 全员表情功能 ====================
    const AllReaction = {
        REACTION_ID: 'distorted_face',
        DELAY_MS: 1500,
        btn: null,

        async getPostIds() {
            const match = window.location.pathname.match(/\/t\/[^\/]+\/(\d+)/);
            if (!match) {
                alert('无法获取帖子 ID，请确认要在帖子详情页使用');
                return null;
            }
            const topicId = match[1];

            try {
                const response = await fetch(`/t/topic/${topicId}.json`);
                if (!response.ok) throw new Error('网络请求失败');
                const data = await response.json();

                if (data.post_stream && data.post_stream.stream) {
                    return data.post_stream.stream;
                } else {
                    alert('未找到楼层数据');
                    return [];
                }
            } catch (e) {
                console.error(e);
                alert('获取楼层列表失败，详情请看控制台');
                return [];
            }
        },

        async sendReaction(postId, current, total) {
            const url = `https://linux.do/discourse-reactions/posts/${postId}/custom-reactions/${this.REACTION_ID}/toggle.json`;

            try {
                const res = await fetch(url, {
                    method: 'PUT',
                    headers: {
                        'Accept': '*/*',
                        'Content-Length': '0',
                        'Discourse-Logged-In': 'true',
                        'X-Csrf-Token': getCsrfToken(),
                        'X-Requested-With': 'XMLHttpRequest',
                        'Content-Type': 'application/json'
                    }
                });

                this.btn.innerHTML = `处理中：${current}/${total}`;

                if (res.status === 429) {
                    console.warn(`楼层 ${postId} 触发限流，将暂停更长时间...`);
                    return false;
                }
                return true;
            } catch (e) {
                console.error(`楼层 ${postId} 请求出错`, e);
                return false;
            }
        },

        init() {
            this.btn = document.createElement('button');
            this.btn.innerHTML = '🤯 全员表情';
            this.btn.className = 'ld-all-reaction-btn';
            document.body.appendChild(this.btn);

            this.btn.onclick = async () => {
                if (confirm(`确定要给当前帖子下的所有楼层发送 "${this.REACTION_ID}" 表情吗？\n注意：此接口为 toggle (切换)，如果已点过则会取消。`)) {
                    this.btn.disabled = true;
                    this.btn.style.backgroundColor = '#95a5a6';

                    const postIds = await this.getPostIds();
                    if (!postIds || postIds.length === 0) {
                        this.btn.disabled = false;
                        this.btn.innerHTML = '🤯 全员表情';
                        return;
                    }

                    console.log(`共获取到 ${postIds.length} 个楼层，开始处理...`);

                    for (let i = 0; i < postIds.length; i++) {
                        const pid = postIds[i];
                        const success = await this.sendReaction(pid, i + 1, postIds.length);

                        if (success) {
                            await sleep(this.DELAY_MS);
                        } else {
                            await sleep(5000);
                        }
                    }

                    this.btn.innerHTML = '✅ 完成';
                    this.btn.style.backgroundColor = '#2ecc71';
                    setTimeout(() => {
                        this.btn.disabled = false;
                        this.btn.innerHTML = '🤯 全员表情';
                        this.btn.style.backgroundColor = '#e74c3c';
                    }, 3000);
                }
            };
        }
    }

    // ==================== 模块 3: 用户表情助手 ====================
    const UserReaction = {
        REACTION_ID: 'distorted_face',
        DELAY_MS: 2000,
        targetPostIds: [],
        isRunning: false,
        panel: null,

        log(msg) {
            const logBox = document.getElementById('ld-log');
            if (logBox) {
                logBox.innerHTML += `<div>[${new Date().toLocaleTimeString()}] ${msg}</div>`;
                logBox.scrollTop = logBox.scrollHeight;
            }
        },

        async fetchUserActions(username, count) {
            let results = [];
            let offset = 0;

            this.log(`正在获取 ${username} 的数据...`);

            while (results.length < count) {
                const url = `/user_actions.json?offset=${offset}&username=${username}&filter=4,5`;

                try {
                    const res = await fetch(url);
                    if (!res.ok) {
                        this.log(`获取失败: ${res.status}`);
                        break;
                    }
                    const data = await res.json();

                    if (!data.user_actions || data.user_actions.length === 0) {
                        this.log("没有更多数据了");
                        break;
                    }

                    for (let item of data.user_actions) {
                        if (results.length >= count) break;

                        if (!results.find(r => r.id === item.post_id)) {
                            results.push({
                                id: item.post_id,
                                title: item.title,
                                excerpt: item.excerpt ? item.excerpt.substring(0, 30) + '...' : '(无预览)'
                            });
                        }
                    }
                    offset += 30;
                    await sleep(500);

                } catch (e) {
                    this.log(`请求出错：${e.message}`);
                    break;
                }
            }

            return results;
        },

        async sendReaction(postId, index, total) {
            const url = `https://linux.do/discourse-reactions/posts/${postId}/custom-reactions/${this.REACTION_ID}/toggle.json`;

            try {
                const res = await fetch(url, {
                    method: 'PUT',
                    headers: {
                        'Accept': '*/*',
                        'Discourse-Logged-In': 'true',
                        'X-Csrf-Token': getCsrfToken(),
                        'X-Requested-With': 'XMLHttpRequest',
                        'Content-Type': 'application/json'
                    }
                });

                if (res.status === 200) {
                    this.log(`✅ (${index}/${total}) ID:${postId} 成功`);
                    return true;
                } else if (res.status === 429) {
                    this.log(`⚠️ (${index}/${total}) ID:${postId} 频率限制，暂停 5 秒`);
                    return 'rate_limit';
                } else {
                    this.log(`❌ (${index}/${total}) ID:${postId} 失败 State:${res.status}`);
                    return false;
                }
            } catch (e) {
                this.log(`❌ 请求异常：${e.message}`);
                return false;
            }
        },

        init() {
            this.panel = createEl('div', { className: 'ld-user-panel' });
            this.panel.innerHTML = `
                <h3>🤯 用户表情助手</h3>

                <div style="margin-bottom: 8px;">
                    <label>用户名 (Username):</label>
                    <input type="text" id="ld-username" placeholder="如：ChesterYuan">
                </div>

                <div style="margin-bottom: 8px;">
                    <label>数量 (Count):</label>
                    <input type="number" id="ld-count" value="10" min="1" max="100">
                </div>

                <div style="display: flex; gap: 10px; margin-top: 15px;">
                    <button id="ld-check-btn" style="flex: 1; background: #3498db;">🔍 预先检测</button>
                    <button id="ld-run-btn" style="flex: 1; background: #555; color: #aaa; cursor: not-allowed;" disabled>🚀 开始执行</button>
                </div>

                <div id="ld-log" class="ld-log">等待操作...</div>
                <button id="ld-close-btn" style="position: absolute; top: 5px; right: 10px; background: transparent; color: #888;">✕</button>
            `;
            document.body.appendChild(this.panel);

            document.getElementById('ld-check-btn').onclick = async () => {
                const username = document.getElementById('ld-username').value.trim();
                const count = parseInt(document.getElementById('ld-count').value);

                if (!username) return alert('请输入用户名');

                document.getElementById('ld-log').innerHTML = '';
                this.targetPostIds = await this.fetchUserActions(username, count);

                if (this.targetPostIds.length > 0) {
                    this.log(`------------------`);
                    this.log(`检测完成！共找到 ${this.targetPostIds.length} 条记录。`);
                    this.log(`示例：[${this.targetPostIds[0].title}] - ${this.targetPostIds[0].excerpt}`);
                    this.log(`------------------`);
                    this.log(`请确认无误后点击"执行"`);

                    const runBtn = document.getElementById('ld-run-btn');
                    runBtn.disabled = false;
                    runBtn.style.backgroundColor = '#e74c3c';
                    runBtn.style.color = '#fff';
                    runBtn.style.cursor = 'pointer';
                } else {
                    this.log(`未找到该用户的相关数据，请检查用户名是否正确 (区分大小写)。`);
                }
            };

            document.getElementById('ld-run-btn').onclick = async () => {
                if (this.targetPostIds.length === 0) return;
                if (this.isRunning) return;

                if (!confirm(`确定要对这 ${this.targetPostIds.length} 个帖子/回复发送 "${this.REACTION_ID}" 吗？`)) return;

                this.isRunning = true;
                document.getElementById('ld-run-btn').disabled = true;
                document.getElementById('ld-check-btn').disabled = true;

                this.log(`🚀 开始批量处理...`);

                for (let i = 0; i < this.targetPostIds.length; i++) {
                    const item = this.targetPostIds[i];
                    const result = await this.sendReaction(item.id, i + 1, this.targetPostIds.length);

                    if (result === 'rate_limit') {
                        await sleep(5000);
                    } else {
                        await sleep(this.DELAY_MS);
                    }
                }

                this.log(`🎉 所有操作已完成！`);
                this.isRunning = false;
                document.getElementById('ld-check-btn').disabled = false;
            };

            document.getElementById('ld-close-btn').onclick = () => {
                this.panel.style.display = 'none';
            };
        }
    }

    // ==================== 初始化所有模块 ====================
    ScheduledReply.init();
    AllReaction.init();
    UserReaction.init();

})();
