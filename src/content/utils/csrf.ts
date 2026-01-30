import { DQS } from './createEl'

export function getCsrfTokenFromPage(): string {
  // Try to get CSRF token from meta tag
  const metaToken = DQS('meta[name="csrf-token"]') as HTMLMetaElement
  if (metaToken) {
    return metaToken.content
  }

  // Try to get from cookie
  const match = document.cookie.match(/csrf_token=([^;]+)/)
  if (match) {
    return decodeURIComponent(match[1])
  }

  // Fallback - try to extract from any form
  const hiddenInput = DQS('input[name="authenticity_token"]') as HTMLInputElement
  if (hiddenInput) {
    return hiddenInput.value
  }

  return ''
}
