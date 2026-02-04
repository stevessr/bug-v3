import { ref } from 'vue'

import type { DiscoursePost, ParsedContent } from '../types'

type PageFetch = typeof import('../utils').pageFetch

type Notify = {
  success: (message: string) => void
  error: (message: string) => void
  loading: (message: string, duration?: number) => () => void
}

export function useTopicArchive(options: {
  baseUrl: string
  topicId: number
  topicTitle?: string | null
  getPosts: () => DiscoursePost[]
  getParsedPost: (postId: number) => ParsedContent
  pageFetch: PageFetch
  notify: Notify
}) {
  const isArchiving = ref(false)

  const extractTextFromHtml = (html: string): string => {
    if (!html) return ''
    const wrapper = document.createElement('div')
    wrapper.innerHTML = html
    const text = wrapper.innerText || wrapper.textContent || ''
    return text.replace(/\n{3,}/g, '\n\n').trim()
  }

  const loadImageFromUrl = async (url: string): Promise<HTMLImageElement | null> => {
    try {
      const result = await options.pageFetch<Blob>(
        url,
        { headers: { 'X-Requested-With': 'XMLHttpRequest' } },
        'blob'
      )
      if (!result.ok || !result.data) return null
      const objectUrl = URL.createObjectURL(result.data)
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image()
        image.onload = () => resolve(image)
        image.onerror = () => reject(new Error('图片加载失败'))
        image.src = objectUrl
      })
      URL.revokeObjectURL(objectUrl)
      return img
    } catch {
      return null
    }
  }

  const archiveTopicAsWebp = async () => {
    if (isArchiving.value) return
    const posts = options.getPosts()
    if (!posts.length) {
      options.notify.error('暂无帖子可导出')
      return
    }

    const hide = options.notify.loading('正在生成主题存档...', 0)
    isArchiving.value = true

    try {
      const canvasWidth = 1200
      const padding = 40
      const contentWidth = canvasWidth - padding * 2
      const blocks: Array<
        | { type: 'text'; lines: string[]; font: string; lineHeight: number; color: string }
        | { type: 'image'; img: HTMLImageElement; width: number; height: number }
      > = []

      const pushTextBlock = (text: string, font: string, lineHeight: number, color: string) => {
        if (!text) return
        const lines: string[] = []
        const ctx = document.createElement('canvas').getContext('2d')
        if (!ctx) return
        ctx.font = font
        const paragraphs = text.split('\n')
        for (const paragraph of paragraphs) {
          const words = paragraph.split(/\s+/)
          let line = ''
          for (const word of words) {
            const testLine = line ? `${line} ${word}` : word
            const { width } = ctx.measureText(testLine)
            if (width > contentWidth && line) {
              lines.push(line)
              line = word
            } else {
              line = testLine
            }
          }
          if (line) lines.push(line)
          lines.push('')
        }
        while (lines.length && lines[lines.length - 1] === '') lines.pop()
        if (lines.length) {
          blocks.push({ type: 'text', lines, font, lineHeight, color })
        }
      }

      const titleText = options.topicTitle || '未命名主题'
      pushTextBlock(titleText, 'bold 28px sans-serif', 36, '#111')

      for (const post of posts) {
        const header = `${post.username} · #${post.post_number} · ${new Date(
          post.created_at
        ).toLocaleString('zh-CN')}`
        pushTextBlock(header, 'bold 16px sans-serif', 24, '#333')

        const parsed = options.getParsedPost(post.id)
        for (const segment of parsed.segments) {
          if (segment.type === 'html') {
            pushTextBlock(extractTextFromHtml(segment.html), '14px sans-serif', 22, '#222')
          } else if (segment.type === 'lightbox') {
            const imageUrl =
              segment.image.downloadHref || segment.image.href || segment.image.thumbSrc || ''
            if (!imageUrl) continue
            const img = await loadImageFromUrl(imageUrl)
            if (!img) continue
            const scale = Math.min(1, contentWidth / img.width)
            blocks.push({
              type: 'image',
              img,
              width: img.width * scale,
              height: img.height * scale
            })
          } else if (segment.type === 'carousel') {
            for (const image of segment.images) {
              const imageUrl = image.downloadHref || image.href || image.thumbSrc || ''
              if (!imageUrl) continue
              const img = await loadImageFromUrl(imageUrl)
              if (!img) continue
              const scale = Math.min(1, contentWidth / img.width)
              blocks.push({
                type: 'image',
                img,
                width: img.width * scale,
                height: img.height * scale
              })
            }
          } else if (segment.type === 'image-grid') {
            for (const column of segment.columns) {
              for (const image of column) {
                const imageUrl = image.downloadHref || image.href || image.thumbSrc || ''
                if (!imageUrl) continue
                const img = await loadImageFromUrl(imageUrl)
                if (!img) continue
                const scale = Math.min(1, contentWidth / img.width)
                blocks.push({
                  type: 'image',
                  img,
                  width: img.width * scale,
                  height: img.height * scale
                })
              }
            }
          }
        }
      }

      const spacing = 16
      let totalHeight = padding
      for (const block of blocks) {
        if (block.type === 'text') {
          totalHeight += block.lines.length * block.lineHeight + spacing
        } else {
          totalHeight += block.height + spacing
        }
      }
      totalHeight += padding

      const MAX_HEIGHT = 60000
      if (totalHeight > MAX_HEIGHT) {
        throw new Error('主题过长，导出失败（超出高度限制）')
      }

      const canvas = document.createElement('canvas')
      canvas.width = canvasWidth
      canvas.height = Math.max(1, Math.round(totalHeight))
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        throw new Error('无法创建画布')
      }

      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      let cursorY = padding
      for (const block of blocks) {
        if (block.type === 'text') {
          ctx.font = block.font
          ctx.fillStyle = block.color
          for (const line of block.lines) {
            if (line) {
              ctx.fillText(line, padding, cursorY)
            }
            cursorY += block.lineHeight
          }
          cursorY += spacing
        } else {
          ctx.drawImage(block.img, padding, cursorY, block.width, block.height)
          cursorY += block.height + spacing
        }
      }

      const blob = await new Promise<Blob | null>(resolve =>
        canvas.toBlob(resolve, 'image/webp', 0.92)
      )
      if (!blob) {
        throw new Error('生成图片失败')
      }

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `topic-${options.topicId}.webp`
      a.click()
      URL.revokeObjectURL(url)
      options.notify.success('主题存档已下载')
    } catch (error: any) {
      console.warn('[DiscourseBrowser] archive failed:', error)
      options.notify.error(error?.message || '生成存档失败')
    } finally {
      isArchiving.value = false
      hide()
    }
  }

  return {
    isArchiving,
    archiveTopicAsWebp
  }
}
