/**
 * 判断当前页面是否为 Discourse（通过显式 meta 标签检测）
 */
import { DQS, DEBI } from '../../utils/createEl'
export function isDiscoursePage(): boolean {
  try {
    // meta generator 中通常含有 Discourse
    const gen = DQS('meta[name="generator"]')?.getAttribute('content') || ''
    if (gen.toLowerCase().includes('discourse')) return true

    // 存在以 discourse_ 开头的 meta 名称
    if (DQS('meta[name^="discourse_"]')) return true

    // 某些站点会在 head 中放置 data-discourse-setup 的 meta（示例中有 id）
    if (DEBI('data-discourse-setup')) return true

    // 额外检测：discourse/config/environment
    if (DQS('meta[name="discourse/config/environment"]')) return true

    return false
  } catch (e) {
    console.error('[DiscourseOneClick] isDiscoursePage check failed', e)
    return false
  }
}
