import type { AgentPlugin } from '../index'

/**
 * code-explainer 插件
 *
 * 仅扩展 system prompt——让 agent 在面对代码 / 文档 / API 时给出更适合
 * 程序员的解释：突出输入输出、副作用、复杂度，以及与上下文相关的注意点。
 */
export const codeExplainerPlugin: AgentPlugin = {
  id: 'prompt-code-explainer',
  name: '代码解读偏好',
  description: '当任务涉及阅读代码或 API 时，要求代理以程序员视角组织输出。',
  defaultEnabled: false,
  systemPrompt: () =>
    [
      '面对代码、API 或技术文档相关任务时，输出请遵循以下结构：',
      '- 概述：用一句话说明这段代码 / API 做什么。',
      '- 参数 & 返回：列名 + 类型 + 含义；遇到 union/optional 务必标记。',
      '- 副作用：明确指出 IO、状态修改、抛错条件。',
      '- 复杂度 & 注意点：必要时给出时间/空间复杂度和易错点。',
      '- 示例：尽量给一个 6 行以内的最小可运行片段。',
      '若信息不足以填某一项，写"不确定"而不是猜测。'
    ].join('\n')
}
