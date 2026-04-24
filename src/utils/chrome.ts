export function getChromeAPI<T = typeof chrome>(): T | null {
  try {
    return ((globalThis as any).chrome || (self as any).chrome) ?? null
  } catch {
    return null
  }
}
