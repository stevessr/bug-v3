import { DAEL, DOA } from '../dom/createEl'

import { createDragDropUploadPanel } from './ui/builder'
import { uploadAndInsert } from './ui/progress'
import { handleDiffFiles, showDiffImagePicker } from './ui/diff'
import { showFolderPickerWithUpload, collectFiles } from './ui/folder'
import { handleUrlImport } from './ui/url'
import { captureEditorInsertionTarget } from './helpers'

import type { DiscourseUploadRouteContext } from '@/content/discourse/utils/nativeUpload'

export async function showImageUploadDialog(
  routeContext: DiscourseUploadRouteContext = 'auto'
): Promise<void> {
  return new Promise(resolve => {
    // Freeze the composer and caret before any control in this dialog can take
    // focus. Every regular/folder upload in this dialog shares this target.
    const editorTarget = captureEditorInsertionTarget()
    const {
      panel,
      dropZone,
      fileInput,
      closeButton,
      diffDropZone,
      diffFileInput,
      markdownTextarea,
      folderDropZone,
      folderInput,
      urlTextarea,
      urlImportBtn,
      urlProgressList,
      statusBar,
      switchToTab,
      addFilesToPreview,
      clearPreview,
      getPendingFiles,
      setUploadHandler
    } = createDragDropUploadPanel()

    let isDragOver = false
    let isDiffDragOver = false
    let isFolderDragOver = false

    // Wire the panel's upload button to our uploadAndInsert
    setUploadHandler(async (files: File[]) => {
      await uploadAndInsert(files, addFilesToPreview, showRetryBar, routeContext, editorTarget)
    })

    const cleanup = () => {
      if (panel.parentElement) {
        document.body.removeChild(panel)
      }
      resolve()
    }

    const showRetryBar = (failedItems: { file: File; error: any }[], closePanel?: () => void) => {
      // Close any lingering progress panel before retrying
      if (closePanel) closePanel()
      statusBar.style.display = 'flex'
      statusBar.innerHTML = `
        <span>${failedItems.length} 个文件上传失败</span>
        <button style="
          background: #dc2626;
          color: white;
          border: none;
          border-radius: 4px;
          padding: 4px 12px;
          font-size: 12px;
          cursor: pointer;
        ">重试全部</button>
      `
      const retryAllBtn = statusBar.querySelector('button')
      if (!retryAllBtn) return
      switchToTab('regular')
      retryAllBtn.addEventListener('click', async () => {
        statusBar.style.display = 'none'
        const files = getPendingFiles()
        if (files.length === 0) return
        clearPreview()
        await uploadAndInsert(files, addFilesToPreview, showRetryBar, routeContext, editorTarget)
      })
    }

    // Regular upload handlers — WYSIWYG mode
    fileInput.addEventListener('change', async (event: Event) => {
      const files = (event.target as HTMLInputElement).files
      if (files) {
        addFilesToPreview(Array.from(files))
      }
    })

    dropZone.addEventListener('click', async () => {
      // Open native file picker — files go to preview grid, not directly uploaded
      fileInput.click()
    })

    dropZone.addEventListener('dragover', (e: DragEvent) => {
      e.preventDefault()
      if (!isDragOver) {
        isDragOver = true
        dropZone.style.borderColor = '#3b82f6'
        dropZone.style.backgroundColor = '#eff6ff'
      }
    })

    dropZone.addEventListener('dragleave', (e: DragEvent) => {
      e.preventDefault()
      if (!dropZone.contains(e.relatedTarget as Node)) {
        isDragOver = false
        dropZone.style.borderColor = '#d1d5db'
        dropZone.style.backgroundColor = '#f9fafb'
      }
    })

    dropZone.addEventListener('drop', async (e: DragEvent) => {
      e.preventDefault()
      isDragOver = false
      dropZone.style.borderColor = '#d1d5db'
      dropZone.style.backgroundColor = '#f9fafb'

      const files = e.dataTransfer?.files
      if (files) {
        addFilesToPreview(Array.from(files))
      }
    })

    // Diff upload handlers
    diffFileInput.addEventListener('change', async (event: Event) => {
      const files = (event.target as HTMLInputElement).files
      if (files) {
        await handleDiffFiles(files, markdownTextarea, routeContext)
      }
    })

    diffDropZone.addEventListener('click', async () => {
      await showDiffImagePicker(markdownTextarea, routeContext)
    })

    diffDropZone.addEventListener('dragover', (e: DragEvent) => {
      e.preventDefault()
      if (!isDiffDragOver) {
        isDiffDragOver = true
        diffDropZone.style.borderColor = '#3b82f6'
        diffDropZone.style.backgroundColor = '#eff6ff'
      }
    })

    diffDropZone.addEventListener('dragleave', (e: DragEvent) => {
      e.preventDefault()
      if (!diffDropZone.contains(e.relatedTarget as Node)) {
        isDiffDragOver = false
        diffDropZone.style.borderColor = '#d1d5db'
        diffDropZone.style.backgroundColor = '#f9fafb'
      }
    })

    diffDropZone.addEventListener('drop', async (e: DragEvent) => {
      e.preventDefault()
      isDiffDragOver = false
      diffDropZone.style.borderColor = '#d1d5db'
      diffDropZone.style.backgroundColor = '#f9fafb'

      const files = e.dataTransfer?.files
      if (files) {
        await handleDiffFiles(files, markdownTextarea, routeContext)
      }
    })

    // Folder upload handlers
    folderInput.addEventListener('change', async (event: Event) => {
      const files = (event.target as HTMLInputElement).files
      if (files) {
        await uploadAndInsert(
          Array.from(files),
          addFilesToPreview,
          showRetryBar,
          routeContext,
          editorTarget
        )
      }
    })

    folderDropZone.addEventListener('click', async () => {
      await showFolderPickerWithUpload(routeContext)
    })

    folderDropZone.addEventListener('dragover', (e: DragEvent) => {
      e.preventDefault()
      if (!isFolderDragOver) {
        isFolderDragOver = true
        folderDropZone.style.borderColor = '#3b82f6'
        folderDropZone.style.backgroundColor = '#eff6ff'
      }
    })

    folderDropZone.addEventListener('dragleave', (e: DragEvent) => {
      e.preventDefault()
      if (!folderDropZone.contains(e.relatedTarget as Node)) {
        isFolderDragOver = false
        folderDropZone.style.borderColor = '#d1d5db'
        folderDropZone.style.backgroundColor = '#f9fafb'
      }
    })

    folderDropZone.addEventListener('drop', async (e: DragEvent) => {
      e.preventDefault()
      isFolderDragOver = false
      folderDropZone.style.borderColor = '#d1d5db'
      folderDropZone.style.backgroundColor = '#f9fafb'

      const items = e.dataTransfer?.items
      if (items) {
        const files: File[] = []
        // Process all dropped items
        for (let i = 0; i < items.length; i++) {
          const item = items[i]
          if (item.kind === 'file') {
            const entry = item.webkitGetAsEntry()
            if (entry) {
              await collectFiles(entry, files)
            }
          }
        }
        if (files.length > 0) {
          await uploadAndInsert(files, addFilesToPreview, showRetryBar, routeContext, editorTarget)
        }
      }
    })

    // Clipboard paste support
    const handlePanelPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return

      const imageFiles: File[] = []
      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (file) {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
            const extension = file.type.split('/')[1] || 'png'
            const renamedFile = new File([file], `pasted-image-${timestamp}.${extension}`, {
              type: file.type
            })
            imageFiles.push(renamedFile)
          }
        }
      }

      if (imageFiles.length > 0) {
        e.preventDefault()
        addFilesToPreview(imageFiles)
      }
    }

    urlTextarea.addEventListener('paste', handlePanelPaste)

    // URL import handler
    urlImportBtn.addEventListener('click', async () => {
      await handleUrlImport(urlTextarea, urlImportBtn, urlProgressList, routeContext)
    })

    // Close handlers — consolidated into enhancedCleanup
    const originalCleanup = cleanup
    const enhancedCleanup = () => {
      urlTextarea.removeEventListener('paste', handlePanelPaste)
      ;['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        document.removeEventListener(eventName, preventDefaults, false)
      })
      originalCleanup()
    }

    // Prevent default drag behaviors on document
    const preventDefaults = (e: Event) => {
      e.preventDefault()
      e.stopPropagation()
    }

    ;['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      DAEL(eventName, preventDefaults, false)
    })

    closeButton.addEventListener('click', enhancedCleanup)

    DOA(panel)
  })
}
