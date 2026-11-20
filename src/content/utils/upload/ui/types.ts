import type { UploadMode } from './panels/regularPanel'

export interface DragDropElements {
  panel: HTMLElement
  overlay: any
  dropZone: HTMLElement
  fileInput: HTMLInputElement
  closeButton: HTMLElement
  modeToggle: HTMLElement
  setUploadMode: (mode: UploadMode) => void
  getUploadMode: () => UploadMode
  diffDropZone: HTMLElement
  diffFileInput: HTMLInputElement
  markdownTextarea: HTMLTextAreaElement
  folderDropZone: HTMLElement
  folderInput: HTMLInputElement
  urlTab: HTMLElement
  urlPanel: HTMLElement
  urlTextarea: HTMLTextAreaElement
  urlImportBtn: HTMLButtonElement
  urlProgressList: HTMLElement
  statusBar: HTMLElement
  switchToTab: (tab: 'regular' | 'diff' | 'folder' | 'url') => void
  addFilesToPreview: (files: File[]) => void
  clearPreview: () => void
  getPendingFiles: () => File[]
  setUploadHandler: (fn: (files: File[]) => Promise<void>) => void
}
