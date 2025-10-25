// FFmpeg functionality for WebM to WebP conversion
let ffmpeg = null;
let ffmpegLoaded = false;
let ffmpegFailed = false; // Flag to track if FFmpeg has permanently failed to initialize

// DOM elements
const botTokenInput = document.getElementById('botToken')
const saveTokenBtn = document.getElementById('saveTokenBtn')
const loadStickersBtn = document.getElementById('loadStickersBtn')
const downloadAllBtn = document.getElementById('downloadAllBtn')
const statusMessage = document.getElementById('statusMessage')
const stickerList = document.getElementById('stickerList')
const stickersContainer = document.getElementById('stickersContainer')
const progressContainer = document.getElementById('progressContainer')
const progressBar = document.getElementById('progressBar')
const progressText = document.getElementById('progressText')
const retrySection = document.getElementById('retrySection')
const retryFailedBtn = document.getElementById('retryFailedBtn')
const failedStickersList = document.getElementById('failedStickersList')
const failedStickersContainer = document.getElementById('failedStickersContainer')
const stats = document.getElementById('stats')
const totalStat = document.getElementById('totalStat')
const downloadedStat = document.getElementById('downloadedStat')
const failedStat = document.getElementById('failedStat')
const sidePanel = document.getElementById('sidePanel')
const sidePanelToggle = document.getElementById('sidePanelToggle')
const mainContainer = document.querySelector('.container')
const stickerSetNameInput = document.getElementById('stickerSetName')
const downloadHistorySection = document.getElementById('downloadHistorySection')
const historyContainer = document.getElementById('historyContainer')
const clearHistoryBtn = document.getElementById('clearHistoryBtn')
const batchDownloadBtn = document.getElementById('batchDownloadBtn')
const convertWebMtoWebPCheckbox = document.getElementById('convertWebMtoWebP')
const initFFmpegBtn = document.getElementById('initFFmpegBtn')
const ffmpegLogEl = document.getElementById('ffmpegLog')

// State variables
let botToken = ''
let stickers = []
let downloadedStickers = new Set()
let failedDownloads = new Set()

// Ensure FFmpeg module is loaded and available on window.TelegramFFmpeg
let _ffmpegModuleLoading = null
function ensureFFmpegLoaded() {
  if (window.TelegramFFmpeg) return Promise.resolve()
  if (_ffmpegModuleLoading) return _ffmpegModuleLoading

  _ffmpegModuleLoading = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = '/assets/js/telegram-ffmpeg.js'
    script.async = true
    script.onload = () => {
      if (window.TelegramFFmpeg) {
        resolve()
      } else {
        reject(new Error('FFmpeg module loaded but API missing'))
      }
    }
    script.onerror = (e) => reject(new Error('Failed to load FFmpeg module'))
    document.head.appendChild(script)
  }).catch(err => {
    console.warn('Could not load FFmpeg module:', err)
    // Keep promise resolved so callers continue, but module won't be available
  })

  return _ffmpegModuleLoading
}

// Register FFmpeg UI callbacks when module is available
function registerFFmpegUICallbacks() {
  if (!window.TelegramFFmpeg) return
  // log forwarding
  window.TelegramFFmpeg._onLog = (msg) => {
    appendFFmpegLog(String(msg))
  }
  // progress forwarding (general or sticker-specific)
  window.TelegramFFmpeg._onProgress = (info) => {
    // info may contain stickerIndex and progress
    try {
      if (info && typeof info === 'object' && typeof info.progress === 'number') {
        if (typeof info.stickerIndex === 'number') {
          // per-sticker ffmpeg progress (0..1)
          updateStickerProgress(info.stickerIndex, Math.round(info.progress * 100))
        } else {
          // global ffmpeg progress show near top progressText (optional)
          // for now append to logs
          appendFFmpegLog(`Progress: ${(info.progress * 100).toFixed(2)}%`)
        }
      }
    } catch (e) {
      console.warn('Error handling ffmpeg progress info', e)
    }
  }
}

// NOTE: FFmpeg-related implementation moved to /assets/js/telegram-ffmpeg.js
// Helper to call convert/compress functions from that module when needed.

// Helper: check whether a Blob is actually a WebP image by peeking at file signature
async function isBlobWebP(blob) {
  try {
    const ab = await blob.arrayBuffer()
    if (ab.byteLength < 12) return false
    const dv = new DataView(ab)
    // Check 'RIFF' at 0 and 'WEBP' at offset 8
    const riff = String.fromCharCode(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3))
    const webp = String.fromCharCode(dv.getUint8(8), dv.getUint8(9), dv.getUint8(10), dv.getUint8(11))
    return riff === 'RIFF' && webp === 'WEBP'
  } catch (e) {
    console.warn('isBlobWebP check failed:', e)
    return false
  }
}

// Initialize from localStorage
function initialize() {
  const savedToken = localStorage.getItem('telegramBotToken')
  const savedStickerSetName = localStorage.getItem('currentStickerSetName')

  if (savedToken) {
    botTokenInput.value = savedToken
    botToken = savedToken
  }

  if (savedStickerSetName) {
    stickerSetNameInput.value = savedStickerSetName
  }

  // Enable buttons if both token and sticker set name are present
  const hasToken = botTokenInput.value.trim()
  const hasSetName = stickerSetNameInput.value.trim()

  loadStickersBtn.disabled = !hasToken || !hasSetName
  batchDownloadBtn.disabled = !hasToken || !hasSetName

  // Set up the input event for the token field to enable/disable buttons
  botTokenInput.addEventListener('input', function () {
    const hasToken = this.value.trim()
    const hasSetName = stickerSetNameInput.value.trim()

    loadStickersBtn.disabled = !hasToken || !hasSetName
    batchDownloadBtn.disabled = !hasToken || !hasSetName
  })

  // Set up the input event for the sticker set name field to enable/disable buttons
  stickerSetNameInput.addEventListener('input', function () {
    const hasToken = botTokenInput.value.trim()
    const hasSetName = this.value.trim()

    loadStickersBtn.disabled = !hasToken || !hasSetName
    batchDownloadBtn.disabled = !hasToken || !hasSetName
  })
}

// Save token to localStorage
function saveToken() {
  const token = botTokenInput.value.trim()
  if (!token) {
    showStatus('Please enter a bot token', 'error')
    return
  }

  botToken = token
  localStorage.setItem('telegramBotToken', token)
  showStatus('Token saved successfully', 'success')
  loadStickersBtn.disabled = false
}

// Show status message
function showStatus(message, type) {
  statusMessage.textContent = message
  statusMessage.className = `status ${type}`
  statusMessage.style.display = 'block'

  // Auto-hide success messages after 3 seconds
  if (type === 'success') {
    setTimeout(() => {
      statusMessage.style.display = 'none'
    }, 3000)
  }
}

// Get file path from file ID
async function getFile(fileId) {
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`
    )
    const data = await response.json()
    if (data.ok) {
      return data.result
    } else {
      throw new Error(data.description || 'Failed to get file info')
    }
  } catch (error) {
    console.error('Error getting file info:', error)
    throw error
  }
}

// Create direct file URL from cached file path
function createFileUrl(filePath) {
  try {
    // Return the direct URL to Telegram API for individual downloads
    const fileUrl = `https://api.telegram.org/file/bot${botToken}/${filePath}`
    return fileUrl
  } catch (error) {
    console.error('Error preparing file download:', error)
    throw error
  }
}


