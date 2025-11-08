// Sync manager module for userscript - handles WebDAV and S3 synchronization
import { createEl } from '../utils/createEl'
import { userscriptState } from '../state'
import { saveDataToLocalStorage, loadDataFromLocalStorage } from '../userscript-storage'
import { createModalElement } from '../utils/editorUtils'
import { showTemporaryMessage } from '../utils/tempMessage'
import {
  createSyncTarget,
  type SyncTargetConfig,
  type WebDAVConfig,
  type S3Config,
  type SyncData
} from '../plugins/syncTargets'

const SYNC_CONFIG_KEY = 'emoji_extension_sync_config'

// Load sync configuration from localStorage
function loadSyncConfig(): SyncTargetConfig | null {
  try {
    const configData = localStorage.getItem(SYNC_CONFIG_KEY)
    if (configData) {
      return JSON.parse(configData)
    }
  } catch (error) {
    console.error('[Sync Manager] Failed to load sync config:', error)
  }
  return null
}

// Save sync configuration to localStorage
function saveSyncConfig(config: SyncTargetConfig): void {
  try {
    localStorage.setItem(SYNC_CONFIG_KEY, JSON.stringify(config))
    console.log('[Sync Manager] Sync config saved')
  } catch (error) {
    console.error('[Sync Manager] Failed to save sync config:', error)
  }
}

// Create sync data from current state
function createSyncDataFromState(): SyncData {
  return {
    emojiGroups: userscriptState.emojiGroups,
    settings: userscriptState.settings,
    timestamp: Date.now(),
    version: '1.0'
  }
}

// Apply sync data to current state
function applySyncDataToState(data: SyncData): void {
  userscriptState.emojiGroups = data.emojiGroups || []
  userscriptState.settings = data.settings || userscriptState.settings
  saveDataToLocalStorage({
    emojiGroups: userscriptState.emojiGroups,
    settings: userscriptState.settings
  })
}

