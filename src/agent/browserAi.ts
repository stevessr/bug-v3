/**
 * 浏览器内置 AI 兼容层。
 *
 * 覆盖两套 Chromium 系内置 AI：
 * - Chrome 127+：Gemini Nano 驱动 `LanguageModel` / `Summarizer` / `Translator`
 * - Edge 138+：Phi-4-mini 驱动 `LanguageModel` / `Summarizer` / `Writer` / `Rewriter`
 *
 * 早期 Chrome 曾使用 `window.ai.languageModel` 命名空间；本模块同时兼容新顶级全局
 * 与旧命名空间。所有 run* 函数在调用结束后立即 destroy() 释放模型句柄。
 */

export type AvailabilityState =
  /** 模型已就绪 */
  | 'available'
  /** 需要先触发下载才可用 */
  | 'downloadable'
  /** 当前正在下载中 */
  | 'downloading'
  /** 当前环境（设备/标志位）无法使用 */
  | 'unavailable'

/** Chrome 早期版本使用的同义词，统一映射到 AvailabilityState */
function normalizeAvailability(raw: unknown): AvailabilityState {
  if (typeof raw !== 'string') return 'unavailable'
  switch (raw) {
    case 'available':
    case 'readily':
      return 'available'
    case 'downloadable':
    case 'after-download':
      return 'downloadable'
    case 'downloading':
      return 'downloading'
    default:
      return 'unavailable'
  }
}

type AnyGlobal = Record<string, any>

function getGlobal(): AnyGlobal | null {
  if (typeof globalThis !== 'undefined') return globalThis as AnyGlobal
  if (typeof self !== 'undefined') return self as AnyGlobal
  if (typeof window !== 'undefined') return window as AnyGlobal
  return null
}

/** 优先返回新的顶级全局，否则回退到 window.ai.xxx 命名空间 */
function resolveApi(
  name: 'LanguageModel' | 'Summarizer' | 'Translator' | 'Writer' | 'Rewriter'
): any {
  const g = getGlobal()
  if (!g) return null
  if (g[name]) return g[name]
  const legacy = g.ai
  if (legacy) {
    if (name === 'LanguageModel' && legacy.languageModel) return legacy.languageModel
    if (name === 'Summarizer' && legacy.summarizer) return legacy.summarizer
    if (name === 'Translator' && legacy.translator) return legacy.translator
    if (name === 'Writer' && legacy.writer) return legacy.writer
    if (name === 'Rewriter' && legacy.rewriter) return legacy.rewriter
  }
  return null
}