// Create a sticker element for the UI
function createStickerElement(sticker, index) {
  const stickerItem = document.createElement('div')
  stickerItem.className = 'sticker-item'

  // Create preview container
  const previewContainer = document.createElement('div')
  previewContainer.className = 'sticker-preview'

  // Create image element for preview
  const img = document.createElement('img')
  img.alt = `Sticker ${sticker.file_id}`
  img.loading = 'lazy'

  // Try to get preview from thumbnail or create from sticker
  if (sticker.thumb && sticker.thumb.file_id) {
    // Use cached thumbnail file path if available, otherwise fetch it
    if (sticker.thumb.file_path) {
      img.src = `https://api.telegram.org/file/bot${botToken}/${sticker.thumb.file_path}`
    } else {
      // If thumbnail doesn't have cached path, fetch it
      getFile(sticker.thumb.file_id)
        .then(fileInfo => {
          // Cache the thumbnail path in case we need it again
          if (!sticker.thumb.file_path) {
            sticker.thumb.file_path = fileInfo.file_path
          }
          img.src = `https://api.telegram.org/file/bot${botToken}/${fileInfo.file_path}`
        })
        .catch(() => {
          // Fallback to question mark if thumbnail fails
          img.src =
            'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="50" height="50" viewBox="0 0 24 24"><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="20">?</text></svg>'
        })
    }
  }

  previewContainer.appendChild(img)

  // Create info container
  const infoContainer = document.createElement('div')
  infoContainer.className = 'sticker-info'

  const nameElement = document.createElement('div')
  nameElement.className = 'sticker-name'
  nameElement.textContent = `Sticker ${index + 1}`

  const fileIdElement = document.createElement('div')
  fileIdElement.className = 'sticker-file-id'
  fileIdElement.textContent = sticker.file_id

  const sizeElement = document.createElement('div')
  sizeElement.className = 'sticker-size'
  sizeElement.textContent = `Size: ${sticker.file_size ? Math.round(sticker.file_size / 1024) + ' KB' : 'Unknown'}`

  infoContainer.appendChild(nameElement)
  infoContainer.appendChild(fileIdElement)
  infoContainer.appendChild(sizeElement)

  // Create actions container
  const actionsContainer = document.createElement('div')
  actionsContainer.className = 'sticker-actions'

  const downloadBtn = document.createElement('button')
  downloadBtn.textContent = 'Download'
  downloadBtn.onclick = () => downloadSingleSticker(sticker, index)

  const retryBtn = document.createElement('button')
  retryBtn.textContent = 'Retry'
  retryBtn.className = 'btn-danger'
  retryBtn.onclick = () => retryDownload(sticker, index)
  retryBtn.style.display = 'none' // Initially hidden

  const statusElement = document.createElement('span')
  statusElement.className = 'status-indicator'
  statusElement.textContent = ''

  // per-sticker progress bar
  const progressWrap = document.createElement('div')
  progressWrap.className = 'sticker-progress-wrap hidden'
  const progressBarInner = document.createElement('div')
  progressBarInner.className = 'sticker-progress-bar'
  const progressPct = document.createElement('span')
  progressPct.className = 'sticker-progress-pct'
  progressPct.textContent = ''
  progressWrap.appendChild(progressBarInner)
  progressWrap.appendChild(progressPct)

  actionsContainer.appendChild(progressWrap)

  actionsContainer.appendChild(downloadBtn)
  actionsContainer.appendChild(retryBtn)
  actionsContainer.appendChild(statusElement)

  stickerItem.appendChild(previewContainer)
  stickerItem.appendChild(infoContainer)
  stickerItem.appendChild(actionsContainer)

  // store references for progress updates
  stickerItem._progressBar = progressBarInner
  stickerItem._progressWrap = progressWrap
  stickerItem._progressPct = progressPct

  // Update status based on download state
  updateStickerStatus(index, 'not-downloaded')

  return stickerItem
}

// Alternative download method for CORS issues
function downloadFileWithCORSHandling(fileUrl, filename) {
  // Open the file URL in a new tab/window to allow the user to download manually
  const newWindow = window.open(fileUrl, '_blank')
  if (!newWindow) {
    // If popup is blocked, show an error message
    showStatus(
      'Please allow popups to download the file, or right-click and select "Save link as..."',
      'error'
    )
    throw new Error('Popup blocked')
  }
  // Provide instructions to user
  showStatus(
    `File opened in new tab. Click the download button or right-click and "Save link as..." to save: ${filename}`,
    'info'
  )
}

