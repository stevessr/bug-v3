/**
 * 判断当前页面是否为 Discourse（仅通过 meta generator 标签检测）
 */
import { hasDiscourseGeneratorMeta } from '../../utils/core/platformDetector'

export function isDiscoursePage(): boolean {
  try {
    // 当且仅当 head 中存在 Discourse 的 meta generator 标签时判定为 Discourse
    return hasDiscourseGeneratorMeta()
  } catch (e) {
    console.error('[DiscourseOneClick] isDiscoursePage check failed', e)
    return false
  }
}
