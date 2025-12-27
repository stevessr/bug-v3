// ==UserScript==
// @name         Discourse 官方回复框定时发送按钮
// @namespace    https://github.com/stevessr/bug-v3
// @version      1.0.0
// @description  在 Discourse 官方回复按钮旁边添加定时发送功能
// @author       stevessr
// @match        https://linux.do/*
// @match        https://meta.discourse.org/*
// @match        https://*.discourse.org/*
// @match        http://localhost:5173/*
// @exclude      https://linux.do/a/*
// @match        https://idcflare.com/*
// @grant        none
// @license      MIT
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    // Utility: Create Element
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

    // Styles
    const STYLES = `
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

    /* Picker Modal */
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
    `
    const styleEl = document.createElement('style')
    styleEl.textContent = STYLES
    document.head.appendChild(styleEl)

    let timerContainer = null
    const timers = new Map()

    function getTimerContainer() {
        if (!timerContainer) {
            timerContainer = createEl('div', { className: 'timer-container' })
            document.body.appendChild(timerContainer)
        }
        return timerContainer
    }

    function showTimePicker(onConfirm) {
        const overlay = createEl('div', { className: 'timer-picker-overlay' })
        const modal = createEl('div', { className: 'timer-picker-modal' })

        // Tabs
        const tabs = createEl('div', { className: 'timer-picker-tabs' })
        const tabCountdown = createEl('div', { className: 'timer-picker-tab active', text: '倒计时' })
        const tabSchedule = createEl('div', { className: 'timer-picker-tab', text: '定时发送' })
        tabs.append(tabCountdown, tabSchedule)

        // Content Container
        const content = createEl('div', { className: 'timer-picker-content' })

        // Countdown View
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

        // Schedule View (Hidden by default)
        const viewSchedule = createEl('div', { className: 'timer-view-schedule', style: 'display:none' })
        const now = new Date()
        now.setMinutes(now.getMinutes() + 5) // Default 5 mins later
        const defaultStr = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().slice(0, 16)
        viewSchedule.innerHTML = `
            <div class="timer-field-group">
                <span class="timer-label">时间:</span>
                <input type="datetime-local" class="timer-input inp-datetime" value="${defaultStr}">
            </div>
            <div style="font-size:12px;color:#999;margin-top:4px">请选择将来的时间</div>
        `

        content.append(viewCountdown, viewSchedule)

        // Tab Switching
        tabCountdown.onclick = () => {
            tabCountdown.classList.add('active'); tabSchedule.classList.remove('active')
            viewCountdown.style.display = 'block'; viewSchedule.style.display = 'none'
        }
        tabSchedule.onclick = () => {
            tabSchedule.classList.add('active'); tabCountdown.classList.remove('active')
            viewSchedule.style.display = 'block'; viewCountdown.style.display = 'none'
        }

        // Actions
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
    }

    // Logic: Add Timer
    function addTimer(topicId, raw, seconds, replyToPostNumber) {
        const container = getTimerContainer()
        const timerId = Date.now() + Math.random().toString()

        const replyInfo = replyToPostNumber ? `(回复 #${replyToPostNumber})` : ''

        const el = createEl('div', {
            className: 'timer-item',
            innerHTML: `
                <div style="font-weight:bold;margin-bottom:4px">Topic #${topicId} 定时回复 ${replyInfo}</div>
                <div class="timer-status">等待中：<span class="countdown">${seconds}</span>s</div>
                <div class="timer-content" style="font-size:12px;opacity:0.8;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:200px">${raw}</div>
            `
        })
        container.appendChild(el)

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
                    fd.append('topic_id', topicId)
                    fd.append('archetype', 'regular')
                    fd.append('nested_post', 'true')
                    if (replyToPostNumber) {
                        fd.append('reply_to_post_number', replyToPostNumber)
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

                    // Success
                    el.classList.add('success')
                    el.innerHTML = `
                        <div style="font-weight:bold">✅ 发送成功</div>
                        <div style="font-size:12px">Topic #${topicId}</div>
                    `
                    setTimeout(() => {
                        el.style.opacity = '0'
                        el.style.transform = 'translateY(20px)'
                        setTimeout(() => el.remove(), 300)
                    }, 3000)

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

        timers.set(timerId, { interval, el })
    }

    // Find internal Discourse controller
    function getComposerModel() {
        try {
            // Discourse 3.x+ usually exposes containers/services differently
            // We can try to find the composer view from the DOM
            // This is a heuristic approach
            // A reliable way is often via `Discourse.__container__` if available, or probing the window.
            // Let's try standard container lookup
            if (window.Discourse && window.Discourse.__container__) {
                const controller = window.Discourse.__container__.lookup('controller:composer')
                if (controller && controller.model) return controller.model
            }

            // Fallback: legacy
            // or we can read from DOM if model access fails (but DOM reading is fragile for hidden fields)
        } catch(e) {
            console.error('Failed to get composer model', e)
        }
        return null
    }

    // Inject Button
    function injectTimerButton() {
        // Target: .save-or-cancel button container usually
        // Specifically look for the reply button: button.create
        // Update: User report shows button is inside .save-or-cancel
        const replyBtn = document.querySelector('.save-or-cancel .create') || document.querySelector('.composer-controls .create');
        if (!replyBtn) {
            console.log('Timer script: Reply button not found yet')
            return
        }
        if (replyBtn.parentNode.querySelector('.timer-btn-wrapper')) return // already injected

        console.log('Timer script: Injecting button...')
        const wrapper = createEl('div', { className: 'timer-btn-wrapper' })

        const btn = createEl('button', {
            className: 'btn btn-icon-text btn-default',
            title: '定时发送',
            innerHTML: `<span class="d-button-label">⏱️</span>`
        })

        btn.onclick = (e) => {
            e.preventDefault()
            const model = getComposerModel()
            if (!model) {
                alert('无法获取编辑器状态，Discourse 版本可能不兼容。')
                return
            }

            const raw = model.reply || model.replyText // standard property for content
            const topicId = model.topic ? model.topic.id : model.topicId
            // Try to get replyToPostNumber correctly from Ember model
            // It might be 'replyToPostNumber' or inside 'action' or 'reply'
            let replyToPostNumber = model.replyToPostNumber
            if (!replyToPostNumber && model.get) {
                replyToPostNumber = model.get('replyToPostNumber')
            }
            // Sometimes it's in model.action ('reply' vs 'replyToPost')
            // If we are replying to a post, we need that ID.

            console.log('Timer script: Model state:', { topicId, replyToPostNumber, raw: raw?.substring(0, 20) })

            if (!raw || !raw.trim()) {
                alert('请输入回复内容')
                return
            }
            if (!topicId) {
                alert('无法获取话题 ID')
                return
            }

            showTimePicker((seconds) => {
                addTimer(topicId, raw, seconds, replyToPostNumber)
            })

            // Optional: Close composer or clear it?
            // Usually scheduled reply means "send later", so we might want to discard the current draft locally?
            // Or just leave it. Let's leave it for now, user can cancel if they want.
            // If we want to simulate "sent", we'd need to close the composer.
            // window.Discourse.__container__.lookup('controller:composer').cancel()
        }

        wrapper.appendChild(btn)

        // Insert after the reply button
        if (replyBtn.nextSibling) {
            replyBtn.parentNode.insertBefore(wrapper, replyBtn.nextSibling)
        } else {
            replyBtn.parentNode.appendChild(wrapper)
        }
    }

    // Observer to detect composer opening
    const observer = new MutationObserver(() => {
        injectTimerButton()
    })

    observer.observe(document.body, { childList: true, subtree: true })

    // Polling fallback (in case MutationObserver misses dynamic updates inside shadow DOM or similar)
    setInterval(injectTimerButton, 1000)

    // Initial check
    injectTimerButton()

})();
