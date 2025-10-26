// Platform detection and optimization utilities

export type PlatformType = 'pc' | 'mobile' | 'original'

// Runtime detection of device type
export function detectRuntimePlatform(): PlatformType {
  try {
    // Check screen size
    const isMobileSize = window.innerWidth <= 768

    // Check user agent
    const userAgent = navigator.userAgent.toLowerCase()
    const isMobileUserAgent = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(
      userAgent
    )

    // Check touch capability
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0

    // Combine indicators
    if (isMobileSize && (isMobileUserAgent || isTouchDevice)) {
      return 'mobile'
    } else if (!isMobileSize && !isMobileUserAgent) {
      return 'pc'
    }

    return 'original' // Fallback for ambiguous cases
  } catch {
    return 'original'
  }
}

// Get effective platform (build-time override or runtime detection)
export function getEffectivePlatform(): PlatformType {
  // Build-time platform override removed; always use runtime detection
  return detectRuntimePlatform()
}

// Check if platform-specific optimization should be applied
export function shouldOptimizeForPlatform(targetPlatform: PlatformType): boolean {
  const effective = getEffectivePlatform()
  return effective === targetPlatform
}

// Platform-specific UI configuration
export interface PlatformUIConfig {
  emojiPickerMaxHeight: string
  emojiPickerColumns: number
  emojiSize: number
  isModal: boolean
  useCompactLayout: boolean
  showSearchBar: boolean
  floatingButtonSize: number
}

export function getPlatformUIConfig(): PlatformUIConfig {
  const platform = getEffectivePlatform()

  switch (platform) {
    case 'mobile':
      return {
        emojiPickerMaxHeight: '60vh',
        emojiPickerColumns: 4,
        emojiSize: 32,
        isModal: true,
        useCompactLayout: true,
        showSearchBar: true,
        floatingButtonSize: 48
      }

    case 'pc':
      return {
        emojiPickerMaxHeight: '400px',
        emojiPickerColumns: 6,
        emojiSize: 24,
        isModal: false,
        useCompactLayout: false,
        showSearchBar: true,
        floatingButtonSize: 40
      }

    default: // original
      return {
        emojiPickerMaxHeight: '350px',
        emojiPickerColumns: 5,
        emojiSize: 28,
        isModal: false,
        useCompactLayout: false,
        showSearchBar: true,
        floatingButtonSize: 44
      }
  }
}

// Platform-specific Discourse toolbar selectors
export function getPlatformToolbarSelectors(): string[] {
  const platform = getEffectivePlatform()

  // Discourse-specific base selectors
  const baseSelectors = [
    '.d-editor-button-bar[role="toolbar"]',
    '.chat-composer__inner-container',
    '.d-editor-button-bar'
  ]

  switch (platform) {
    case 'mobile':
      return [
        ...baseSelectors,
        '.mobile-composer .d-editor-button-bar',
        '.discourse-mobile .d-editor-button-bar',
        '[data-mobile-toolbar]'
      ]

    case 'pc':
      return [
        ...baseSelectors,
        '.desktop-composer .d-editor-button-bar',
        '.discourse-desktop .d-editor-button-bar',
        '[data-desktop-toolbar]'
      ]

    default:
      return baseSelectors
  }
}

// Log platform information
export function logPlatformInfo(): void {
  const buildPlatform = 'original' // build-time platform support removed
  const runtimePlatform = detectRuntimePlatform()
  const effectivePlatform = getEffectivePlatform()
  const config = getPlatformUIConfig()

  console.log('[Platform] Build target:', buildPlatform)
  console.log('[Platform] Runtime detected:', runtimePlatform)
  console.log('[Platform] Effective platform:', effectivePlatform)
  console.log('[Platform] UI config:', config)
  console.log('[Platform] Screen size:', `${window.innerWidth}x${window.innerHeight}`)
  console.log(
    '[Platform] User agent mobile:',
    /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(
      navigator.userAgent.toLowerCase()
    )
  )
  console.log('[Platform] Touch device:', 'ontouchstart' in window || navigator.maxTouchPoints > 0)
}
