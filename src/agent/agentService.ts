import type { AgentSettings, SubAgentConfig, AgentActionResult } from './types'
import { runPiAgentFollowup, runPiAgentMessage, type AgentRunResult } from './piRuntime'
import {
  buildSystemPrompt,
  dataUrlToImageContent,
  extractAssistantText,
  type AgentTabContextLike,
  runSimpleTextPrompt,
  runSimpleVisionPrompt
} from './piSupport'
import type { AgentToolPayload } from './agentPayload'
import type { AgentStreamUpdate } from './agentStreaming'

export type AgentTabContext = AgentTabContextLike
export type { AgentRunResult }

export async function generateChecklist(
  input: string,
  settings: AgentSettings,
  subagent?: SubAgentConfig,
  context?: { tab?: AgentTabContextLike }
): Promise<string[]> {
  try {
    const response = await runSimpleTextPrompt({
      prompt: input,
      settings,
      subagent,
      systemPrompt: [
        buildSystemPrompt(settings, subagent, context),
        '请将用户需求拆分为可执行的清单任务（最多 7 条）。',
        '仅输出条目列表，每行一条，不要输出其他内容。'
      ].join('\n')
    })

    return extractAssistantText(response)
      .split('\n')
      .map(line => line.replace(/^[-*+\d.、\s]+/, '').trim())
      .filter(Boolean)
      .slice(0, 10)
  } catch {
    return []
  }
}

export async function verifyChecklist(
  input: string,
  checklist: string[],
  finalMessage: string,
  settings: AgentSettings,
  subagent?: SubAgentConfig,
  context?: { tab?: AgentTabContextLike }
): Promise<string> {
  try {
    const response = await runSimpleTextPrompt({
      prompt: [
        `用户需求：${input}`,
        `任务清单：${JSON.stringify(checklist)}`,
        `最终输出：${finalMessage}`
      ].join('\n'),
      settings,
      subagent,
      systemPrompt: [
        buildSystemPrompt(settings, subagent, context),
        '你是任务核查助手，只根据提供的信息判断是否完成清单。',
        '输出一句简短结论，格式：已完成/未完成 + 简要原因。'
      ].join('\n')
    })
    return extractAssistantText(response) || '待确认'
  } catch {
    return '待确认'
  }
}

export async function runAgentMessage(
  input: string,
  settings: AgentSettings,
  subagent?: SubAgentConfig,
  context?: { tab?: AgentTabContextLike },
  options?: {
    onUpdate?: (update: AgentStreamUpdate) => void
    sessionId?: string
    isolated?: boolean
  }
): Promise<AgentRunResult> {
  return runPiAgentMessage(input, settings, subagent, context, options)
}

export async function runAgentFollowup(
  input: string,
  toolUses: { id: string; input: AgentToolPayload }[],
  toolResult: AgentActionResult[],
  settings: AgentSettings,
  subagent?: SubAgentConfig,
  context?: { tab?: AgentTabContextLike },
  options?: {
    onUpdate?: (update: AgentStreamUpdate) => void
    sessionId?: string
    isolated?: boolean
  }
): Promise<AgentRunResult> {
  return runPiAgentFollowup(input, toolUses, toolResult, settings, subagent, context, options)
}

export async function describeScreenshot(
  screenshotDataUrl: string,
  userPrompt: string,
  settings: AgentSettings,
  subagent?: SubAgentConfig,
  context?: { tab?: AgentTabContextLike }
): Promise<string> {
  try {
    const image = dataUrlToImageContent(screenshotDataUrl)
    if (!image) return ''

    const response = await runSimpleVisionPrompt({
      prompt: `用户需求：${userPrompt}\n请描述截图中与完成任务直接相关的内容。`,
      image,
      settings,
      subagent,
      systemPrompt: [
        buildSystemPrompt(settings, subagent, context),
        '你是截图理解助手。',
        '请结合用户意图，简洁描述截图中与任务相关的页面状态、关键文本、控件和反馈。',
        '如果关键信息不可见，明确说明“待确认”。'
      ].join('\n')
    })
    return extractAssistantText(response)
  } catch {
    return ''
  }
}
