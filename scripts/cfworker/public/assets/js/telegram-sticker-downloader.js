// FFmpeg functionality for WebM to WebP conversion
let ffmpeg = null;
let ffmpegLoaded = false;

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

// State variables
let botToken = ''
let stickers = []
let downloadedStickers = new Set()
let failedDownloads = new Set()

// Initialize FFmpeg for WebM to WebP conversion
async function initFFmpeg() {
  if (ffmpegLoaded) return true;
  
  try {
    // Dynamically import FFmpeg (similar to the main app)
    const { FFmpeg } = await import('/assets/ffmpeg/esm/index.js');
    // Import fetchFile is not always needed for basic operations
    // const { fetchFile } = await import('https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.2/dist/esm/index.js');
    
    ffmpeg = new FFmpeg();
    
    ffmpeg.on('log', ({ message }) => {
      // Only log important messages
      if (message.toLowerCase().includes('error') || message.toLowerCase().includes('fail')) {
        console.error(`[FFmpeg] ${message}`);
      }
    });
    
    ffmpeg.on('progress', ({ progress }) => {
      // Progress is updated elsewhere with more context
      console.log(`FFmpeg conversion progress: ${(progress * 100).toFixed(2)}%`);
    });
    
    // Set up CDN paths for FFmpeg assets
    const localBase = '/assets/ffmpeg';
    const cdnBase = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.2/dist/esm';
    
    // Check if local WASM file exists first, if not, use CDN
    let wasmURL = `${localBase}/ffmpeg-core.wasm`;
    
    // Try to check if local WASM exists by attempting a HEAD request
    try {
      const response = await fetch(wasmURL, { method: 'HEAD' });
      if (!response.ok) {
        // If local WASM doesn't exist or is invalid, use CDN
        wasmURL = `${cdnBase}/ffmpeg-core.wasm`;
      }
    } catch (e) {
      // If fetch fails, fall back to CDN
      wasmURL = `${cdnBase}/ffmpeg-core.wasm`;
    }
    
    // Load FFmpeg
    await ffmpeg.load({
      coreURL: `${localBase}/ffmpeg-core.js`,
      wasmURL: wasmURL, // Use either local or CDN based on availability
      workerURL: `${localBase}/worker.js`
    });
    
    ffmpegLoaded = true;
    console.log('FFmpeg initialized successfully');
    return true;
  } catch (error) {
    console.error('Error initializing FFmpeg:', error);
    showStatus(`FFmpeg initialization failed: ${error.message}`, 'error');
    return false;
  }
}

// Compress data using the Compression Streams API
async function compressData(data) {
  // Check if CompressionStream is supported in this browser
  if (typeof CompressionStream === 'undefined') {
    console.warn('CompressionStream not supported, returning original data as blob');
    return new Blob([data], { type: 'application/octet-stream' });
  }
  
  // Create a readable stream from our data
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(data);
      controller.close();
    }
  });
  
  try {
    // Create compression stream
    const compressionStream = new CompressionStream('gzip');
    
    // Create a transformer that combines the readable stream and compression stream
    const compressedStream = stream.pipeThrough(compressionStream);
    
    // Collect the compressed chunks
    const chunks = [];
    const reader = compressedStream.getReader();
    
    let done = false;
    while (!done) {
      const { value, done: readerDone } = await reader.read();
      done = readerDone;
      if (value) {
        chunks.push(value);
      }
    }
    
    // Concatenate all chunks
    let totalLength = 0;
    for (const chunk of chunks) {
      totalLength += chunk.length;
    }
    
    const concatenated = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      concatenated.set(chunk, offset);
      offset += chunk.length;
    }
    
    return new Blob([concatenated], { type: 'application/gzip' });
  } catch (error) {
    console.error('Error during compression, returning original data as blob:', error);
    // If compression fails, return the original data as is
    return new Blob([data], { type: 'application/octet-stream' });
  }
}

