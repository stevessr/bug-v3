import { uploadAndAddEmoji } from '../../utils/uploadServices'

export async function handleUploadAndAddEmoji(message: any, sendResponse: any) {
  // message.payload: { arrayData, filename, mimeType, name }
  try {
    const payload = message.payload || {}
    const { arrayData, filename, mimeType, name, originUrl } = payload

    console.debug('[Background] handleUploadAndAddEmoji received payload', {
      filename,
      mimeType,
      name,
      length: Array.isArray(arrayData) ? arrayData.length : undefined
    })

    if (!Array.isArray(arrayData) || arrayData.length === 0) {
      sendResponse({ success: false, error: 'No arrayData provided' })
      return
    }

    // Use the universal upload function
    const result = await uploadAndAddEmoji(
      arrayData,
      filename,
      mimeType,
      name,
      originUrl,
      { groupId: 'ungrouped' }
    )

    sendResponse(result)
  } catch (error) {
    console.error('[Background] handleUploadAndAddEmoji failed', error)
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    })
  }
}
