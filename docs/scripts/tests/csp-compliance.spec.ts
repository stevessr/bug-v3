import { test, expect } from '@playwright/test'

test.describe('CSP Compliance Validation', () => {
  const pages = [
    '/options.html',
    '/animation-converter.html', 
    '/image-editor.html',
    '/image-generator-vue.html',
    '/emoji-manager.html'
  ]

  pages.forEach(pagePath => {
    test(`should validate CSP compliance for ${pagePath}`, async ({ page }) => {
      // Track console errors
      const consoleErrors = []
      const networkErrors = []
      
      page.on('console', msg => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text())
        }
      })
      
      page.on('response', response => {
        if (!response.ok()) {
          networkErrors.push(`${response.status()}: ${response.url()}`)
        }
      })
      
      // Load the page
      await page.goto(pagePath)
      await page.waitForLoadState('networkidle')
      
      // Check for CSP violations
      const cspErrors = consoleErrors.filter(error => 
        error.includes('Content Security Policy') ||
        error.includes('script-src') ||
        error.includes('inline script')
      )
      
      expect(cspErrors, `CSP violations found on ${pagePath}: ${cspErrors.join(', ')}`).toHaveLength(0)
      
      // Check for external CDN loading attempts
      const cdnErrors = consoleErrors.filter(error => 
        error.includes('unpkg.com') ||
        error.includes('cdn.jsdelivr.net') ||
        error.includes('cdnjs.cloudflare.com')
      )
      
      expect(cdnErrors, `CDN loading attempts found on ${pagePath}: ${cdnErrors.join(', ')}`).toHaveLength(0)
      
      // Check for failed external requests
      const externalFailures = networkErrors.filter(error =>
        error.includes('unpkg.com') ||
        error.includes('cdn.jsdelivr.net') ||
        error.includes('cdnjs.cloudflare.com')
      )
      
      expect(externalFailures, `External CDN failures on ${pagePath}: ${externalFailures.join(', ')}`).toHaveLength(0)
    })
  })

  test('should validate all scripts load from extension sources', async ({ page }) => {
    // Track all script requests
    const scriptRequests = []
    
    page.on('request', request => {
      if (request.resourceType() === 'script') {
        scriptRequests.push(request.url())
      }
    })
    
    // Load main options page
    await page.goto('/options.html')
    await page.waitForLoadState('networkidle')
    
    // All script URLs should be local (extension:// or relative)
    scriptRequests.forEach(url => {
      const isLocal = url.startsWith('chrome-extension://') ||
                     url.startsWith('extension://') ||
                     url.startsWith('/') ||
                     url.startsWith('./') ||
                     url.startsWith('file://')
      
      expect(isLocal, `External script detected: ${url}`).toBe(true)
    })
  })

  test('should validate FFmpeg loads from local packages', async ({ page }) => {
    // Track network requests
    const requests = []
    
    page.on('request', request => {
      requests.push(request.url())
    })
    
    // Load animation converter
    await page.goto('/animation-converter.html')
    await page.waitForLoadState('networkidle')
    
    // Check no ffmpeg CDN requests
    const ffmpegCdnRequests = requests.filter(url =>
      url.includes('unpkg.com/@ffmpeg') ||
      url.includes('cdn.jsdelivr.net/@ffmpeg')
    )
    
    expect(ffmpegCdnRequests, `FFmpeg CDN requests detected: ${ffmpegCdnRequests.join(', ')}`).toHaveLength(0)
  })

  test('should validate Vue and Ant Design load locally', async ({ page }) => {
    // Track requests
    const requests = []
    
    page.on('request', request => {
      requests.push(request.url())
    })
    
    // Load Vue-based pages
    await page.goto('/emoji-manager.html')
    await page.waitForLoadState('networkidle')
    
    await page.goto('/image-generator-vue.html')
    await page.waitForLoadState('networkidle')
    
    // Check no Vue or Ant Design CDN requests
    const vueCdnRequests = requests.filter(url =>
      url.includes('unpkg.com/vue') ||
      url.includes('unpkg.com/ant-design-vue') ||
      url.includes('cdn.jsdelivr.net/npm/vue') ||
      url.includes('cdn.jsdelivr.net/npm/ant-design-vue')
    )
    
    expect(vueCdnRequests, `Vue/Ant Design CDN requests detected: ${vueCdnRequests.join(', ')}`).toHaveLength(0)
  })

  test('should validate no inline script execution', async ({ page }) => {
    const consoleErrors = []
    
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text())
      }
    })
    
    // Test all main pages
    for (const pagePath of pages) {
      await page.goto(pagePath)
      await page.waitForLoadState('networkidle')
    }
    
    // Check for inline script execution errors
    const inlineScriptErrors = consoleErrors.filter(error =>
      error.includes('unsafe-inline') ||
      error.includes('inline script') ||
      error.includes('nonce') ||
      error.includes('sha256')
    )
    
    expect(inlineScriptErrors, `Inline script execution errors: ${inlineScriptErrors.join(', ')}`).toHaveLength(0)
  })

  test('should validate extension works in strict CSP environment', async ({ page, context }) => {
    // Simulate strict CSP headers
    await context.route('**/*', async route => {
      const response = await route.fetch()
      const headers = response.headers()
      
      // Add strict CSP header for HTML pages
      if (headers['content-type']?.includes('text/html')) {
        headers['content-security-policy'] = "script-src 'self'; object-src 'none'; base-uri 'self';"
      }
      
      route.fulfill({
        response,
        headers
      })
    })
    
    // Test main functionality still works
    await page.goto('/options.html')
    
    // Should be able to navigate to tools tab
    await page.locator('text=小工具').click()
    await expect(page.locator('.tool-card')).toHaveCount(4)
    
    // Should be able to open tools in new tabs
    const [newPage] = await Promise.all([
      context.waitForEvent('page'),
      page.locator('text=表情管理器').click()
    ])
    
    await expect(newPage).toHaveURL(/emoji-manager\.html/)
  })
})