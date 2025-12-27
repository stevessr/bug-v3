/**
 * 处理自动下载图片的请求
 */
export async function handleDownloadImage(message: any, sendResponse: (_resp: any) => void) {
  const { url, source } = message

  if (!url) {
    sendResponse({ success: false, error: 'Missing URL for download' })
    return
  }

  if (__ENABLE_LOGGING__)
    console.log(
      `[DownloadImage] Processing download request for: ${url}, source: ${source || 'unknown'}`
    )

  try {
    // 使用 Chrome downloads API 下载图片
    const chromeAPI = typeof chrome !== 'undefined' ? chrome : null

    if (!chromeAPI || !chromeAPI.downloads) {
      sendResponse({ success: false, error: 'Chrome downloads API not available' })
      return
    }

    // 从 URL 中提取文件名
    let filename = 'image'
    try {
      const parsedUrl = new URL(url)
      const pathname = parsedUrl.pathname
      const lastSegment = pathname.split('/').pop()
      if (lastSegment) {
        filename = lastSegment
      }

      // 如果有查询参数，尝试获取 format 参数
      const format = parsedUrl.searchParams.get('format')
      if (format && !filename.includes(`.${format}`)) {
        filename += `.${format}`
      }
    } catch (e) {
      // 如果 URL 解析失败，使用默认文件名
      console.warn('[DownloadImage] Failed to parse URL for filename:', e)
    }

    // 开始下载
    chromeAPI.downloads.download(
      {
        url: url,
        filename: filename,
        saveAs: false // 不显示保存对话框，直接下载
      },
      (downloadId?: number) => {
        if (chromeAPI.runtime.lastError) {
          console.error('[DownloadImage] Download failed:', chromeAPI.runtime.lastError)
          sendResponse({ success: false, error: chromeAPI.runtime.lastError.message })
        } else {
          if (__ENABLE_LOGGING__)
            console.log(`[DownloadImage] Download started successfully, ID: ${downloadId}`)
          sendResponse({ success: true, downloadId })
        }
      }
    )
  } catch (error: any) {
    console.error('[DownloadImage] Error processing download:', error)
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