// Get sticker set by name
async function getStickerSet(name) {
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/getStickerSet?name=${name}`
    )
    const data = await response.json()
    if (data.ok) {
      return data.result
    } else {
      throw new Error(data.description || 'Failed to get sticker set')
    }
  } catch (error) {
    console.error('Error getting sticker set:', error)
    throw error
  }
}

// Load stickers from a sticker set
async function loadStickers() {
  let setName = stickerSetNameInput.value.trim()

  // Extract set name from URL if a URL is provided
  if (setName.startsWith('https://t.me/addstickers/')) {
    setName = setName.replace('https://t.me/addstickers/', '')
  } else if (setName.startsWith('https://telegram.me/addstickers/')) {
    setName = setName.replace('https://telegram.me/addstickers/', '')
  }

  if (!setName) {
    showStatus('Sticker set name or URL is required', 'error')
    return
  }

  // Save sticker set name to localStorage
  localStorage.setItem('currentStickerSetName', setName)

  showStatus('Loading stickers...', 'info')

  // Register FFmpeg UI callbacks if loaded
  registerFFmpegUICallbacks()

  try {
    const stickerSet = await getStickerSet(setName)

    // Initialize arrays
    stickers = []
    downloadedStickers = new Set() // Reset on new load
    failedDownloads = new Set() // Reset on new load

    // Clear current sticker display
    stickersContainer.innerHTML = ''
    stickerList.classList.remove('hidden')
    downloadAllBtn.disabled = false

    // Process stickers one by one, adding each to the display as it loads
    for (let i = 0; i < stickerSet.stickers.length; i++) {
      const sticker = stickerSet.stickers[i]
      try {
        const fileInfo = await getFile(sticker.file_id)
        // Add file path information to the sticker object
        const stickerWithInfo = {
          ...sticker,
          file_path: fileInfo.file_path,
          file_unique_id: fileInfo.file_unique_id,
          file_size: fileInfo.file_size
        }

        // Add to our main array
        stickers.push(stickerWithInfo)

        // Create and add the sticker element to the container
        const stickerElement = createStickerElement(stickerWithInfo, i)
        stickersContainer.appendChild(stickerElement)

        // Update status message periodically
        if ((i + 1) % 5 === 0 || i === stickerSet.stickers.length - 1) {
          showStatus(`Loaded ${i + 1} of ${stickerSet.stickers.length} stickers...`, 'info')
        }
      } catch (fileError) {
        console.error(`Could not get file info for sticker ${sticker.file_id}:`, fileError)
        // Add sticker with minimal info if file info fails
        const stickerWithMinimalInfo = {
          ...sticker,
          file_path: null,
          file_unique_id: null,
          file_size: sticker.file_size
        }

        // Add to our main array
        stickers.push(stickerWithMinimalInfo)

        // Create and add the sticker element to the container
        const stickerElement = createStickerElement(stickerWithMinimalInfo, i)
        stickersContainer.appendChild(stickerElement)

        // Still update status even for failed ones
        if ((i + 1) % 5 === 0 || i === stickerSet.stickers.length - 1) {
          showStatus(
            `Loaded ${i + 1} of ${stickerSet.stickers.length} stickers... (${stickerSet.stickers.length - (i + 1)} remaining)`,
            'info'
          )
        }
      }
    }

    showStatus(`Successfully loaded ${stickers.length} stickers`, 'success')

    // Store the loaded stickers in localStorage for persistence
    try {
      const stickerData = {
        setName: setName,
        stickers: stickers,
        downloadedStickers: Array.from(downloadedStickers), // Convert Set to Array
        failedDownloads: Array.from(failedDownloads), // Convert Set to Array
        timestamp: Date.now()
      };
      localStorage.setItem('cachedStickers', JSON.stringify(stickerData));
    } catch (storageError) {
      console.warn('Could not save stickers to localStorage:', storageError);
    }

    updateStats()
  } catch (error) {
    showStatus(`Error loading stickers: ${error.message}`, 'error')
    console.error(error)
  }
}

// Render stickers to the page
function renderStickers() {
  stickersContainer.innerHTML = ''

  if (stickers.length === 0) {
    stickersContainer.innerHTML = '<p>No stickers loaded</p>'
    return
  }

  stickers.forEach((sticker, index) => {
    const stickerItem = document.createElement('div')
    stickerItem.className = 'sticker-item'

    // Create preview container
    const previewContainer = document.createElement('div')
    previewContainer.className = 'sticker-preview'

    // Create image element for preview
    const img = document.createElement('img')
    img.alt = `Sticker ${sticker.file_id}`
    img.loading = 'lazy'

    // Try to get preview from thumbnail or create from sticker
    if (sticker.thumb && sticker.thumb.file_id) {
      // Use cached thumbnail file path if available, otherwise fetch it
      if (sticker.thumb.file_path) {
        img.src = `https://api.telegram.org/file/bot${botToken}/${sticker.thumb.file_path}`
      } else {
        // If thumbnail doesn't have cached path, fetch it
        getFile(sticker.thumb.file_id)
          .then(fileInfo => {
            // Cache the thumbnail path in case we need it again
            sticker.thumb.file_path = fileInfo.file_path
            img.src = `https://api.telegram.org/file/bot${botToken}/${fileInfo.file_path}`
          })
          .catch(() => {
            // Fallback to question mark if thumbnail fails
            img.src =
              'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="50" height="50" viewBox="0 0 24 24"><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="20">?</text></svg>'
          })
      }
    }

    previewContainer.appendChild(img)

    // Create info container
    const infoContainer = document.createElement('div')
    infoContainer.className = 'sticker-info'

    const nameElement = document.createElement('div')
    nameElement.className = 'sticker-name'
    nameElement.textContent = `Sticker ${index + 1}`

    const fileIdElement = document.createElement('div')
    fileIdElement.className = 'sticker-file-id'
    fileIdElement.textContent = sticker.file_id

    const sizeElement = document.createElement('div')
    sizeElement.className = 'sticker-size'
    sizeElement.textContent = `Size: ${sticker.file_size ? Math.round(sticker.file_size / 1024) + ' KB' : 'Unknown'}`

    infoContainer.appendChild(nameElement)
    infoContainer.appendChild(fileIdElement)
    infoContainer.appendChild(sizeElement)

    // Create actions container
    const actionsContainer = document.createElement('div')
    actionsContainer.className = 'sticker-actions'

    const downloadBtn = document.createElement('button')
    downloadBtn.textContent = 'Download'
    downloadBtn.onclick = () => downloadSingleSticker(sticker, index)

    const retryBtn = document.createElement('button')
    retryBtn.textContent = 'Retry'
    retryBtn.className = 'btn-danger'
    retryBtn.onclick = () => retryDownload(sticker, index)
    retryBtn.style.display = 'none' // Initially hidden

    const statusElement = document.createElement('span')
    statusElement.className = 'status-indicator'
    statusElement.textContent = ''

    actionsContainer.appendChild(downloadBtn)
    actionsContainer.appendChild(retryBtn)
    actionsContainer.appendChild(statusElement)

    stickerItem.appendChild(previewContainer)
    stickerItem.appendChild(infoContainer)
    stickerItem.appendChild(actionsContainer)

    stickersContainer.appendChild(stickerItem)

    // Update status based on download state
    updateStickerStatus(index, 'not-downloaded')
  })

  renderFailedStickers()
}

// Update sticker status display
function updateStickerStatus(index, status) {
  const stickerItem = stickersContainer.children[index]
  if (!stickerItem) return

  const downloadBtn = stickerItem.querySelector('button:first-child')
  const retryBtn = stickerItem.querySelector('button:nth-child(2)')
  const statusElement = stickerItem.querySelector('.status-indicator')

  switch (status) {
    case 'downloading':
      downloadBtn.disabled = true
      statusElement.textContent = 'Downloading...'
      statusElement.className = 'status-indicator spinner'
      break
    case 'downloaded':
      downloadBtn.disabled = true
      downloadBtn.textContent = 'Downloaded'
      downloadBtn.className = 'btn-success'
      statusElement.textContent = '✓'
      statusElement.className = 'status-indicator'
      downloadedStickers.add(index)

      // Add to download history
      addToDownloadHistory(stickers[index])
      break
    case 'failed':
      downloadBtn.disabled = true
      retryBtn.style.display = 'inline-block'
      statusElement.textContent = 'Failed'
      statusElement.className = 'status-indicator'
      failedDownloads.add(index)
      break
    case 'not-downloaded':
      downloadBtn.disabled = false
      downloadBtn.textContent = 'Download'
      downloadBtn.className = ''
      retryBtn.style.display = 'none'
      statusElement.textContent = ''
      statusElement.className = 'status-indicator'
      break
  }

  updateStats()
}

// Add a sticker to the download history
function addToDownloadHistory(sticker) {
  const history = JSON.parse(localStorage.getItem('downloadHistory') || '[]')

  // Check if this sticker is already in history
  const exists = history.some(item => item.file_id === sticker.file_id)

  if (!exists) {
    const historyItem = {
      file_id: sticker.file_id,
      set_name: localStorage.getItem('currentStickerSetName') || 'Unknown Set',
      timestamp: new Date().toISOString(),
      size: sticker.file_size,
      emoji: sticker.emoji || ''
    }

    history.push(historyItem)
    localStorage.setItem('downloadHistory', JSON.stringify(history))
  }
}

// Get download history
function getDownloadHistory() {
  return JSON.parse(localStorage.getItem('downloadHistory') || '[]')
}

