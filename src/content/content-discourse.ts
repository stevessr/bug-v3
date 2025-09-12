import { initDiscourse } from './discourse/discourse'

try {
  initDiscourse()
} catch (e) {
  console.error('[discourse] 注入失败', e)
}
