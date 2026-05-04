import type { BuiltinMcpServer, Skill } from './skills.types'

// ============ 存储 ============

export const SKILLS_ENABLED_KEY = 'ai-agent-skills-enabled-v1'
export const BUILTIN_MCP_ENABLED_KEY = 'ai-agent-builtin-mcp-enabled-v1'
export const API_KEYS_KEY = 'ai-agent-api-keys-v1'
export const CUSTOM_SKILLS_KEY = 'ai-agent-custom-skills-v1'
export const SKILL_CHAINS_KEY = 'ai-agent-skill-chains-v1'
export const SKILL_STATS_KEY = 'ai-agent-skill-stats-v1'
export const SKILL_PRESETS_KEY = 'ai-agent-skill-presets-v1'

// ============ 内置 MCP 服务 ============

export const BUILTIN_MCP_SERVERS: BuiltinMcpServer[] = [
  {
    id: 'builtin-deepwiki',
    name: 'DeepWiki',
    url: 'https://mcp.deepwiki.com/mcp',
    transport: 'streamable-http',
    description: 'AI 驱动的 GitHub 仓库文档服务，获取任何开源项目的文档和解答',
    category: 'knowledge',
    enabled: false
  },
  {
    id: 'builtin-context7',
    name: 'Context7',
    url: 'https://mcp.context7.com/mcp',
    transport: 'streamable-http',
    headers: {
      CONTEXT7_API_KEY: '$CONTEXT7_API_KEY'
    },
    description: '获取最新的库文档和代码示例，支持任何编程库',
    category: 'code',
    requiresApiKey: 'CONTEXT7_API_KEY',
    enabled: false
  },
  {
    id: 'builtin-tavily',
    name: 'Tavily',
    url: 'https://mcp.tavily.com/mcp',
    transport: 'streamable-http',
    description: 'AI 优化的网络搜索 API，获取实时网络信息',
    category: 'search',
    requiresApiKey: 'TAVILY_API_KEY',
    enabled: false
  },
  {
    id: 'builtin-tavily-expert',
    name: 'Tavily Expert',
    url: 'https://tavily.api.tadata.com/mcp/tavily/$TAVILY_PATH',
    transport: 'sse',
    description: 'Tavily Expert 搜索服务，支持更强大的搜索和内容提取功能',
    category: 'search',
    requiresApiKey: 'TAVILY_PATH',
    enabled: false
  }
]

// ============ 内置 Skills ============

