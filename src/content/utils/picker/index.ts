import type { CustomFilePickerOptions, CustomFilePickerResult, FileStatusUpdater } from './types'
import { FilePickerLogic } from './logic'

export * from './types'

/**
 * Show a custom styled file picker dialog
 * This provides a better UI experience while still using the secure native file input
 */
export async function showCustomFilePicker(
  options: CustomFilePickerOptions = {}
): Promise<CustomFilePickerResult> {
  return new Promise(resolve => {
    new FilePickerLogic(options, resolve)
  })
}

/**
 * Show custom file picker for images with optional upload handler
 */
export async function showCustomImagePicker(
  multiple: boolean = true,
  onUpload?: (files: File[], updateStatus: FileStatusUpdater) => Promise<void>,
  fileFilter?: (file: File) => { shouldKeep: boolean; skipReason?: string }
): Promise<File[]> {
  const result = await showCustomFilePicker({
    multiple,
    accept: 'image/*',
    directory: false,
    title: multiple ? '选择图片文件' : '选择图片',
    onUpload,
    fileFilter
  })

  return result.cancelled ? [] : result.files
}

/**
 * Show custom folder picker for images with optional upload handler
 */
export async function showCustomFolderPicker(
  onUpload?: (files: File[], updateStatus: FileStatusUpdater) => Promise<void>
): Promise<File[]> {
  const result = await showCustomFilePicker({
    multiple: true,
    accept: 'image/*',
    directory: true,
    title: '选择文件夹',
    onUpload
  })

  return result.cancelled ? [] : result.files
}
