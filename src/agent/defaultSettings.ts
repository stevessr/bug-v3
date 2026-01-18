import type { AgentPermissions, AgentSettings, SubAgentConfig } from './types'

const defaultPermissions: AgentPermissions = {
  click: true,
  scroll: true,
  touch: false,
  screenshot: true,
  navigate: true,
  clickDom: true,
  input: true
}

const defaultSubagents: SubAgentConfig[] = [
  {
    id: 'general-assistant',
    name: '通用助手',
    description: '默认通用助手，适合对话和轻量任务。',
    systemPrompt: '你是一个浏览器侧边栏助手，帮助用户在当前网页完成任务。',
    permissions: { ...defaultPermissions },
    enabled: true,
    isPreset: true
  },
  {
    id: 'web-operator',
    name: '网页操作员',
    description: '专注网页点击、滚动和表单输入的自动化。',
    systemPrompt: '你擅长网页自动化任务，优先使用最少步骤完成操作。',
    permissions: { ...defaultPermissions, screenshot: true },
    enabled: true,
    isPreset: true
  },
  {
    id: 'web-search',
    name: '联网搜索',
    description: '在 Bing 或 Google 进行检索并返回简洁总结。',
    systemPrompt: [
      '你是联网搜索助手，优先使用浏览器打开搜索引擎进行检索。',
      '默认使用 Bing，必要时可切换到 Google。',
      '先 navigate 到 https://www.bing.com 或 https://www.google.com。',
      '使用 DOM 访问定位搜索框并输入关键词，提交搜索。',
      '从结果页提取关键标题与摘要（优先 DOM 文本），不要只截图。',
      '输出简洁的要点总结，必要时附带来源域名。'
    ].join('\n'),
    permissions: { ...defaultPermissions },
    enabled: true,
    isPreset: true
  }
]

export const defaultAgentSettings: AgentSettings = {
  baseUrl: '',
  apiKey: '',
  taskModel: 'claude-3-7-sonnet',
  reasoningModel: 'claude-3-7-sonnet',
  imageModel: 'claude-3-5-sonnet',
  maxTokens: 4096,
  masterSystemPrompt: '你是总代理，了解并可调用可用的子代理协助完成任务。',
  enableThoughts: false,
  enableMcp: false,
  mcpServers: [],
  subagents: defaultSubagents,
  defaultSubagentId: defaultSubagents[0].id
}
