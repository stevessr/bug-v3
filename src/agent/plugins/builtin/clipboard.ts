import { Type } from '@mariozechner/pi-ai'

import type { AgentPlugin } from '../index'

type ClipboardParams = {
  action: 'read' | 'write'
  text?: string
}

/**
 * clipboard 插件
 *
 * 通过 navigator.clipboard 提供剪贴板访问能力。
 * read：读取剪贴板纯文本；write：把指定文本写入剪贴板。
 * 默认关闭：浏览器扩展只在用户主动开启后才让 agent 访问剪贴板。
 */
export const clipboardPlugin: AgentPlugin = {
  id: 'clipboard',
  name: '剪贴板访问',
  description: '允许代理读取与写入系统剪贴板。仅在你启用时生效。',
  defaultEnabled: false,
  checkAvailability: () => {
    const hasClipboard = typeof navigator !== 'undefined' && Boolean(navigator.clipboard?.writeText)
    return hasClipboard
      ? {
          level: 'available',
          summary: 'navigator.clipboard 可用',
          details: [{ label: 'navigator.clipboard', state: 'available' }]
        }
      : {
          level: 'unavailable',
          summary: '当前上下文无 navigator.clipboard',
          details: [
            {
              label: 'navigator.clipboard',
              state: 'unavailable',
              hint: '非安全上下文或被浏览器策略禁用'
            }
          ]
        }
  },
  systemPrompt: () =>
    [
      '插件 clipboard 提供 `plugin_clipboard` tool。',
      '当用户要求复制 / 粘贴 / 拷贝某段内容时，可直接调用此 tool。',
      "调用格式：{ action: 'read' } 或 { action: 'write', text: '...' }。",
      '剪贴板属于用户的隐私资源，仅在用户明确意图时使用，避免静默读取。'
    ].join('\n'),
  buildTools: () => {
    return [
      {
        name: 'plugin_clipboard',
        label: '剪贴板',
        description: '读取或写入系统剪贴板。action=read|write，write 时需要 text。',
        parameters: Type.Unsafe<ClipboardParams>({
          type: 'object',
          required: ['action'],
          properties: {
            action: { type: 'string', enum: ['read', 'write'] },
            text: { type: 'string' }
          }
        }),
        execute: async (_toolCallId: string, params: unknown) => {
          if (typeof navigator === 'undefined' || !navigator.clipboard) {
            throw new Error('当前上下文不支持 navigator.clipboard')
          }
          const args = (params || {}) as ClipboardParams
          if (args.action === 'read') {
            const text = await navigator.clipboard.readText()
            return {
              content: [{ type: 'text' as const, text }],
              details: { kind: 'plugin:clipboard', action: 'read', length: text.length }
            }
          }
          if (args.action === 'write') {
            const text = args.text ?? ''
            await navigator.clipboard.writeText(text)
            return {
              content: [
                {
                  type: 'text' as const,
                  text: `已写入剪贴板，长度 ${text.length} 字符。`
                }
              ],
              details: { kind: 'plugin:clipboard', action: 'write', length: text.length }
            }
          }
          throw new Error(`未知 action: ${(args as any).action}`)
        }
      }
    ]
  }
}
