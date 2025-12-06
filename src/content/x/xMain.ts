import { initXImages } from './xImages'
import { initVideoCopy } from './video/videoCopy'
import xAutoDownloadSettings from './autoDownloadSettings'
import { isXMainHost } from './utils'

export function initXMain() {
  try {
    if (!isXMainHost()) return
    initXImages()
    initVideoCopy()
    // 初始化自动下载设置菜单
    xAutoDownloadSettings.init()
  } catch (err) {
    console.error('[XMain] init failed', err)
  }
}
