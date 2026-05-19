import { Type } from '@mariozechner/pi-ai'

import type { AgentPlugin } from '../index'

type QuickEmojiAddParams = {
  url: string
  name?: string
  groupName?: string
}

/**
 * quick-emoji-add 插件
 *
 * 让 pi agent 可以一步把外网图片加入到当前扩展的表情库。
 * 内部通过 chrome.runtime 把 ADD_EMOJI_FROM_WEB 消息发给 background。
 */
export const quickEmojiAddPlugin: AgentPlugin = {
  id: 'quick-emoji-add',
  name: '快速添加表情',
  description: '让代理把网页图片快速加入当前扩展的表情库（调用扩展自身的添加流程）。',
  defaultEnabled: true,
  systemPrompt: () =>
    [
      '插件 quick-emoji-add 提供 `plugin_quick_emoji_add` tool。',
      '当用户表示"把这张图加进我的表情库"等意图时调用。',
      '参数：url 必填、name 可选、groupName 可选（不传则进默认分组）。',
      '该 tool 不会绕过扩展本身的去重和分组逻辑。'
    ].join('\n'),
  buildTools: () => {
    return [
      {
        name: 'plugin_quick_emoji_add',
        label: '快速添加表情',
        description: '把图片 URL 添加到扩展的表情库；可选指定名称与目标分组名。',
        parameters: Type.Unsafe<QuickEmojiAddParams>({
          type: 'object',
          required: ['url'],
          properties: {
            url: { type: 'string' },
            name: { type: 'string' },
            groupName: { type: 'string' }
          }
        }),
        execute: async (_toolCallId: string, params: unknown) => {
          const args = (params || {}) as QuickEmojiAddParams
          if (!args.url || typeof args.url !== 'string') {
            throw new Error('plugin_quick_emoji_add 缺少必填参数 url')
          }
          const chromeAPI = (globalThis as any).chrome
          if (!chromeAPI?.runtime?.sendMessage) {
            throw new Error('当前运行环境没有 chrome.runtime.sendMessage，无法触发添加流程。')
          }
          const message = {
            type: 'ADD_EMOJI_FROM_WEB' as const,
            payload: {
              emojiData: {
                url: args.url,
                name: args.name,
                targetGroupName: args.groupName
              }
            }
          }
          const result = await new Promise<{ success?: boolean; error?: string; data?: unknown }>(
            (resolve, reject) => {
              try {
                chromeAPI.runtime.sendMessage(message, (response: any) => {
                  const err = chromeAPI.runtime.lastError
                  if (err) reject(new Error(err.message || String(err)))
                  else resolve(response ?? { success: true })
                })
              } catch (e) {
                reject(e)
              }
            }
          )
          if (result && result.success === false) {
            throw new Error(result.error || '添加表情失败')
          }
          return {
            content: [
              {
                type: 'text' as const,
                text: `表情已加入${
                  args.groupName ? `分组「${args.groupName}」` : '默认分组'
                }: ${args.url}`
              }
            ],
            details: {
              kind: 'plugin:quick-emoji-add',
              url: args.url,
              name: args.name,
              groupName: args.groupName,
              raw: result?.data
            }
          }
        }
      }
    ]
  }
}
