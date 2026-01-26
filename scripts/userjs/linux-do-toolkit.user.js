// ==UserScript==
// @name         Linux.do 工具集
// @namespace    https://github.com/stevessr/bug-v3
// @version      1.6.0
// @description  Linux.do 增强工具集：定时发送、表情助手（全员 + 用户）、群组管理、点赞计数器
// @author       stevessr, ChiGamma
// @match        https://linux.do/*
// @match        https://meta.discourse.org/*
// @match        https://*.discourse.org/*
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

    /* 表情助手面板 - 折叠/展开 */
    .ld-reaction-panel {
        position: fixed;
        bottom: 20px;
        left: 20px;
        z-index: 9999;
        font-family: Arial, sans-serif;
        transition: left 0.3s ease, right 0.3s ease;
    }
    .ld-reaction-panel.dragging {
        transition: none;
    }

    /* 折叠按钮 */
    .ld-panel-toggle {
        width: 50px;
        height: 50px;
        background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%);
        color: white;
        border: none;
        border-radius: 50%;
        cursor: move;
        font-size: 24px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.3s;
        user-select: none;
        touch-action: none;
    }
    .ld-panel-toggle:hover {
        transform: scale(1.1);
        box-shadow: 0 6px 16px rgba(0,0,0,0.4);
    }
    .ld-panel-toggle:active {
        cursor: grabbing;
    }

    /* 展开的面板内容 */
    .ld-panel-content {
        position: absolute;
        bottom: 60px;
        left: 0;
        width: 320px;
        background-color: #222;
        color: #fff;
        border: 1px solid #444;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        padding: 15px;
        font-size: 14px;
        display: none;
        opacity: 0;
        transform: translateY(10px);
        transition: all 0.3s ease;
    }
    .ld-panel-content.show {
        display: block;
        opacity: 1;
        transform: translateY(0);
    }

    /* Tab 切换 */
    .ld-panel-tabs {
        display: flex;
        border-bottom: 1px solid #555;
        margin-bottom: 15px;
        gap: 5px;
    }
    .ld-panel-tab {
        flex: 1;
        text-align: center;
        padding: 8px;
        cursor: pointer;
        color: #999;
        border-radius: 4px 4px 0 0;
        transition: all 0.2s;
    }
    .ld-panel-tab:hover {
        background: #333;
        color: #fff;
    }
    .ld-panel-tab.active {
        color: #e74c3c;
        background: #333;
        font-weight: bold;
    }

    /* Tab 内容区 */
    .ld-tab-content {
        display: none;
    }
    .ld-tab-content.active {
        display: block;
    }

    .ld-panel-content h4 {
        margin: 0 0 10px 0;
        color: #e74c3c;
        font-size: 13px;
    }
    .ld-panel-content input {
        width: 100%;
        padding: 6px;
        box-sizing: border-box;
        margin-top: 4px;
        border-radius: 4px;
        border: 1px solid #555;
        background: #333;
        color: white;
        font-size: 13px;
    }
    .ld-panel-content button {
        padding: 8px 12px;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 13px;
        transition: all 0.2s;
    }
    .ld-panel-content button:hover:not(:disabled) {
        transform: translateY(-1px);
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    }
    .ld-panel-content .ld-log {
        margin-top: 10px;
        padding: 8px;
        background: #111;
        height: 120px;
        overflow-y: auto;
        border: 1px solid #333;
        font-size: 12px;
        color: #ccc;
        white-space: pre-wrap;
        border-radius: 4px;
    }
    .ld-field-group {
        margin-bottom: 10px;
    }
    .ld-field-group label {
        display: block;
        margin-bottom: 4px;
        font-size: 12px;
        color: #aaa;
    }
    .ld-reaction-selector {
        width: 100%;
        padding: 6px;
        border-radius: 4px;
        border: 1px solid #555;
        background: #333;
        color: white;
        font-size: 13px;
        cursor: pointer;
    }
    .ld-reaction-selector option {
        background: #333;
        color: white;
    }

    /* 进度条 */
    .ld-progress-container {
        width: 100%;
        height: 6px;
        background: #444;
        border-radius: 3px;
        margin: 10px 0;
        overflow: hidden;
        display: none;
    }
    .ld-progress-container.active {
        display: block;
    }
    .ld-progress-bar {
        height: 100%;
        background: linear-gradient(90deg, #e74c3c, #f39c12);
        border-radius: 3px;
        width: 0%;
        transition: width 0.3s ease;
    }
    .ld-progress-text {
        font-size: 11px;
        color: #aaa;
        text-align: center;
        margin-top: 4px;
        display: none;
    }
    .ld-progress-text.active {
        display: block;
    }

    /* 用户卡片点赞按钮 */
    .ld-usercard-reaction-btn {
        position: relative;
    }
    .ld-usercard-reaction-btn .ld-reaction-count {
        position: absolute;
        top: -8px;
        right: -8px;
        background: #e74c3c;
        color: white;
        font-size: 11px;
        font-weight: bold;
        padding: 2px 6px;
        border-radius: 10px;
        min-width: 18px;
        text-align: center;
        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    }

    /* 点赞计数器 */
    .ld-picker-counter {
        width: auto !important;
        box-sizing: border-box !important;
        text-align: center;
        margin: 0 3.5px !important;
        padding: 6px 0 4px 0;
        font-size: 0.85em;
        font-weight: 600;
        border-bottom: 1px solid var(--primary-low, #e9e9e9);
        border-top-left-radius: 8px;
        border-top-right-radius: 8px;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
    }
    .ld-picker-counter.bg-ok {
        background-color: color-mix(in srgb, var(--secondary), #00F2FF 15%) !important;
    }
    .ld-picker-counter.bg-cooldown {
        background-color: color-mix(in srgb, var(--secondary), #FF3131 15%) !important;
    }
    .ld-picker-counter.bg-mismatch {
        background-color: color-mix(in srgb, var(--secondary), #4D00FF 15%) !important;
    }
    .discourse-reactions-picker .discourse-reactions-picker-container {
        margin-top: 0 !important;
        border-top-left-radius: 0 !important;
        border-top-right-radius: 0 !important;
    }
    .ld-content-wrapper {
        display: flex !important;
        margin: 0 !important;
        align-items: center !important;
        gap: 6px !important;
        flex: 0 1 auto !important;
    }
    .ld-mismatch-tooltip {
        display: inline-flex;
        align-items: center;
        margin-right: 6px;
        cursor: help;
        position: relative;
    }
    .ld-mismatch-tooltip svg {
        width: 14px;
        height: 14px;
        fill: currentColor;
    }
    .ld-mismatch-tooltip::after {
        content: attr(data-tooltip);
        position: absolute;
        bottom: 125%;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0,0,0,0.85);
        color: #fff;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 0.75em;
        white-space: nowrap;
        opacity: 0;
        visibility: hidden;
        transition: opacity 0.2s;
        pointer-events: none;
        z-index: 9999;
    }
    .ld-mismatch-tooltip:hover::after {
        opacity: 1;
        visibility: visible;
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

    // ==================== 初始化所有模块 ====================
    ScheduledReply.init();

    // ==================== 模块 2: 表情助手（全员表情 + 用户表情） ====================
    const ReactionHelper = {
        // 可用表情列表
        REACTIONS: [
            { id: 'heart', name: '❤️ Heart', emoji: '❤️' },
            { id: '+1', name: '👍 +1', emoji: '👍' },
            { id: 'laughing', name: '😆 Laughing', emoji: '😆' },
            { id: 'open_mouth', name: '😮 Open Mouth', emoji: '😮' },
            { id: 'clap', name: '👏 Clap', emoji: '👏' },
            { id: 'confetti_ball', name: '🎊 Confetti Ball', emoji: '🎊' },
            { id: 'hugs', name: '🤗 Hugs', emoji: '🤗' },
            { id: 'distorted_face', name: '🤯 Distorted Face', emoji: '🤯' },
            { id: 'tieba_087', name: '🎭 Tieba 087', emoji: '🎭' },
            { id: 'bili_057', name: '📺 Bili 057', emoji: '📺' }
        ],

        DELAY_MS_ALL: 1500,
        DELAY_MS_USER: 2000,
        SKIP_ALREADY_REACTED: true,
        targetPostIds: [],
        isRunning: false,
        panel: null,
        panelContent: null,
        isExpanded: false,
        isDragging: false,
        dragStartX: 0,
        dragStartY: 0,
        panelStartLeft: 0,
        panelStartBottom: 0,
        reactionStatusCache: new Map(),

        getSelectedReaction() {
            const selector = document.getElementById('ld-reaction-select');
            return selector ? selector.value : 'distorted_face';
        },

        normalizePostData(data) {
            if (!data) return null;
            return data.post || data;
        },

        extractCurrentReactions(postData) {
            if (!postData) return { any: false, list: [] };
            const list = [];
            if (postData.current_user_reaction) {
                const r = postData.current_user_reaction;
                list.push(typeof r === 'object' && r.id ? r.id : r);
            }
            if (Array.isArray(postData.current_user_reactions)) {
                postData.current_user_reactions.filter(Boolean).forEach(r => {
                    list.push(typeof r === 'object' && r.id ? r.id : r);
                });
            }
            if (postData.reactions) {
                if (Array.isArray(postData.reactions)) {
                    postData.reactions.forEach(r => {
                        if (r && r.reacted && r.id) list.push(r.id);
                    });
                } else if (typeof postData.reactions === 'object') {
                    Object.values(postData.reactions).forEach(r => {
                        if (r && r.reacted && r.id) list.push(r.id);
                    });
                }
            }
            const unique = Array.from(new Set(list));
            return { any: unique.length > 0, list: unique };
        },

        async isAlreadyReacted(postId, reactionId) {
            const cacheKey = `${postId}:${reactionId || '*'}`;
            if (this.reactionStatusCache.has(cacheKey)) return this.reactionStatusCache.get(cacheKey);

            const url = `/posts/${postId}.json`;
            try {
                const res = await fetch(url);
                if (!res.ok) {
                    this.reactionStatusCache.set(cacheKey, false);
                    return false;
                }
                const data = await res.json();
                const postData = this.normalizePostData(data);
                const status = this.extractCurrentReactions(postData);
                const matched = reactionId ? status.list.includes(reactionId) : status.any;
                this.reactionStatusCache.set(cacheKey, matched);
                return matched;
            } catch (e) {
                this.reactionStatusCache.set(cacheKey, false);
                return false;
            }
        },

        // 从 localStorage 加载位置
        loadPosition() {
            const saved = localStorage.getItem('ld-reaction-panel-position');
            if (saved) {
                try {
                    const pos = JSON.parse(saved);
                    this.panel.style.left = pos.left || '';
                    this.panel.style.right = pos.right || '';
                    this.panel.style.bottom = pos.bottom || '20px';
                } catch (e) {
                    console.error('Failed to load panel position', e);
                }
            }
        },

        // 保存位置到 localStorage
        savePosition() {
            const pos = {
                left: this.panel.style.left,
                right: this.panel.style.right,
                bottom: this.panel.style.bottom
            };
            localStorage.setItem('ld-reaction-panel-position', JSON.stringify(pos));
        },

        // 吸附到最近的边缘
        snapToEdge() {
            const rect = this.panel.getBoundingClientRect();
            const windowWidth = window.innerWidth;
            const panelCenterX = rect.left + rect.width / 2;

            // 保持底部位置不变
            const bottomOffset = window.innerHeight - rect.bottom;
            this.panel.style.bottom = Math.max(20, bottomOffset) + 'px';

            // 判断吸附到左边还是右边
            if (panelCenterX < windowWidth / 2) {
                // 吸附到左边
                this.panel.style.left = '20px';
                this.panel.style.right = '';
                this.panelContent.style.left = '0';
                this.panelContent.style.right = '';
            } else {
                // 吸附到右边
                this.panel.style.right = '20px';
                this.panel.style.left = '';
                this.panelContent.style.right = '0';
                this.panelContent.style.left = '';
            }

            this.savePosition();
        },

        // 拖拽开始
        onDragStart(e) {
            // 只有点击按钮本身才能拖拽，点击面板内容不触发拖拽
            if (!e.target.classList.contains('ld-panel-toggle')) return;

            this.isDragging = true;
            this.panel.classList.add('dragging');

            const touch = e.type.includes('touch') ? e.touches[0] : e;
            this.dragStartX = touch.clientX;
            this.dragStartY = touch.clientY;

            const rect = this.panel.getBoundingClientRect();
            this.panelStartLeft = rect.left;
            this.panelStartBottom = window.innerHeight - rect.bottom;

            e.preventDefault();
        },

        // 拖拽中
        onDragMove(e) {
            if (!this.isDragging) return;

            const touch = e.type.includes('touch') ? e.touches[0] : e;
            const deltaX = touch.clientX - this.dragStartX;
            const deltaY = touch.clientY - this.dragStartY;

            // 计算新位置
            const newLeft = this.panelStartLeft + deltaX;
            const newBottom = this.panelStartBottom - deltaY;

            // 设置边界限制
            const maxLeft = window.innerWidth - this.panel.offsetWidth - 10;
            const maxBottom = window.innerHeight - this.panel.offsetHeight - 10;

            this.panel.style.left = Math.max(10, Math.min(newLeft, maxLeft)) + 'px';
            this.panel.style.right = '';
            this.panel.style.bottom = Math.max(10, Math.min(newBottom, maxBottom)) + 'px';

            e.preventDefault();
        },

        // 拖拽结束
        onDragEnd(e) {
            if (!this.isDragging) return;

            this.isDragging = false;
            this.panel.classList.remove('dragging');

            // 吸附到边缘
            setTimeout(() => this.snapToEdge(), 50);

            e.preventDefault();
        },

        log(msg, tabId = 'user') {
            const logBox = document.getElementById(`ld-log-${tabId}`);
            if (logBox) {
                logBox.innerHTML += `<div>[${new Date().toLocaleTimeString()}] ${msg}</div>`;
                logBox.scrollTop = logBox.scrollHeight;
            }
        },

        clearLog(tabId) {
            const logBox = document.getElementById(`ld-log-${tabId}`);
            if (logBox) logBox.innerHTML = '';
        },

        updateProgress(tabId, current, total) {
            const container = document.getElementById(`ld-progress-${tabId}`);
            const bar = document.getElementById(`ld-progress-bar-${tabId}`);
            const text = document.getElementById(`ld-progress-text-${tabId}`);
            if (!container || !bar || !text) return;

            const percent = total > 0 ? Math.round((current / total) * 100) : 0;
            container.classList.add('active');
            text.classList.add('active');
            bar.style.width = `${percent}%`;
            text.textContent = `${current} / ${total} (${percent}%)`;
        },

        hideProgress(tabId) {
            const container = document.getElementById(`ld-progress-${tabId}`);
            const text = document.getElementById(`ld-progress-text-${tabId}`);
            if (container) container.classList.remove('active');
            if (text) text.classList.remove('active');
        },

        togglePanel() {
            // 如果刚刚拖拽过，不触发展开/折叠
            if (this.isDragging) return;

            this.isExpanded = !this.isExpanded;
            if (this.isExpanded) {
                this.panelContent.classList.add('show');
            } else {
                this.panelContent.classList.remove('show');
            }
        },

        switchTab(tabName) {
            // 切换 tab 按钮状态
            document.querySelectorAll('.ld-panel-tab').forEach(tab => {
                tab.classList.remove('active');
            });
            document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

            // 切换内容区
            document.querySelectorAll('.ld-tab-content').forEach(content => {
                content.classList.remove('active');
            });
            document.getElementById(`ld-tab-${tabName}`).classList.add('active');
        },

        // ===== 全员表情功能 =====
        async getAllPostIds() {
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
                    this.log('未找到楼层数据', 'all');
                    return [];
                }
            } catch (e) {
                console.error(e);
                this.log(`获取楼层列表失败：${e.message}`, 'all');
                return [];
            }
        },

        async sendReactionToPost(postId, current, total, tabId) {
            const reactionId = this.getSelectedReaction();
            const url = `https://linux.do/discourse-reactions/posts/${postId}/custom-reactions/${reactionId}/toggle.json`;

            try {
                if (this.SKIP_ALREADY_REACTED) {
                    const alreadyReacted = await this.isAlreadyReacted(postId, reactionId);
                    if (alreadyReacted) {
                        this.log(`⏭️ (${current}/${total}) ID:${postId} 已点过，跳过`, tabId);
                        return 'skipped';
                    }
                }

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

                if (res.status === 200) {
                    this.log(`✅ (${current}/${total}) ID:${postId} 成功`, tabId);
                    return true;
                } else if (res.status === 429) {
                    this.log(`⚠️ (${current}/${total}) ID:${postId} 触发限流，暂停 5 秒`, tabId);
                    return 'rate_limit';
                } else {
                    this.log(`❌ (${current}/${total}) ID:${postId} 失败 State:${res.status}`, tabId);
                    return false;
                }
            } catch (e) {
                this.log(`❌ 请求异常：${e.message}`, tabId);
                return false;
            }
        },

        async runAllReaction() {
            if (this.isRunning) return;

            const btn = document.getElementById('ld-all-start-btn');
            const reactionId = this.getSelectedReaction();
            const reactionName = this.REACTIONS.find(r => r.id === reactionId)?.name || reactionId;

            if (!confirm(`确定要给当前帖子下的所有楼层发送 "${reactionName}" 表情吗？\n注意：此接口为 toggle (切换)，如果已点过则会取消。`)) return;

            this.isRunning = true;
            btn.disabled = true;
            btn.style.backgroundColor = '#95a5a6';
            btn.textContent = '处理中...';
            this.clearLog('all');
            this.hideProgress('all');

            const postIds = await this.getAllPostIds();
            if (!postIds || postIds.length === 0) {
                this.isRunning = false;
                btn.disabled = false;
                btn.style.backgroundColor = '#e74c3c';
                btn.textContent = '🚀 开始执行';
                return;
            }

            this.log(`共获取到 ${postIds.length} 个楼层，开始处理...`, 'all');
            this.updateProgress('all', 0, postIds.length);

            for (let i = 0; i < postIds.length; i++) {
                const pid = postIds[i];
                const result = await this.sendReactionToPost(pid, i + 1, postIds.length, 'all');
                this.updateProgress('all', i + 1, postIds.length);

                if (result === 'rate_limit') {
                    await sleep(5000);
                } else {
                    await sleep(this.DELAY_MS_ALL);
                }
            }

            this.log(`🎉 所有操作已完成！`, 'all');
            btn.textContent = '✅ 完成';
            btn.style.backgroundColor = '#2ecc71';
            setTimeout(() => {
                this.isRunning = false;
                btn.disabled = false;
                btn.style.backgroundColor = '#e74c3c';
                btn.textContent = '🚀 开始执行';
                this.hideProgress('all');
            }, 3000);
        },

        // ===== 用户表情功能 =====
        async fetchUserActions(username, count) {
            let results = [];
            let offset = 0;

            this.log(`正在获取 ${username} 的数据...`, 'user');

            while (results.length < count) {
                const url = `/user_actions.json?offset=${offset}&username=${username}&filter=4,5`;

                try {
                    const res = await fetch(url);
                    if (!res.ok) {
                        this.log(`获取失败: ${res.status}`, 'user');
                        break;
                    }
                    const data = await res.json();

                    if (!data.user_actions || data.user_actions.length === 0) {
                        this.log("没有更多数据了", 'user');
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
                    this.log(`请求出错：${e.message}`, 'user');
                    break;
                }
            }

            return results;
        },

        async checkUserPosts() {
            const username = document.getElementById('ld-username').value.trim();
            const count = parseInt(document.getElementById('ld-count').value);

            if (!username) return alert('请输入用户名');

            this.clearLog('user');
            this.targetPostIds = await this.fetchUserActions(username, count);

            if (this.targetPostIds.length > 0) {
                this.log(`------------------`, 'user');
                this.log(`检测完成！共找到 ${this.targetPostIds.length} 条记录。`, 'user');
                this.log(`示例：[${this.targetPostIds[0].title}] - ${this.targetPostIds[0].excerpt}`, 'user');
                this.log(`------------------`, 'user');
                this.log(`请确认无误后点击"执行"`, 'user');

                const runBtn = document.getElementById('ld-user-run-btn');
                runBtn.disabled = false;
                runBtn.style.backgroundColor = '#e74c3c';
                runBtn.style.cursor = 'pointer';
            } else {
                this.log(`未找到该用户的相关数据，请检查用户名是否正确 (区分大小写)。`, 'user');
            }
        },

        async runUserReaction() {
            if (this.targetPostIds.length === 0) return;
            if (this.isRunning) return;

            const reactionId = this.getSelectedReaction();
            const reactionName = this.REACTIONS.find(r => r.id === reactionId)?.name || reactionId;

            if (!confirm(`确定要对这 ${this.targetPostIds.length} 个帖子/回复发送 "${reactionName}" 吗？`)) return;

            this.isRunning = true;
            document.getElementById('ld-user-run-btn').disabled = true;
            document.getElementById('ld-user-check-btn').disabled = true;
            this.hideProgress('user');

            this.log(`🚀 开始批量处理...`, 'user');
            this.updateProgress('user', 0, this.targetPostIds.length);

            for (let i = 0; i < this.targetPostIds.length; i++) {
                const item = this.targetPostIds[i];
                const result = await this.sendReactionToPost(item.id, i + 1, this.targetPostIds.length, 'user');
                this.updateProgress('user', i + 1, this.targetPostIds.length);

                if (result === 'rate_limit') {
                    await sleep(5000);
                } else {
                    await sleep(this.DELAY_MS_USER);
                }
            }

            this.log(`🎉 所有操作已完成！`, 'user');
            this.isRunning = false;
            document.getElementById('ld-user-check-btn').disabled = false;
            setTimeout(() => {
                this.hideProgress('user');
            }, 3000);
        },

        // ===== 群组管理功能 =====
        async addGroupMembers() {
            const groupId = document.getElementById('ld-group-id').value.trim();
            const usernames = document.getElementById('ld-group-usernames').value.trim();
            const notifyUsers = document.getElementById('ld-group-notify').checked;

            if (!groupId) {
                alert('请输入群组 ID');
                return;
            }

            if (!usernames) {
                alert('请输入用户名列表');
                return;
            }

            // 支持逗号或空格分隔
            const usernameList = usernames.split(/[,\s]+/).map(u => u.trim()).filter(u => u);
            if (usernameList.length === 0) {
                alert('请输入有效的用户名');
                return;
            }

            if (!confirm(`确定要将 ${usernameList.length} 个用户添加到群组 ${groupId} 吗？\n\n用户列表：\n${usernameList.join('\n')}`)) {
                return;
            }

            this.clearLog('group');
            this.log(`准备添加 ${usernameList.length} 个用户到群组 ${groupId}...`, 'group');

            const btn = document.getElementById('ld-group-add-btn');
            btn.disabled = true;
            btn.style.backgroundColor = '#95a5a6';
            btn.textContent = '处理中...';

            try {
                const url = `https://linux.do/groups/${groupId}/members.json`;
                const formData = new URLSearchParams();
                formData.append('usernames', usernameList.join(','));
                formData.append('emails', '');
                formData.append('notify_users', notifyUsers ? 'true' : 'false');

                this.log(`发送请求到：${url}`, 'group');

                const res = await fetch(url, {
                    method: 'PUT',
                    headers: {
                        'Accept': '*/*',
                        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                        'Discourse-Logged-In': 'true',
                        'Discourse-Present': 'true',
                        'X-Csrf-Token': getCsrfToken(),
                        'X-Requested-With': 'XMLHttpRequest'
                    },
                    body: formData.toString()
                });

                if (res.ok) {
                    const data = await res.json();
                    this.log(`✅ 成功添加成员！`, 'group');
                    this.log(`返回数据：${JSON.stringify(data).substring(0, 200)}`, 'group');

                    btn.textContent = '✅ 添加成功';
                    btn.style.backgroundColor = '#2ecc71';

                    setTimeout(() => {
                        btn.disabled = false;
                        btn.style.backgroundColor = '#27ae60';
                        btn.textContent = '➕ 添加成员';
                    }, 3000);
                } else {
                    const errorText = await res.text();
                    throw new Error(`HTTP ${res.status}: ${errorText}`);
                }
            } catch (err) {
                console.error('添加群组成员失败：', err);
                this.log(`❌ 添加失败：${err.message}`, 'group');

                btn.textContent = '❌ 添加失败';
                btn.style.backgroundColor = '#e74c3c';

                setTimeout(() => {
                    btn.disabled = false;
                    btn.style.backgroundColor = '#27ae60';
                    btn.textContent = '➕ 添加成员';
                }, 3000);
            }
        },

        init() {
            // 创建面板容器
            this.panel = createEl('div', { className: 'ld-reaction-panel' });

            // 创建折叠按钮
            const toggleBtn = createEl('button', {
                className: 'ld-panel-toggle',
                innerHTML: '🤯',
                title: '表情助手'
            });

            // 绑定拖拽事件（使用箭头函数保持 this 上下文）
            toggleBtn.addEventListener('mousedown', (e) => this.onDragStart(e));
            toggleBtn.addEventListener('touchstart', (e) => this.onDragStart(e), { passive: false });

            document.addEventListener('mousemove', (e) => this.onDragMove(e));
            document.addEventListener('touchmove', (e) => this.onDragMove(e), { passive: false });

            document.addEventListener('mouseup', (e) => this.onDragEnd(e));
            document.addEventListener('touchend', (e) => this.onDragEnd(e));

            // 点击事件（在 mouseup 时判断是否为拖拽）
            let clickStartTime = 0;
            let clickStartX = 0;
            let clickStartY = 0;

            toggleBtn.addEventListener('mousedown', (e) => {
                clickStartTime = Date.now();
                clickStartX = e.clientX;
                clickStartY = e.clientY;
            });

            toggleBtn.addEventListener('click', (e) => {
                const clickDuration = Date.now() - clickStartTime;
                const moveDistance = Math.sqrt(
                    Math.pow(e.clientX - clickStartX, 2) +
                    Math.pow(e.clientY - clickStartY, 2)
                );

                // 如果移动距离小于 5px 且点击时间小于 200ms，认为是点击而非拖拽
                if (moveDistance < 5 && clickDuration < 200) {
                    this.togglePanel();
                }
            });

            // 创建面板内容
            this.panelContent = createEl('div', { className: 'ld-panel-content' });

            // 生成表情选择器选项
            const reactionOptions = this.REACTIONS.map(r =>
                `<option value="${r.id}">${r.name}</option>`
            ).join('');

            this.panelContent.innerHTML = `
                <div class="ld-panel-tabs">
                    <div class="ld-panel-tab active" data-tab="all">🎯 全员表情</div>
                    <div class="ld-panel-tab" data-tab="user">👤 用户表情</div>
                    <div class="ld-panel-tab" data-tab="group">👥 群组管理</div>
                </div>

                <!-- 表情选择器 - 全局共用 -->
                <div class="ld-field-group">
                    <label>选择表情</label>
                    <select id="ld-reaction-select" class="ld-reaction-selector">
                        ${reactionOptions}
                    </select>
                </div>

                <!-- 全员表情 Tab -->
                <div id="ld-tab-all" class="ld-tab-content active">
                    <h4>给当前帖子所有楼层发送表情</h4>
                    <p style="font-size: 12px; color: #999; margin: 10px 0;">
                        注意：toggle 模式，已点过会取消
                    </p>
                    <button id="ld-all-start-btn" style="width: 100%; background: #e74c3c; margin-top: 10px;">🚀 开始执行</button>
                    <div id="ld-progress-all" class="ld-progress-container">
                        <div id="ld-progress-bar-all" class="ld-progress-bar"></div>
                    </div>
                    <div id="ld-progress-text-all" class="ld-progress-text"></div>
                    <div id="ld-log-all" class="ld-log">等待操作...</div>
                </div>

                <!-- 用户表情 Tab -->
                <div id="ld-tab-user" class="ld-tab-content">
                    <h4>给指定用户历史帖子发送表情</h4>
                    <div class="ld-field-group">
                        <label>用户名 (Username)</label>
                        <input type="text" id="ld-username" placeholder="如：Neo">
                    </div>
                    <div class="ld-field-group">
                        <label>数量 (Count)</label>
                        <input type="number" id="ld-count" value="10" min="1" max="100">
                    </div>
                    <div style="display: flex; gap: 10px; margin-top: 10px;">
                        <button id="ld-user-check-btn" style="flex: 1; background: #3498db;">🔍 预检</button>
                        <button id="ld-user-run-btn" style="flex: 1; background: #555; cursor: not-allowed;" disabled>🚀 执行</button>
                    </div>
                    <div id="ld-progress-user" class="ld-progress-container">
                        <div id="ld-progress-bar-user" class="ld-progress-bar"></div>
                    </div>
                    <div id="ld-progress-text-user" class="ld-progress-text"></div>
                    <div id="ld-log-user" class="ld-log">等待操作...</div>
                </div>

                <!-- 群组管理 Tab -->
                <div id="ld-tab-group" class="ld-tab-content">
                    <h4>批量添加群组成员</h4>
                    <div class="ld-field-group">
                        <label>群组 ID</label>
                        <input type="number" id="ld-group-id" placeholder="如：105" value="105">
                    </div>
                    <div class="ld-field-group">
                        <label>用户名列表（逗号或空格分隔）</label>
                        <input type="text" id="ld-group-usernames" placeholder="如：user1 user2 user3 或 user1,user2,user3">
                    </div>
                    <div class="ld-field-group">
                        <label style="display: flex; align-items: center; gap: 5px;">
                            <input type="checkbox" id="ld-group-notify" checked>
                            <span>通知用户</span>
                        </label>
                    </div>
                    <button id="ld-group-add-btn" style="width: 100%; background: #27ae60; margin-top: 10px;">➕ 添加成员</button>
                    <div id="ld-log-group" class="ld-log">等待操作...</div>
                </div>
            `;

            this.panel.appendChild(toggleBtn);
            this.panel.appendChild(this.panelContent);
            document.body.appendChild(this.panel);

            // 加载保存的位置
            this.loadPosition();

            // 绑定 Tab 切换事件
            document.querySelectorAll('.ld-panel-tab').forEach(tab => {
                tab.onclick = () => this.switchTab(tab.dataset.tab);
            });

            // 绑定全员表情按钮
            document.getElementById('ld-all-start-btn').onclick = () => this.runAllReaction();

            // 绑定用户表情按钮
            document.getElementById('ld-user-check-btn').onclick = () => this.checkUserPosts();
            document.getElementById('ld-user-run-btn').onclick = () => this.runUserReaction();

            // 绑定群组管理按钮
            document.getElementById('ld-group-add-btn').onclick = () => this.addGroupMembers();

            // 监听用户卡片出现
            this.observeUserCard();
        },

        // ===== 用户卡片快捷点赞功能 =====
        observeUserCard() {
            const observer = new MutationObserver((mutations) => {
                for (const mutation of mutations) {
                    if (mutation.addedNodes.length) {
                        for (const node of mutation.addedNodes) {
                            if (node.nodeType === 1 && node.id === 'user-card') {
                                this.injectUserCardButton(node);
                            } else if (node.nodeType === 1) {
                                const userCard = node.querySelector('#user-card');
                                if (userCard) {
                                    this.injectUserCardButton(userCard);
                                }
                            }
                        }
                    }
                }
            });

            observer.observe(document.body, { childList: true, subtree: true });

            // 检查是否已存在用户卡片
            const existingCard = document.getElementById('user-card');
            if (existingCard) {
                this.injectUserCardButton(existingCard);
            }
        },

        injectUserCardButton(userCard) {
            // 避免重复注入
            if (userCard.querySelector('.ld-usercard-reaction-btn')) return;

            const controlsList = userCard.querySelector('.usercard-controls');
            if (!controlsList) return;

            // 获取用户名
            const usernameEl = userCard.querySelector('.names__secondary.username');
            if (!usernameEl) return;
            const username = usernameEl.textContent.trim();

            // 创建按钮容器
            const btnContainer = createEl('li', { className: 'ld-usercard-reaction-btn' });

            // 创建按钮
            const btn = createEl('button', {
                className: 'btn btn-icon-text btn-default',
                title: '快捷点赞该用户的最近帖子',
                innerHTML: `
                    <svg class="fa d-icon d-icon-heart svg-icon svg-string" xmlns="http://www.w3.org/2000/svg"><use href="#heart"></use></svg>
                    <span class="d-button-label">快捷点赞</span>
                `
            });

            // 绑定点击事件
            btn.onclick = async (e) => {
                e.preventDefault();
                await this.quickReactionFromUserCard(username, btn);
            };

            btnContainer.appendChild(btn);
            controlsList.appendChild(btnContainer);
        },

        async quickReactionFromUserCard(username, btn) {
            const originalHTML = btn.innerHTML;
            const defaultCount = 10; // 默认点赞数量

            try {
                // 更新按钮状态
                btn.disabled = true;
                btn.innerHTML = `
                    <svg class="fa d-icon d-icon-spinner svg-icon svg-string" xmlns="http://www.w3.org/2000/svg"><use href="#spinner"></use></svg>
                    <span class="d-button-label">获取中...</span>
                `;

                // 获取用户的帖子
                const posts = await this.fetchUserActions(username, defaultCount);

                if (posts.length === 0) {
                    alert(`未找到用户 ${username} 的帖子`);
                    btn.disabled = false;
                    btn.innerHTML = originalHTML;
                    return;
                }

                // 确认操作
                const reactionId = this.getSelectedReaction();
                const reactionName = this.REACTIONS.find(r => r.id === reactionId)?.name || reactionId;

                if (!confirm(`确定要给 ${username} 的 ${posts.length} 个最近帖子发送 "${reactionName}" 吗？`)) {
                    btn.disabled = false;
                    btn.innerHTML = originalHTML;
                    return;
                }

                // 批量发送
                let successCount = 0;
                for (let i = 0; i < posts.length; i++) {
                    const post = posts[i];

                    // 更新进度
                    btn.innerHTML = `
                        <svg class="fa d-icon d-icon-heart svg-icon svg-string" xmlns="http://www.w3.org/2000/svg"><use href="#heart"></use></svg>
                        <span class="d-button-label">${i + 1}/${posts.length}</span>
                    `;

                    const result = await this.sendReactionToPost(post.id, i + 1, posts.length, 'all');

                    if (result === true) {
                        successCount++;
                    }

                    if (result === 'rate_limit') {
                        await sleep(5000);
                    } else {
                        await sleep(this.DELAY_MS_USER);
                    }
                }

                // 完成
                btn.innerHTML = `
                    <svg class="fa d-icon d-icon-check svg-icon svg-string" xmlns="http://www.w3.org/2000/svg"><use href="#check"></use></svg>
                    <span class="d-button-label">完成 (${successCount}/${posts.length})</span>
                `;

                setTimeout(() => {
                    btn.disabled = false;
                    btn.innerHTML = originalHTML;
                }, 3000);

            } catch (err) {
                console.error('快捷点赞失败', err);
                alert(`操作失败：${err.message}`);
                btn.disabled = false;
                btn.innerHTML = originalHTML;
            }
        }
    }

    ReactionHelper.init();

    // ==================== 模块 3: 点赞计数器 ====================
    const LikeCounter = {
        CONFIG: {
            HOST: window.location.origin,
            SYNC_INTERVAL: 30 * 60 * 1000,
            STORAGE_KEY: 'linuxdo_likes_history',
            LIMITS: { 0: 50, 1: 50, 2: 75, 3: 100, 4: 150 },
            MAX_STORED_ITEMS: 500
        },

        state: { timestamps: [], cooldownUntil: 0, lastSync: 0, matched: false },
        currentUser: null,
        uiUpdateTimer: null,
        cooldownTicker: null,

        // localStorage 替代 GM_getValue/GM_setValue
        loadState() {
            const stored = localStorage.getItem(this.CONFIG.STORAGE_KEY) || "{}";
            try {
                const parsed = JSON.parse(stored);
                this.state = { ...this.state, ...parsed };
                if (this.state.timestamps.length > this.CONFIG.MAX_STORED_ITEMS) {
                    this.state.timestamps = this.state.timestamps.slice(0, this.CONFIG.MAX_STORED_ITEMS);
                }
            } catch (e) {
                this.state = { timestamps: [], cooldownUntil: 0, lastSync: 0, matched: false };
            }
            this.cleanOldEntries();
        },

        saveState() {
            localStorage.setItem(this.CONFIG.STORAGE_KEY, JSON.stringify(this.state));
        },

        cleanOldEntries() {
            const now = Date.now();
            const cutoff = now - 24 * 60 * 60 * 1000;
            this.state.timestamps = this.state.timestamps.filter(ts => ts > cutoff);
            this.state.timestamps.sort((a, b) => b - a);

            if (this.state.cooldownUntil < now) {
                if (this.state.cooldownUntil > 0) {
                    const expectedBase = this.state.cooldownUntil - (24 * 60 * 60 * 1000);
                    const beforeCount = this.state.timestamps.length;
                    this.state.timestamps = this.state.timestamps.filter(ts => ts < expectedBase || ts >= expectedBase + 5000);
                    if (this.state.timestamps.length < beforeCount) {
                        this.checkAndUpdateMismatch();
                    }
                }
                this.state.cooldownUntil = 0;
            }
        },

        checkAndUpdateMismatch() {
            const limit = (this.currentUser && this.CONFIG.LIMITS[this.currentUser.trust_level]) || 50;
            const count = this.state.timestamps.length;
            this.state.matched = (count >= limit) || (count === 0 && this.state.lastSync === 0);
        },

        processToggleResponse(url, data) {
            this.loadState();
            const now = Date.now();

            if (data.errors && data.error_type === "rate_limit") {
                let waitSeconds = data.extras?.wait_seconds || 0;
                if (waitSeconds) this.state.cooldownUntil = now + (waitSeconds * 1000);

                let limit = (this.currentUser && this.CONFIG.LIMITS[this.currentUser.trust_level]) || 50;
                const currentCount = this.state.timestamps.length;

                this.state.matched = (currentCount >= limit);

                if (currentCount < limit && waitSeconds > 0) {
                    const needed = limit - currentCount;
                    const placeholderBaseTime = (now + waitSeconds * 1000) - (24 * 60 * 60 * 1000);
                    const safeNeeded = Math.min(needed, 200);
                    for (let i = 0; i < safeNeeded; i++) {
                        this.state.timestamps.push(placeholderBaseTime + i);
                    }
                    this.state.timestamps.sort((a, b) => b - a);
                }

            } else if (data.id || data.resource_post_id) {
                const isLike = !!data.current_user_reaction;
                if (isLike) {
                    this.state.timestamps.push(now);
                } else {
                    if (this.state.timestamps.length > 0) this.state.timestamps.shift();
                    if (this.state.cooldownUntil > now) this.state.cooldownUntil = 0;
                }
            }

            this.saveState();
            this.requestUiUpdate(true);
        },

        installInterceptors() {
            const self = this;
            const originalFetch = window.fetch;
            window.fetch = async function(...args) {
                let url = (typeof args[0] === "string") ? args[0] : (args[0]?.url || "");
                const response = await originalFetch.apply(this, args);
                if (url && (url.includes("/toggle.json") || url.includes("/custom-reactions/"))) {
                    response.clone().json().then(data => self.processToggleResponse(url, data)).catch(() => {});
                }
                return response;
            };

            const originalOpen = window.XMLHttpRequest.prototype.open;
            window.XMLHttpRequest.prototype.open = function(method, url) {
                this._interceptUrl = url;
                return originalOpen.apply(this, arguments);
            };

            const originalSend = window.XMLHttpRequest.prototype.send;
            window.XMLHttpRequest.prototype.send = function() {
                const url = this._interceptUrl;
                if (url && (url.includes("/toggle.json") || url.includes("/custom-reactions/"))) {
                    this.addEventListener('load', function() {
                        try { self.processToggleResponse(url, JSON.parse(this.responseText)); } catch (e) {}
                    });
                }
                return originalSend.apply(this, arguments);
            };
        },

        requestUiUpdate(immediate = false) {
            if (immediate) {
                if (this.uiUpdateTimer) cancelAnimationFrame(this.uiUpdateTimer);
                this.updateUI();
                this.uiUpdateTimer = null;
            } else {
                if (this.uiUpdateTimer) return;
                this.uiUpdateTimer = requestAnimationFrame(() => {
                    this.updateUI();
                    this.uiUpdateTimer = null;
                });
            }
        },

        updateUI() {
            const picker = document.querySelector('.discourse-reactions-picker');

            if (this.cooldownTicker) {
                clearTimeout(this.cooldownTicker);
                this.cooldownTicker = null;
            }

            if (!picker) return;

            this.cleanOldEntries();
            const count = this.state.timestamps.length;
            const now = Date.now();
            const isCooldown = this.state.cooldownUntil > now;
            const dailyLimit = (this.currentUser && this.CONFIG.LIMITS[this.currentUser.trust_level]) || 50;

            let statusClass = "bg-ok";
            if (isCooldown) {
                statusClass = "bg-cooldown";
            } else if (!this.state.matched) {
                statusClass = "bg-mismatch";
            }

            const finalClassName = `ld-picker-counter ${statusClass}`;

            let displayText = "";
            if (isCooldown) {
                const diff = Math.max(0, this.state.cooldownUntil - now);
                const h = Math.floor(diff / 3600000);
                const m = Math.floor((diff % 3600000) / 60000);
                const s = Math.floor((diff % 60000) / 1000);
                displayText = `冷却：${h > 0 ? `${h}h ${String(m).padStart(2,'0')}m` : `${String(m).padStart(2,'0')}m ${String(s).padStart(2,'0')}s`}`;
            } else {
                displayText = `剩余：${dailyLimit - count} / ${dailyLimit}`;
            }

            let counter = picker.querySelector('.ld-picker-counter');
            if (!counter) {
                counter = document.createElement('div');
                counter.className = finalClassName;
                picker.insertBefore(counter, picker.firstChild);
            } else if (counter.className !== finalClassName) {
                counter.className = finalClassName;
            }

            let wrapper = counter.querySelector('.ld-content-wrapper');
            if (!wrapper) {
                wrapper = document.createElement('div');
                wrapper.className = 'ld-content-wrapper';
                counter.appendChild(wrapper);
            }

            let tooltipSpan = wrapper.querySelector('.ld-mismatch-tooltip');
            const shouldShowTooltip = !this.state.matched && !isCooldown;

            if (shouldShowTooltip) {
                if (!tooltipSpan) {
                    tooltipSpan = document.createElement('span');
                    tooltipSpan.className = 'ld-mismatch-tooltip';
                    tooltipSpan.dataset.tooltip = "计数可能不准确";
                    tooltipSpan.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zm0-384c13.3 0 24 10.7 24 24V264c0 13.3-10.7 24-24 24s-24-10.7-24-24V152c0-13.3 10.7-24 24-24zM224 352a32 32 0 1 1 64 0 32 32 0 1 1 -64 0z"/></svg>';
                    tooltipSpan.onclick = (e) => { e.preventDefault(); this.syncRemote(); };
                    wrapper.prepend(tooltipSpan);
                }
                if (wrapper.firstChild !== tooltipSpan) {
                    wrapper.insertBefore(tooltipSpan, wrapper.firstChild);
                }
            } else if (tooltipSpan) {
                tooltipSpan.remove();
            }

            let textSpan = wrapper.querySelector('.ld-text-span');
            if (!textSpan) {
                textSpan = document.createElement('span');
                textSpan.className = 'ld-text-span';
                wrapper.appendChild(textSpan);
            }

            if (textSpan.textContent !== displayText) {
                textSpan.textContent = displayText;
            }

            if (isCooldown) {
                const diff = this.state.cooldownUntil - Date.now();
                const h = Math.floor(diff / 3600000);
                this.cooldownTicker = setTimeout(() => this.requestUiUpdate(true), h === 0 ? 1000 : 30 * 1000);
            }
        },

        async fetchUserActions(username) {
            let offset = 0, limit = 50, allItems = [], keepFetching = true, pages = 0;
            const cutoff = Date.now() - 24 * 60 * 60 * 1000;

            while (keepFetching && pages < 5) {
                try {
                    const url = `${this.CONFIG.HOST}/user_actions.json?limit=${limit}&username=${username}&filter=1&offset=${offset}`;
                    const res = await fetch(url).then(r => r.json());
                    const items = res.user_actions || [];
                    if (!items.length) break;

                    let hasOld = false;
                    for (const item of items) {
                        const t = new Date(item.created_at).getTime();
                        if (t > cutoff) allItems.push({ post_id: item.post_id, timestamp: t });
                        else hasOld = true;
                    }
                    if (hasOld || items.length < limit) keepFetching = false;
                    offset += limit;
                    pages++;
                } catch (e) { keepFetching = false; }
            }
            return allItems;
        },

        async fetchReactions(username) {
            let beforeId = null, allItems = [], keepFetching = true, pages = 0;
            const cutoff = Date.now() - 24 * 60 * 60 * 1000;

            while (keepFetching && pages < 10) {
                try {
                    let url = `${this.CONFIG.HOST}/discourse-reactions/posts/reactions.json?username=${username}`;
                    if (beforeId) url += `&before_reaction_user_id=${beforeId}`;

                    const items = await fetch(url).then(r => r.json());
                    if (!Array.isArray(items) || !items.length) break;

                    let hasOld = false;
                    for (const item of items) {
                        const t = new Date(item.created_at).getTime();
                        if (t > cutoff) allItems.push({ post_id: item.post_id, timestamp: t });
                        else hasOld = true;
                    }
                    beforeId = items[items.length - 1].id;
                    if (hasOld || items.length < 20) keepFetching = false;
                    pages++;
                } catch (e) { keepFetching = false; }
            }
            return allItems;
        },

        async syncRemote() {
            if (!this.currentUser) {
                try { this.currentUser = require("discourse/models/user").default.current(); } catch(e) {}
                if(!this.currentUser) return;
            }
            const savedCooldown = this.state.cooldownUntil;
            const savedMatched = this.state.matched;
            this.cleanOldEntries();
            const username = this.currentUser.username;

            try {
                const [likes, reactions] = await Promise.all([this.fetchUserActions(username), this.fetchReactions(username)]);
                const combined = [...likes, ...reactions];
                const postMap = new Map();
                for (const item of combined) {
                    if (!postMap.has(item.post_id) || postMap.get(item.post_id) < item.timestamp) {
                        postMap.set(item.post_id, item.timestamp);
                    }
                }
                const dedupedTimestamps = Array.from(postMap.values());
                const maxRemote = Math.max(...dedupedTimestamps, 0);

                const localNewer = this.state.timestamps.filter(ts => ts > maxRemote + 2000);
                let placeholders = [];
                if (savedCooldown > Date.now()) {
                    const expectedBase = savedCooldown - (24*60*60*1000);
                    placeholders = this.state.timestamps.filter(ts => ts >= expectedBase && ts < expectedBase + 5000);
                }

                this.state.timestamps = Array.from(new Set([...dedupedTimestamps, ...localNewer, ...placeholders]));
                this.state.lastSync = Date.now();

                const limit = this.CONFIG.LIMITS[this.currentUser.trust_level] || 50;
                const apiCount = dedupedTimestamps.length;
                if (savedMatched) {
                    this.state.matched = (apiCount <= limit);
                } else {
                    this.state.matched = (apiCount === limit);
                }
                if (savedCooldown > Date.now()) {
                    this.state.cooldownUntil = savedCooldown;
                }

                this.cleanOldEntries();
                if (this.state.timestamps.length >= limit && this.state.cooldownUntil === 0) {
                    const oldestTs = Math.min(...this.state.timestamps);
                    const estimatedCooldown = oldestTs + 24 * 60 * 60 * 1000;
                    if (estimatedCooldown > Date.now()) {
                        this.state.cooldownUntil = estimatedCooldown;
                    }
                }

                this.saveState();
                this.requestUiUpdate(true);
            } catch (e) { console.error("[LikeCounter] Sync failed", e); }
        },

        init() {
            this.installInterceptors();
            this.loadState();

            let observerTimer = null;
            const observer = new MutationObserver((mutations) => {
                let reactionPickerFound = false;
                for (const m of mutations) {
                    if (m.addedNodes.length) {
                        for (const node of m.addedNodes) {
                            if (node.nodeType === 1 && (node.classList.contains('discourse-reactions-picker') || node.querySelector('.discourse-reactions-picker'))) {
                                reactionPickerFound = true;
                                break;
                            }
                        }
                    }
                    if (reactionPickerFound) break;
                }

                if (reactionPickerFound) {
                    if (observerTimer) clearTimeout(observerTimer);
                    this.requestUiUpdate(true);
                } else {
                    if (observerTimer) return;
                    observerTimer = setTimeout(() => {
                        const picker = document.querySelector('.discourse-reactions-picker');
                        if (picker) this.requestUiUpdate();
                        observerTimer = null;
                    }, 300);
                }
            });

            window.addEventListener('load', () => {
                try { this.currentUser = require("discourse/models/user").default.current(); } catch (e) {}
                setTimeout(() => this.syncRemote(), 3000);
                setInterval(() => this.syncRemote(), this.CONFIG.SYNC_INTERVAL);
                observer.observe(document.body, { childList: true, subtree: true });
            });
        }
    }

    // 只在 linux.do 启用点赞计数器
    if (window.location.hostname === 'linux.do') {
        LikeCounter.init();
    }

})();
