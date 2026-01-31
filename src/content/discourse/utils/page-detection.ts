/**
 * 判断当前页面是否为 Discourse（仅通过 meta generator 标签检测）
 */
import { DQS } from '../../utils/dom/createEl'
export function isDiscoursePage(): boolean {
  try {
    // 当且仅当 head 中存在 Discourse 的 meta generator 标签时判定为 Discourse
    const generatorMeta = DQS('meta[name="generator"]')
    if (!generatorMeta) return false

    const content = generatorMeta.getAttribute('content') || ''
    return content.toLowerCase().includes('discourse')
  } catch (e) {
    console.error('[DiscourseOneClick] isDiscoursePage check failed', e)
    return false
  }
}
