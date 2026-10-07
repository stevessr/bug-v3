import { extractStickerSetName } from '@/utils/telegramResolver'

const sourceLine = /Telegram 贴纸包：[ \t]*([^\r\n]*)/

export const getTelegramGroupSource = (detail?: string): string => {
  const input = detail?.match(sourceLine)?.[1]?.trim()
  return input ? extractStickerSetName(input) || '' : ''
}

export const withTelegramGroupSource = (detail: string | undefined, name: string): string => {
  const line = `Telegram 贴纸包：${name}`
  if (detail && sourceLine.test(detail)) return detail.replace(sourceLine, line)
  return detail?.trim() ? `${detail.trim()}\n\n${line}` : line
}
