export interface CustomFilePickerOptions {
  multiple?: boolean
  accept?: string
  directory?: boolean
  title?: string
  onUpload?: (files: File[], updateStatus: FileStatusUpdater) => Promise<void>
  // File filter function: return true to keep file, false to skip
  // Returns object with shouldKeep boolean and optional skip reason
  fileFilter?: (file: File) => { shouldKeep: boolean; skipReason?: string }
}

export interface CustomFilePickerResult {
  files: File[]
  cancelled: boolean
}

// Upload status for each file
export interface FileUploadStatus {
  file: File
  status: 'waiting' | 'uploading' | 'success' | 'failed'
  progress?: number
  error?: string
  url?: string
}

// Status updater callback type
export type FileStatusUpdater = (
  file: File,
  update: Partial<Omit<FileUploadStatus, 'file'>>
) => void

export interface PickerUI {
  dialog: HTMLElement
  header: HTMLElement
  titleEl: HTMLElement
  closeBtn: HTMLButtonElement
  content: HTMLElement
  previewContainer: HTMLElement
  previewTitleText: HTMLElement
  previewList: HTMLElement
  fileTypeInfo: HTMLElement
  nativeInput: HTMLInputElement
  infoBox: HTMLElement
  cancelButton: HTMLButtonElement
  selectButton: HTMLButtonElement
  confirmButton: HTMLButtonElement
  clearAllBtn: HTMLButtonElement
}
