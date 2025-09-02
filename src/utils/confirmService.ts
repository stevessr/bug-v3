/* eslint-disable no-alert, @typescript-eslint/no-explicit-any */
let handler: any = null

export function setConfirmHandler(h: any) {
  handler = h
}

export function clearConfirmHandler() {
  handler = null
}

export function requestConfirmation(title?: string, message?: string): Promise<boolean> {
  if (handler) return handler(title, message)
  try {
    // fallback to native confirm in non-UI environments

    return Promise.resolve(window.confirm(message || title || '确定要继续吗？'))
  } catch {
    // fallback
    return Promise.resolve(false)
  }
}
