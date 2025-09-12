import { initX } from './x/main'

try {
  initX()
} catch (e) {
  console.error('[X} 注入失败', e)
}
