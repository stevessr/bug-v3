import { Type } from '@mariozechner/pi-ai'

import type { AgentPlugin } from '../index'

/**
 * page-info 插件
 *
 * 暴露一个 `plugin_page_info` tool，让 agent 直接拿到当前 tab 的
 * id / title / url，省去通过 browser_actions getDOM 探测的开销。
 */
export const pageInfoPlugin: AgentPlugin = {
  id: 'page-info',
  name: '页面信息',
  description: '允许代理一次性查询当前标签页的 id、标题与 URL，避免反复截图与 DOM 探测。',
  defaultEnabled: true,
  systemPrompt: ({ tab }) =>
    [
      '插件 page-info 提供 `plugin_page_info` tool，返回 { id, title, url }。',
      tab?.url
        ? `当前标签页 URL: ${tab.url}`
        : '当前标签页尚未提供 URL 信息，可调用 plugin_page_info 自助查询。'
    ].join('\n'),
  buildTools: ({ tab }) => {
    return [
      {
        name: 'plugin_page_info',
        label: '页面信息',
        description: '返回当前活动标签页的 id、title 与 url。',
        parameters: Type.Unsafe<Record<string, unknown>>({ type: 'object' }),
        execute: async () => {
          const payload = {
            id: tab?.id ?? null,
            title: tab?.title ?? null,
            url: tab?.url ?? null
          }
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify(payload)
              }
            ],
            details: { kind: 'plugin:page-info', ...payload }
          }
        }
      }
    ]
  }
}
