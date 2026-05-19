import { Type } from '@mariozechner/pi-ai'

import type { AgentPlugin } from '../index'

import {
  getBrowserAiSnapshot,
  runLanguageModelPrompt,
  runSummarizer,
  runTranslator,
  type SummarizerFormat,
  type SummarizerLength,
  type SummarizerType
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

/**
 * browser-ai 插件
 *
 * 把 Chrome 127+ 的浏览器内置 on-device AI（LanguageModel / Summarizer /
 * Translator）以 pi-agent tools 形式暴露给 agent。
 *
 * 三个 tool + 一个状态查询。所有调用一次性创建 session、调用后立即 destroy()，
 * 避免占用模型句柄。
 */
export const browserAiPlugin: AgentPlugin = {
  id: 'browser-ai',
  name: '浏览器内置 AI',
  description:
    '调用 Chrome 127+ 提供的本地 LanguageModel / Summarizer / Translator API，无需联网或额外 API Key。',
  defaultEnabled: false,
  systemPrompt: () =>
    [
      '插件 browser-ai 提供 4 个 tool：',
      '- plugin_browser_ai_status：查询三类内置 AI 当前的可用性（available / downloadable / downloading / unavailable）。',
      '- plugin_browser_ai_prompt：调用 LanguageModel 做通用文本补全（适合短问答、抽取、改写）。',
      '- plugin_browser_ai_summarize：调用 Summarizer 做摘要，可指定 type/length/format。',
      '- plugin_browser_ai_translate：调用 Translator 做翻译，必须同时给 sourceLanguage 与 targetLanguage（BCP-47）。',
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
      }
    ]
  }
}