// Render download history
function renderDownloadHistory() {
  const history = getDownloadHistory()
  const historyContainer = document.getElementById('historyContainer')
  const historySection = document.getElementById('downloadHistorySection')

  if (history.length === 0) {
    historyContainer.innerHTML = '<p>No downloads yet.</p>'
    historySection.classList.add('hidden')
    return
  }

  historyContainer.innerHTML = ''

  // Sort history by timestamp (newest first)
  history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))

  history.forEach((item, index) => {
    const historyItem = document.createElement('div')
    historyItem.className = 'history-item'

    const infoContainer = document.createElement('div')
    infoContainer.className = 'history-info'

    const fileIdElement = document.createElement('div')
    fileIdElement.className = 'history-file-id'
    fileIdElement.textContent = item.file_id

    const metaElement = document.createElement('div')
    metaElement.className = 'history-meta'

    const sizeText = item.size ? `Size: ${Math.round(item.size / 1024)} KB` : ''
    const setText = item.set_name ? `Set: ${item.set_name}` : ''
    const timeText = `Time: ${new Date(item.timestamp).toLocaleString()}`

    metaElement.textContent = [setText, sizeText, timeText].filter(Boolean).join(' | ')

    infoContainer.appendChild(fileIdElement)
    infoContainer.appendChild(metaElement)

    historyItem.appendChild(infoContainer)

    historyContainer.appendChild(historyItem)
  })

  historySection.classList.remove('hidden')
}

// Clear download history
function clearDownloadHistory() {
  if (confirm('Are you sure you want to clear download history?')) {
    localStorage.removeItem('downloadHistory')
    renderDownloadHistory()
    showStatus('Download history cleared', 'success')
  }
}

// Download a single sticker
async function downloadSingleSticker(sticker, index) {
  updateStickerStatus(index, 'downloading')

  try {
    // Use cached file_path from when stickers were loaded
    if (!sticker.file_path) {
      // Fallback to get file info if not cached (shouldn't happen if loadStickers worked properly)
      const fileInfo = await getFile(sticker.file_id)
      sticker.file_path = fileInfo.file_path
      sticker.file_unique_id = fileInfo.file_unique_id
      sticker.file_size = fileInfo.file_size
    }

    // Use the sticker's file_id as the filename instead of file_XX
    const fileExtension = sticker.file_path.split('.').pop() || 'webp'
    const originalFilename = `${sticker.file_id}.${fileExtension}`
    
    // Check if we need to convert from WebM to WebP
    if (convertWebMtoWebPCheckbox.checked && fileExtension.toLowerCase() === 'webm') {
      try {
        // Fetch the WebM file via the proxy (show download progress)
        showStatus(`Downloading ${originalFilename}...`, 'info')
        
        const proxyUrl = `/api/proxy/telegram-file?token=${encodeURIComponent(botToken)}&path=${encodeURIComponent(sticker.file_path)}`
        
        // Fetch with progress (streaming) to update per-sticker download progress
        const webmBlob = await fetchWithProgress(proxyUrl, (loaded, total) => {
          const pct = total ? (loaded / total) * 100 : Math.round((loaded / 1024) / 10)
          updateStickerProgress(index, pct)
        })

        // Ensure ffmpeg module is loaded
        await ensureFFmpegLoaded()

        // Convert WebM to WebP if checkbox is checked (show conversion progress)
        showStatus(`Converting ${originalFilename} to WebP...`, 'info')
        let webpBlob = webmBlob
        let didConvert = false
        if (window.TelegramFFmpeg && typeof window.TelegramFFmpeg.convertWebMtoWebP === 'function') {
          try {
            webpBlob = await window.TelegramFFmpeg.convertWebMtoWebP(webmBlob, index, 1)
            // Verify returned blob is actually WebP; fallback to original if not
            if (webpBlob && await isBlobWebP(webpBlob)) {
              didConvert = true
            } else {
              console.warn('Conversion returned non-WebP blob, falling back to original WebM')
              webpBlob = webmBlob
              didConvert = false
            }
          } catch (convErr) {
            console.warn('Conversion threw error, falling back to original:', convErr)
            webpBlob = webmBlob
            didConvert = false
          }
        }

        // Create download link from the blob we actually have
        const url = URL.createObjectURL(webpBlob)
        const downloadFilename = didConvert ? `${sticker.file_id}.webp` : originalFilename

        const a = document.createElement('a')
        a.href = url
        a.download = downloadFilename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)

        // Clean up
        URL.revokeObjectURL(url)

        updateStickerStatus(index, 'downloaded')
        showStatus(didConvert ? `Successfully converted and downloaded as WebP: ${downloadFilename}` : `Downloaded original format (conversion unavailable): ${downloadFilename}`, didConvert ? 'success' : 'info')
      } catch (convertError) {
        console.error(`Error converting WebM to WebP for sticker ${index}:`, convertError)
        // Fall back to original download method
        const fileUrl = createFileUrl(sticker.file_path)
        const a = document.createElement('a')
        a.href = fileUrl
        a.download = originalFilename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        
        updateStickerStatus(index, 'downloaded')
        showStatus(`Downloaded original format (conversion failed): ${originalFilename}`, 'info')
      }
    } else {
      // Normal download without conversion
      showStatus(`Downloading ${originalFilename}...`, 'info')
      const fileUrl = createFileUrl(sticker.file_path)
      
      // Try direct download first
      try {
        // Create download link directly using the URL
        const a = document.createElement('a')
        a.href = fileUrl
        a.download = originalFilename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)

        updateStickerStatus(index, 'downloaded')
      } catch (downloadError) {
        // If direct download fails due to CORS, open in new tab
        console.warn(
          `Direct download failed for sticker ${index + 1}, opening in new tab:`,
          downloadError
        )
        downloadFileWithCORSHandling(fileUrl, originalFilename)
        // Consider it as downloaded since it's opened for user to handle
        updateStickerStatus(index, 'downloaded')
      }
    }
  } catch (error) {
    console.error(`Error downloading sticker ${index}:`, error)
    updateStickerStatus(index, 'failed')
    showStatus(`Failed to download sticker ${index + 1}: ${error.message}`, 'error')
  }
}

