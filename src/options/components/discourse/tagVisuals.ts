import { tag_icon_list } from './linux.do/icon.js'

export type TagVisual = {
  icon: string
  color: string
}

const toKey = (value?: string | null) => (value || '').trim().toLocaleLowerCase()

const tagVisualMap = (() => {
  const map = new Map<string, TagVisual>()
  tag_icon_list.split('|').forEach(item => {
    const [rawName, rawIcon, rawColor] = item.split(',').map(part => (part || '').trim())
    const key = toKey(rawName)
    if (!key || !rawIcon) return
    map.set(key, {
      icon: rawIcon,
      color: rawColor || '#669d34'
    })
  })
  return map
})()

export const getTagVisual = (name?: string | null, text?: string | null) => {
  return tagVisualMap.get(toKey(name)) || tagVisualMap.get(toKey(text)) || null
}

export const stripHtml = (value?: string | null) => {
  if (!value) return ''
  return value.replace(/<[^>]+>/g, '').trim()
}

export const hexToRgba = (hex: string, alpha: number) => {
  const clean = hex.replace('#', '').trim()
  const normalized =
    clean.length === 3
      ? clean
          .split('')
          .map(char => char + char)
          .join('')
      : clean
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return `rgba(102,157,52,${alpha})`
  }
  const r = parseInt(normalized.slice(0, 2), 16)
  const g = parseInt(normalized.slice(2, 4), 16)
  const b = parseInt(normalized.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}
