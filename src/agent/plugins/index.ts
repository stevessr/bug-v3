/**
 * Pi Agent 可选插件
 *
 * 插件 = 一段可被启用 / 禁用的能力：可附加 system prompt 片段、注册额外的
 * pi-agent tools，或两者结合。所有内置插件在 `builtinPlugins.ts` 中实现，
 * 通过 `getEnabledPlugins(settings)` 在 runtime 中获取。
 */

import type { AgentTool } from '@mariozechner/pi-agent-core'

import type { AgentSettings, SubAgentConfig } from '../types'

import { BUILTIN_PLUGINS, getBuiltinPluginById } from './builtin'

export interface PluginRuntimeContext {
  settings: AgentSettings
  subagent?: SubAgentConfig
  tab?: {
    id?: number
    title?: string
    url?: string
  }
}

export interface AgentPlugin {
  /** 全局唯一 id，用于持久化用户启用列表 */
  id: string
  /** 展示名 */
  name: string
  /** 一句话描述，给用户看 */
  description: string
  /** 默认是否启用（新安装 / 用户未调整时） */
  defaultEnabled: boolean
  /**
   * 可选的 system prompt 片段，会被追加到主 system prompt 之后。
   * 接收当前 runtime 上下文，便于按 tab/subagent 做调整。
   * 返回空字符串等价于不追加。
   */
  systemPrompt?: (ctx: PluginRuntimeContext) => string
  /**
   * 可选的 tool 列表构造器。返回 pi-agent tool，会被合并进 runtime。
   * 异步以便插件按需从 chrome.* / network 拉资源。
   */
  buildTools?: (ctx: PluginRuntimeContext) => Promise<AgentTool<any, any>[]> | AgentTool<any, any>[]
}

/** 内置插件总表（导出供 UI 使用） */
export const BUILTIN_AGENT_PLUGINS: readonly AgentPlugin[] = BUILTIN_PLUGINS

/** 根据 settings.enabledPluginIds 判断某插件是否启用（含默认值） */
export function isPluginEnabled(settings: AgentSettings, plugin: AgentPlugin): boolean {
  const list = settings.enabledPluginIds
  if (Array.isArray(list)) {
    return list.includes(plugin.id)
  }
  // 用户未设置时退回到默认
  return plugin.defaultEnabled
}

/** 解析当前启用的内置插件列表 */
export function getEnabledPlugins(settings: AgentSettings): AgentPlugin[] {
  return BUILTIN_AGENT_PLUGINS.filter(plugin => isPluginEnabled(settings, plugin))
}

/** 把启用插件的 system prompt 片段拼接成一个块（无内容返回空串） */
export function buildPluginSystemPromptSection(ctx: PluginRuntimeContext): string {
  const sections: string[] = []
  for (const plugin of getEnabledPlugins(ctx.settings)) {
    const text = plugin.systemPrompt?.(ctx)?.trim()
    if (text) {
      sections.push(`### Plugin: ${plugin.name}\n${text}`)
    }
  }
  if (!sections.length) return ''
  return ['## Enabled Plugins', ...sections].join('\n\n')
}

/** 收集启用插件提供的 tool */
export async function collectPluginTools(
  ctx: PluginRuntimeContext
): Promise<AgentTool<any, any>[]> {
  const tools: AgentTool<any, any>[] = []
  for (const plugin of getEnabledPlugins(ctx.settings)) {
    if (!plugin.buildTools) continue
    try {
      const produced = await plugin.buildTools(ctx)
      tools.push(...produced)
    } catch (err) {
      console.warn(`[Pi Plugin] ${plugin.id} buildTools failed:`, err)
    }
  }
  return tools
}

/** UI 友好工具：按 id 获取插件 */
export function findPluginById(id: string): AgentPlugin | undefined {
  return getBuiltinPluginById(id)
}

/** 计算默认开启的插件 id 列表（用于首次初始化 settings） */
export function defaultEnabledPluginIds(): string[] {
  return BUILTIN_AGENT_PLUGINS.filter(p => p.defaultEnabled).map(p => p.id)
}
