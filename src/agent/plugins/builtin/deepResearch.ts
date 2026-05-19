import type { AgentPlugin } from '../index'

/**
 * deep-research 插件
 *
 * 仅扩展 system prompt——引导 agent 在"研究/调研"类任务中走更严谨的流程：
 * 先列计划，再分步执行，最后总结要点与来源。
 */
export const deepResearchPlugin: AgentPlugin = {
  id: 'prompt-deep-research',
  name: '深度调研模式',
  description: '让代理在调研类任务中先规划再行动，并要求总结附带可验证来源。',
  defaultEnabled: false,
  systemPrompt: () =>
    [
      '当任务属于"调研 / 比较 / 总结 / 搜集资料"等类型时，按以下流程：',
      '1. 先用一段话陈述目标 + 列出 2~5 步研究计划。',
      '2. 每一步只针对一个子问题，调用对应 tool（搜索、浏览、DOM 提取）。',
      '3. 阶段结论必须有可点击或可验证的来源（URL/选择器/具体段落）。',
      '4. 全部完成后给出"要点摘要"+"来源列表"两段输出。'
    ].join('\n')
}
