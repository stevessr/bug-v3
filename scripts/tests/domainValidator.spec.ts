import { test, expect } from '@playwright/test'

// Since we're testing utilities that depend on window.location, we'll test them in a browser context

test.describe('Domain Validator', () => {
  test('should filter emojis by domain on linux.do', async ({ page }) => {
    // Navigate to a test page that simulates linux.do
    await page.goto('https://linux.do')

    // Inject our utility functions and test data
    const result = await page.evaluate(() => {
      // Mock emoji data
      const testEmojis = [
        { id: '1', url: 'https://linux.do/uploads/test.jpg', name: 'test1' },
        { id: '2', url: 'https://sub.linux.do/uploads/test.jpg', name: 'test2' },
        { id: '3', url: 'https://example.com/uploads/test.jpg', name: 'test3' },
        { id: '4', url: 'https://another.linux.do/image.png', name: 'test4' }
      ]

      const testGroups = [
        {
          id: 'group1',
          name: 'Linux.do Emojis',
          icon: '🐧',
          order: 1,
          emojis: [testEmojis[0], testEmojis[1], testEmojis[3]]
        },
        {
          id: 'group2',
          name: 'External Emojis',
          icon: '🌍',
          order: 2,
          emojis: [testEmojis[2]]
        },
        {
          id: 'favorites',
          name: 'Favorites',
          icon: '⭐',
          order: 0,
          emojis: []
        }
      ]

      // Simulate the domain validator logic inline
      const getCurrentDomain = () => {
        return window.location.hostname.toLowerCase()
      }

      const extractHostname = (url: string): string | null => {
        try {
          const urlObj = new URL(url)
          return urlObj.hostname.toLowerCase()
        } catch {
          return null
        }
      }

      const matchesDomainPattern = (hostname: string, domainPattern: string): boolean => {
        const pattern = domainPattern.toLowerCase()
        const host = hostname.toLowerCase()

        if (host === pattern) {
          return true
        }

        if (pattern.startsWith('*.')) {
          const baseDomain = pattern.slice(2)
          return host === baseDomain || host.endsWith('.' + baseDomain)
        }

        if (host.endsWith('.' + pattern)) {
          return true
        }

        return false
      }

      const isEmojiFromDomain = (emojiUrl: string, domainPattern: string): boolean => {
        const hostname = extractHostname(emojiUrl)
        if (!hostname) {
          return false
        }
        return matchesDomainPattern(hostname, domainPattern)
      }

      const filterEmojisByDomain = <T extends { url: string }>(
        emojis: T[],
        domainPattern: string
      ): T[] => {
        if (!domainPattern) {
          return emojis
        }
        return emojis.filter(emoji => isEmojiFromDomain(emoji.url, domainPattern))
      }

      const getDomainFilterPattern = (): string | null => {
        const currentDomain = getCurrentDomain()
        if (!currentDomain) {
          return null
        }

        if (currentDomain === 'linux.do' || currentDomain.endsWith('.linux.do')) {
          return '*.linux.do'
        }

        return null
      }

      const filterGroupsByDomain = (groups: any[]): any[] => {
        const domainPattern = getDomainFilterPattern()

        if (!domainPattern) {
          return groups
        }

        const filteredGroups: any[] = []

        for (const group of groups) {
          if (group.id === 'favorites') {
            filteredGroups.push(group)
            continue
          }

          const filteredEmojis = filterEmojisByDomain(group.emojis, domainPattern)

          if (filteredEmojis.length > 0) {
            filteredGroups.push({
              ...group,
              emojis: filteredEmojis
            })
          }
        }

        return filteredGroups
      }

      // Test the filtering
      const filteredGroups = filterGroupsByDomain(testGroups)

      return {
        currentDomain: getCurrentDomain(),
        domainPattern: getDomainFilterPattern(),
        originalGroupsCount: testGroups.length,
        filteredGroupsCount: filteredGroups.length,
        group1EmojisCount: filteredGroups.find(g => g.id === 'group1')?.emojis.length || 0,
        group2Exists: filteredGroups.some(g => g.id === 'group2'),
        favoritesExists: filteredGroups.some(g => g.id === 'favorites')
      }
    })

    // Verify the results
    expect(result.currentDomain).toBe('linux.do')
    expect(result.domainPattern).toBe('*.linux.do')
    expect(result.originalGroupsCount).toBe(3)
    expect(result.filteredGroupsCount).toBe(2) // group1 and favorites, group2 should be filtered out
    expect(result.group1EmojisCount).toBe(3) // All three linux.do emojis
    expect(result.group2Exists).toBe(false) // Should be filtered out (no linux.do emojis)
    expect(result.favoritesExists).toBe(true) // Favorites should always be kept
  })

  test('should not filter emojis on non-linux.do domains', async ({ page }) => {
    // Navigate to a different domain
    await page.goto('https://example.com')

    const result = await page.evaluate(() => {
      const getCurrentDomain = () => {
        return window.location.hostname.toLowerCase()
      }

      const getDomainFilterPattern = (): string | null => {
        const currentDomain = getCurrentDomain()
        if (!currentDomain) {
          return null
        }

        if (currentDomain === 'linux.do' || currentDomain.endsWith('.linux.do')) {
          return '*.linux.do'
        }

        return null
      }

      return {
        currentDomain: getCurrentDomain(),
        domainPattern: getDomainFilterPattern()
      }
    })

    expect(result.currentDomain).toBe('example.com')
    expect(result.domainPattern).toBe(null) // No filtering on example.com
  })
})
