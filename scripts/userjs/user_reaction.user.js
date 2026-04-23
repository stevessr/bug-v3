// ==UserScript==
// @name         Linux.do 指定用户历史贴表情助手
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  输入用户名和数量，给指定用户的历史回复/帖子发送表情 (支持预检)
// @author       You
// @match        https://linux.do/*
// @icon         https://cdn3.ldstatic.com/original/4X/f/2/2/f228b317d9c333833ccf3a81fee705024a548963.png
// @grant        none
// ==/UserScript==

;(function () {
  'use strict'

  // ================= 配置区域 =================
  const REACTION_ID = 'distorted_face' // 表情 ID，如 'heart', '+1', 'distorted_face'
  const DELAY_MS = 2000 // 请求间隔 (建议 2 秒以上，防止风控)
  // ===========================================

  let targetPostIds = [] // 存储预检到的 Post 对象
  let isRunning = false

  // --- UI 构建 ---
  const panel = document.createElement('div')
  panel.style.cssText = `
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
    `

  panel.innerHTML = `
        <h3 style="margin:0 0 10px 0; color: #e74c3c; border-bottom: 1px solid #555; padding-bottom: 5px;">🤯 用户表情助手</h3>

        <div style="margin-bottom: 8px;">
            <label>用户名 (Username):</label>
            <input type="text" id="ld-username" placeholder="如：Neo" style="width: 100%; padding: 5px; box-sizing: border-box; margin-top: 4px; border-radius: 4px; border: 1px solid #555; background: #333; color: white;">
        </div>

        <div style="margin-bottom: 8px;">
            <label>数量 (Count):</label>
            <input type="number" id="ld-count" value="10" min="1" max="100" style="width: 100%; padding: 5px; box-sizing: border-box; margin-top: 4px; border-radius: 4px; border: 1px solid #555; background: #333; color: white;">
        </div>

        <div style="display: flex; gap: 10px; margin-top: 15px;">
            <button id="ld-check-btn" style="flex: 1; padding: 6px; background: #3498db; color: white; border: none; border-radius: 4px; cursor: pointer;">🔍 预先检测</button>
            <button id="ld-run-btn" style="flex: 1; padding: 6px; background: #555; color: #aaa; border: none; border-radius: 4px; cursor: not-allowed;" disabled>🚀 开始执行</button>
        </div>

        <div id="ld-log" style="margin-top: 10px; padding: 8px; background: #111; height: 120px; overflow-y: auto; border: 1px solid #333; font-size: 12px; color: #ccc; white-space: pre-wrap;">等待操作...</div>
        <button id="ld-close-btn" style="position: absolute; top: 5px; right: 10px; background: transparent; border: none; color: #888; cursor: pointer;">✕</button>
    `
  document.body.appendChild(panel)

  // --- 辅助函数 ---
  const log = msg => {
    const logBox = document.getElementById('ld-log')
    logBox.innerHTML += `<div>[${new Date().toLocaleTimeString()}] ${msg}</div>`
    logBox.scrollTop = logBox.scrollHeight
  }

  const getCsrfToken = () => {
    const meta = document.querySelector('meta[name="csrf-token"]')
    return meta ? meta.content : ''
  }

  const sleep = ms => new Promise(r => setTimeout(r, ms))

  // --- 核心逻辑：获取用户动作 ---
  async function fetchUserActions(username, count) {
    let results = []
    let offset = 0
    let limit = 30 // 接口默认每次通常返回 30 条

    log(`正在获取 ${username} 的数据...`)

    while (results.length < count) {
      // 构造URL，filter=4,5 通常代表帖子和回复
      const url = `/user_actions.json?offset=${offset}&username=${username}&filter=4,5`

      try {
        const res = await fetch(url)
        if (!res.ok) {
          log(`获取失败: ${res.status}`)
          break
        }
        const data = await res.json()

        if (!data.user_actions || data.user_actions.length === 0) {
          log('没有更多数据了')
          break
        }

        // 提取 post_id
        for (let item of data.user_actions) {
          if (results.length >= count) break

          // 简单的去重检查 (虽然 API 一般不重复返回)
          if (!results.find(r => r.id === item.post_id)) {
            results.push({
              id: item.post_id,
              title: item.title,
              excerpt: item.excerpt ? item.excerpt.substring(0, 30) + '...' : '(无预览)'
            })
          }
        }
        offset += 30
        await sleep(500) // 稍微停顿，防止请求列表过快
      } catch (e) {
        log(`请求出错：${e.message}`)
        break
      }
    }

    return results
  }

  // --- 核心逻辑：发送表情 ---
  async function sendReaction(postId, index, total) {
    const url = `https://linux.do/discourse-reactions/posts/${postId}/custom-reactions/${REACTION_ID}/toggle.json`

    try {
      const res = await fetch(url, {
        method: 'PUT',
        headers: {
          Accept: '*/*',
          'Discourse-Logged-In': 'true',
          'X-Csrf-Token': getCsrfToken(),
          'X-Requested-With': 'XMLHttpRequest',
          'Content-Type': 'application/json'
        }
      })

      if (res.status === 200) {
        log(`✅ (${index}/${total}) ID:${postId} 成功`)
        return true
      } else if (res.status === 429) {
        log(`⚠️ (${index}/${total}) ID:${postId} 频率限制，暂停 5 秒`)
        return 'rate_limit'
      } else {
        log(`❌ (${index}/${total}) ID:${postId} 失败 State:${res.status}`)
        return false
      }
    } catch (e) {
      log(`❌ 请求异常：${e.message}`)
      return false
    }
  }

  // --- 事件监听 ---

  // 1. 预先检测
  document.getElementById('ld-check-btn').onclick = async () => {
    const username = document.getElementById('ld-username').value.trim()
    const count = parseInt(document.getElementById('ld-count').value)

    if (!username) return alert('请输入用户名')

    document.getElementById('ld-log').innerHTML = '' // 清空日志
    targetPostIds = await fetchUserActions(username, count)

    if (targetPostIds.length > 0) {
      log(`------------------`)
      log(`检测完成！共找到 ${targetPostIds.length} 条记录。`)
      log(`示例：[${targetPostIds[0].title}] - ${targetPostIds[0].excerpt}`)
      log(`------------------`)
      log(`请确认无误后点击“执行”`)

      // 激活执行按钮
      const runBtn = document.getElementById('ld-run-btn')
      runBtn.disabled = false
      runBtn.style.backgroundColor = '#e74c3c'
      runBtn.style.color = '#fff'
      runBtn.style.cursor = 'pointer'
    } else {
      log(`未找到该用户的相关数据，请检查用户名是否正确 (区分大小写)。`)
    }
  }

  // 2. 开始执行
  document.getElementById('ld-run-btn').onclick = async () => {
    if (targetPostIds.length === 0) return
    if (isRunning) return

    if (!confirm(`确定要对这 ${targetPostIds.length} 个帖子/回复发送 "${REACTION_ID}" 吗？`)) return

    isRunning = true
    document.getElementById('ld-run-btn').disabled = true
    document.getElementById('ld-check-btn').disabled = true

    log(`🚀 开始批量处理...`)

    for (let i = 0; i < targetPostIds.length; i++) {
      const item = targetPostIds[i]
      const result = await sendReaction(item.id, i + 1, targetPostIds.length)

      if (result === 'rate_limit') {
        await sleep(5000) // 遇到429多停一会
      } else {
        await sleep(DELAY_MS)
      }
    }

    log(`🎉 所有操作已完成！`)
    isRunning = false
    document.getElementById('ld-check-btn').disabled = false
  }

  // 3. 关闭面板
  document.getElementById('ld-close-btn').onclick = () => {
    panel.style.display = 'none'
  }
})()
