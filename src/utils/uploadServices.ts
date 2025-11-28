export interface UploadService {
  name: string
  uploadFile(file: File, onProgress?: (percent: number) => void): Promise<string>
}

class LinuxDoUploadService implements UploadService {
  name = 'linux.do'
  private readonly UPLOAD_URL =
    'https://linux.do/uploads.json?client_id=f06cb5577ba9410d94b9faf94e48c2d8'

  async computeSHA1OfArrayBuffer(buffer: ArrayBuffer): Promise<string | null> {
    if (typeof crypto === 'undefined' || !crypto.subtle) return null
    try {
      const hash = await crypto.subtle.digest('SHA-1', buffer)
      const arr = Array.from(new Uint8Array(hash))
      return arr.map(b => b.toString(16).padStart(2, '0')).join('')
    } catch {
      return null
    }
  }

  async uploadFile(file: File, onProgress?: (percent: number) => void): Promise<string> {
    try {
      // Get cookies and CSRF token
      const { cookies, csrfToken } = await this.getLinuxDoAuth()

      // Build form data
      const arrayBuffer = await file.arrayBuffer()
      const sha1 = await this.computeSHA1OfArrayBuffer(arrayBuffer)

      const form = new FormData()
      form.append('upload_type', 'composer')
      form.append('relativePath', 'null')
      form.append('name', file.name)
      form.append('type', file.type)
      if (sha1) form.append('sha1_checksum', sha1)
      form.append('file', file, file.name)

      const headers: Record<string, string> = {}
      if (csrfToken) headers['X-Csrf-Token'] = csrfToken
      if (cookies) headers['Cookie'] = cookies

      // Note: Progress tracking for fetch uploads is complex and requires XHR
      // For now, we'll simulate progress
      if (onProgress) {
        let progress = 0
        const interval = setInterval(() => {
          progress += 10
          if (progress <= 90) {
            onProgress(progress)
          } else {
            clearInterval(interval)
          }
        }, 200)
      }

      const response = await fetch(this.UPLOAD_URL, {
        method: 'POST',
        headers,
        body: form
      })

      if (response.ok) {
        const data = await response.json()
        if (data && data.url) {
          if (onProgress) onProgress(100)
          return data.url
        }
        throw new Error('Invalid response from linux.do')
      } else {
        const errorData = await response.json().catch(() => null)
        throw new Error(`Upload failed: ${response.status} ${errorData?.message || ''}`)
      }
    } catch (error) {
      console.error('Linux.do upload failed:', error)
      throw error
    }
  }

  private async getLinuxDoAuth(): Promise<{ cookies: string; csrfToken: string }> {
    let cookies = ''
    let csrfToken = ''

    try {
      // Get cookies from chrome API if available
      if (typeof chrome !== 'undefined' && chrome.cookies) {
        const cookieList = await chrome.cookies.getAll({ domain: 'linux.do' })
        cookies = cookieList.map(c => `${c.name}=${c.value}`).join('; ')
      }

      // Get CSRF token from linux.do tabs
      if (typeof chrome !== 'undefined' && chrome.tabs) {
        const tabs = await chrome.tabs.query({ url: 'https://linux.do/*' })
        for (const tab of tabs) {
          if (tab.id) {
            try {
              const resp = await chrome.tabs.sendMessage(tab.id, { type: 'GET_CSRF_TOKEN' })
              if (resp && resp.csrfToken) {
                csrfToken = resp.csrfToken
                break
              }
            } catch {
              continue
            }
          }
        }
      }
    } catch (error) {
      console.warn('Failed to get linux.do auth:', error)
    }

    return { cookies, csrfToken }
  }
}

class IDCFlareUploadService implements UploadService {
  name = 'idcflare.com'
  private readonly UPLOAD_URL =
    'https://idcflare.com/uploads.json?client_id=1b4186493e084a11955dd3cab51b5062'

  async computeSHA1OfArrayBuffer(buffer: ArrayBuffer): Promise<string | null> {
    if (typeof crypto === 'undefined' || !crypto.subtle) return null
    try {
      const hash = await crypto.subtle.digest('SHA-1', buffer)
      const arr = Array.from(new Uint8Array(hash))
      return arr.map(b => b.toString(16).padStart(2, '0')).join('')
    } catch {
      return null
    }
  }

  async uploadFile(file: File, onProgress?: (percent: number) => void): Promise<string> {
    try {
      // Get cookies and CSRF token
      const { cookies, csrfToken } = await this.getIDCFlareAuth()

      // Build form data
      const arrayBuffer = await file.arrayBuffer()
      const sha1 = await this.computeSHA1OfArrayBuffer(arrayBuffer)

      const form = new FormData()
      form.append('upload_type', 'composer')
      form.append('relativePath', 'null')
      form.append('name', file.name)
      form.append('type', file.type)
      if (sha1) form.append('sha1_checksum', sha1)
      form.append('file', file, file.name)

      const headers: Record<string, string> = {}
      if (csrfToken) headers['X-Csrf-Token'] = csrfToken
      if (cookies) headers['Cookie'] = cookies

      // Note: Progress tracking for fetch uploads is complex and requires XHR
      // For now, we'll simulate progress
      if (onProgress) {
        let progress = 0
        const interval = setInterval(() => {
          progress += 10
          if (progress <= 90) {
            onProgress(progress)
          } else {
            clearInterval(interval)
          }
        }, 200)
      }

      const response = await fetch(this.UPLOAD_URL, {
        method: 'POST',
        headers,
        body: form
      })

      if (response.ok) {
        const data = await response.json()
        if (data && data.url) {
          if (onProgress) onProgress(100)
          return data.url
        }
        throw new Error('Invalid response from idcflare.com')
      } else {
        const errorData = await response.json().catch(() => null)
        throw new Error(`Upload failed: ${response.status} ${errorData?.message || ''}`)
      }
    } catch (error) {
      console.error('IDCFlare upload failed:', error)
      throw error
    }
  }

  private async getIDCFlareAuth(): Promise<{ cookies: string; csrfToken: string }> {
    let cookies = ''
    let csrfToken = ''

    try {
      // Get cookies from chrome API if available
      if (typeof chrome !== 'undefined' && chrome.cookies) {
        const cookieList = await chrome.cookies.getAll({ domain: 'idcflare.com' })
        cookies = cookieList.map(c => `${c.name}=${c.value}`).join('; ')
      }

      // Get CSRF token from idcflare.com tabs
      if (typeof chrome !== 'undefined' && chrome.tabs) {
        const tabs = await chrome.tabs.query({ url: 'https://idcflare.com/*' })
        for (const tab of tabs) {
          if (tab.id) {
            try {
              const resp = await chrome.tabs.sendMessage(tab.id, { type: 'GET_CSRF_TOKEN' })
              if (resp && resp.csrfToken) {
                csrfToken = resp.csrfToken
                break
              }
            } catch {
              continue
            }
          }
        }
      }
    } catch (error) {
      console.warn('Failed to get idcflare.com auth:', error)
    }

    return { cookies, csrfToken }
  }
}

export const uploadServices: Record<string, UploadService> = {
  'linux.do': new LinuxDoUploadService(),
  'idcflare.com': new IDCFlareUploadService()
}
