import { initPixiv } from './pixiv'

try {
  initPixiv()
} catch (e) {
  console.error('[pixiv] 注入失败', e)
}
