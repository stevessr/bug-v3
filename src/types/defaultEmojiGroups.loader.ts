/* Runtime loader for default emoji groups.
   It fetches the packaged JSON at runtime (from /assets/defaultEmojiGroups.json) and
   caches the result. This avoids generating a TypeScript module at build time.
*/
import type { EmojiGroup, AppSettings, DefaultEmojiData } from './emoji'

import { logger } from '@/config/buildFlags'

let cachedGroups: EmojiGroup[] | null = null
let cachedDefaults: DefaultEmojiData | null = null
let loadingGroups: Promise<EmojiGroup[]> | null = null
let loadingDefaults: Promise<DefaultEmojiData> | null = null

function isEmojiGroupArray(v: unknown): v is EmojiGroup[] {
  if (!Array.isArray(v)) return false
  return v.every((g: unknown) => !!g && typeof (g as Record<string, unknown>).id === 'string')
}

function isAppSettings(v: unknown): v is AppSettings {
  return !!v && typeof (v as Record<string, unknown>).imageScale === 'number'
}

export async function loadDefaultEmojiGroups(): Promise<EmojiGroup[]> {
  if (cachedGroups) return cachedGroups
  if (loadingGroups) return loadingGroups

  loadingGroups = (async (): Promise<EmojiGroup[]> => {
    try {
      const url = '/assets/defaultEmojiGroups.json'
      const res = await fetch(url, { cache: 'reload' })
      if (!res.ok) {
        logger.warn('[defaultEmojiGroups.loader] failed to fetch', res.status)
        cachedGroups = []
        return cachedGroups
      }
      const data = await res.json()

      // Support shapes: { groups: [...] , settings: {...} } or [...]
      if (isEmojiGroupArray(data)) {
        cachedGroups = data
      } else if (
        data &&
        typeof (data as unknown) === 'object' &&
        isEmojiGroupArray((data as unknown as Record<string, unknown>).groups)
      ) {
        cachedGroups = (data as unknown as Record<string, unknown>).groups as EmojiGroup[]
      } else {
        logger.warn('[defaultEmojiGroups.loader] unexpected JSON shape for groups')
        cachedGroups = []
      }
    } catch (e) {
      logger.warn('[defaultEmojiGroups.loader] error loading JSON', e)
      cachedGroups = []
    } finally {
      // noop
    }

    loadingGroups = null
    return cachedGroups || []
  })()

  return loadingGroups as Promise<EmojiGroup[]>
}

// Load both groups and settings from the packaged JSON. Cached separately.
export async function loadPackagedDefaults(): Promise<DefaultEmojiData> {
  if (cachedDefaults) return cachedDefaults
  if (loadingDefaults) return loadingDefaults

  loadingDefaults = (async (): Promise<DefaultEmojiData> => {
    try {
      const url = '/assets/defaultEmojiGroups.json'
      const res = await fetch(url, { cache: 'reload' })
      if (!res.ok) {
        logger.warn('[defaultEmojiGroups.loader] failed to fetch defaults', res.status)
        cachedDefaults = { groups: [], settings: {} as AppSettings }
        return cachedDefaults
      }

      const data = await res.json()

      let groups: EmojiGroup[] = []
      let settings: AppSettings | null = null

      if (isEmojiGroupArray(data)) {
        groups = data
      } else if (
        data &&
        typeof (data as unknown) === 'object' &&
        isEmojiGroupArray((data as unknown as Record<string, unknown>).groups)
      ) {
        groups = (data as unknown as Record<string, unknown>).groups as EmojiGroup[]
      }

      if (
        data &&
        typeof (data as unknown) === 'object' &&
        isAppSettings((data as unknown as Record<string, unknown>).settings)
      ) {
        settings = (data as unknown as Record<string, unknown>).settings as AppSettings
      } else if (isAppSettings(data)) {
        settings = data as AppSettings
      }

      cachedDefaults = {
        groups,
        settings: (settings as AppSettings) || ({} as AppSettings)
      }
    } catch (e) {
      logger.warn('[defaultEmojiGroups.loader] error loading defaults JSON', e)
      cachedDefaults = { groups: [], settings: {} as AppSettings }
    } finally {
      // noop
    }

    loadingDefaults = null
    return cachedDefaults as DefaultEmojiData
  })()

  return loadingDefaults as Promise<DefaultEmojiData>
}
