// Content-only copy of runtime defaults to avoid creating a shared chunk
// during bundling. This file intentionally duplicates a small subset of
// `src/types/emoji.ts` (runtime defaults) so the content bundle can be
// emitted as a single file without importing the project's central runtime
// types module.

export const DEFAULT_UPLOAD_MENU_ITEMS = {
  autoItems: [
    ['学习 xv6', '🖥︎', 'https://pwsh.edu.deal/'],
    ['connect', '🔗', 'https://connect.linux.do/'],
    ['idcalre', '📅', 'https://idcflare.com/']
  ] as Array<[string, string, string]>,
  iframes: [['过盾', '🛡', 'https://linux.do/challenge', 'emoji-extension-passwall-iframe']] as Array<[string, string, string, string]>,
  sides: [
    ['视频转 gif(iframe)', '🎞️', 'https://video2gif-pages.pages.dev/', 'emoji-extension-video2gif-iframe']
  ] as Array<[string, string, string, string]>
}

// Minimal default settings used by content scripts. Keep this small and
// focused on runtime values the content script relies on; other code paths
// (background, options) continue to use the canonical `src/types/emoji.ts`.
export const defaultSettings: any = {
  imageScale: 100,
  defaultGroup: 'nachoneko',
  showSearchBar: true,
  gridColumns: 4,
  outputFormat: 'markdown',
  forceMobileMode: false,
  enableHoverPreview: true,
  enableLinuxDoInjection: true,
  enableXcomExtraSelectors: false,
  enableCalloutSuggestions: true,
  enableBatchParseImages: true,
  customColorScheme: 'default',
  customPrimaryColor: '#1890ff',
  customCss: '',
  syncVariantToDisplayUrl: true,
  // ensure uploadMenuItems exists so content consumers always have it
  uploadMenuItems: DEFAULT_UPLOAD_MENU_ITEMS
}

export default defaultSettings