/** 粗略推断当前浏览器内核：用于在错误信息中给用户更准确的指引 */
export type BrowserAiVendor = 'edge' | 'chrome' | 'unknown'
export function detectBrowserAiVendor(): BrowserAiVendor {
  const ua = (typeof navigator !== 'undefined' && navigator.userAgent) || ''
  if (/Edg\//i.test(ua)) return 'edge'
  if (/Chrome\//i.test(ua)) return 'chrome'
  return 'unknown'
}

async function safeAvailability(
  api: any,
  opts?: Record<string, unknown>
): Promise<AvailabilityState> {
  if (!api) return 'unavailable'
  try {
    if (typeof api.availability === 'function') {
      return normalizeAvailability(await api.availability(opts))
    }
    // 老版本曾用 capabilities()
    if (typeof api.capabilities === 'function') {
      const caps = await api.capabilities()
      return normalizeAvailability(caps?.available)
    }
  } catch (err) {
    console.warn('[browserAi] availability check failed:', err)
  }
  return 'unavailable'
}

/** 不可用时给出按 vendor 区分的提示文案 */
function formatUnavailableMessage(
  api: 'LanguageModel' | 'Summarizer' | 'Translator' | 'Writer' | 'Rewriter',
  state: AvailabilityState
): string {
  const vendor = detectBrowserAiVendor()
  const tail =
    vendor === 'edge'
      ? '请使用 Edge Canary/Dev 138+，并在 edge://flags 启用对应 "API for Phi mini" 开关。'
      : vendor === 'chrome'
        ? '请使用 Chrome 127+，在 chrome://flags 启用 Built-in AI 实验，并在 chrome://components 触发模型下载。'
        : '该 API 仅在新版 Chromium 内核（Chrome / Edge）上可用。'
  return `${api} 暂不可用（状态: ${state}）。${tail}`
}

/** 不支持该 API 时的提示 */
function formatUnsupportedMessage(
  api: 'LanguageModel' | 'Summarizer' | 'Translator' | 'Writer' | 'Rewriter'
): string {
  const vendor = detectBrowserAiVendor()
  if (api === 'Translator') {
    return vendor === 'edge'
      ? '当前 Edge 还未提供 Translator API，请使用 LanguageModel 或 Chrome 138+。'
      : '当前浏览器不支持 Translator API。请使用 Chrome 138+ 并启用内置 AI。'
  }
  if (api === 'Writer' || api === 'Rewriter') {
    return vendor === 'edge'
      ? `当前 Edge 未启用 ${api} API。请在 edge://flags 启用 "${api} API for Phi mini" 并重启浏览器。`
      : `当前浏览器不支持 ${api} API。请使用 Edge 138+ 或 Chrome 138+ 并启用对应实验。`
  }
  return `当前浏览器不支持 ${api} API。请使用 Chrome 127+ 或 Edge 138+ 并启用内置 AI。`
}

export interface BrowserAiSnapshot {
  vendor: BrowserAiVendor
  languageModel: AvailabilityState
  summarizer: AvailabilityState
  translator: AvailabilityState
  writer: AvailabilityState
  rewriter: AvailabilityState
  supported: boolean
}

/** 一次性查询所有内置 AI 的可用性，含 vendor 与各能力状态 */
export async function getBrowserAiSnapshot(): Promise<BrowserAiSnapshot> {
  const [languageModel, summarizer, translator, writer, rewriter] = await Promise.all([
    safeAvailability(resolveApi('LanguageModel')),
    safeAvailability(resolveApi('Summarizer')),
    safeAvailability(resolveApi('Translator')),
    safeAvailability(resolveApi('Writer')),
    safeAvailability(resolveApi('Rewriter'))
  ])
  return {
    vendor: detectBrowserAiVendor(),
    languageModel,
    summarizer,
    translator,
    writer,
    rewriter,
    supported:
      languageModel !== 'unavailable' ||
      summarizer !== 'unavailable' ||
      translator !== 'unavailable' ||
      writer !== 'unavailable' ||
      rewriter !== 'unavailable'
  }
}

export type LanguageModelCreateOptions = {
  systemPrompt?: string
  initialPrompts?: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
  expectedInputs?: Array<{ type: string; languages?: string[] }>
  expectedOutputs?: Array<{ type: string; languages?: string[] }>
  /** Chrome 仅在扩展环境允许调整这两项 */
  temperature?: number
  topK?: number
}

export interface LanguageModelPromptInput {
  prompt: string
  systemPrompt?: string
  temperature?: number
  topK?: number
  expectedInputLanguages?: string[]
  expectedOutputLanguages?: string[]
}

export async function runLanguageModelPrompt(input: LanguageModelPromptInput): Promise<string> {
  const api = resolveApi('LanguageModel')
  if (!api) throw new Error(formatUnsupportedMessage('LanguageModel'))

  const availabilityOpts: Record<string, unknown> = {}
  if (input.expectedInputLanguages) {
    availabilityOpts.expectedInputs = [{ type: 'text', languages: input.expectedInputLanguages }]
  }
  if (input.expectedOutputLanguages) {
    availabilityOpts.expectedOutputs = [{ type: 'text', languages: input.expectedOutputLanguages }]
  }
  const state = await safeAvailability(api, availabilityOpts)
  if (state !== 'available') {
    throw new Error(formatUnavailableMessage('LanguageModel', state))
  }

  const createOpts: LanguageModelCreateOptions = {
    ...availabilityOpts
  }
  if (input.systemPrompt) {
    createOpts.initialPrompts = [{ role: 'system', content: input.systemPrompt }]
  }
  if (typeof input.temperature === 'number') createOpts.temperature = input.temperature
  if (typeof input.topK === 'number') createOpts.topK = input.topK

  const session: any = await api.create(createOpts)
  try {
    const result = await session.prompt(input.prompt)
    return typeof result === 'string' ? result : String(result ?? '')
  } finally {
    try {
      session.destroy?.()
    } catch (e) {
      void e
    }
  }
}

export type SummarizerType = 'key-points' | 'tldr' | 'teaser' | 'headline'
export type SummarizerFormat = 'markdown' | 'plain-text'
export type SummarizerLength = 'short' | 'medium' | 'long'

export interface SummarizerInput {
  text: string
  type?: SummarizerType
  format?: SummarizerFormat
  length?: SummarizerLength
  sharedContext?: string
  context?: string
  outputLanguage?: string
  expectedInputLanguages?: string[]
}

export async function runSummarizer(input: SummarizerInput): Promise<string> {
  const api = resolveApi('Summarizer')
  if (!api) throw new Error(formatUnsupportedMessage('Summarizer'))

  const createOpts: Record<string, unknown> = {
    type: input.type || 'key-points',
    format: input.format || 'markdown',
    length: input.length || 'medium'
  }
  if (input.sharedContext) createOpts.sharedContext = input.sharedContext
  if (input.outputLanguage) createOpts.outputLanguage = input.outputLanguage
  if (input.expectedInputLanguages) createOpts.expectedInputLanguages = input.expectedInputLanguages

  const state = await safeAvailability(api, createOpts)
  if (state !== 'available') {
    throw new Error(formatUnavailableMessage('Summarizer', state))
  }

  const session: any = await api.create(createOpts)
  try {
    const result = await session.summarize(input.text, {
      context: input.context
    })
    return typeof result === 'string' ? result : String(result ?? '')
  } finally {
    try {
      session.destroy?.()
    } catch (e) {
      void e
    }
  }
}

export interface TranslatorInput {
  text: string
  sourceLanguage: string
  targetLanguage: string
}

export async function runTranslator(input: TranslatorInput): Promise<string> {
  const api = resolveApi('Translator')
  if (!api) throw new Error(formatUnsupportedMessage('Translator'))

  if (!input.sourceLanguage || !input.targetLanguage) {
    throw new Error('Translator 需要同时指定 sourceLanguage 与 targetLanguage（BCP-47）。')
  }

  const createOpts = {
    sourceLanguage: input.sourceLanguage,
    targetLanguage: input.targetLanguage
  }
  const state = await safeAvailability(api, createOpts)
  if (state !== 'available') {
    throw new Error(formatUnavailableMessage('Translator', state))
  }

  const session: any = await api.create(createOpts)
  try {
    const result = await session.translate(input.text)
    return typeof result === 'string' ? result : String(result ?? '')
  } finally {
    try {
      session.destroy?.()
    } catch (e) {
      void e
    }
  }
}

// === Writer / Rewriter（Edge 主导，Chrome 也实现） ===

export type WriterTone = 'formal' | 'neutral' | 'casual'
export type WriterLength = 'short' | 'medium' | 'long'
export type WriterFormat = 'plain-text' | 'markdown'

export interface WriterInput {
  task: string
  tone?: WriterTone
  length?: WriterLength
  format?: WriterFormat
  sharedContext?: string
  context?: string
}

export async function runWriter(input: WriterInput): Promise<string> {
  const api = resolveApi('Writer')
  if (!api) throw new Error(formatUnsupportedMessage('Writer'))

  if (!input.task || typeof input.task !== 'string') {
    throw new Error('Writer 需要给定要生成的写作任务描述（task 参数）。')
  }

  const createOpts: Record<string, unknown> = {
    tone: input.tone || 'neutral',
    length: input.length || 'medium',
    format: input.format || 'markdown'
  }
  if (input.sharedContext) createOpts.sharedContext = input.sharedContext

  const state = await safeAvailability(api, createOpts)
  if (state !== 'available') {
    throw new Error(formatUnavailableMessage('Writer', state))
  }

  const session: any = await api.create(createOpts)
  try {
    const result = await session.write(
      input.task,
      input.context ? { context: input.context } : undefined
    )
    return typeof result === 'string' ? result : String(result ?? '')
  } finally {
    try {
      session.destroy?.()
    } catch (e) {
      void e
    }
  }
}

export type RewriterTone = 'as-is' | 'more-formal' | 'more-casual'
export type RewriterLength = 'as-is' | 'shorter' | 'longer'
export type RewriterFormat = 'as-is' | 'plain-text' | 'markdown'

export interface RewriterInput {
  text: string
  tone?: RewriterTone
  length?: RewriterLength
  format?: RewriterFormat
  sharedContext?: string
  context?: string
}

export async function runRewriter(input: RewriterInput): Promise<string> {
  const api = resolveApi('Rewriter')
  if (!api) throw new Error(formatUnsupportedMessage('Rewriter'))

  if (!input.text || typeof input.text !== 'string') {
    throw new Error('Rewriter 需要给定要重写的原文（text 参数）。')
  }

  const createOpts: Record<string, unknown> = {
    tone: input.tone || 'as-is',
    length: input.length || 'as-is',
    format: input.format || 'as-is'
  }
  if (input.sharedContext) createOpts.sharedContext = input.sharedContext

  const state = await safeAvailability(api, createOpts)
  if (state !== 'available') {
    throw new Error(formatUnavailableMessage('Rewriter', state))
  }

  const session: any = await api.create(createOpts)
  try {
    const result = await session.rewrite(
      input.text,
      input.context ? { context: input.context } : undefined
    )
    return typeof result === 'string' ? result : String(result ?? '')
  } finally {
    try {
      session.destroy?.()
    } catch (e) {
      void e
    }
  }
}
