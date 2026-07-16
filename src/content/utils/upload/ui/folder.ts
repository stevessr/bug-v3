import { showCustomFolderPicker } from '../../picker'
import { uploader } from '../core'

import type { DiscourseUploadRouteContext } from '@/content/discourse/utils/nativeUpload'

export async function showFolderPickerWithUpload(
  routeContext: DiscourseUploadRouteContext = 'auto'
) {
  // Use custom folder picker with integrated upload
  await showCustomFolderPicker(async (files, updateStatus) => {
    // Upload each file with status updates
    for (const file of files) {
      try {
        updateStatus(file, { status: 'uploading', progress: 0 })
        const result = await uploader.uploadImage(file, routeContext)
        updateStatus(file, { status: 'success', url: result.url || undefined })
      } catch (error: any) {
        console.error(`Failed to upload ${file.name}:`, error)
        updateStatus(file, { status: 'failed', error: error.message || '上传失败' })
      }
    }
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
