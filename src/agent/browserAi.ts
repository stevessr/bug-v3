/**
 * 浏览器内置 AI（Chrome 127+ on-device API）兼容层。
 *
 * Chrome 仍在快速迭代命名：早期版本暴露 `window.ai.languageModel` / `.summarizer`，
 * 后续版本拆为顶级全局 `LanguageModel` / `Summarizer` / `Translator`。
 * 此模块只在用户运行环境真正具备相应能力时把 API 透出来，否则 readiness 返回 'unavailable'。
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
function resolveApi(name: 'LanguageModel' | 'Summarizer' | 'Translator'): any {
  const g = getGlobal()
  if (!g) return null
  if (g[name]) return g[name]
  const legacy = g.ai
  if (legacy) {
    if (name === 'LanguageModel' && legacy.languageModel) return legacy.languageModel
    if (name === 'Summarizer' && legacy.summarizer) return legacy.summarizer
    if (name === 'Translator' && legacy.translator) return legacy.translator
  }
  return null
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

export interface BrowserAiSnapshot {
  languageModel: AvailabilityState
  summarizer: AvailabilityState
  translator: AvailabilityState
  supported: boolean
}

/** 一次性查询三类内置 AI 的可用性 */
export async function getBrowserAiSnapshot(): Promise<BrowserAiSnapshot> {
  const [languageModel, summarizer, translator] = await Promise.all([
    safeAvailability(resolveApi('LanguageModel')),
    safeAvailability(resolveApi('Summarizer')),
    safeAvailability(resolveApi('Translator'))
  ])
  return {
    languageModel,
    summarizer,
    translator,
    supported:
      languageModel !== 'unavailable' ||
      summarizer !== 'unavailable' ||
      translator !== 'unavailable'
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
  if (!api)
    throw new Error('当前浏览器不支持 LanguageModel API。请使用 Chrome 127+ 并启用内置 AI。')

  const availabilityOpts: Record<string, unknown> = {}
  if (input.expectedInputLanguages) {
    availabilityOpts.expectedInputs = [{ type: 'text', languages: input.expectedInputLanguages }]
  }
  if (input.expectedOutputLanguages) {
    availabilityOpts.expectedOutputs = [{ type: 'text', languages: input.expectedOutputLanguages }]
  }
  const state = await safeAvailability(api, availabilityOpts)
  if (state !== 'available') {
    throw new Error(
      `LanguageModel 暂不可用（状态: ${state}）。请先在 chrome://components 触发模型下载。`
    )
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
  if (!api) throw new Error('当前浏览器不支持 Summarizer API。请使用 Chrome 127+ 并启用内置 AI。')

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
    throw new Error(
      `Summarizer 暂不可用（状态: ${state}）。请先在 chrome://components 触发模型下载。`
    )
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
  if (!api) throw new Error('当前浏览器不支持 Translator API。请使用 Chrome 138+ 并启用内置 AI。')

  if (!input.sourceLanguage || !input.targetLanguage) {
    throw new Error('Translator 需要同时指定 sourceLanguage 与 targetLanguage（BCP-47）。')
  }

  const createOpts = {
    sourceLanguage: input.sourceLanguage,
    targetLanguage: input.targetLanguage
  }
  const state = await safeAvailability(api, createOpts)
  if (state !== 'available') {
    throw new Error(
      `Translator(${input.sourceLanguage}→${input.targetLanguage}) 暂不可用（状态: ${state}）。`
    )
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
