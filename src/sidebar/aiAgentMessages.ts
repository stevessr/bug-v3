/**
 * AI Agent i18n message keys
 * These messages should be added to the locale files
 */

export const AI_AGENT_MESSAGES = {
  emojiTab: 'emojiTab',
  aiAgentTab: 'aiAgentTab',
  aiAgentTitle: 'aiAgentTitle',
  aiAgentApiKey: 'aiAgentApiKey',
  aiAgentApiKeyPlaceholder: 'aiAgentApiKeyPlaceholder',
  aiAgentBaseUrl: 'aiAgentBaseUrl',
  aiAgentBaseUrlPlaceholder: 'aiAgentBaseUrlPlaceholder',
  aiAgentModel: 'aiAgentModel',
  aiAgentModelPlaceholder: 'aiAgentModelPlaceholder',
  aiAgentSettingsHint: 'aiAgentSettingsHint',
  aiAgentNotConfigured: 'aiAgentNotConfigured',
  aiAgentConfigure: 'aiAgentConfigure',
  aiAgentStep: 'aiAgentStep',
  aiAgentStop: 'aiAgentStop',
  aiAgentThinking: 'aiAgentThinking',
  aiAgentAction: 'aiAgentAction',
  aiAgentExecuting: 'aiAgentExecuting',
  aiAgentResult: 'aiAgentResult',
  aiAgentScreenshot: 'aiAgentScreenshot',
  aiAgentError: 'aiAgentError',
  aiAgentWelcome: 'aiAgentWelcome',
  aiAgentHint: 'aiAgentHint',
  aiAgentInputPlaceholder: 'aiAgentInputPlaceholder',
  aiAgentClear: 'aiAgentClear'
} as const

/**
 * Fallback messages for AI Agent (English)
 */
export const AI_AGENT_FALLBACKS: Record<string, string> = {
  emojiTab: 'Emoji',
  aiAgentTab: 'AI Agent',
  aiAgentTitle: 'AI Browser Agent',
  aiAgentApiKey: 'API Key',
  aiAgentApiKeyPlaceholder: 'Enter your Claude API Key',
  aiAgentBaseUrl: 'API Base URL',
  aiAgentBaseUrlPlaceholder: 'https://api.anthropic.com',
  aiAgentModel: 'Model',
  aiAgentModelPlaceholder: 'claude-sonnet-4-20250514',
  aiAgentSettingsHint:
    'You need to configure your own Claude API Key to use the AI Agent. Custom API endpoints are supported.',
  aiAgentNotConfigured: 'AI Agent is not configured',
  aiAgentConfigure: 'Configure API',
  aiAgentStep: 'Step $1',
  aiAgentStop: 'Stop',
  aiAgentThinking: 'Thinking',
  aiAgentAction: 'Action',
  aiAgentExecuting: 'Executing',
  aiAgentResult: 'Result',
  aiAgentScreenshot: 'Screenshot',
  aiAgentError: 'Error',
  aiAgentWelcome: 'AI Browser Agent',
  aiAgentHint:
    'Describe a task and AI will automatically control the browser to complete it. Supports screenshot, click, scroll, type, and more.',
  aiAgentInputPlaceholder: 'Describe the task you want AI to complete...',
  aiAgentClear: 'Clear History'
}

/**
 * Fallback messages for AI Agent (Chinese)
 */
export const AI_AGENT_FALLBACKS_ZH: Record<string, string> = {
  emojiTab: '表情',
  aiAgentTab: 'AI 助手',
  aiAgentTitle: 'AI 浏览器助手',
  aiAgentApiKey: 'API Key',
  aiAgentApiKeyPlaceholder: '输入您的 Claude API Key',
  aiAgentBaseUrl: 'API Base URL',
  aiAgentBaseUrlPlaceholder: 'https://api.anthropic.com',
  aiAgentModel: '模型',
  aiAgentModelPlaceholder: 'claude-sonnet-4-20250514',
  aiAgentSettingsHint:
    '您需要配置自己的 Claude API Key 才能使用 AI 助手功能。支持自定义 API 地址。',
  aiAgentNotConfigured: 'AI 助手尚未配置',
  aiAgentConfigure: '配置 API',
  aiAgentStep: '步骤 $1',
  aiAgentStop: '停止',
  aiAgentThinking: '思考中',
  aiAgentAction: '操作',
  aiAgentExecuting: '执行中',
  aiAgentResult: '结果',
  aiAgentScreenshot: '截图',
  aiAgentError: '错误',
  aiAgentWelcome: 'AI 浏览器助手',
  aiAgentHint: '输入任务描述，AI 将自动操控浏览器完成任务。支持截屏、点击、滚动、输入等操作。',
  aiAgentInputPlaceholder: '描述您想让 AI 完成的任务...',
  aiAgentClear: '清除历史'
}
