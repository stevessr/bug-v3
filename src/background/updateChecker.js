/**
 * 扩展更新检查脚本
 * 用于自动检查并提示用户更新扩展
 */

// 检查更新的间隔时间（毫秒）
const UPDATE_CHECK_INTERVAL = 24 * 60 * 60 * 1000 // 24 小时

// 存储上次检查时间的键名
const LAST_CHECK_KEY = 'extension_last_update_check'

// 当前版本
const CURRENT_VERSION = chrome.runtime.getManifest().version

/**
 * 检查是否有可用更新
 */
async function checkForUpdates() {
  try {
    const manifest = chrome.runtime.getManifest()
    const updateUrl = manifest.update_url

    if (!updateUrl) {
      console.log('未配置更新 URL')
      return
    }

    // 检查 Chrome 更新
    if (chrome.runtime.requestUpdateCheck) {
      const status = await new Promise(resolve => {
        chrome.runtime.requestUpdateCheck((status, details) => {
          resolve({ status, details })
        })
      })

      if (status.status === 'update_available') {
        console.log('发现新版本：', status.details.version)
        showUpdateNotification(status.details.version)
        return true
      }
    }

    // 手动检查更新（适用于自托管）
    const response = await fetch(updateUrl)
    if (response.ok) {
      const xmlText = await response.text()
      const parser = new DOMParser()
      const xmlDoc = parser.parseFromString(xmlText, 'text/xml')

      const updateCheck = xmlDoc.querySelector('updatecheck')
      if (updateCheck) {
        const latestVersion = updateCheck.getAttribute('version')
        if (isNewerVersion(latestVersion, CURRENT_VERSION)) {
          console.log('发现新版本：', latestVersion)
          showUpdateNotification(latestVersion)
          return true
        }
      }
    }

    return false
  } catch (error) {
    console.error('检查更新失败：', error)
    return false
  }
}

/**
 * 比较版本号
 */
function isNewerVersion(latest, current) {
  const latestParts = latest.split('.').map(Number)
  const currentParts = current.split('.').map(Number)

  for (let i = 0; i < Math.max(latestParts.length, currentParts.length); i++) {
    const latestPart = latestParts[i] || 0
    const currentPart = currentParts[i] || 0

    if (latestPart > currentPart) return true
    if (latestPart < currentPart) return false
  }

  return false
}

/**
 * 显示更新通知
 */
function showUpdateNotification(newVersion) {
  if (chrome.notifications) {
    chrome.notifications.create(
      {
        type: 'basic',
        iconUrl: chrome.runtime.getURL('img/128.png'),
        title: '表情扩展更新',
        message: `发现新版本 ${newVersion}，点击查看详情`,
        buttons: [{ title: '立即更新' }, { title: '稍后提醒' }]
      },
      notificationId => {
        if (chrome.runtime.lastError) {
          console.error('创建通知失败：', chrome.runtime.lastError)
          return
        }

        // 处理通知点击
        chrome.notifications.onClicked.addListener(id => {
          if (id === notificationId) {
            chrome.tabs.create({
              url: 'https://github.com/stevessr/bug-v3/releases'
            })
            chrome.notifications.clear(notificationId)
          }
        })

        // 处理按钮点击
        chrome.notifications.onButtonClicked.addListener((id, buttonIndex) => {
          if (id === notificationId) {
            if (buttonIndex === 0) {
              // 立即更新
              chrome.tabs.create({
                url: 'https://github.com/stevessr/bug-v3/releases'
              })
            }
            chrome.notifications.clear(notificationId)
          }
        })
      }
    )
  }
}

/**
 * 定期检查更新
 */
async function scheduleUpdateCheck() {
  const lastCheck = await getStorageData(LAST_CHECK_KEY)
  const now = Date.now()

  // 如果距离上次检查超过间隔时间，则进行检查
  if (!lastCheck || now - lastCheck > UPDATE_CHECK_INTERVAL) {
    console.log('开始检查扩展更新...')
    const hasUpdate = await checkForUpdates()

    // 更新检查时间
    await setStorageData(LAST_CHECK_KEY, now)

    if (hasUpdate) {
      console.log('发现可用更新')
    } else {
      console.log('当前已是最新版本')
    }
  }
}

/**
 * 获取存储数据
 */
function getStorageData(key) {
  return new Promise(resolve => {
    chrome.storage.local.get([key], result => {
      resolve(result[key])
    })
  })
}

/**
 * 设置存储数据
 */
function setStorageData(key, value) {
  return new Promise(resolve => {
    chrome.storage.local.set({ [key]: value }, () => {
      resolve()
    })
  })
}

/**
 * 手动检查更新（可通过 popup 调用）
 */
async function manualCheckForUpdates() {
  console.log('手动检查更新...')
  const hasUpdate = await checkForUpdates()

  if (!hasUpdate) {
    // 显示已是最新版本的通知
    if (chrome.notifications) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: chrome.runtime.getURL('img/128.png'),
        title: '表情扩展',
        message: `当前版本 ${CURRENT_VERSION} 已是最新版本`
      })
    }
  }

  // 更新检查时间
  await setStorageData(LAST_CHECK_KEY, Date.now())

  return hasUpdate
}

// 监听来自 popup 的消息（手动检查更新）
if (chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'checkForUpdates') {
      manualCheckForUpdates()
        .then(hasUpdate => {
          sendResponse({ hasUpdate })
        })
        .catch(error => {
          console.error('[UpdateChecker] Manual check failed:', error)
          sendResponse({ hasUpdate: false, error: error.message })
        })
      return true // 保持消息通道开放
    }
  })
}

// 扩展安装或更新时进行检查
if (chrome.runtime.onInstalled) {
  chrome.runtime.onInstalled.addListener(details => {
    if (details.reason === 'install' || details.reason === 'update') {
      console.log('扩展安装/更新，检查新版本...')
      checkForUpdates()
    }
  })
}

// 扩展启动时安排定期检查
scheduleUpdateCheck()

// 导出函数供其他模块使用
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    checkForUpdates,
    manualCheckForUpdates,
    isNewerVersion
  }
}