// Retry a single download
async function retryDownload(sticker, index) {
  updateStickerStatus(index, 'downloading')
  failedDownloads.delete(index) // Remove from failed set

  try {
    // Use cached file_path from when stickers were loaded
    if (!sticker.file_path) {
      // Fallback to get file info if not cached (shouldn't happen if loadStickers worked properly)
      const fileInfo = await getFile(sticker.file_id)
      sticker.file_path = fileInfo.file_path
      sticker.file_unique_id = fileInfo.file_unique_id
      sticker.file_size = fileInfo.file_size
    }

    // Use the sticker's file_id as the filename instead of file_XX
    const fileExtension = sticker.file_path.split('.').pop() || 'webp'
    const originalFilename = `${sticker.file_id}.${fileExtension}`
    
    // Check if we need to convert from WebM to WebP
    if (convertWebMtoWebPCheckbox.checked && fileExtension.toLowerCase() === 'webm') {
      try {
        // Fetch the WebM file via the proxy (show download progress)
        showStatus(`Downloading ${originalFilename}...`, 'info')
        
        const proxyUrl = `/api/proxy/telegram-file?token=${encodeURIComponent(botToken)}&path=${encodeURIComponent(sticker.file_path)}`
        
        // Fetch with progress (streaming) to update per-sticker download progress
        const webmBlob = await fetchWithProgress(proxyUrl, (loaded, total) => {
          const pct = total ? (loaded / total) * 100 : 0
          updateStickerProgress(index, pct)
        })
        
        // Convert WebM to WebP if checkbox is checked (show conversion progress)
        showStatus(`Converting ${originalFilename} to WebP...`, 'info')
        await ensureFFmpegLoaded()
        let webpBlob = webmBlob
        let didConvert = false
        if (window.TelegramFFmpeg && typeof window.TelegramFFmpeg.convertWebMtoWebP === 'function') {
          try {
            webpBlob = await window.TelegramFFmpeg.convertWebMtoWebP(webmBlob, index, 1)
            if (webpBlob && await isBlobWebP(webpBlob)) {
              didConvert = true
            } else {
              console.warn('Conversion returned non-WebP blob, falling back to original WebM')
              webpBlob = webmBlob
              didConvert = false
            }
          } catch (err) {
            console.warn('FFmpeg conversion failed, falling back to original blob', err)
            webpBlob = webmBlob
            didConvert = false
          }
        }

        // Create download link from the blob we actually have
        const url = URL.createObjectURL(webpBlob)
        const downloadFilename = didConvert ? `${sticker.file_id}.webp` : originalFilename

        const a = document.createElement('a')
        a.href = url
        a.download = downloadFilename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)

        // Clean up
        URL.revokeObjectURL(url)

        updateStickerStatus(index, 'downloaded')
        showStatus(didConvert ? `Successfully converted and downloaded as WebP: ${downloadFilename}` : `Downloaded original format (conversion unavailable): ${downloadFilename}`, didConvert ? 'success' : 'info')
      } catch (convertError) {
        console.error(`Error converting WebM to WebP for sticker ${index}:`, convertError)
        // Fall back to original download method
        const fileUrl = createFileUrl(sticker.file_path)
        const a = document.createElement('a')
        a.href = fileUrl
        a.download = originalFilename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        
        updateStickerStatus(index, 'downloaded')
        showStatus(`Downloaded original format (conversion failed): ${originalFilename}`, 'info')
      }
    } else {
      // Normal download without conversion
      showStatus(`Downloading ${originalFilename}...`, 'info')
      const fileUrl = createFileUrl(sticker.file_path)
      
      // Try direct download first
      try {
        // Create download link directly using the URL
        const a = document.createElement('a')
        a.href = fileUrl
        a.download = originalFilename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)

        updateStickerStatus(index, 'downloaded')
      } catch (downloadError) {
        // If direct download fails due to CORS, open in new tab
        console.warn(
          `Direct download failed for sticker ${index + 1}, opening in new tab:`,
          downloadError
        )
        downloadFileWithCORSHandling(fileUrl, originalFilename)
        // Consider it as downloaded since it's opened for user to handle
        updateStickerStatus(index, 'downloaded')
      }
    }
  } catch (error) {
    console.error(`Error retrying download for sticker ${index}:`, error)
    updateStickerStatus(index, 'failed')
    showStatus(`Retry failed for sticker ${index + 1}: ${error.message}`, 'error')
  }
}

// Download all stickers sequentially to avoid rate limiting
async function downloadAllStickers() {
  if (stickers.length === 0) {
    showStatus('No stickers to download', 'error')
    return
  }

  showStatus(`Starting download of ${stickers.length} stickers...`, 'info')

  let successCount = 0
  let failedCount = 0

  // Reset progress
  updateProgress(0)

  for (let i = 0; i < stickers.length; i++) {
    const sticker = stickers[i]

    // Only download if not already downloaded or failed
    if (!downloadedStickers.has(i) && !failedDownloads.has(i)) {
      try {
        // Use cached file_path from when stickers were loaded
        if (!sticker.file_path) {
          // Fallback to get file info if not cached (shouldn't happen if loadStickers worked properly)
          const fileInfo = await getFile(sticker.file_id)
          sticker.file_path = fileInfo.file_path
          sticker.file_unique_id = fileInfo.file_unique_id
          sticker.file_size = fileInfo.file_size
        }

        // Download the file using the CF Worker as a proxy to avoid CORS and rate limiting
        const proxyUrl = `/api/proxy/telegram-file?token=${encodeURIComponent(botToken)}&path=${encodeURIComponent(sticker.file_path)}`

        // Create a request to the CF Worker proxy
        // Fetch with progress for batch download
        const blob = await fetchWithProgress(proxyUrl, (loaded, total) => {
          const pct = total ? (loaded / total) * 100 : 0
          updateStickerProgress(i, pct)
        })

        // Use the sticker's file_id as the filename
        const fileExtension = sticker.file_path.split('.').pop() || 'webp'
        const originalFilename = `${sticker.file_id}.${fileExtension}`
        
        // Check if we need to convert from WebM to WebP
        let fileToDownload = blob;
        let finalFilename = originalFilename;
        
        if (convertWebMtoWebPCheckbox.checked && fileExtension.toLowerCase() === 'webm') {
          try {
            showStatus(`Converting ${originalFilename} to WebP (sticker ${i+1}/${stickers.length})...`, 'info')
            await ensureFFmpegLoaded()
            if (window.TelegramFFmpeg && typeof window.TelegramFFmpeg.convertWebMtoWebP === 'function') {
              try {
                const converted = await window.TelegramFFmpeg.convertWebMtoWebP(blob, i, stickers.length)
                if (converted && await isBlobWebP(converted)) {
                  fileToDownload = converted
                  finalFilename = `${sticker.file_id}.webp`
                } else {
                  console.warn('Conversion returned non-WebP, falling back to original blob')
                  showStatus(`Conversion returned non-WebP for ${sticker.file_id}, using original`, 'info')
                  fileToDownload = blob
                }
              } catch (err) {
                console.warn('FFmpeg conversion failed, falling back to original blob', err)
                fileToDownload = blob
              }
            } else {
              // FFmpeg module not available
              fileToDownload = blob
            }
          } catch (convertError) {
            console.error(`Error converting WebM to WebP for sticker ${i}:`, convertError)
            showStatus(`Conversion failed for ${originalFilename}, downloading original`, 'info')
            fileToDownload = blob
          }
          // finalFilename will be set above in success case
        }

        // Create download link
        const url = URL.createObjectURL(fileToDownload)
        const a = document.createElement('a')
        a.href = url
        a.download = finalFilename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)

        // Clean up
        URL.revokeObjectURL(url)

        // Update status to downloaded
        updateStickerStatus(i, 'downloaded')
        successCount++

        // Add to download history
        addToDownloadHistory(sticker)
      } catch (error) {
        console.error(`Error downloading sticker ${i}:`, error)
        updateStickerStatus(i, 'failed')
        failedCount++
        showStatus(`Failed to download sticker ${i + 1}: ${error.message}`, 'error')
      }
    }

    // Update progress
    const progress = Math.round(((i + 1) / stickers.length) * 100)
    updateProgress(progress)

    // Add small delay to prevent rate limiting
    await new Promise(resolve => setTimeout(resolve, 200))
  }

  // Final progress update
  updateProgress(100)

  const message = `Download complete! ${successCount} successful, ${failedCount} failed.`
  showStatus(message, successCount > 0 ? 'success' : 'error')

  // Update stats to reflect the downloads
  updateStats()
}

// Update progress bar
function updateProgress(percent) {
  progressBar.style.width = `${percent}%`
  progressText.textContent = `${percent}%`

  if (percent > 0) {
    progressContainer.classList.remove('hidden')
  } else if (percent === 0) {
    progressContainer.classList.add('hidden')
  }
}

