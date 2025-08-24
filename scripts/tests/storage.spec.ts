import { test, expect } from '@playwright/test'

test.describe('Emoji Extension Storage System', () => {
  test('should load popup without errors', async ({ page }) => {
    // Listen for console errors
    const errors: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
      }
    })

    // Navigate to popup page
    await page.goto('/popup.html')

    // Wait for the page to load
    await page.waitForTimeout(2000)

    // Check that no console errors occurred (filter out expected network errors)
    const relevantErrors = errors.filter(error => 
      !error.includes('Extension context invalidated') &&
      !error.includes('Failed to load resource: net::ERR_NAME_NOT_RESOLVED') &&
      !error.includes('Failed to load resource: the server responded with a status of 404')
    )
    expect(relevantErrors).toHaveLength(0)

    // Check that the page loaded correctly
    const title = await page.title()
    expect(title).toBeTruthy()
  })

  test('should load options page without errors', async ({ page }) => {
    const errors: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
      }
    })

    await page.goto('/options.html')
    await page.waitForTimeout(2000)

    expect(errors.filter(error => 
      !error.includes('Extension context invalidated') &&
      !error.includes('Failed to load resource: net::ERR_NAME_NOT_RESOLVED') &&
      !error.includes('Failed to load resource: the server responded with a status of 404')
    )).toHaveLength(0)

    const title = await page.title()
    expect(title).toBeTruthy()
  })

  test('should handle storage operations', async ({ page }) => {
    // Test storage system functionality
    await page.goto('/options.html')

    // Wait for app to initialize
    await page.waitForTimeout(3000)

    // Check for storage-related console messages
    const logs: string[] = []
    page.on('console', msg => {
      if (msg.text().includes('[Storage')) {
        logs.push(msg.text())
      }
    })

    // Trigger a storage operation by waiting a bit more
    await page.waitForTimeout(2000)

    // Should have some storage log messages
    expect(logs.length).toBeGreaterThan(0)

    // Look for successful storage operations
    const successfulOps = logs.filter(
      log => log.includes('success') || log.includes('SUCCESS') || log.includes('completed')
    )
    expect(successfulOps.length).toBeGreaterThan(0)
  })

  test('should display emoji groups correctly', async ({ page }) => {
    await page.goto('/options.html')

    // Wait for the page to fully load
    await page.waitForTimeout(3000)

    // Check for emoji-related content
    const emojiGroupElements = await page.$$('[data-testid*="group"], .emoji-group, .group-item')

    // Should have some emoji groups displayed
    expect(emojiGroupElements.length).toBeGreaterThan(0)
  })
})
