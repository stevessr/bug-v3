import { Type } from '@mariozechner/pi-ai'

import type { AgentPlugin } from '../index'

import { pageInfoPlugin } from './pageInfo'
import { clipboardPlugin } from './clipboard'
import { quickEmojiAddPlugin } from './quickEmojiAdd'
import { deepResearchPlugin } from './deepResearch'
import { codeExplainerPlugin } from './codeExplainer'

/**
 * 内置插件清单。新增插件时在此 append 即可。
 *
 * 顺序仅影响 UI 列表展示顺序，runtime 行为不依赖。
 */
export const BUILTIN_PLUGINS: readonly AgentPlugin[] = [
  pageInfoPlugin,
  clipboardPlugin,
  quickEmojiAddPlugin,
  deepResearchPlugin,
  codeExplainerPlugin
]

export function getBuiltinPluginById(id: string): AgentPlugin | undefined {
  return BUILTIN_PLUGINS.find(plugin => plugin.id === id)
}

/** 共用：构造无 schema 校验的简单参数定义 */
export const looseRecordSchema = () => Type.Unsafe<Record<string, unknown>>({ type: 'object' })
