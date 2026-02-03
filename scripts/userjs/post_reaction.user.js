// ==UserScript==
// @name         Linux.do 全员表情 (Distorted Face)
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  给 Linux.do 帖子下的所有楼层发送指定表情 (默认为 distorted_face 🤯)
// @author       You
// @match        https://linux.do/*
// @icon         https://linux.do/images/emoji/twemoji/distorted_face.png?v=15
// @grant        none
// ==/UserScript==

;(function () {
  'use strict'

  // ================= 配置区域 =================
  const REACTION_ID = 'distorted_face' // 表情 ID，如需改为点赞可尝试 'heart' 或 '+1'
  const DELAY_MS = 1500 // 每次请求间隔毫秒数（建议不低于 1000ms，以免触发 429 限流）
  // ===========================================

  // 创建悬浮按钮
  const btn = document.createElement('button')
  btn.innerHTML = 'distorted 所有人'
  btn.style.cssText = `
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
    `
  document.body.appendChild(btn)

  // 获取 CSRF Token (Discourse 必须头部)
  function getCsrfToken() {
    const meta = document.querySelector('meta[name="csrf-token"]')
    return meta ? meta.content : ''
  }

  // 获取当前帖子的所有 Post ID
  async function getPostIds() {
    // 从 URL 获取 Topic ID
    // 格式通常为 https://linux.do/t/topic-slug/12345
    const match = window.location.pathname.match(/\/t\/[^\/]+\/(\d+)/)
    if (!match) {
      alert('无法获取帖子 ID，请确认要在帖子详情页使用')
      return null
    }
    const topicId = match[1]

    try {
      // 获取帖子 JSON 数据
      const response = await fetch(`/t/topic/${topicId}.json`)
      if (!response.ok) throw new Error('网络请求失败')
      const data = await response.json()

      // post_stream.stream 包含了该帖子下所有的 post_id (即使未渲染出来的也在里面)
      if (data.post_stream && data.post_stream.stream) {
        return data.post_stream.stream
      } else {
        alert('未找到楼层数据')
        return []
      }
    } catch (e) {
      console.error(e)
      alert('获取楼层列表失败，详情请看控制台')
      return []
    }
  }

  // 发送表情请求
  async function sendReaction(postId, current, total) {
    const url = `https://linux.do/discourse-reactions/posts/${postId}/custom-reactions/${REACTION_ID}/toggle.json`

    try {
      const res = await fetch(url, {
        method: 'PUT',
        headers: {
          Accept: '*/*',
          'Content-Length': '0', // 模仿 curl
          'Discourse-Logged-In': 'true',
          'X-Csrf-Token': getCsrfToken(),
          'X-Requested-With': 'XMLHttpRequest',
          'Content-Type': 'application/json'
        }
      })

      // 更新按钮状态
      btn.innerHTML = `处理中：${current}/${total}`

      if (res.status === 429) {
        console.warn(`楼层 ${postId} 触发限流，将暂停更长时间...`)
        return false // 触发限流
      }
      return true
    } catch (e) {
      console.error(`楼层 ${postId} 请求出错`, e)
      return false
    }
  }

  // 延迟函数
  const sleep = ms => new Promise(r => setTimeout(r, ms))

  // 点击事件处理
  btn.onclick = async function () {
    if (
      confirm(
        `确定要给当前帖子下的所有楼层发送 "${REACTION_ID}" 表情吗？\n注意：此接口为 toggle (切换)，如果已点过则会取消。`
      )
    ) {
      btn.disabled = true
      btn.style.backgroundColor = '#95a5a6'

      const postIds = await getPostIds()
      if (!postIds || postIds.length === 0) {
        btn.disabled = false
        btn.innerHTML = '🤯 全员表情'
        return
      }

      console.log(`共获取到 ${postIds.length} 个楼层，开始处理...`)

      for (let i = 0; i < postIds.length; i++) {
        const pid = postIds[i]
        const success = await sendReaction(pid, i + 1, postIds.length)

        // 如果成功，按照 DELAY_MS 等待；如果触发 429，等待 5秒
        if (success) {
          await sleep(DELAY_MS)
        } else {
          await sleep(5000)
        }
      }

      btn.innerHTML = '✅ 完成'
      btn.style.backgroundColor = '#2ecc71'
      setTimeout(() => {
        btn.disabled = false
        btn.innerHTML = '🤯 全员表情'
        btn.style.backgroundColor = '#e74c3c'
      }, 3000)
    }
  }
})()
