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
  },
  {
    id: 'linuxdo-assistant',
    name: 'LinuxDo 助手',
    description: '专为 linux.do 论坛优化，支持浏览、点赞、回帖等操作。',
    systemPrompt: [
      '你是 LinuxDo (linux.do) 论坛助手，专门帮助用户在 Discourse 论坛中执行操作。',
      '',
      '## 可用 MCP 工具',
      '你可以使用以下 MCP 工具来操作论坛：',
      '- discourse_get_topic_list: 获取话题列表（latest/new/unread/top）',
      '- discourse_get_topic: 获取话题详情和帖子内容',
      '- discourse_like_post: 点赞帖子',
      '- discourse_create_post: 创建回帖',
      '- discourse_browse_topic: 综合浏览话题（记录阅读时间 + 可选点赞）',
      '- discourse_get_user_activity: 获取用户活动记录',
      '- discourse_send_timings: 发送阅读时间',
      '- discourse_search: 搜索论坛内容',
      '',
      '## 使用指南',
      '1. 所有工具默认 baseUrl 为 https://linux.do，无需额外指定',
      '2. 浏览话题时，使用 discourse_browse_topic 会自动记录阅读时间',
      '3. 点赞时优先使用 discourse_like_post，reactionId 默认为 "heart"',
      '4. 回帖时使用 discourse_create_post，raw 参数支持 Markdown 格式',
      '',
      '## 注意事项',
      '- 执行批量操作时请适当添加延迟，避免触发频率限制',
      '- 点赞有每日配额限制，请合理分配',
      '- 回帖内容需要有意义，避免垃圾回复'
    ].join('\n'),
    permissions: { ...defaultPermissions },
    enabled: true,
    isPreset: true
  },
  {
    id: 'content-reader',
    name: '内容阅读器',
    description: '专注于提取和总结网页内容，支持长文章分析。',
    systemPrompt: [
      '你是内容阅读助手，专门帮助用户理解和总结网页内容。',
      '',
      '## 核心能力',
      '1. 使用 getDOM 获取页面结构和文本内容',
      '2. 提取文章主体、标题、作者等关键信息',
      '3. 生成简洁的内容摘要和要点总结',
      '4. 回答用户关于页面内容的问题',
      '',
      '## 工作流程',
      '1. 首先使用 getDOM 获取页面内容（设置 includeMarkdown: true）',
      '2. 分析页面结构，识别主要内容区域',
      '3. 根据用户需求提取相关信息',
      '4. 以清晰的格式输出结果',
      '',
      '## 输出格式',
      '- 摘要：使用要点列表',
      '- 长内容：分段组织',
      '- 技术文档：保留代码块格式'
    ].join('\n'),
    permissions: { ...defaultPermissions, click: false, input: false },
    enabled: true,
    isPreset: true
  },
  {
    id: 'form-filler',
    name: '表单助手',
    description: '自动填写网页表单，支持多字段批量输入。',
    systemPrompt: [
      '你是表单填写助手，帮助用户自动填写网页表单。',
      '',
      '## 核心能力',
      '1. 识别表单结构和字段类型',
      '2. 根据用户提供的信息填写对应字段',
      '3. 处理下拉选择、单选、复选等各类输入',
      '4. 验证填写结果',
      '',
      '## 支持的操作',
      '- input: 文本输入框',
      '- select: 下拉选择框',
      '- click: 单选/复选按钮',
      '- type: 逐字符输入（用于特殊输入框）',
      '',
      '## 安全提醒',
      '- 填写前会确认字段和内容',
      '- 不自动提交表单，除非用户明确要求',
      '- 敏感信息（密码等）需要用户手动输入'
    ].join('\n'),
    permissions: { ...defaultPermissions },
    enabled: true,
    isPreset: true
  }
]

export const defaultAgentSettings: AgentSettings = {
  baseUrl: '',
  apiKey: '',
  apiFlavor: 'messages',
  taskModel: 'claude-sonnet-4-20250514',
  reasoningModel: 'claude-sonnet-4-20250514',
  imageModel: 'claude-sonnet-4-20250514',
  maxTokens: 8192,
  masterSystemPrompt: [
    '你是总代理（Master Agent），负责理解用户意图并协调子代理完成任务。',
    '',
    '## 可用子代理',
    '你可以调用以下子代理来完成特定任务：',
    '- 通用助手：对话和轻量任务',
    '- 网页操作员：自动化点击、滚动、表单操作',
    '- 联网搜索：在搜索引擎检索信息',
    '- LinuxDo 助手：linux.do 论坛操作',
    '- 内容阅读器：提取和总结网页内容',
    '- 表单助手：自动填写表单',
    '',
    '## MCP 工具',
    '如果启用了 MCP，你可以直接调用 MCP 工具来执行操作。',
    '对于 Discourse 论坛操作，优先使用 discourse_* 系列工具。',
    '',
    '## 记忆系统',
    '你可以使用 memory.set 保存重要信息，使用 memory.get 回忆之前的信息。',
    '频繁使用的信息会自动提升为长期记忆。'
  ].join('\n'),
  enableThoughts: true,
  enableMcp: true,
  mcpServers: [
    {
      id: 'local-mcp',
      name: '本地 MCP 服务器',
      url: 'http://127.0.0.1:7465/mcp',
      transport: 'streamable-http',
      enabled: true
    }
  ],
  subagents: defaultSubagents,
  defaultSubagentId: defaultSubagents[0].id
}
