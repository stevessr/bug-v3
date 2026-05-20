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

/**
 * 单项能力 / 子 API 的运行时状态。
 * - available：已就绪可直接调用
 * - downloadable / downloading：浏览器内置模型需要先下载
 * - unavailable：当前环境无法使用（缺少 API / 标志位未开启 / 权限被拒）
 * - unknown：尚未探测或探测失败
 */
export type PluginCapabilityState =
  | 'available'
  | 'downloadable'
  | 'downloading'
  | 'unavailable'
  | 'unknown'

export interface PluginCapabilityDetail {
  /** 给用户看的能力名 */
  label: string
  state: PluginCapabilityState
  /** 状态不为 available 时的简短解释 */
  hint?: string
}

/**
 * 插件整体可用性汇总。UI 用这个判断徽章颜色与提示文案。
 * - available：所有子能力均可用
 * - partial：部分子能力可用
 * - unavailable：完全不可用
 * - unknown：未提供 checkAvailability 或探测失败
 */
export type PluginAvailabilityLevel = 'available' | 'partial' | 'unavailable' | 'unknown'

export interface PluginAvailabilityResult {
  level: PluginAvailabilityLevel
  /** 一句话总结，例如 "Chrome 内核 · 5/5 就绪" */
  summary: string
  /** 可选：拆分到子 API / 子能力的明细，用于 Popover 展开 */
  details?: PluginCapabilityDetail[]
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
  /**
   * 可选的运行时可用性探测。仅在设置页主动调用，用于在 UI 上展示
   * 插件能力是否真的可用（特别是依赖浏览器原生 API 的插件，例如内置 AI）。
   */
  checkAvailability?: () => Promise<PluginAvailabilityResult> | PluginAvailabilityResult
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
