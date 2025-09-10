import { defaultEmojiGroups } from './defaultEmojiGroups'
import type { DefaultEmojiData, EmojiGroup } from './emoji'

export async function loadDefaultEmojiGroups(): Promise<EmojiGroup[]> {
  return defaultEmojiGroups
}

export async function loadPackagedDefaults(): Promise<DefaultEmojiData> {
  return {
    groups: defaultEmojiGroups,
    settings: {
      imageScale: 30,
      defaultGroup: 'nachoneko',
      showSearchBar: true,
      gridColumns: 4,
      outputFormat: 'markdown',
      forceMobileMode: false,
      enableLinuxDoInjection: false,
      enableXcomExtraSelectors: true,
      lastModified: 1757425692494,
      tenorApiKey: 'AIzaSyC-P6_qz3FzCoXGLk6tgitZo4jEJ5mLzD8'
    }
  } as unknown as DefaultEmojiData
}
