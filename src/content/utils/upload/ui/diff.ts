import { customAlert, customConfirm } from '../../ui/dialog'
import { showCustomImagePicker } from '../../picker'
import { notify } from '../../ui/notify'
import { uploader } from '../core'
import { parseImageFilenamesFromMarkdown } from '../helpers'

export async function handleDiffFiles(
  files: FileList | File[],
  markdownTextarea: HTMLTextAreaElement
) {
  if (!files || (files instanceof FileList ? files.length === 0 : files.length === 0)) return

  const markdownText = markdownTextarea.value.trim()

  if (!markdownText) {
    await customAlert('请先在上方文本框中粘贴包含图片的 markdown 文本')
    return
  }

  // Extract existing filenames from markdown using the same logic as parseImageFilenamesFromMarkdown
  const existingFilenames = parseImageFilenamesFromMarkdown(markdownText)

  // Also extract filenames from URLs as a fallback
  const urlFilenames =
    markdownText
      .match(/!\[.*?\]\((.*?)\)/g)
      ?.map(match => {
        const url = match.match(/!\[.*?\]\((.*?)\)/)?.[1] || ''
        return url.split('/').pop()?.split('?')[0] || '' // Remove query params
      })
      .filter(Boolean) || []

  // Combine both lists for comprehensive checking
  const allExistingFilenames = new Set([...existingFilenames, ...urlFilenames])

  // Filter files that are not in the existing list
  const filesArray = Array.from(files)
  const filesToUpload = filesArray.filter(file => {
    return !allExistingFilenames.has(file.name)
  })

  if (filesToUpload.length === 0) {
    await customAlert('所有选择的图片都已在 markdown 文本中存在，无需上传。')
    return
  }

  if (filesToUpload.length < filesArray.length) {
    const skippedCount = filesArray.length - filesToUpload.length
    const proceed = await customConfirm(
      `发现 ${skippedCount} 个图片已存在于 markdown 文本中，将被跳过。是否继续上传剩余 ${filesToUpload.length} 个图片？`
    )
    if (!proceed) {
      return
    }
  }

  notify(`开始差分上传 ${filesToUpload.length} 个新文件...`, 'info')

  let successCount = 0
  let failCount = 0

  const uploadPromises = filesToUpload.map(async file => {
    try {
      const result = await uploader.uploadImage(file)
      successCount++
      const progressMsg = `差分上传：${successCount}/${filesToUpload.length} (成功)`
      notify(progressMsg, 'info')
      return result
    } catch (error: any) {
      failCount++
      console.error(`[Image Uploader] Failed to upload ${file.name}:`, error)
      notify(`差分上传 ${file.name} 失败：${error.message || '上传失败'}`, 'error')
      throw error
    }
  })

  try {
    await Promise.allSettled(uploadPromises)
    notify(
      `差分上传完成：已跳过 ${filesArray.length - filesToUpload.length} 个重复文件，上传 ${successCount} 个新文件，${failCount} 个失败`,
      successCount > 0 ? 'success' : 'info'
    )
  } finally {
    // Keep progress dialog open
  }
}

export async function showDiffImagePicker(markdownTextarea: HTMLTextAreaElement) {
  // Get markdown text for diff check
  const markdownText = markdownTextarea.value.trim()

  if (!markdownText) {
    await customAlert('请先在上方文本框中粘贴包含图片的 markdown 文本')
    return
  }

  // Extract existing filenames from markdown
  const existingFilenames = parseImageFilenamesFromMarkdown(markdownText)

  // Also extract filenames from URLs as a fallback
  const urlFilenames =
    markdownText
      .match(/!\[.*?\]\((.*?)\)/g)
      ?.map(match => {
        const url = match.match(/!\[.*?\]\((.*?)\)/)?.[1] || ''
        return url.split('/').pop()?.split('?')[0] || '' // Remove query params
      })
      .filter(Boolean) || []

  // Combine both lists for comprehensive checking
  const allExistingFilenames = new Set([...existingFilenames, ...urlFilenames])

  // Use custom file picker with file filter
  await showCustomImagePicker(
    true,
    async (files, updateStatus) => {
      // Upload filtered files
      let uploadCount = 0

      for (const file of files) {
        try {
          updateStatus(file, { status: 'uploading', progress: 0 })
          const result = await uploader.uploadImage(file)
          updateStatus(file, { status: 'success', url: result.url })
          uploadCount++
        } catch (error: any) {
          console.error(`Failed to upload ${file.name}:`, error)
          updateStatus(file, { status: 'failed', error: error.message || '上传失败' })
        }
      }

      // Show summary notification if any files were uploaded
      if (uploadCount > 0) {
        notify(`差分上传完成：成功上传 ${uploadCount} 个文件`, 'success')
      }
    },
    // File filter function
    (file: File) => {
      if (allExistingFilenames.has(file.name)) {
        return {
          shouldKeep: false,
          skipReason: '已存在于 markdown 中'
        }
      }
      return { shouldKeep: true }
    }
  )
}
