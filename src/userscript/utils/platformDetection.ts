// Platform detection and optimization utilities
declare const __USERSCRIPT_PLATFORM__: string

export type PlatformType = 'pc' | 'mobile' | 'original'

// Get the build-time platform setting
export function getBuildPlatform(): PlatformType {
  try {
    return __USERSCRIPT_PLATFORM__ as PlatformType
  } catch {
    return 'original'
  }
}

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
  const buildPlatform = getBuildPlatform()

  if (buildPlatform === 'original') {
    return detectRuntimePlatform()
  }

  return buildPlatform
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

// Platform-specific injection selectors
export function getPlatformToolbarSelectors(): string[] {
  const platform = getEffectivePlatform()

  const baseSelectors = ['.d-editor-button-bar[role="toolbar"]', '.chat-composer__inner-container']

  switch (platform) {
    case 'mobile':
      return [
        ...baseSelectors,
        '.mobile-composer-toolbar',
        '.chat-composer-mobile',
        '[data-mobile-toolbar]',
        '.discourse-mobile .d-editor-button-bar'
      ]

    case 'pc':
      return [
        ...baseSelectors,
        '.desktop-composer-toolbar',
        '.chat-composer-desktop',
        '[data-desktop-toolbar]',
        '.discourse-desktop .d-editor-button-bar'
      ]

    default:
      return baseSelectors
  }
}

// Log platform information
export function logPlatformInfo(): void {
  const buildPlatform = getBuildPlatform()
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
