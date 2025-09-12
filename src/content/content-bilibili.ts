import { initBilibili } from './bilibili/bilibili'

try {
  initBilibili()
} catch (e) {
  // Fail silently; background injection may call init directly instead
}
