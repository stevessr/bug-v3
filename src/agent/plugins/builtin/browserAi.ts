import { Type } from '@mariozechner/pi-ai'

import type { AgentPlugin, PluginAvailabilityResult, PluginCapabilityState } from '../index'

import {
  detectBrowserAiVendor,
  getBrowserAiSnapshot,
  runLanguageModelPrompt,
  runRewriter,
  runSummarizer,
  runTranslator,
  runWriter,
  type AvailabilityState,
  type RewriterFormat,
  type RewriterLength,
  type RewriterTone,
  type SummarizerFormat,
  type SummarizerLength,
  type SummarizerType,
  type WriterFormat,
  type WriterLength,
  type WriterTone
} from '@/agent/browserAi'

type PromptParams = {
  prompt: string
  systemPrompt?: string
  temperature?: number
  topK?: number
  expectedInputLanguages?: string[]
  expectedOutputLanguages?: string[]
}

type SummarizeParams = {
  text: string
  type?: SummarizerType
  format?: SummarizerFormat
  length?: SummarizerLength
  context?: string
  sharedContext?: string
  outputLanguage?: string
  expectedInputLanguages?: string[]
}

type TranslateParams = {
  text: string
  sourceLanguage: string
  targetLanguage: string
}

type WriteParams = {
  task: string
  tone?: WriterTone
  length?: WriterLength
  format?: WriterFormat
  sharedContext?: string
  context?: string
}

type RewriteParams = {
  text: string
  tone?: RewriterTone
  length?: RewriterLength
  format?: RewriterFormat
  sharedContext?: string
  context?: string
}

const VENDOR_LABELS: Record<ReturnType<typeof detectBrowserAiVendor>, string> = {
  edge: 'Edge / Phi-4-mini',
  chrome: 'Chrome / Gemini Nano',
  unknown: '未知 Chromium'
}

const mapAvailability = (state: AvailabilityState): PluginCapabilityState => state

const hintFor = (
  api: 'LanguageModel' | 'Summarizer' | 'Translator' | 'Writer' | 'Rewriter',
  state: AvailabilityState,
  vendor: ReturnType<typeof detectBrowserAiVendor>
): string | undefined => {
  if (state === 'available') return undefined
  if (state === 'downloadable') return '需手动触发模型下载'
  if (state === 'downloading') return '模型正在下载中'
  if (api === 'Translator' && vendor === 'edge') return 'Edge 暂未提供 Translator API'
  if ((api === 'Writer' || api === 'Rewriter') && vendor === 'chrome') {
    return 'Chrome 默认未开启，需在 chrome://flags 启用'
  }
  if (vendor === 'edge') return '需在 edge://flags 启用对应 "API for Phi mini" 开关'
  if (vendor === 'chrome') return '需在 chrome://flags 启用 Built-in AI 并触发模型下载'
  return '当前浏览器不支持该 API'
}

async function checkBrowserAiAvailability(): Promise<PluginAvailabilityResult> {
  try {
    const snapshot = await getBrowserAiSnapshot()
    const apiStates: Array<{
      key: 'languageModel' | 'summarizer' | 'translator' | 'writer' | 'rewriter'
      label: string
      api: 'LanguageModel' | 'Summarizer' | 'Translator' | 'Writer' | 'Rewriter'
    }> = [
      { key: 'languageModel', label: 'LanguageModel', api: 'LanguageModel' },
      { key: 'summarizer', label: 'Summarizer', api: 'Summarizer' },
      { key: 'translator', label: 'Translator', api: 'Translator' },
      { key: 'writer', label: 'Writer', api: 'Writer' },
      { key: 'rewriter', label: 'Rewriter', api: 'Rewriter' }
    ]

    const details = apiStates.map(({ key, label, api }) => {
      const raw = snapshot[key]
      return {
        label,
        state: mapAvailability(raw),
        hint: hintFor(api, raw, snapshot.vendor)
      }
    })

    const availableCount = details.filter(d => d.state === 'available').length
    const total = details.length
    const vendorLabel = VENDOR_LABELS[snapshot.vendor]

    let level: PluginAvailabilityResult['level']
    if (availableCount === total) level = 'available'
    else if (availableCount === 0) level = 'unavailable'
    else level = 'partial'

    return {
      level,
      summary: `${vendorLabel} · ${availableCount}/${total} 就绪`,
      details
    }
  } catch (err) {
    return {
      level: 'unknown',
      summary: `探测失败：${(err as Error)?.message || String(err)}`,
      details: []
    }
  }
}

/**
 * browser-ai 插件
 *
 * 把 Chromium 内核（Chrome 127+ / Edge 138+）的浏览器内置 on-device AI
 * 以 pi-agent tools 形式暴露给 agent。覆盖：
 * - LanguageModel（通用补全，两家都支持）
 * - Summarizer（摘要，两家都支持）
 * - Writer / Rewriter（Edge 主导，需 edge://flags 启用对应 "API for Phi mini"）
 * - Translator（目前仅 Chrome 138+ 支持）
 *
 * 所有调用一次性创建 session、调用后立即 destroy()，避免占用模型句柄。
 */