// Convert WebM blob to WebP format preserving original resolution and frame rate
async function convertWebMtoWebP(webmBlob, stickerIndex = null, totalStickers = 0) {
  // First, check if FFmpeg is properly loaded and available
  if (!ffmpegLoaded || !ffmpeg || !ffmpeg.loaded) {
    if (!(await initFFmpeg())) {
      console.warn('FFmpeg not available for conversion, returning original blob');
      return webmBlob; // Return original blob if FFmpeg cannot be initialized
    }
  }
  
  // Additional check to ensure ffmpeg is loaded after initialization attempt
  if (!ffmpeg || !ffmpeg.loaded) {
    console.warn('FFmpeg is not properly loaded, returning original blob');
    return webmBlob;
  }
  
  try {
    // Write WebM file to FFmpeg's virtual filesystem
    const webmArrayBuffer = await webmBlob.arrayBuffer();
    await ffmpeg.writeFile('input.webm', new Uint8Array(webmArrayBuffer));
    
    // Convert WebM to WebP using FFmpeg, preserving original resolution and frame rate
    // Use the exact same parameters as the original file to maintain quality
    const execResult = await ffmpeg.exec([
      '-i', 'input.webm',           // Input file
      '-c:v', 'libwebp_anim',       // Use libwebp_anim codec for animated WebP
      '-lossless', '0',             // Lossy compression for smaller file sizes
      '-q:v', '85',                 // Quality (0-100, higher is better)
      '-compression_level', '6',    // Compression level (0-6, higher is slower but smaller)
      '-f', 'webp',                 // Output format
      '-y',                         // Overwrite output file
      'output.webp'                 // Output file
    ]);
    
    // Check if the execution was successful (should be 0 for success)
    if (execResult !== 0 && execResult !== undefined) {
      console.warn(`FFmpeg exec returned error code: ${execResult}, returning original blob`);
      return webmBlob; // Return original blob if conversion fails
    }
    
    // Read the converted WebP file
    const webpData = await ffmpeg.readFile('output.webp');
    const webpBlob = new Blob([webpData], { type: 'image/webp' });
    
    // Clean up virtual filesystem
    try {
      await ffmpeg.deleteFile('input.webm');
      await ffmpeg.deleteFile('output.webp');
    } catch (cleanupError) {
      console.warn('Error during FFmpeg cleanup:', cleanupError);
    }
    
    return webpBlob;
  } catch (error) {
    console.error('Error converting WebM to WebP, returning original blob:', error);
    // Return the original blob if conversion fails
    return webmBlob;
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

  actionsContainer.appendChild(downloadBtn)
  actionsContainer.appendChild(retryBtn)
  actionsContainer.appendChild(statusElement)

  stickerItem.appendChild(previewContainer)
  stickerItem.appendChild(infoContainer)
  stickerItem.appendChild(actionsContainer)

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
        
        const webmBlob = await response.blob()
        
        // Convert WebM to WebP if checkbox is checked (show conversion progress)
        showStatus(`Converting ${originalFilename} to WebP...`, 'info')
        const webpBlob = await convertWebMtoWebP(webmBlob, index, 1) // 1 for single download
        
        // Create download link from the converted WebP blob
        const url = URL.createObjectURL(webpBlob)
        const webpFilename = `${sticker.file_id}.webp`  // Changed extension to .webp
        
        const a = document.createElement('a')
        a.href = url
        a.download = webpFilename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        
        // Clean up
        URL.revokeObjectURL(url)
        
        updateStickerStatus(index, 'downloaded')
        showStatus(`Successfully converted and downloaded as WebP: ${webpFilename}`, 'success')
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
        
        const webmBlob = await response.blob()
        
        // Convert WebM to WebP if checkbox is checked (show conversion progress)
        showStatus(`Converting ${originalFilename} to WebP...`, 'info')
        const webpBlob = await convertWebMtoWebP(webmBlob, index, 1) // 1 for single download
        
        // Create download link from the converted WebP blob
        const url = URL.createObjectURL(webpBlob)
        const webpFilename = `${sticker.file_id}.webp`  // Changed extension to .webp
        
        const a = document.createElement('a')
        a.href = url
        a.download = webpFilename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        
        // Clean up
        URL.revokeObjectURL(url)
        
        updateStickerStatus(index, 'downloaded')
        showStatus(`Successfully converted and downloaded as WebP: ${webpFilename}`, 'success')
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

        const blob = await response.blob()

        // Use the sticker's file_id as the filename
        const fileExtension = sticker.file_path.split('.').pop() || 'webp'
        const originalFilename = `${sticker.file_id}.${fileExtension}`
        
        // Check if we need to convert from WebM to WebP
        let fileToDownload = blob;
        let finalFilename = originalFilename;
        
        if (convertWebMtoWebPCheckbox.checked && fileExtension.toLowerCase() === 'webm') {
          try {
            showStatus(`Converting ${originalFilename} to WebP (sticker ${i+1}/${stickers.length})...`, 'info')
            fileToDownload = await convertWebMtoWebP(blob, i, stickers.length)
            finalFilename = `${sticker.file_id}.webp`  // Changed extension to .webp
          } catch (convertError) {
            console.error(`Error converting WebM to WebP for sticker ${i}:`, convertError)
            showStatus(`Conversion failed for ${originalFilename}, downloading original`, 'info')
            // Continue with original file
          }
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
      
      // Check if we need to convert from WebM to WebP
      let fileData;
      let finalFilename = `${sticker.file_id}.${sticker.file_path.split('.').pop() || 'webp'}`;
      
      if (convertWebMtoWebPCheckbox.checked && finalFilename.toLowerCase().endsWith('.webm')) {
        // Fetch and convert
        showStatus(`Downloading and converting ${finalFilename} to WebP (sticker ${i+1}/${stickers.length})...`, 'info')
        try {
          const convertedBlob = await convertWebMtoWebP(blob, i, stickers.length)
          fileData = await convertedBlob.arrayBuffer()
          finalFilename = `${sticker.file_id}.webp`  // Changed extension to .webp
        } catch (convertError) {
          console.error(`Error converting WebM to WebP for sticker ${i}:`, convertError)
          showStatus(`Conversion failed for ${finalFilename}, downloading original`, 'info')
          // Use original blob if conversion fails
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
      
      // Create a simple concatenated format with headers for each file
      // Format: [HEADER_LENGTH][HEADER][FILE_DATA][NEXT_FILE...] where HEADER contains filename and size
      const outputStream = [];
      
      for (const file of filesData) {
        const filename = file.name;
        const fileSize = file.data.byteLength;
        
        // Create a simple header with filename length, filename, and file size
        const encoder = new TextEncoder();
        const filenameBytes = encoder.encode(filename);
        
        // Create header buffer: [filename length (4 bytes)][filename bytes][file size (4 bytes)]
        const headerBuffer = new Uint8Array(4 + filenameBytes.length + 4);
        const headerView = new DataView(headerBuffer.buffer);
        
        headerView.setUint32(0, filenameBytes.length, true);  // Little endian
        headerBuffer.set(filenameBytes, 4);
        headerView.setUint32(4 + filenameBytes.length, fileSize, true);
        
        // Add header and file data to output
        outputStream.push(headerBuffer);
        outputStream.push(new Uint8Array(file.data));
      }
      
      // Concatenate all data
      let totalLength = 0;
      for (const buffer of outputStream) {
        totalLength += buffer.length;
      }
      
      const totalBuffer = new Uint8Array(totalLength);
      let offset = 0;
      for (const buffer of outputStream) {
        totalBuffer.set(buffer, offset);
        offset += buffer.length;
      }
      
      // Compress the entire bundle using Compression Streams API
      const compressedBlob = await compressData(totalBuffer);
      
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

      // Try direct download first
      try {
        // Create download link directly using the URL
        const a = document.createElement('a')
        a.href = fileUrl
        a.download = filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)

        updateStickerStatus(index, 'downloaded')
        successCount++
      } catch (downloadError) {
        // If direct download fails due to CORS, open in new tab
        console.warn(
          `Direct download failed for sticker ${index + 1}, opening in new tab:`,
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

// Enable loadStickersBtn when there's text in the sticker set name input
stickerSetNameInput.addEventListener('input', function () {
  const hasInput = this.value.trim()
  const hasToken = botTokenInput.value.trim()

  loadStickersBtn.disabled = !hasInput || !hasToken
  batchDownloadBtn.disabled = !hasInput || !hasToken
})

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

// Initialize
initialize()

// Set up auto-hide when page loads
if (sidePanel.classList.contains('active')) {
  setupAutoHide()
}

// Render download history on page load
renderDownloadHistory()
