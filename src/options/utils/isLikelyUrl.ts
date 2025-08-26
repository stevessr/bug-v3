export const isLikelyUrl = (str: string): boolean => {
  if (!str) return false
  return str.startsWith('http://') || str.startsWith('https://') || str.startsWith('data:image')
}
