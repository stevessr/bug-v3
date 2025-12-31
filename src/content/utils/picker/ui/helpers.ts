import type { FileUploadStatus } from '../types'

/**
 * Format file size to human readable string
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

/**
 * Get status icon for file upload status
 */
export const getStatusIcon = (status: FileUploadStatus['status']): string => {
  const icons = {
    waiting: '⏳',
    uploading: '⬆️',
    success: '✓',
    failed: '✗'
  }
  return icons[status]
}

/**
 * Get status display info (text and color)
 */
export const getStatusInfo = (status: FileUploadStatus): { text: string; color: string } => {
  const colors = {
    waiting: '#6b7280',
    uploading: '#3b82f6',
    success: '#10b981',
    failed: '#ef4444'
  }

  let text = ''
  switch (status.status) {
    case 'waiting':
      text = '等待上传...'
      break
    case 'uploading':
      text = status.progress !== undefined ? `上传中 ${status.progress}%` : '上传中...'
      break
    case 'success':
      text = '✓ 上传成功'
      break
    case 'failed':
      text = status.error ? `✗ ${status.error}` : '✗ 上传失败'
      break
  }

  return {
    text: `${formatFileSize(status.file.size)} • ${text}`,
    color: colors[status.status]
  }
}
