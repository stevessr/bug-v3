const IMAGE_EXTENSIONS = new Set([
  'avif',
  'bmp',
  'gif',
  'heic',
  'heif',
  'ico',
  'jpeg',
  'jpg',
  'png',
  'svg',
  'tif',
  'tiff',
  'webp'
])

export interface EmojiPackFolderMetadata {
  name: string
  detail?: string
}

/**
 * Parse a selected folder name into the emoji group name and optional detail.
 * The first whitespace separates the two fields; the rest of the name belongs
 * to detail so names such as "初音公式服 单主：初桑さん" remain intact.
 */
export const parseEmojiPackFolderName = (folderName: string): EmojiPackFolderMetadata => {
  const trimmedName = folderName.trim()
  const separatorIndex = trimmedName.search(/\s/)

  if (separatorIndex === -1) {
    return { name: trimmedName }
  }

  const name = trimmedName.slice(0, separatorIndex).trim()
  const detail = trimmedName.slice(separatorIndex + 1).trim()

  return detail ? { name, detail } : { name }
}

/**
 * Return the root directory name reported by an input with webkitdirectory.
 * A directory input should contain one root; returning undefined for mixed
 * roots prevents assigning files from different folders to one emoji pack.
 */
export const getEmojiPackFolderName = (files: Iterable<File>): string | undefined => {
  const roots = new Set<string>()

  for (const file of files) {
    const relativePath = file.webkitRelativePath?.replace(/\\/g, '/')
    const root = relativePath?.split('/').find(Boolean)
    if (root) roots.add(root)
  }

  return roots.size === 1 ? roots.values().next().value : undefined
}

/**
 * Browser MIME detection is not consistent for every image extension. Keep
 * the extension fallback so AVIF/GIF and files from drag-and-drop still work.
 */
export const isEmojiImageFile = (file: Pick<File, 'name' | 'type'>): boolean => {
  if (file.type.toLowerCase().startsWith('image/')) return true

  const extension = file.name.split('.').pop()?.toLowerCase()
  return extension ? IMAGE_EXTENSIONS.has(extension) : false
}

/** Normalize a file/emoji name for duplicate checks while preserving its display name. */
export const normalizeEmojiFilename = (name: string): string =>
  name
    .trim()
    .toLowerCase()
    .replace(/\.[^/.]+$/, '')