// Show sync configuration modal
export function showSyncConfigModal() {
  const existingConfig = loadSyncConfig()
  const syncType = existingConfig?.type || 'webdav'

  const contentHTML = `
    <div style="margin-bottom: 24px;">
      <h3 style="margin: 0 0 12px 0; color: var(--emoji-modal-label);">同步类型</h3>
      <select id="syncTypeSelect" style="
        width: 100%;
        padding: 8px;
        background: var(--emoji-modal-button-bg);
        color: var(--emoji-modal-text);
        border: 1px solid var(--emoji-modal-border);
        border-radius: 4px;
        margin-bottom: 16px;
      ">
        <option value="webdav" ${syncType === 'webdav' ? 'selected' : ''}>WebDAV</option>
        <option value="s3" ${syncType === 's3' ? 'selected' : ''}>S3</option>
      </select>
    </div>

    <!-- WebDAV Configuration -->
    <div id="webdavConfig" style="display: ${syncType === 'webdav' ? 'block' : 'none'};">
      <h3 style="margin: 0 0 12px 0; color: var(--emoji-modal-label);">WebDAV 配置</h3>
      
      <div style="margin-bottom: 12px;">
        <label style="display: block; margin-bottom: 4px; color: var(--emoji-modal-label);">服务器 URL:</label>
        <input type="text" id="webdavUrl" placeholder="https://your-webdav-server.com" value="${existingConfig?.type === 'webdav' ? existingConfig.url : ''}" style="
          width: 100%;
          padding: 8px;
          background: var(--emoji-modal-button-bg);
          color: var(--emoji-modal-text);
          border: 1px solid var(--emoji-modal-border);
          border-radius: 4px;
        ">
      </div>

      <div style="margin-bottom: 12px;">
        <label style="display: block; margin-bottom: 4px; color: var(--emoji-modal-label);">用户名:</label>
        <input type="text" id="webdavUsername" value="${existingConfig?.type === 'webdav' ? existingConfig.username : ''}" style="
          width: 100%;
          padding: 8px;
          background: var(--emoji-modal-button-bg);
          color: var(--emoji-modal-text);
          border: 1px solid var(--emoji-modal-border);
          border-radius: 4px;
        ">
      </div>

      <div style="margin-bottom: 12px;">
        <label style="display: block; margin-bottom: 4px; color: var(--emoji-modal-label);">密码:</label>
        <input type="password" id="webdavPassword" value="${existingConfig?.type === 'webdav' ? existingConfig.password : ''}" style="
          width: 100%;
          padding: 8px;
          background: var(--emoji-modal-button-bg);
          color: var(--emoji-modal-text);
          border: 1px solid var(--emoji-modal-border);
          border-radius: 4px;
        ">
      </div>

      <div style="margin-bottom: 12px;">
        <label style="display: block; margin-bottom: 4px; color: var(--emoji-modal-label);">文件路径 (可选):</label>
        <input type="text" id="webdavPath" placeholder="emoji-data.json" value="${existingConfig?.type === 'webdav' ? existingConfig.path || '' : ''}" style="
          width: 100%;
          padding: 8px;
          background: var(--emoji-modal-button-bg);
          color: var(--emoji-modal-text);
          border: 1px solid var(--emoji-modal-border);
          border-radius: 4px;
        ">
      </div>
    </div>

    <!-- S3 Configuration -->
    <div id="s3Config" style="display: ${syncType === 's3' ? 'block' : 'none'};">
      <h3 style="margin: 0 0 12px 0; color: var(--emoji-modal-label);">S3 配置</h3>
      
      <div style="margin-bottom: 12px;">
        <label style="display: block; margin-bottom: 4px; color: var(--emoji-modal-label);">Endpoint:</label>
        <input type="text" id="s3Endpoint" placeholder="s3.amazonaws.com" value="${existingConfig?.type === 's3' ? existingConfig.endpoint : ''}" style="
          width: 100%;
          padding: 8px;
          background: var(--emoji-modal-button-bg);
          color: var(--emoji-modal-text);
          border: 1px solid var(--emoji-modal-border);
          border-radius: 4px;
        ">
      </div>

      <div style="margin-bottom: 12px;">
        <label style="display: block; margin-bottom: 4px; color: var(--emoji-modal-label);">Region:</label>
        <input type="text" id="s3Region" placeholder="us-east-1" value="${existingConfig?.type === 's3' ? existingConfig.region : ''}" style="
          width: 100%;
          padding: 8px;
          background: var(--emoji-modal-button-bg);
          color: var(--emoji-modal-text);
          border: 1px solid var(--emoji-modal-border);
          border-radius: 4px;
        ">
      </div>

      <div style="margin-bottom: 12px;">
        <label style="display: block; margin-bottom: 4px; color: var(--emoji-modal-label);">Bucket:</label>
        <input type="text" id="s3Bucket" placeholder="my-bucket" value="${existingConfig?.type === 's3' ? existingConfig.bucket : ''}" style="
          width: 100%;
          padding: 8px;
          background: var(--emoji-modal-button-bg);
          color: var(--emoji-modal-text);
          border: 1px solid var(--emoji-modal-border);
          border-radius: 4px;
        ">
      </div>

      <div style="margin-bottom: 12px;">
        <label style="display: block; margin-bottom: 4px; color: var(--emoji-modal-label);">Access Key ID:</label>
        <input type="text" id="s3AccessKeyId" value="${existingConfig?.type === 's3' ? existingConfig.accessKeyId : ''}" style="
          width: 100%;
          padding: 8px;
          background: var(--emoji-modal-button-bg);
          color: var(--emoji-modal-text);
          border: 1px solid var(--emoji-modal-border);
          border-radius: 4px;
        ">
      </div>

      <div style="margin-bottom: 12px;">
        <label style="display: block; margin-bottom: 4px; color: var(--emoji-modal-label);">Secret Access Key:</label>
        <input type="password" id="s3SecretAccessKey" value="${existingConfig?.type === 's3' ? existingConfig.secretAccessKey : ''}" style="
          width: 100%;
          padding: 8px;
          background: var(--emoji-modal-button-bg);
          color: var(--emoji-modal-text);
          border: 1px solid var(--emoji-modal-border);
          border-radius: 4px;
        ">
      </div>

      <div style="margin-bottom: 12px;">
        <label style="display: block; margin-bottom: 4px; color: var(--emoji-modal-label);">路径前缀 (可选):</label>
        <input type="text" id="s3Path" placeholder="emoji-data.json" value="${existingConfig?.type === 's3' ? existingConfig.path || '' : ''}" style="
          width: 100%;
          padding: 8px;
          background: var(--emoji-modal-button-bg);
          color: var(--emoji-modal-text);
          border: 1px solid var(--emoji-modal-border);
          border-radius: 4px;
        ">
      </div>
    </div>

    <div style="display: flex; gap: 8px; margin-top: 16px;">
      <button id="testConnection" style="padding: 8px 16px; background: var(--emoji-modal-button-bg); color: var(--emoji-modal-text); border: 1px solid var(--emoji-modal-border); border-radius: 4px; cursor: pointer;">测试连接</button>
      <button id="saveConfig" style="padding: 8px 16px; background: var(--emoji-modal-primary-bg); color: white; border: none; border-radius: 4px; cursor: pointer;">保存配置</button>
    </div>
  `

  const modal = createModalElement({
    title: '同步配置',
    content: contentHTML,
    onClose: () => modal.remove()
  })

  document.body.appendChild(modal)

  // Handle sync type change
  const syncTypeSelect = modal.querySelector('#syncTypeSelect') as HTMLSelectElement
  const webdavConfigDiv = modal.querySelector('#webdavConfig') as HTMLDivElement
  const s3ConfigDiv = modal.querySelector('#s3Config') as HTMLDivElement

  syncTypeSelect.addEventListener('change', () => {
    const selectedType = syncTypeSelect.value
    webdavConfigDiv.style.display = selectedType === 'webdav' ? 'block' : 'none'
    s3ConfigDiv.style.display = selectedType === 's3' ? 'block' : 'none'
  })

  // Handle test connection
  const testBtn = modal.querySelector('#testConnection') as HTMLButtonElement
  testBtn.addEventListener('click', async () => {
    const config = getCurrentConfigFromModal(modal)
    if (!config) {
      showTemporaryMessage('请填写完整的配置信息', 'error')
      return
    }

    testBtn.disabled = true
    testBtn.textContent = '测试中...'

    try {
      const target = createSyncTarget(config)
      const result = await target.test()

      if (result.success) {
        showTemporaryMessage(result.message, 'success')
      } else {
        showTemporaryMessage(result.message, 'error')
      }
    } catch (error) {
      showTemporaryMessage(`测试失败: ${error}`, 'error')
    } finally {
      testBtn.disabled = false
      testBtn.textContent = '测试连接'
    }
  })

  // Handle save config
  const saveBtn = modal.querySelector('#saveConfig') as HTMLButtonElement
  saveBtn.addEventListener('click', () => {
    const config = getCurrentConfigFromModal(modal)
    if (!config) {
      showTemporaryMessage('请填写完整的配置信息', 'error')
      return
    }

    saveSyncConfig(config)
    showTemporaryMessage('配置已保存', 'success')
    modal.remove()
  })
}