export const browserAiPlugin: AgentPlugin = {
  id: 'browser-ai',
  name: '浏览器内置 AI',
  description:
    '调用浏览器本地的 on-device AI：Chrome 用 Gemini Nano；Edge 用 Phi-4-mini，并额外提供 Writer/Rewriter。',
  defaultEnabled: false,
  checkAvailability: checkBrowserAiAvailability,
  systemPrompt: () =>
    [
      '插件 browser-ai 提供本地推理 tool，跨 Chrome 与 Edge 内核：',
      '- plugin_browser_ai_status：查询当前内置 AI 各能力的可用性（含浏览器 vendor）。',
      '- plugin_browser_ai_prompt：LanguageModel 通用补全（Chrome / Edge 都可用）。',
      '- plugin_browser_ai_summarize：Summarizer 摘要（Chrome / Edge）。',
      '- plugin_browser_ai_write：Writer 写作生成（Edge 主推；Chrome 也已支持）。tone=formal|neutral|casual。',
      '- plugin_browser_ai_rewrite：Rewriter 改写（Edge 主推；Chrome 也已支持）。tone=as-is|more-formal|more-casual。',
      '- plugin_browser_ai_translate：Translator 翻译（目前仅 Chrome 138+ 支持，Edge 暂无）。',
      '调用前若不确定能力是否就绪，先调用 plugin_browser_ai_status；状态非 available 时不要重试。',
      '该插件完全本地推理：长文输入或敏感场景下应优先使用此插件而非外部 API。'
    ].join('\n'),
  buildTools: () => {
    return [
      {
        name: 'plugin_browser_ai_status',
        label: '内置 AI 状态',
        description: '查询当前浏览器内置 LanguageModel / Summarizer / Translator 的可用性。',
        parameters: Type.Unsafe<Record<string, unknown>>({ type: 'object' }),
        execute: async () => {
          const snapshot = await getBrowserAiSnapshot()
          return {
            content: [{ type: 'text' as const, text: JSON.stringify(snapshot) }],
            details: { kind: 'plugin:browser-ai:status', ...snapshot }
          }
        }
      },
      {
        name: 'plugin_browser_ai_prompt',
        label: '内置 AI 文本补全',
        description:
          '使用浏览器本地 LanguageModel 做文本补全。必填 prompt；可选 systemPrompt、temperature、topK。',
        parameters: Type.Unsafe<PromptParams>({
          type: 'object',
          required: ['prompt'],
          properties: {
            prompt: { type: 'string' },
            systemPrompt: { type: 'string' },
            temperature: { type: 'number' },
            topK: { type: 'number' },
            expectedInputLanguages: { type: 'array', items: { type: 'string' } },
            expectedOutputLanguages: { type: 'array', items: { type: 'string' } }
          }
        }),
        execute: async (_id: string, params: unknown) => {
          const args = (params || {}) as PromptParams
          if (!args.prompt || typeof args.prompt !== 'string') {
            throw new Error('plugin_browser_ai_prompt 缺少必填参数 prompt')
          }
          const output = await runLanguageModelPrompt({
            prompt: args.prompt,
            systemPrompt: args.systemPrompt,
            temperature: args.temperature,
            topK: args.topK,
            expectedInputLanguages: args.expectedInputLanguages,
            expectedOutputLanguages: args.expectedOutputLanguages
          })
          return {
            content: [{ type: 'text' as const, text: output }],
            details: {
              kind: 'plugin:browser-ai:prompt',
              outputLength: output.length
            }
          }
        }
      },
      {
        name: 'plugin_browser_ai_summarize',
        label: '内置 AI 摘要',
        description:
          '使用浏览器本地 Summarizer 摘要长文。必填 text；可选 type=key-points|tldr|teaser|headline，length=short|medium|long，format=markdown|plain-text。',
        parameters: Type.Unsafe<SummarizeParams>({
          type: 'object',
          required: ['text'],
          properties: {
            text: { type: 'string' },
            type: { type: 'string', enum: ['key-points', 'tldr', 'teaser', 'headline'] },
            format: { type: 'string', enum: ['markdown', 'plain-text'] },
            length: { type: 'string', enum: ['short', 'medium', 'long'] },
            context: { type: 'string' },
            sharedContext: { type: 'string' },
            outputLanguage: { type: 'string' },
            expectedInputLanguages: { type: 'array', items: { type: 'string' } }
          }
        }),
        execute: async (_id: string, params: unknown) => {
          const args = (params || {}) as SummarizeParams
          if (!args.text || typeof args.text !== 'string') {
            throw new Error('plugin_browser_ai_summarize 缺少必填参数 text')
          }
          const output = await runSummarizer({
            text: args.text,
            type: args.type,
            format: args.format,
            length: args.length,
            context: args.context,
            sharedContext: args.sharedContext,
            outputLanguage: args.outputLanguage,
            expectedInputLanguages: args.expectedInputLanguages
          })
          return {
            content: [{ type: 'text' as const, text: output }],
            details: {
              kind: 'plugin:browser-ai:summarize',
              outputLength: output.length,
              type: args.type || 'key-points',
              length: args.length || 'medium'
            }
          }
        }
      },
      {
        name: 'plugin_browser_ai_translate',
        label: '内置 AI 翻译',
        description:
          '使用浏览器本地 Translator 翻译文本。必填 text、sourceLanguage、targetLanguage（BCP-47）。',
        parameters: Type.Unsafe<TranslateParams>({
          type: 'object',
          required: ['text', 'sourceLanguage', 'targetLanguage'],
          properties: {
            text: { type: 'string' },
            sourceLanguage: { type: 'string' },
            targetLanguage: { type: 'string' }
          }
        }),
        execute: async (_id: string, params: unknown) => {
          const args = (params || {}) as TranslateParams
          if (!args.text || !args.sourceLanguage || !args.targetLanguage) {
            throw new Error(
              'plugin_browser_ai_translate 需要 text / sourceLanguage / targetLanguage 全部填写'
            )
          }
          const output = await runTranslator({
            text: args.text,
            sourceLanguage: args.sourceLanguage,
            targetLanguage: args.targetLanguage
          })
          return {
            content: [{ type: 'text' as const, text: output }],
            details: {
              kind: 'plugin:browser-ai:translate',
              sourceLanguage: args.sourceLanguage,
              targetLanguage: args.targetLanguage,
              outputLength: output.length
            }
          }
        }
      },
      {
        name: 'plugin_browser_ai_write',
        label: '内置 AI 写作',
        description:
          '使用浏览器本地 Writer（Edge 主推 / Chrome 也支持）按提示生成新文本。必填 task；可选 tone=formal|neutral|casual, length=short|medium|long, format=plain-text|markdown, sharedContext, context。',
        parameters: Type.Unsafe<WriteParams>({
          type: 'object',
          required: ['task'],
          properties: {
            task: { type: 'string' },
            tone: { type: 'string', enum: ['formal', 'neutral', 'casual'] },
            length: { type: 'string', enum: ['short', 'medium', 'long'] },
            format: { type: 'string', enum: ['plain-text', 'markdown'] },
            sharedContext: { type: 'string' },
            context: { type: 'string' }
          }
        }),
        execute: async (_id: string, params: unknown) => {
          const args = (params || {}) as WriteParams
          if (!args.task || typeof args.task !== 'string') {
            throw new Error('plugin_browser_ai_write 缺少必填参数 task')
          }
          const output = await runWriter({
            task: args.task,
            tone: args.tone,
            length: args.length,
            format: args.format,
            sharedContext: args.sharedContext,
            context: args.context
          })
          return {
            content: [{ type: 'text' as const, text: output }],
            details: {
              kind: 'plugin:browser-ai:write',
              tone: args.tone || 'neutral',
              length: args.length || 'medium',
              format: args.format || 'markdown',
              outputLength: output.length
            }
          }
        }
      },
      {
        name: 'plugin_browser_ai_rewrite',
        label: '内置 AI 改写',
        description:
          '使用浏览器本地 Rewriter（Edge 主推 / Chrome 也支持）改写已有文本。必填 text；可选 tone=as-is|more-formal|more-casual, length=as-is|shorter|longer, format=as-is|plain-text|markdown, sharedContext, context。',
        parameters: Type.Unsafe<RewriteParams>({
          type: 'object',
          required: ['text'],
          properties: {
            text: { type: 'string' },
            tone: { type: 'string', enum: ['as-is', 'more-formal', 'more-casual'] },
            length: { type: 'string', enum: ['as-is', 'shorter', 'longer'] },
            format: { type: 'string', enum: ['as-is', 'plain-text', 'markdown'] },
            sharedContext: { type: 'string' },
            context: { type: 'string' }
          }
        }),
        execute: async (_id: string, params: unknown) => {
          const args = (params || {}) as RewriteParams
          if (!args.text || typeof args.text !== 'string') {
            throw new Error('plugin_browser_ai_rewrite 缺少必填参数 text')
          }
          const output = await runRewriter({
            text: args.text,
            tone: args.tone,
            length: args.length,
            format: args.format,
            sharedContext: args.sharedContext,
            context: args.context
          })
          return {
            content: [{ type: 'text' as const, text: output }],
            details: {
              kind: 'plugin:browser-ai:rewrite',
              tone: args.tone || 'as-is',
              length: args.length || 'as-is',
              format: args.format || 'as-is',
              outputLength: output.length
            }
          }
        }
      }
    ]
  }
}