// Update per-sticker progress
function updateStickerProgress(index, percent) {
  const stickerItem = stickersContainer.children[index]
  if (!stickerItem) return
  const wrap = stickerItem._progressWrap
  const bar = stickerItem._progressBar
  const pct = stickerItem._progressPct
  if (!wrap || !bar || !pct) return

  if (percent <= 0) {
    wrap.classList.add('hidden')
    bar.style.width = `0%`
    pct.textContent = ''
  } else {
    wrap.classList.remove('hidden')
    const p = Math.min(100, Math.max(0, Math.round(percent)))
    bar.style.width = `${p}%`
    pct.textContent = `${p}%`
  }
}

// Append FFmpeg log to UI
function appendFFmpegLog(line) {
  if (!ffmpegLogEl) return
  const div = document.createElement('div')
  div.textContent = line
  ffmpegLogEl.appendChild(div)
  // keep scroll at bottom
  ffmpegLogEl.scrollTop = ffmpegLogEl.scrollHeight
}

function clearFFmpegLog() {
  if (!ffmpegLogEl) return
  ffmpegLogEl.innerHTML = ''
}

// Batch download all stickers as a tar.gz file with sequential downloads
async function batchDownloadAllStickers() {
  if (stickers.length === 0) {
    showStatus('No stickers to download', 'error')
    return
  }

  showStatus(`Starting batch download of ${stickers.length} stickers...`, 'info')

  let successCount = 0
  let failedCount = 0
  const filesData = [] // Store file data for archive creation

  // Reset progress
  updateProgress(0)

  for (let i = 0; i < stickers.length; i++) {
    const sticker = stickers[i]

    // Use cached file_path from when stickers were loaded
    if (!sticker.file_path) {
      // Fallback to get file info if not cached (shouldn't happen if loadStickers worked properly)
      try {
        const fileInfo = await getFile(sticker.file_id)
        sticker.file_path = fileInfo.file_path
        sticker.file_unique_id = fileInfo.file_unique_id
        sticker.file_size = fileInfo.file_size
      } catch (getError) {
        console.error(`Could not get file info for sticker ${sticker.file_id}:`, getError)
        failedCount++
        showStatus(`Could not get file info for sticker ${i + 1}: ${getError.message}`, 'error')
        continue
      }
    }

    try {
      // Download the file using the CF Worker as a proxy to avoid CORS and rate limiting
      const proxyUrl = `/api/proxy/telegram-file?token=${encodeURIComponent(botToken)}&path=${encodeURIComponent(sticker.file_path)}`

      // Create a request to the CF Worker proxy
      const response = await fetch(proxyUrl, {
        method: 'GET',
        headers: {
          Accept: '*/*'
        },
        mode: 'cors'
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      // Get the blob from the response
      const blob = await response.blob();

      // Quick content-type check: if the proxy returned HTML/JSON/text (likely an error page),
      // don't treat it as a sticker image. Instead include a small .error.txt file in the tar
      // so the user can inspect the server response.
      const contentType = (response.headers && response.headers.get)
        ? (response.headers.get('content-type') || '')
        : ''
      if (/html|json|text/i.test(contentType) || blob.size < 20) {
        // Try to extract text for diagnostics
        let txt = ''
        try {
          txt = await blob.text()
        } catch (e) {
          txt = `Failed to read error response, size=${blob.size}`
        }

        const encoder = new TextEncoder()
        const errName = `${sticker.file_id}.error.txt`
        filesData.push({ name: errName, data: encoder.encode(`Content-Type: ${contentType}\n\n${txt}`).buffer })
        failedCount++
        showStatus(`Received non-binary response for ${sticker.file_id}, added ${errName} to archive`, 'error')
        // skip further processing for this sticker
        // Add small delay to avoid tight loop
        await new Promise(resolve => setTimeout(resolve, 50))
        continue
      }
      
      // Check if we need to convert from WebM to WebP
      let fileData;
      let finalFilename = `${sticker.file_id}.${sticker.file_path.split('.').pop() || 'webp'}`;
      
      if (convertWebMtoWebPCheckbox.checked && finalFilename.toLowerCase().endsWith('.webm')) {
        // Fetch and convert
        showStatus(`Downloading and converting ${finalFilename} to WebP (sticker ${i+1}/${stickers.length})...`, 'info')
        try {
          await ensureFFmpegLoaded()
            if (window.TelegramFFmpeg && typeof window.TelegramFFmpeg.convertWebMtoWebP === 'function') {
              try {
                const convertedBlob = await window.TelegramFFmpeg.convertWebMtoWebP(blob, i, stickers.length)
                // Verify converted blob is actually WebP
                if (convertedBlob && await isBlobWebP(convertedBlob)) {
                  fileData = await convertedBlob.arrayBuffer()
                  finalFilename = `${sticker.file_id}.webp`
                } else {
                  console.warn(`Conversion returned non-WebP for sticker ${i}, using original blob`)
                  showStatus(`Conversion returned non-WebP for ${sticker.file_id}, using original`, 'info')
                  fileData = await blob.arrayBuffer()
                }
              } catch (convertError) {
                console.error(`Error converting WebM to WebP for sticker ${i}:`, convertError)
                showStatus(`Conversion failed for ${finalFilename}, downloading original`, 'info')
                fileData = await blob.arrayBuffer()
              }
          } else {
            // No FFmpeg module available, use original
            fileData = await blob.arrayBuffer()
          }
        } catch (convertError) {
          console.error(`Error converting WebM to WebP for sticker ${i}:`, convertError)
          showStatus(`Conversion failed for ${finalFilename}, downloading original`, 'info')
          fileData = await blob.arrayBuffer()
        }
      } else {
        // Just download normally
        showStatus(`Downloading ${finalFilename} (sticker ${i+1}/${stickers.length})...`, 'info')
        fileData = await blob.arrayBuffer()
      }

      filesData.push({
        name: finalFilename,
        data: fileData
      })

      successCount++

      // Add to download history
      addToDownloadHistory(sticker)
    } catch (error) {
      console.error(`Error downloading sticker ${i}:`, error)
      failedCount++
      showStatus(`Failed to download sticker ${i + 1}: ${error.message}`, 'error')
    }

    // Update progress
    const progress = Math.round(((i + 1) / stickers.length) * 100)
    updateProgress(progress)

    // Add small delay to prevent rate limiting
    await new Promise(resolve => setTimeout(resolve, 200))
  }

  if (successCount > 0) {
    try {
      showStatus(`Compressing ${successCount} files using Compression Streams API...`, 'info')
      
      // Build a proper tar archive (ustar) and gzip it.
      // Helper: create tar header and concatenate file data with 512-byte blocks.
      function padUint8Array(arr, blockSize) {
        const pad = (blockSize - (arr.length % blockSize)) % blockSize
        if (pad === 0) return arr
        const out = new Uint8Array(arr.length + pad)
        out.set(arr, 0)
        return out
      }

      function numberToOctal(value, length) {
        // return ascii octal string padded with leading zeros, no leading 0o
        let oct = value.toString(8)
        if (oct.length > length - 1) {
          // overflow, fill with zeros
          oct = oct.slice(- (length - 1))
        }
        return oct.padStart(length - 1, '0') + '\0'
      }

      function createTar(files) {
        const encoder = new TextEncoder()
        const blocks = []

        for (const file of files) {
          const name = file.name
          const data = new Uint8Array(file.data)
          const size = data.byteLength

          const header = new Uint8Array(512)
          // name field (100)
          let nameBytes = encoder.encode(name)
          if (nameBytes.length > 100) {
            // try to split into prefix (155) + name (100)
            // simple approach: if name <= 255, put last 100 into name and prefix the rest
            if (nameBytes.length <= 255) {
              const prefixLen = nameBytes.length - 100
              const prefix = nameBytes.slice(0, prefixLen)
              nameBytes = nameBytes.slice(prefixLen)
              header.set(prefix.slice(0, 155), 345) // prefix offset
            } else {
              // truncate
              nameBytes = nameBytes.slice(-100)
            }
          }
          header.set(nameBytes.slice(0, 100), 0)

          // mode (8) - default 644
          header.set(encoder.encode(numberToOctal(0o644, 8)), 100)
          // uid (8)
          header.set(encoder.encode(numberToOctal(0, 8)), 108)
          // gid (8)
          header.set(encoder.encode(numberToOctal(0, 8)), 116)
          // size (12)
          header.set(encoder.encode(numberToOctal(size, 12)), 124)
          // mtime (12)
          header.set(encoder.encode(numberToOctal(Math.floor(Date.now() / 1000), 12)), 136)
          // checksum (8) - fill with spaces for calculation
          for (let i = 148; i < 156; i++) header[i] = 0x20
          // typeflag (1) - '0'
          header[156] = 0x30
          // linkname (100) left zero
          // magic (6) ustar\0
          header.set(encoder.encode('ustar\0'), 257)
          // version (2) '00'
          header.set(encoder.encode('00'), 263)
          // uname (32)
          header.set(encoder.encode('user'), 265)
          // gname (32)
          header.set(encoder.encode('user'), 297)
          // devmajor (8)
          header.set(encoder.encode(numberToOctal(0, 8)), 329)
          // devminor (8)
          header.set(encoder.encode(numberToOctal(0, 8)), 337)
          // prefix already handled at 345

          // compute checksum
          let sum = 0
          for (let i = 0; i < 512; i++) sum += header[i]
          // Tar checksum field convention: 6 octal digits, NUL, SPACE (total 8 bytes)
          const chkOct = sum.toString(8).padStart(6, '0') + '\0 '
          header.set(encoder.encode(chkOct), 148)

          blocks.push(header)

          // file data, padded to 512
          blocks.push(padUint8Array(data, 512))
        }

        // two 512-byte zero blocks at end
        blocks.push(new Uint8Array(512))
        blocks.push(new Uint8Array(512))

        // concat
        let total = 0
        for (const b of blocks) total += b.length
        const out = new Uint8Array(total)
        let off = 0
        for (const b of blocks) {
          out.set(b, off)
          off += b.length
        }
        return out
      }

      const tarBuffer = createTar(filesData)

      // Compress the tar using Compression Streams API (via ffmpeg module helper)
      await ensureFFmpegLoaded()
      let compressedBlob
      if (window.TelegramFFmpeg && typeof window.TelegramFFmpeg.compressData === 'function') {
        compressedBlob = await window.TelegramFFmpeg.compressData(tarBuffer)
      } else if (typeof CompressionStream !== 'undefined') {
        // fallback to local CompressionStream
        const cs = new CompressionStream('gzip')
        const rs = new Response(new Blob([tarBuffer]).stream().pipeThrough(cs))
        compressedBlob = await rs.blob()
      } else {
        // last resort: return tar as blob without compression
        compressedBlob = new Blob([tarBuffer], { type: 'application/x-tar' })
      }
      
      // Create download link for the compressed file
      const url = URL.createObjectURL(compressedBlob);
      const setName = localStorage.getItem('currentStickerSetName') || 'stickers';
      const filename = `${setName}_${new Date().getTime()}.tar.gz`;  // Using requested extension
      
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      // Clean up
      URL.revokeObjectURL(url);
      
      const message = `Batch download complete! ${successCount} stickers compressed, ${failedCount} failed.`;
      showStatus(message, 'success');
    } catch (error) {
      console.error('Error creating compressed archive:', error);
      showStatus(`Error creating compressed archive: ${error.message}`, 'error');
    }
  } else {
    showStatus(`All downloads failed! ${failedCount} stickers failed to download.`, 'error')
  }

  // Update stats to reflect the downloads
  updateStats()
}



// Update statistics display
function updateStats() {
  totalStat.textContent = stickers.length
  downloadedStat.textContent = downloadedStickers.size
  failedStat.textContent = failedDownloads.size

  if (stickers.length > 0) {
    stats.classList.remove('hidden')
  }

  // Show retry section if there are failed downloads
  if (failedDownloads.size > 0) {
    retrySection.classList.remove('hidden')
    failedStickersList.classList.remove('hidden')
    renderFailedStickers()
  } else {
    retrySection.classList.add('hidden')
  }
}

// Render failed stickers list
function renderFailedStickers() {
  failedStickersContainer.innerHTML = ''

  const failedIndexes = Array.from(failedDownloads)
  if (failedIndexes.length === 0) {
    failedStickersList.classList.add('hidden')
    return
  }

  failedIndexes.forEach(index => {
    const sticker = stickers[index]
    const item = document.createElement('div')
    item.className = 'failed-sticker-item'

    const info = document.createElement('div')
    info.innerHTML = `<strong>Sticker ${index + 1}</strong>: ${sticker.file_id}`

    const retryBtn = document.createElement('button')
    retryBtn.textContent = 'Retry'
    retryBtn.onclick = () => retryDownload(sticker, index)

    item.appendChild(info)
    item.appendChild(retryBtn)

    failedStickersContainer.appendChild(item)
  })
}

// Retry all failed downloads
async function retryAllFailed() {
  if (failedDownloads.size === 0) {
    showStatus('No failed downloads to retry', 'info')
    return
  }

  const failedIndexes = Array.from(failedDownloads)
  let successCount = 0

  for (let i = 0; i < failedIndexes.length; i++) {
    const index = failedIndexes[i]
    const sticker = stickers[index]

    try {
      // Use cached file_path from when stickers were loaded
      if (!sticker.file_path) {
        // Fallback to get file info if not cached (shouldn't happen if loadStickers worked properly)
        const fileInfo = await getFile(sticker.file_id)
        sticker.file_path = fileInfo.file_path
        sticker.file_unique_id = fileInfo.file_unique_id
        sticker.file_size = fileInfo.file_size
      }

      // Create URL via CF Worker proxy to avoid CORS and rate limiting
      const fileUrl = `/api/proxy/telegram-file?token=${encodeURIComponent(botToken)}&path=${encodeURIComponent(sticker.file_path)}`
      const fileExtension = sticker.file_path.split('.').pop() || 'webp'
      const filename = `${sticker.file_id}.${fileExtension}`

      // Try downloading via streaming to show progress and avoid CORS issues via proxy
      try {
        const downloadedBlob = await fetchWithProgress(fileUrl, (loaded, total) => {
          const pct = total ? (loaded / total) * 100 : 0
          updateStickerProgress(index, pct)
        })

        // Create a temporary link to download the blob
        const url = URL.createObjectURL(downloadedBlob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)

        updateStickerStatus(index, 'downloaded')
        successCount++
      } catch (downloadError) {
        // If direct streaming download fails (likely due to CORS), open in new tab
        console.warn(
          `Streaming download failed for sticker ${index + 1}, opening in new tab:`,
          downloadError
        )
        downloadFileWithCORSHandling(fileUrl, filename)
        // Consider it as downloaded since it's opened for user to handle
        updateStickerStatus(index, 'downloaded')
        successCount++
      }
    } catch (error) {
      console.error(`Error retrying download for sticker ${index}:`, error)
      showStatus(`Retry failed for sticker ${index + 1}: ${error.message}`, 'error')
    }

    // Update progress
    const progress = Math.round(((i + 1) / failedIndexes.length) * 100)
    updateProgress(progress)
  }

  // Final progress update
  updateProgress(100)
  showStatus(`Retried ${failedIndexes.length} downloads, ${successCount} successful`, 'info')
}

// Toggle side panel
function toggleSidePanel() {
  sidePanel.classList.toggle('active')
  mainContainer.classList.toggle('side-panel-visible')
}

// Auto-hide side panel after 3 seconds of inactivity if it's open
let hidePanelTimeout
function setupAutoHide() {
  // Clear any existing timeout
  clearTimeout(hidePanelTimeout)

  // Set new timeout if panel is active
  if (sidePanel.classList.contains('active')) {
    hidePanelTimeout = setTimeout(() => {
      sidePanel.classList.remove('active')
      mainContainer.classList.remove('side-panel-visible')
    }, 3000)
  }
}

// Event listeners
saveTokenBtn.addEventListener('click', saveToken)
loadStickersBtn.addEventListener('click', loadStickers)
downloadAllBtn.addEventListener('click', downloadAllStickers)
batchDownloadBtn.addEventListener('click', batchDownloadAllStickers)
retryFailedBtn.addEventListener('click', retryAllFailed)
sidePanelToggle.addEventListener('click', toggleSidePanel)
clearHistoryBtn.addEventListener('click', clearDownloadHistory)

// Preheat / initialize FFmpeg on demand to reduce latency during conversions
if (initFFmpegBtn) {
  initFFmpegBtn.addEventListener('click', async () => {
    try {
      initFFmpegBtn.disabled = true
      showStatus('Loading FFmpeg module...', 'info')
      await ensureFFmpegLoaded()

      if (window.TelegramFFmpeg && typeof window.TelegramFFmpeg.initFFmpeg === 'function') {
        showStatus('Initializing FFmpeg (this may take a while)...', 'info')
        const ok = await window.TelegramFFmpeg.initFFmpeg()
        if (ok) {
          ffmpegLoaded = true
          showStatus('FFmpeg initialized and ready', 'success')
        } else {
          showStatus('FFmpeg initialization failed (check console)', 'error')
        }
      } else if (window.TelegramFFmpeg) {
        // Module loaded but no init function - treat as ready
        showStatus('FFmpeg module loaded (no explicit init required)', 'success')
      } else {
        showStatus('FFmpeg module could not be loaded', 'error')
      }
    } catch (e) {
      console.error('Error during FFmpeg preheat:', e)
      showStatus('Error initializing FFmpeg: ' + (e && e.message ? e.message : String(e)), 'error')
    } finally {
      initFFmpegBtn.disabled = false
    }
  })
}

// Enable loadStickersBtn when there's text in the sticker set name input
stickerSetNameInput.addEventListener('input', function () {
  const hasInput = this.value.trim()
  const hasToken = botTokenInput.value.trim()

  loadStickersBtn.disabled = !hasInput || !hasToken
  batchDownloadBtn.disabled = !hasInput || !hasToken
})

// Helper: fetch with progress reporting, returns Blob
async function fetchWithProgress(url, onProgress) {
  const res = await fetch(url, { method: 'GET', headers: { Accept: '*/*' }, mode: 'cors' })
  if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`)

  const contentLength = res.headers && res.headers.get ? parseInt(res.headers.get('content-length') || '0', 10) : 0
  if (!res.body || !res.body.getReader) {
    // fallback
    const blob = await res.blob()
    if (onProgress) onProgress(blob.size, contentLength || blob.size)
    return blob
  }

  const reader = res.body.getReader()
  const chunks = []
  let received = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    received += value.length || value.byteLength || 0
    if (onProgress) {
      try {
        onProgress(received, contentLength || 0)
      } catch (e) {
        // ignore progress callback errors
      }
    }
  }

  // concatenate
  let total = 0
  for (const c of chunks) total += c.length || c.byteLength
  const out = new Uint8Array(total)
  let offset = 0
  for (const c of chunks) {
    out.set(c, offset)
    offset += c.length || c.byteLength
  }

  return new Blob([out.buffer || out], { type: res.headers.get('content-type') || 'application/octet-stream' })
}

// Set up auto-hide functionality
document.addEventListener('click', e => {
  // If click is outside side panel and panel is active, hide it
  if (
    sidePanel.classList.contains('active') &&
    !sidePanel.contains(e.target) &&
    e.target !== sidePanelToggle
  ) {
    setupAutoHide()
  }
})

// Restore previously loaded stickers from localStorage if available
function restoreCachedStickers() {
  try {
    const cachedData = localStorage.getItem('cachedStickers');
    if (cachedData) {
      const stickerData = JSON.parse(cachedData);
      
      // Check if data is not too old (older than 24 hours)
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
      if (Date.now() - stickerData.timestamp <= maxAge) {
        // Restore the sticker data
        stickers = stickerData.stickers || [];
        
        // Restore the download status
        downloadedStickers = new Set(stickerData.downloadedStickers || []);
        failedDownloads = new Set(stickerData.failedDownloads || []);
        
        // Restore the sticker set name
        if (stickerData.setName) {
          const savedToken = localStorage.getItem('telegramBotToken');
          if (savedToken) {
            botToken = savedToken;
            stickerSetNameInput.value = stickerData.setName;
            localStorage.setItem('currentStickerSetName', stickerData.setName);
          }
        }
        
        if (stickers.length > 0) {
          // Update UI to show the restored stickers
          renderStickers();
          stickerList.classList.remove('hidden');
          downloadAllBtn.disabled = false;
          batchDownloadBtn.disabled = false;
          
          showStatus(`Restored ${stickers.length} stickers from cache`, 'success');
          updateStats();
          
          console.log(`Restored ${stickers.length} stickers from cache, ${downloadedStickers.size} downloaded, ${failedDownloads.size} failed`);
        }
      } else {
        // Cached data is too old, remove it
        localStorage.removeItem('cachedStickers');
        console.log('Removed expired cached stickers');
      }
    }
  } catch (error) {
    console.error('Error restoring cached stickers:', error);
    // If there's an error, remove the cached data to prevent repeated errors
    localStorage.removeItem('cachedStickers');
  }
}

// Initialize
initialize()

// Restore cached stickers after initialization
restoreCachedStickers()

// Set up auto-hide when page loads
if (sidePanel.classList.contains('active')) {
  setupAutoHide()
}

// Render download history on page load
renderDownloadHistory()