export const BUILTIN_SKILLS: Skill[] = [
  {
    id: 'skill-web-search',
    name: '网络搜索',
    description: '使用 Tavily 进行 AI 优化的网络搜索',
    category: 'search',
    source: 'builtin',
    mcpServerId: 'builtin-tavily',
    mcpToolName: 'search',
    enabled: true,
    icon: '🔍',
    priority: 100,
    triggers: [
      '搜索 (.+)',
      '查找 (.+)',
      '查询 (.+)',
      'search\\s+(.+)',
      '帮我搜 (.+)',
      '(.+) 是什么',
      '(.+) 怎么样'
    ],
    aliases: ['搜索', 'search', '查询', '查找', '网搜'],
    tags: ['search', 'web', 'tavily'],
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '搜索查询' }
      },
      required: ['query']
    },
    presets: [
      { id: 'news', name: '最新新闻', args: { query: '最新新闻' } },
      { id: 'tech', name: '科技动态', args: { query: '科技新闻' } }
    ]
  },
  {
    id: 'skill-extract-content',
    name: '内容提取',
    description: '从 URL 提取清洁的文本内容',
    category: 'web',
    source: 'builtin',
    mcpServerId: 'builtin-tavily',
    mcpToolName: 'extract',
    enabled: true,
    icon: '📄',
    priority: 80,
    triggers: ['提取 (.+) 内容', '获取 (.+) 的内容', '读取 (.+)', 'extract\\s+(.+)', '抓取 (.+)'],
    aliases: ['提取', 'extract', '抓取', '获取内容'],
    tags: ['web', 'extract', 'content'],
    inputSchema: {
      type: 'object',
      properties: {
        urls: { type: 'array', items: { type: 'string' }, description: '要提取内容的 URL 列表' }
      },
      required: ['urls']
    }
  },
  {
    id: 'skill-github-docs',
    name: 'GitHub 文档',
    description: '获取 GitHub 仓库的 AI 生成文档',
    category: 'knowledge',
    source: 'builtin',
    mcpServerId: 'builtin-deepwiki',
    mcpToolName: 'read_wiki_contents',
    enabled: true,
    icon: '📚',
    priority: 90,
    triggers: ['(.+) 仓库文档', '(.+) 的文档', '(.+) 怎么用', '(.+) 项目介绍', 'github\\s+(.+)'],
    aliases: ['GitHub 文档', 'deepwiki', '仓库文档', '项目文档'],
    tags: ['github', 'docs', 'knowledge'],
    inputSchema: {
      type: 'object',
      properties: {
        repoName: { type: 'string', description: 'GitHub 仓库名称 (owner/repo)' }
      },
      required: ['repoName']
    },
    chainTo: ['skill-ask-repo']
  },
  {
    id: 'skill-ask-repo',
    name: '问答仓库',
    description: '向 GitHub 仓库提问，获取 AI 回答',
    category: 'knowledge',
    source: 'builtin',
    mcpServerId: 'builtin-deepwiki',
    mcpToolName: 'ask_question',
    enabled: true,
    icon: '❓',
    priority: 85,
    triggers: ['问 (.+) 仓库 (.+)', '(.+) 仓库 (.+) 怎么', '(.+) 项目 (.+) 如何'],
    aliases: ['问答', 'ask', '提问仓库'],
    tags: ['github', 'qa', 'knowledge'],
    inputSchema: {
      type: 'object',
      properties: {
        repoName: { type: 'string', description: 'GitHub 仓库名称' },
        question: { type: 'string', description: '要问的问题' }
      },
      required: ['repoName', 'question']
    }
  },
  {
    id: 'skill-library-docs',
    name: '库文档查询',
    description: '获取编程库的最新文档和代码示例',
    category: 'code',
    source: 'builtin',
    mcpServerId: 'builtin-context7',
    mcpToolName: 'get-library-docs',
    enabled: true,
    icon: '📖',
    priority: 95,
    triggers: ['(.+) 文档', '(.+) 怎么使用', '(.+) 用法', '(.+) 示例', '(.+) 教程'],
    aliases: ['库文档', 'docs', 'library docs', 'context7'],
    tags: ['code', 'docs', 'library'],
    inputSchema: {
      type: 'object',
      properties: {
        context7CompatibleLibraryID: { type: 'string', description: '库 ID (如 /mongodb/docs)' },
        topic: { type: 'string', description: '要查询的主题' }
      },
      required: ['context7CompatibleLibraryID']
    },
    chainTo: ['skill-resolve-library']
  },
  {
    id: 'skill-resolve-library',
    name: '查找库 ID',
    description: '将库名称解析为 Context7 兼容的库 ID',
    category: 'code',
    source: 'builtin',
    mcpServerId: 'builtin-context7',
    mcpToolName: 'resolve-library-id',
    enabled: true,
    icon: '🔗',
    priority: 70,
    triggers: ['查找 (.+) 库', '(.+) 库的 ID', 'resolve\\s+(.+)'],
    aliases: ['查找库', 'resolve', '库 ID'],
    tags: ['code', 'library', 'resolve'],
    inputSchema: {
      type: 'object',
      properties: {
        libraryName: { type: 'string', description: '库名称 (如 react, vue, express)' }
      },
      required: ['libraryName']
    },
    chainTo: ['skill-library-docs']
  },
  {
    id: 'skill-expert-search',
    name: '专家搜索',
    description: '使用 Tavily Expert 进行深度网络搜索，支持更精确的结果',
    category: 'search',
    source: 'builtin',
    mcpServerId: 'builtin-tavily-expert',
    mcpToolName: 'tavily_search',
    enabled: true,
    icon: '🔬',
    priority: 95,
    triggers: ['深度搜索 (.+)', '专家搜索 (.+)', '详细搜索 (.+)', 'expert search(.+)'],
    aliases: ['专家搜索', 'expert search', '深度搜索', '详细搜索'],
    tags: ['search', 'expert', 'tavily'],
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '搜索查询' },
        search_depth: { type: 'string', description: '搜索深度：basic 或 advanced' },
        max_results: { type: 'number', description: '最大结果数量' }
      },
      required: ['query']
    },
    presets: [
      {
        id: 'deep-news',
        name: '深度新闻',
        args: { query: '最新新闻', search_depth: 'advanced', max_results: 10 }
      },
      {
        id: 'research',
        name: '学术研究',
        args: { query: '', search_depth: 'advanced', max_results: 20 }
      }
    ]
  },
  {
    id: 'skill-expert-extract',
    name: '专家内容提取',
    description: '使用 Tavily Expert 从多个 URL 提取和分析内容',
    category: 'web',
    source: 'builtin',
    mcpServerId: 'builtin-tavily-expert',
    mcpToolName: 'tavily_extract',
    enabled: true,
    icon: '📑',
    priority: 75,
    triggers: ['深度提取 (.+)', '专家提取 (.+)', '分析 (.+) 内容'],
    aliases: ['专家提取', 'expert extract', '深度提取'],
    tags: ['web', 'extract', 'expert', 'tavily'],
    inputSchema: {
      type: 'object',
      properties: {
        urls: { type: 'array', items: { type: 'string' }, description: '要提取内容的 URL 列表' }
      },
      required: ['urls']
    }
  },
  // ============ 新增内置 Skills ============
  {
    id: 'skill-github-issue',
    name: 'GitHub Issue',
    description: '获取 GitHub Issue 详情和讨论内容',
    category: 'knowledge',
    source: 'builtin',
    mcpServerId: 'builtin-deepwiki',
    mcpToolName: 'ask_question',
    enabled: true,
    icon: '🐛',
    priority: 88,
    triggers: ['github\\s+issue\\s+(.+)', '(.+) 的 issue', '(.+) 问题列表', 'issue\\s+(.+)'],
    aliases: ['GitHub Issue', 'issue', '问题', 'bug'],
    tags: ['github', 'issue', 'bug', 'knowledge'],
    inputSchema: {
      type: 'object',
      properties: {
        repoName: { type: 'string', description: 'GitHub 仓库名称 (owner/repo)' },
        question: {
          type: 'string',
          description: '关于 Issue 的问题，如：最近的 issues、open issues、某个具体问题'
        }
      },
      required: ['repoName', 'question']
    },
    presets: [
      {
        id: 'open-issues',
        name: '开放 Issues',
        args: { question: 'What are the recent open issues?' }
      },
      { id: 'bugs', name: 'Bug 列表', args: { question: 'What are the known bugs?' } }
    ]
  },
  {
    id: 'skill-github-discussion',
    name: 'GitHub Discussion',
    description: '获取 GitHub Discussion 讨论内容',
    category: 'knowledge',
    source: 'builtin',
    mcpServerId: 'builtin-deepwiki',
    mcpToolName: 'ask_question',
    enabled: true,
    icon: '💬',
    priority: 87,
    triggers: [
      'github\\s+discussion\\s+(.+)',
      '(.+) 的讨论',
      '(.+)discussion',
      'discussion\\s+(.+)'
    ],
    aliases: ['GitHub Discussion', 'discussion', '讨论'],
    tags: ['github', 'discussion', 'community', 'knowledge'],
    inputSchema: {
      type: 'object',
      properties: {
        repoName: { type: 'string', description: 'GitHub 仓库名称 (owner/repo)' },
        question: { type: 'string', description: '关于讨论的问题' }
      },
      required: ['repoName', 'question']
    },
    presets: [
      {
        id: 'recent-discussions',
        name: '最近讨论',
        args: { question: 'What are the recent discussions?' }
      },
      {
        id: 'popular-discussions',
        name: '热门讨论',
        args: { question: 'What are the most popular discussions?' }
      }
    ]
  },
  {
    id: 'skill-web-screenshot',
    name: '网页截图',
    description: '截取当前页面的屏幕截图',
    category: 'web',
    source: 'builtin',
    enabled: true,
    icon: '📸',
    priority: 70,
    triggers: ['截图', '截屏', 'screenshot', '屏幕截图', '网页截图'],
    aliases: ['截图', 'screenshot', '截屏'],
    tags: ['web', 'screenshot', 'capture'],
    inputSchema: {
      type: 'object',
      properties: {
        format: { type: 'string', description: '图片格式：png 或 jpeg' }
      }
    }
  },
  {
    id: 'skill-page-dom',
    name: '页面 DOM 分析',
    description: '获取当前页面的 DOM 结构和内容',
    category: 'web',
    source: 'builtin',
    enabled: true,
    icon: '🌳',
    priority: 65,
    triggers: ['获取 DOM', '页面结构', '分析页面', 'DOM 树', '页面内容'],
    aliases: ['DOM', '页面结构', '页面分析'],
    tags: ['web', 'dom', 'analysis'],
    inputSchema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS 选择器，限定分析范围' },
        includeMarkdown: { type: 'boolean', description: '是否包含 Markdown 格式内容' },
        maxDepth: { type: 'number', description: '最大深度' }
      }
    }
  },
  {
    id: 'skill-web-crawl',
    name: '网页抓取',
    description: '抓取指定网页的完整内容',
    category: 'web',
    source: 'builtin',
    mcpServerId: 'builtin-tavily-expert',
    mcpToolName: 'tavily_crawl',
    enabled: true,
    icon: '🕷️',
    priority: 72,
    triggers: ['抓取 (.+)', '爬取 (.+)', 'crawl\\s+(.+)', '网页抓取 (.+)'],
    aliases: ['抓取', 'crawl', '爬取', '网页抓取'],
    tags: ['web', 'crawl', 'scrape'],
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: '要抓取的 URL' },
        max_depth: { type: 'number', description: '最大抓取深度' },
        max_pages: { type: 'number', description: '最大页面数量' }
      },
      required: ['url']
    }
  },
  {
    id: 'skill-code-explain',
    name: '代码解释',
    description: '解释选中的代码或页面上的代码片段',
    category: 'code',
    source: 'builtin',
    enabled: true,
    icon: '💡',
    priority: 60,
    triggers: ['解释 (.+) 代码', '(.+) 代码什么意思', '代码解释', 'explain\\s+code'],
    aliases: ['代码解释', 'explain code', '代码说明'],
    tags: ['code', 'explain', 'analysis'],
    inputSchema: {
      type: 'object',
      properties: {
        code: { type: 'string', description: '要解释的代码' },
        language: { type: 'string', description: '编程语言' }
      }
    }
  },
  {
    id: 'skill-translate',
    name: '翻译',
    description: '翻译选中的文本或页面内容',
    category: 'other',
    source: 'builtin',
    enabled: true,
    icon: '🌐',
    priority: 75,
    triggers: ['翻译 (.+)', '(.+) 翻译成 (.+)', 'translate\\s+(.+)', '(.+) 的翻译'],
    aliases: ['翻译', 'translate', '转换'],
    tags: ['translate', 'language'],
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: '要翻译的文本' },
        targetLanguage: { type: 'string', description: '目标语言' },
        sourceLanguage: { type: 'string', description: '源语言（可选）' }
      },
      required: ['text']
    },
    presets: [
      { id: 'to-chinese', name: '翻译成中文', args: { targetLanguage: 'zh-CN' } },
      { id: 'to-english', name: '翻译成英文', args: { targetLanguage: 'en' } }
    ]
  },
  {
    id: 'skill-summarize',
    name: '内容总结',
    description: '总结网页或文档内容的要点',
    category: 'other',
    source: 'builtin',
    enabled: true,
    icon: '📝',
    priority: 78,
    triggers: ['总结 (.+)', '概括 (.+)', '(.+) 的要点', 'summarize\\s+(.+)', '摘要 (.+)'],
    aliases: ['总结', 'summarize', '概括', '摘要'],
    tags: ['summarize', 'content'],
    inputSchema: {
      type: 'object',
      properties: {
        content: { type: 'string', description: '要总结的内容' },
        maxLength: { type: 'number', description: '摘要最大长度' },
        format: { type: 'string', description: '输出格式：bullets, paragraph, outline' }
      }
    },
    presets: [
      { id: 'bullets', name: '要点列表', args: { format: 'bullets' } },
      { id: 'brief', name: '简短摘要', args: { format: 'paragraph', maxLength: 200 } }
    ]
  }
]