// Get current config from modal inputs
function getCurrentConfigFromModal(modal: HTMLElement): SyncTargetConfig | null {
  const syncType = (modal.querySelector('#syncTypeSelect') as HTMLSelectElement).value

  if (syncType === 'webdav') {
    const url = (modal.querySelector('#webdavUrl') as HTMLInputElement).value.trim()
    const username = (modal.querySelector('#webdavUsername') as HTMLInputElement).value.trim()
    const password = (modal.querySelector('#webdavPassword') as HTMLInputElement).value.trim()
    const path = (modal.querySelector('#webdavPath') as HTMLInputElement).value.trim()

    if (!url || !username || !password) {
      return null
    }

    return {
      type: 'webdav',
      enabled: true,
      url,
      username,
      password,
      path: path || undefined
    } as WebDAVConfig
  } else if (syncType === 's3') {
    const endpoint = (modal.querySelector('#s3Endpoint') as HTMLInputElement).value.trim()
    const region = (modal.querySelector('#s3Region') as HTMLInputElement).value.trim()
    const bucket = (modal.querySelector('#s3Bucket') as HTMLInputElement).value.trim()
    const accessKeyId = (modal.querySelector('#s3AccessKeyId') as HTMLInputElement).value.trim()
    const secretAccessKey = (modal.querySelector('#s3SecretAccessKey') as HTMLInputElement).value.trim()
    const path = (modal.querySelector('#s3Path') as HTMLInputElement).value.trim()

    if (!endpoint || !region || !bucket || !accessKeyId || !secretAccessKey) {
      return null
    }

    return {
      type: 's3',
      enabled: true,
      endpoint,
      region,
      bucket,
      accessKeyId,
      secretAccessKey,
      path: path || undefined
    } as S3Config
  }

  return null
}

