import { initBilibili } from './bilibili/bilibili'

try {
  initBilibili()
} catch (e) {
  console.error('[哔哩哔哩] 注入失败', e)
}
