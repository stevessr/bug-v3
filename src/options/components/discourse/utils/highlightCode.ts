import type { HLJSApi, LanguageFn } from 'highlight.js'

let hljsPromise: Promise<HLJSApi> | null = null

const EXTRA_LANGUAGES: ReadonlyArray<readonly [string, () => Promise<{ default: LanguageFn }>]> = [
  ['dockerfile', () => import('highlight.js/lib/languages/dockerfile')],
  ['nginx', () => import('highlight.js/lib/languages/nginx')],
  ['powershell', () => import('highlight.js/lib/languages/powershell')],
  ['nix', () => import('highlight.js/lib/languages/nix')],
  ['http', () => import('highlight.js/lib/languages/http')],
  ['properties', () => import('highlight.js/lib/languages/properties')],
  ['protobuf', () => import('highlight.js/lib/languages/protobuf')],
  ['vim', () => import('highlight.js/lib/languages/vim')],
  ['awk', () => import('highlight.js/lib/languages/awk')]
]

function getHighlighter(): Promise<HLJSApi> {
  if (!hljsPromise) {
    hljsPromise = (async () => {
      const [{ default: hljs }, loadedResults] = await Promise.all([
        import('highlight.js/lib/common'),
        Promise.allSettled(
          EXTRA_LANGUAGES.map(async ([name, loader]) => {
            const mod = await loader()
            return [name, mod.default] as const
          })
        )
      ])

      for (const result of loadedResults) {
        if (result.status !== 'fulfilled') continue
        const [name, language] = result.value
        if (!hljs.getLanguage(name)) {
          hljs.registerLanguage(name, language)
        }
      }

      return hljs
    })().catch(error => {
      hljsPromise = null
      throw error
    })
  }
  return hljsPromise
}

export async function highlightCodeBlocks(container: HTMLElement | null): Promise<void> {
  if (!container) return
  const blocks = Array.from(container.querySelectorAll<HTMLElement>('pre code')).filter(
    el => !el.dataset.highlighted
  )
  if (blocks.length === 0) return

  const hljs = await getHighlighter()

  for (const el of blocks) {
    if (!el.isConnected || el.dataset.highlighted) continue
    try {
      const langMatch = Array.from(el.classList).find(cls => cls.startsWith('lang-'))
      if (langMatch) {
        const lang = langMatch.slice('lang-'.length)
        if (hljs.getLanguage(lang)) {
          el.innerHTML = hljs.highlight(el.textContent || '', { language: lang }).value
          el.classList.add('hljs')
          el.dataset.highlighted = 'true'
          continue
        }
      }
      hljs.highlightElement(el)
      el.dataset.highlighted = 'true'
    } catch {
      // ignore per-block highlight failures
    }
  }
}
