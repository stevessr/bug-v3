import { showCustomFolderPicker } from '../../picker'
import { uploader } from '../core'

import type { DiscourseUploadRouteContext } from '@/content/discourse/utils/nativeUpload'

export async function showFolderPickerWithUpload(
  routeContext: DiscourseUploadRouteContext = 'auto'
) {
  // Use custom folder picker with integrated upload
  await showCustomFolderPicker(async (files, updateStatus) => {
    // Enqueue the whole selection up front. The uploader can now keep later
    // files in a real waiting state when Discourse rate-limits the active one.
    await Promise.all(
      files.map(async file => {
        try {
          const result = await uploader.uploadImage(file, routeContext, update => {
            if (update.status === 'waiting' || update.status === 'uploading') {
              updateStatus(file, { status: update.status, progress: 0 })
            }
          })
          updateStatus(file, { status: 'success', url: result.url || undefined })
        } catch (error: any) {
          console.error(`Failed to upload ${file.name}:`, error)
          updateStatus(file, { status: 'failed', error: error.message || '上传失败' })
        }
      })
    )
  })
}

// Helper function to recursively collect files from folder
export async function collectFiles(entry: any, files: File[]): Promise<void> {
  if (entry.isFile) {
    const file = await new Promise<File>(resolve => {
      entry.file((f: File) => resolve(f))
    })
    // Only collect image files
    if (file.type.startsWith('image/')) {
      files.push(file)
    }
  } else if (entry.isDirectory) {
    const reader = entry.createReader()
    const entries = await new Promise<any[]>(resolve => {
      reader.readEntries((entries: any[]) => resolve(entries))
    })
    for (const subEntry of entries) {
      await collectFiles(subEntry, files)
    }
  }
}