// Show sync operations modal (push/pull)
export function showSyncOperationsModal() {
  const config = loadSyncConfig()

  if (!config) {
    showTemporaryMessage('请先配置同步设置', 'error')
    showSyncConfigModal()
    return
  }

  const lastSyncTime = config.lastSyncTime
    ? new Date(config.lastSyncTime).toLocaleString()
    : '从未同步'

  const contentHTML = `
    <div style="margin-bottom: 24px;">
      <h3 style="margin: 0 0 12px 0; color: var(--emoji-modal-label);">同步状态</h3>
      <div style="padding: 12px; background: var(--emoji-modal-button-bg); border-radius: 4px; margin-bottom: 16px;">
        <div style="color: var(--emoji-modal-text); margin-bottom: 4px;">
          <strong>同步类型:</strong> ${config.type.toUpperCase()}
        </div>
        <div style="color: var(--emoji-modal-text);">
          <strong>最后同步:</strong> ${lastSyncTime}
        </div>
      </div>
    </div>

    <div style="margin-bottom: 24px;">
      <h3 style="margin: 0 0 12px 0; color: var(--emoji-modal-label);">同步操作</h3>
      
      <div style="margin-bottom: 16px;">
        <button id="pushData" style="
          width: 100%;
          padding: 12px;
          background: var(--emoji-modal-primary-bg);
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
        ">
          ⬆️ 推送 (Push) - 上传本地数据到服务器
        </button>
        <div style="font-size: 12px; color: var(--emoji-modal-text); opacity: 0.7; margin-top: 4px;">
          将当前的表情分组和设置推送到远程服务器
        </div>
      </div>

      <div style="margin-bottom: 16px;">
        <button id="pullData" style="
          width: 100%;
          padding: 12px;
          background: #10b981;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
        ">
          ⬇️ 拉取 (Pull) - 从服务器下载数据
        </button>
        <div style="font-size: 12px; color: var(--emoji-modal-text); opacity: 0.7; margin-top: 4px;">
          从远程服务器拉取表情分组和设置（会覆盖本地数据）
        </div>
      </div>

      <div>
        <button id="configSync" style="
          width: 100%;
          padding: 12px;
          background: var(--emoji-modal-button-bg);
          color: var(--emoji-modal-text);
          border: 1px solid var(--emoji-modal-border);
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
        ">
          ⚙️ 同步配置
        </button>
      </div>
    </div>
  `

  const modal = createModalElement({
    title: '同步管理',
    content: contentHTML,
    onClose: () => modal.remove()
  })

  document.body.appendChild(modal)

  // Handle push
  const pushBtn = modal.querySelector('#pushData') as HTMLButtonElement
  pushBtn.addEventListener('click', async () => {
    pushBtn.disabled = true
    pushBtn.textContent = '推送中...'

    try {
      const target = createSyncTarget(config)
      const syncData = createSyncDataFromState()
      const result = await target.push(syncData)

      if (result.success) {
        config.lastSyncTime = Date.now()
        saveSyncConfig(config)
        showTemporaryMessage('数据推送成功', 'success')
        modal.remove()
      } else {
        showTemporaryMessage(`推送失败: ${result.message}`, 'error')
      }
    } catch (error) {
      showTemporaryMessage(`推送错误: ${error}`, 'error')
    } finally {
      pushBtn.disabled = false
      pushBtn.textContent = '⬆️ 推送 (Push) - 上传本地数据到服务器'
    }
  })

  // Handle pull
  const pullBtn = modal.querySelector('#pullData') as HTMLButtonElement
  pullBtn.addEventListener('click', async () => {
    if (!confirm('拉取数据会覆盖当前的本地数据，确定要继续吗？')) {
      return
    }

    pullBtn.disabled = true
    pullBtn.textContent = '拉取中...'

    try {
      const target = createSyncTarget(config)
      const result = await target.pull()

      if (result.success && result.data) {
        applySyncDataToState(result.data)
        config.lastSyncTime = Date.now()
        saveSyncConfig(config)
        showTemporaryMessage('数据拉取成功，页面将刷新', 'success')
        setTimeout(() => {
          window.location.reload()
        }, 1000)
      } else {
        showTemporaryMessage(`拉取失败: ${result.message}`, 'error')
      }
    } catch (error) {
      showTemporaryMessage(`拉取错误: ${error}`, 'error')
    } finally {
      pullBtn.disabled = false
      pullBtn.textContent = '⬇️ 拉取 (Pull) - 从服务器下载数据'
    }
  })

  // Handle config
  const configBtn = modal.querySelector('#configSync') as HTMLButtonElement
  configBtn.addEventListener('click', () => {
    modal.remove()
    showSyncConfigModal()
  })
}
