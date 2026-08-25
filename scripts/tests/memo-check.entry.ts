// Memoization behavior check for sanitizeHtml.ts + parsePostContent.ts.
// Bundled with esbuild as an IIFE and executed in real Chromium via Playwright
// (DOMPurify + rehype need a DOM).
import { sanitizeDiscourseHtml } from '../../src/options/components/discourse/sanitizeHtml'
import { parsePostContent } from '../../src/options/components/discourse/parser/parsePostContent'

declare global {
  interface Window {
    __memoCheck: () => Record<string, unknown>
  }
}

window.__memoCheck = () => {
  const results: Record<string, unknown> = {}

  const dirty = '<p onclick="evil()">hello <script>alert(1)</script><b>world</b></p>'
  const clean1 = sanitizeDiscourseHtml(dirty)
  const clean2 = sanitizeDiscourseHtml(dirty)
  results.sanitizeStripsScript = clean1 === '<p>hello <b>world</b></p>' || !clean1.includes('script')
  results.sanitizeDeterministic = clean1 === clean2

  // LRU eviction: insert more than the limit, oldest entries recompute fine.
  for (let i = 0; i < 320; i++) sanitizeDiscourseHtml(`<p>item-${i}</p>`)
  results.sanitizeCacheSurvivesEviction = sanitizeDiscourseHtml(dirty) === clean1

  const cooked =
    '<p>quote <aside class="quote"><blockquote>inner</blockquote></aside>' +
    '<img src="https://example.com/a.png" width="100" height="80">' +
    '<sup class="footnote-ref">[1]</sup></p>'
  const parsed1 = parsePostContent(cooked, 'https://forum.example.com')
  const parsed2 = parsePostContent(cooked, 'https://forum.example.com')
  results.parseProducesHtml = typeof parsed1.html === 'string' && parsed1.html.length > 0
  results.parseMemoSameObject = parsed1 === parsed2
  const parsedOtherBase = parsePostContent(cooked, 'https://other.example.com')
  results.parseKeyedByBaseUrl = parsedOtherBase !== parsed1
  for (let i = 0; i < 220; i++) parsePostContent(`<p>filler-${i}</p>`, 'https://forum.example.com')
  results.parseCacheSurvivesEviction =
    parsePostContent(cooked, 'https://forum.example.com').html === parsed1.html

  results.parseEmpty = parsePostContent('', 'https://x').html === ''
  return results
}
