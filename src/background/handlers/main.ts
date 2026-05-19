export { handleAddToFavorites } from './handleAddToFavorites'
export { handleLinuxDoAuthRequest } from './handleLinuxDoAuthRequest'
export { handleLinuxDoUserRequest } from './handleLinuxDoUserRequest'
export { handlePageFetchRequest } from './handlePageFetchRequest'
export { handlePageFetchRequest as handleLinuxDoPageFetchRequest } from './handlePageFetchRequest'
export { handleLinuxDoUploadRequest } from './handleLinuxDoUploadRequest'
export { handleProxyFetchRequest } from './handleProxyFetchRequest'
export { handleProxyImageRequest } from './handleProxyImageRequest'
export { setupContextMenu } from './setupContextMenu'
export { handleSyncSettings } from './handleSyncSettings'
export { handleDownloadImage } from './handleDownloadImage'
export { handleCaptureScreenshot } from './handleCaptureScreenshot'
export {
  handleGetEmojiData,
  handleGetEmojiSetting,
  handleGetEmojiSettingsBatch,
  handleSaveEmojiData,
  setupStorageChangeListener,
  setupPeriodicCleanup,
  invalidateCache
} from './handlersImpl'
// scheduledLikes / scheduledBrowse 已改为按需 import，
// background entry 通过动态 import 直接加载这两个模块
