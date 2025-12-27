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
            const replyToPostNumber = model.replyToPostNumber

            if (!raw || !raw.trim()) {
                alert('请输入回复内容')
                return
            }
            if (!topicId) {
                alert('无法获取话题 ID')
                return
            }

            const secStr = prompt('请输入倒计时秒数：', '10')
            if (!secStr) return
            const seconds = parseInt(secStr, 10)
            if (isNaN(seconds) || seconds <= 0) {
                alert('无效的秒数')
                return
            }

            addTimer(topicId, raw, seconds, replyToPostNumber)

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
