import { marked } from 'marked'
import DOMPurify from 'dompurify'
import katex from 'katex'

import { renderBBCode } from './parser'
import { parseEmojiShortcodeToMarkdown } from './emojiShortcode'

/**
 * Discourse 富文本渲染（对齐官方 discourse-markdown 渲染结构）
 *
 * 渲染管线（参考官方 Discourse 的 markdown-it + 自定义插件）：
 * 1. 保护数学公式（$$ 块级、$ 行内）
 * 2. 预处理全部 Discourse BBCode 扩展（details / wrap / spoiler / poll /
 *    tabs / quote / table / video / audio / tip 等，嵌套与多行由
 *    bbcode/parser.ts 递归解析），渲染为官方 HTML 结构
 * 3. 剩余内容交给 marked（GFM）
 * 4. 处理 markdown 图片尺寸语法 ![alt|WxH](url)
 * 5. 还原 KaTeX 公式并 DOMPurify 清理
 */

marked.setOptions({ breaks: true, gfm: true })

const SANITIZE_TAGS = [
  'math',
  'semantics',
  'mrow',
  'mi',
  'mn',
  'mo',
  'annotation',
  'annotation-xml',
  'svg',
  'path',
  'img',
  'details',
  'summary',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
  'mark',
  'ins',
  'del',
  'video',
  'audio'
]

const SANITIZE_ATTRS = [
  'class',
  'style',
  'src',
  'alt',
  'viewBox',
  'width',
  'height',
  'rel',
  'loading',
  'controls',
  'preload',
  'data-code-wrap',
  'data-post',
  'data-topic'
]

/** 全部 Discourse BBCode 标签（含闭合标签的预处理） */
const DISCOURSE_TAG =
  '(b|i|u|s|ins|del|sub|sup|mark|size|color|url|img|quote|code|list|spoiler|details|wrap|poll|tabs|table|video|audio|youtube|tip|note|warning|footnote|mention|emoji|center|left|right)'

/** 自闭合标签（[img=url] / [video=url] / [emoji=x] / [mention=u] / [hr] 等） */
const SELF_CLOSING_RE = /\[(video|audio|youtube|img|emoji|mention)(?:=([^\]]*?))?\]|\[hr\]/g

/** markdown 图片尺寸 ![alt|WxH](url) */
const IMG_SIZE_RE = /<img ([^>]*?)alt="([^"]*?)\|(\d+)x(\d+)"([^>]*)>/g

/**
 * 渲染 Discourse 富文本（markdown + BBCode 混合）为已清理的 HTML
 */
export function renderDiscourseMarkdown(input: string): string {
  if (!input) return ''

  const withEmoji = parseEmojiShortcodeToMarkdown(input)

  // 1. 保护数学公式（$$ 块级先于 $ 行内；$ 后不跟数字/空格，避免美元误判）
  const mathBlocks: Array<{ tex: string; display: boolean }> = []
  let source = withEmoji.replace(/\$\$([\s\S]+?)\$\$/g, (_, tex) => {
    const id = mathBlocks.length
    mathBlocks.push({ tex, display: true })
    return `@@MATH_BLOCK_${id}@@`
  })
  source = source.replace(/(^|[^\\])\$(?!\d)([^\s$][^$]*?)\$/g, (_match, prefix, tex) => {
    const id = mathBlocks.length
    mathBlocks.push({ tex, display: false })
    return `${prefix}@@MATH_INLINE_${id}@@`
  })

  // 2. 预处理 BBCode（含闭合标签 → 递归解析为官方结构；自闭合标签 → 直接渲染）
  source = source.replace(
    new RegExp(`\\[${DISCOURSE_TAG}(?:=([^\\]]*?))?\\]([\\s\\S]*?)\\[\\/\\1\\]`, 'g'),
    match => renderBBCode(match)
  )
  source = source.replace(SELF_CLOSING_RE, match => renderBBCode(match))

  // 行内脚注 ^[内容]
  source = source.replace(/\^\[([^\]]+)\]/g, (_match, text) => {
    return `<span class="footnote">${text}</span>`
  })

  // 3. GFM markdown
  let html = marked.parse(source) as string

  // 4. 图片尺寸 ![alt|WxH](url) → width/height 属性
  html = html.replace(IMG_SIZE_RE, (_m, pre, alt, w, h, post) => {
    return `<img ${pre}alt="${alt}" width="${w}" height="${h}"${post}>`
  })

  // 5. 还原 KaTeX 公式
  html = html.replace(/@@MATH_(BLOCK|INLINE)_(\d+)@@/g, (_match, kind, index) => {
    const item = mathBlocks[Number(index)]
    if (!item) return ''
    return katex.renderToString(item.tex, {
      displayMode: kind === 'BLOCK',
      throwOnError: false
    })
  })

  return DOMPurify.sanitize(html, {
    ADD_TAGS: SANITIZE_TAGS,
    ADD_ATTR: SANITIZE_ATTRS
  })
}
