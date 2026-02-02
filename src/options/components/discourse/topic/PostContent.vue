<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { message } from 'ant-design-vue'

import type { ParsedContent, LightboxImage, DiscoursePoll } from '../types'
import { parsePostContent } from '../parser/parsePostContent'
import { pageFetch, extractData } from '../utils'

type ImageGridSegment = Extract<ParsedContent['segments'][number], { type: 'image-grid' }>

const props = defineProps<{
  segments: ParsedContent['segments']
  baseUrl: string
  postId: number
  footnotes?: Record<string, string>
  polls?: DiscoursePoll[]
}>()

const emit = defineEmits<{
  (e: 'navigate', url: string): void
}>()

const getCarouselImg = (images: LightboxImage[], index: number) => {
  const image = images[index]
  return image?.thumbSrc || image?.href || ''
}

const getLightboxThumb = (image: LightboxImage) => {
  return image.thumbSrc || image.href
}

const getLightboxPreview = (image: LightboxImage) => {
  if (image.href && image.href !== getLightboxThumb(image)) {
    return { src: image.href }
  }
  return true
}

const processHtmlContent = (html: string) => html

const normalizeLoading = (value?: string): 'lazy' | 'eager' => {
  return value === 'eager' ? 'eager' : 'lazy'
}

let activeFootnoteRoot: HTMLElement | null = null
let activeFootnoteContainer: HTMLDivElement | null = null
let scrollContainer: HTMLElement | null = null
let pollCleanupFns: Array<() => void> = []

const getImageGridItems = (segment: ImageGridSegment) => {
  if (segment.columns.length <= 1) return segment.columns[0] || []
  return segment.columns.flat()
}

const getImageGridColumnsCount = (segment: ImageGridSegment) => {
  if (segment.columnsCount) return Math.max(segment.columnsCount, 1)
  if (segment.columns.length > 1) return segment.columns.length
  return 2
}

const isSameSiteUrl = (url: string): boolean => {
  if (!url) return false
  try {
    const urlObj = new URL(url, props.baseUrl)
    const baseUrlObj = new URL(props.baseUrl)
    return urlObj.origin === baseUrlObj.origin
  } catch {
    return false
  }
}

const handleClick = (event: MouseEvent) => {
  const target = event.target as HTMLElement

  // Handle spoiler click
  const spoiler = target?.closest('.spoiled') as HTMLElement | null
  if (spoiler) {
    const isBlurred =
      spoiler.classList.contains('spoiler-blurred') ||
      spoiler.getAttribute('data-spoiler-state') === 'blurred'
    if (isBlurred) {
      spoiler.classList.remove('spoiler-blurred')
      spoiler.setAttribute('data-spoiler-state', 'revealed')
      spoiler.setAttribute('aria-expanded', 'true')
      spoiler.querySelectorAll('[aria-hidden="true"]').forEach(el => {
        el.setAttribute('aria-hidden', 'false')
      })
    } else {
      spoiler.classList.add('spoiler-blurred')
      spoiler.setAttribute('data-spoiler-state', 'blurred')
      spoiler.setAttribute('aria-expanded', 'false')
      spoiler.querySelectorAll('[aria-hidden="false"]').forEach(el => {
        el.setAttribute('aria-hidden', 'true')
      })
    }
    event.preventDefault()
    event.stopPropagation()
    return
  }

  const anchor = target?.closest('a') as HTMLAnchorElement | null

  if (!anchor) return
  if (anchor.closest('sup.footnote-ref')) {
    event.preventDefault()
    return
  }

  const href = anchor.getAttribute('href')
  if (!href) return

  // Check if it's a same-site URL
  if (href.startsWith('/')) {
    // Internal path
    event.preventDefault()
    emit('navigate', href)
  } else if (href.startsWith('http') && isSameSiteUrl(href)) {
    // Same-site full URL, convert to internal path
    event.preventDefault()
    try {
      const urlObj = new URL(href)
      const internalPath = urlObj.pathname + urlObj.search + urlObj.hash
      emit('navigate', internalPath)
    } catch {
      // Invalid URL, let it open
      return
    }
  }
  // External links will open normally or in new tab
}

const updateFootnotePosition = () => {
  if (!activeFootnoteRoot || !activeFootnoteContainer || !contentRef.value) return
  const host = contentRef.value
  const rect = activeFootnoteRoot.getBoundingClientRect()
  const hostRect = host.getBoundingClientRect()
  const maxWidth = Math.min(520, Math.max(240, hostRect.width - 24))
  const left = Math.min(rect.left - hostRect.left, hostRect.width - maxWidth - 12)
  const top = rect.bottom - hostRect.top + 6
  activeFootnoteContainer.style.maxWidth = `${maxWidth}px`
  activeFootnoteContainer.style.left = `${Math.max(12, left)}px`
  activeFootnoteContainer.style.top = `${Math.max(8, top)}px`
}

const hideActiveFootnote = () => {
  if (activeFootnoteContainer) {
    activeFootnoteContainer.remove()
  }
  if (activeFootnoteRoot) {
    const trigger = activeFootnoteRoot.querySelector('sup.footnote-ref a')
    trigger?.setAttribute('aria-expanded', 'false')
  }
  activeFootnoteContainer = null
  activeFootnoteRoot = null
}

const voteEndpoint = () => `${props.baseUrl.replace(/\/+$/, '')}/polls/vote`

const requestPollVote = async (method: 'PUT' | 'DELETE', body: URLSearchParams) => {
  const response = await pageFetch<any>(
    voteEndpoint(),
    {
      method,
      headers: {
        accept: '*/*',
        'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest',
        'Discourse-Logged-In': 'true'
      },
      body: body.toString()
    },
    'json'
  )
  const data = extractData(response)
  if (!response.ok || !data?.poll) {
    throw new Error(data?.errors?.[0] || data?.error || '投票失败')
  }
  return data
}

const inferMaxSelections = (pollEl: HTMLElement) => {
  const maxStrong = pollEl.querySelector('.multiple-help-text strong')?.textContent || ''
  const direct = maxStrong.match(/\d+/)?.[0]
  if (direct) return Number(direct)

  const helpText = pollEl.querySelector('.multiple-help-text')?.textContent || ''
  const fallback = helpText.match(/(\d+)/)?.[1]
  if (fallback) return Number(fallback)

  return null
}

const updatePollVoters = (pollEl: HTMLElement, voters?: number) => {
  if (typeof voters !== 'number') return
  const infoNumber = pollEl.querySelector('.poll-info .info-number')
  if (infoNumber) {
    infoNumber.textContent = String(voters)
  }
}

const ensurePollButtons = (pollEl: HTMLElement) => {
  const container = pollEl.querySelector<HTMLElement>('.poll-container') || pollEl
  let buttonsWrap = pollEl.querySelector<HTMLElement>('.poll-buttons')
  if (!buttonsWrap) {
    buttonsWrap = document.createElement('div')
    buttonsWrap.className = 'poll-buttons'
    const info = pollEl.querySelector('.poll-info')
    if (info) {
      pollEl.insertBefore(buttonsWrap, info)
    } else {
      container.appendChild(buttonsWrap)
    }
  }

  let castButton = buttonsWrap.querySelector<HTMLButtonElement>('.cast-votes')
  if (!castButton) {
    castButton = document.createElement('button')
    castButton.type = 'button'
    castButton.className = 'btn btn-primary cast-votes'
    castButton.textContent = '提交投票'
    buttonsWrap.appendChild(castButton)
  }

  let clearButton = buttonsWrap.querySelector<HTMLButtonElement>('.revoke-votes')
  if (!clearButton) {
    clearButton = document.createElement('button')
    clearButton.type = 'button'
    clearButton.className = 'btn btn-default revoke-votes'
    clearButton.title = '撤销投票'
    clearButton.textContent = '撤销'
    buttonsWrap.insertBefore(clearButton, castButton)
  }

  let resultsButton = buttonsWrap.querySelector<HTMLButtonElement>('.toggle-results')
  if (!resultsButton) {
    const existing = pollEl.querySelector<HTMLButtonElement>('.toggle-results')
    if (existing) {
      resultsButton = existing
      buttonsWrap.appendChild(resultsButton)
    }
  }
  if (!resultsButton) {
    resultsButton = document.createElement('button')
    resultsButton.type = 'button'
    resultsButton.className = 'btn btn-default toggle-results'
    resultsButton.textContent = '结果'
    buttonsWrap.appendChild(resultsButton)
  }

  return { buttonsWrap, castButton, clearButton, resultsButton }
}

const setupMultiplePoll = (
  pollEl: HTMLElement,
  pollName: string,
  pollType: string,
  pollData?: DiscoursePoll
) => {
  const optionItems = Array.from(pollEl.querySelectorAll<HTMLLIElement>('li[data-poll-option-id]'))
  if (optionItems.length === 0) return

  const ensureOptionButton = (item: HTMLLIElement) => {
    const existing = item.querySelector('button')
    if (existing) return existing

    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'poll-option-btn'

    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    icon.setAttribute('class', 'poll-option-icon')
    icon.setAttribute('viewBox', '0 0 448 512')
    icon.setAttribute('width', '1em')
    icon.setAttribute('height', '1em')
    icon.setAttribute('aria-hidden', 'true')
    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use')
    use.setAttribute('href', '#far-square')
    icon.appendChild(use)

    const optionText = document.createElement('span')
    optionText.className = 'option-text'
    optionText.textContent = (item.textContent || '').trim()

    button.appendChild(icon)
    button.appendChild(optionText)
    item.textContent = ''
    item.appendChild(button)
    return button
  }

  const selected = new Set<string>()
  let max = pollType === 'multiple' ? inferMaxSelections(pollEl) : 1

  const isSingle = pollType !== 'multiple'
  const { castButton, clearButton, resultsButton } = ensurePollButtons(pollEl)
  if (resultsButton) {
    resultsButton.disabled = !pollData
  }

  const setOptionChecked = (item: HTMLLIElement, checked: boolean) => {
    const button = item.querySelector('button')
    if (!button) return
    item.classList.toggle('poll-option-selected', checked)
    button.setAttribute('aria-pressed', checked ? 'true' : 'false')
    const use = button.querySelector('use')
    if (use) {
      use.setAttribute('href', checked ? '#far-square-check' : '#far-square')
    }
  }

  const syncCastButtonState = () => {
    if (!castButton) return
    castButton.disabled = selected.size === 0 || (!!max && selected.size > max)
    if (clearButton) {
      clearButton.disabled = selected.size === 0
    }
  }

  const upsertVotesLabel = (item: HTMLLIElement, votes?: number) => {
    if (typeof votes !== 'number') return
    const textContainer =
      item.querySelector<HTMLElement>('.option-text') || item.querySelector<HTMLElement>('button')
    if (!textContainer) return
    let counter = item.querySelector<HTMLElement>('.poll-option-votes')
    if (!counter) {
      counter = document.createElement('span')
      counter.className = 'poll-option-votes'
      textContainer.insertAdjacentElement('afterend', counter)
    }
    counter.textContent = `(${votes})`
  }

  const applyResult = (poll: DiscoursePoll | undefined) => {
    if (!poll) return
    if (typeof poll.max === 'number') {
      max = poll.max
    }

    if (Array.isArray(poll.options)) {
      selected.clear()
      const byId = new Map(optionItems.map(item => [item.dataset.pollOptionId || '', item]))
      poll.options.forEach((option: any) => {
        const item = byId.get(option?.id || '')
        if (!item) return
        const chosen = Boolean(option?.chosen)
        if (chosen) selected.add(option.id)
        setOptionChecked(item, chosen)
        upsertVotesLabel(item, typeof option?.votes === 'number' ? option.votes : undefined)
      })
    }

    updatePollVoters(pollEl, poll.voters)
    syncCastButtonState()
  }

  const onOptionClick = (event: Event) => {
    event.preventDefault()
    event.stopPropagation()

    const item = (event.currentTarget as HTMLElement).closest(
      'li[data-poll-option-id]'
    ) as HTMLLIElement | null
    if (!item) return
    const optionId = item.dataset.pollOptionId
    if (!optionId) return

    if (selected.has(optionId)) {
      selected.delete(optionId)
      setOptionChecked(item, false)
      syncCastButtonState()
      return
    }

    if (isSingle) {
      selected.forEach(id => {
        const match = optionItems.find(node => node.dataset.pollOptionId === id)
        if (match) setOptionChecked(match, false)
      })
      selected.clear()
    } else if (max && selected.size >= max) {
      message.warning(`最多选择 ${max} 个选项`)
      return
    }

    selected.add(optionId)
    setOptionChecked(item, true)
    syncCastButtonState()
  }

  const onCastClick = async (event: Event) => {
    event.preventDefault()
    if (!castButton || castButton.disabled) return

    castButton.disabled = true
    try {
      const body = new URLSearchParams()
      body.append('post_id', String(props.postId))
      body.append('poll_name', pollName)
      selected.forEach(optionId => {
        body.append('options[]', optionId)
      })

      const data = await requestPollVote('PUT', body)
      applyResult(data.poll)
      message.success('投票成功')
    } catch (error) {
      const text = error instanceof Error ? error.message : '投票失败'
      message.error(text)
      syncCastButtonState()
    }
  }

  const onClearClick = async (event: Event) => {
    event.preventDefault()
    if (!clearButton || clearButton.disabled) return
    clearButton.disabled = true
    castButton && (castButton.disabled = true)

    try {
      const body = new URLSearchParams()
      body.append('post_id', String(props.postId))
      body.append('poll_name', pollName)
      const data = await requestPollVote('DELETE', body)
      applyResult(data.poll)
      message.success('已撤销投票')
    } catch (error) {
      const text = error instanceof Error ? error.message : '撤销投票失败'
      message.error(text)
      syncCastButtonState()
    }
  }

  optionItems.forEach(item => {
    const button = ensureOptionButton(item)
    button.addEventListener('click', onOptionClick)
  })
  castButton?.addEventListener('click', onCastClick)
  clearButton?.addEventListener('click', onClearClick)
  const onResultsClick = (event: Event) => {
    event.preventDefault()
    applyResult(pollData)
  }
  resultsButton?.addEventListener('click', onResultsClick)

  optionItems.forEach(item => setOptionChecked(item, false))
  syncCastButtonState()
  if (pollData?.results === 'always') {
    applyResult(pollData)
  }

  pollCleanupFns.push(() => {
    optionItems.forEach(item => {
      const button = item.querySelector('button')
      if (!button) return
      button.removeEventListener('click', onOptionClick)
    })
    castButton?.removeEventListener('click', onCastClick)
    clearButton?.removeEventListener('click', onClearClick)
    resultsButton?.removeEventListener('click', onResultsClick)
  })
}

const setupRankedChoicePoll = (
  pollEl: HTMLElement,
  pollName: string,
  pollData?: DiscoursePoll
) => {
  const optionNodes = Array.from(
    pollEl.querySelectorAll<HTMLElement>(
      '.ranked-choice-poll-option[data-poll-option-id], li[data-poll-option-id]'
    )
  )
  if (optionNodes.length === 0) return

  const ensureRankedOptionButton = (node: HTMLElement) => {
    const existing = node.querySelector<HTMLButtonElement>('button.poll-option-btn')
    if (existing) return existing

    const optionTextNode = node.querySelector<HTMLElement>('.option-text')
    const optionTextValue =
      optionTextNode?.textContent?.trim() || (node.textContent || '').trim()

    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'poll-option-btn'

    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    icon.setAttribute('class', 'poll-option-icon')
    icon.setAttribute('viewBox', '0 0 448 512')
    icon.setAttribute('width', '1em')
    icon.setAttribute('height', '1em')
    icon.setAttribute('aria-hidden', 'true')
    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use')
    use.setAttribute('href', '#sort-amount-down')
    icon.appendChild(use)

    const optionText = document.createElement('span')
    optionText.className = 'option-text'
    optionText.textContent = optionTextValue

    const rankText = document.createElement('span')
    rankText.className = 'poll-rank-label'
    rankText.textContent = '弃权'

    button.appendChild(icon)
    button.appendChild(optionText)
    button.appendChild(rankText)
    node.textContent = ''
    node.appendChild(button)
    return button
  }

  optionNodes.forEach(node => {
    ensureRankedOptionButton(node)
  })

  const ranks = new Map<string, number>()
  optionNodes.forEach(node => {
    const id = node.dataset.pollOptionId
    if (!id) return
    const rank = Number(node.dataset.pollOptionRank || '0')
    ranks.set(id, Number.isFinite(rank) && rank > 0 ? rank : 0)
  })

  const { castButton, clearButton, resultsButton } = ensurePollButtons(pollEl)
  if (resultsButton) {
    resultsButton.disabled = !pollData
  }

  const compactRanks = () => {
    const ordered = Array.from(ranks.entries())
      .filter(([, rank]) => rank > 0)
      .sort((a, b) => a[1] - b[1])
    ordered.forEach(([id], index) => {
      ranks.set(id, index + 1)
    })
  }

  const getMaxRank = () => {
    return Math.max(0, ...Array.from(ranks.values()))
  }

  const updateUi = () => {
    optionNodes.forEach(node => {
      const id = node.dataset.pollOptionId
      if (!id) return
      const rank = ranks.get(id) || 0
      const label = node.querySelector<HTMLElement>('.poll-rank-label')
      if (label) {
        label.textContent = rank > 0 ? `第 ${rank} 选择` : '弃权'
      }
      node.classList.toggle('poll-rank-active', rank > 0)
      node.dataset.pollOptionRank = String(rank)
    })
    if (castButton) {
      castButton.disabled = !Array.from(ranks.values()).some(rank => rank > 0)
    }
    if (clearButton) {
      clearButton.disabled = !Array.from(ranks.values()).some(rank => rank > 0)
    }
  }

  const upsertVotesLabel = (node: HTMLElement, votes?: number) => {
    if (typeof votes !== 'number') return
    const textContainer = node.querySelector<HTMLElement>('.option-text') || node
    let counter = node.querySelector<HTMLElement>('.poll-option-votes')
    if (!counter) {
      counter = document.createElement('span')
      counter.className = 'poll-option-votes'
      textContainer.insertAdjacentElement('afterend', counter)
    }
    counter.textContent = `(${votes})`
  }

  const applyResult = (poll: any) => {
    if (!poll || !Array.isArray(poll.options)) return
    poll.options.forEach((option: any) => {
      const hasRank = Array.isArray(option?.rank) && option.rank.length > 0
      const rank = hasRank ? Number(option.rank[0]) : 0
      if (option?.id && ranks.has(option.id) && hasRank) {
        ranks.set(option.id, Number.isFinite(rank) && rank > 0 ? rank : 0)
      }
      const node = optionNodes.find(item => item.dataset.pollOptionId === option?.id)
      if (node) {
        upsertVotesLabel(node, typeof option?.votes === 'number' ? option.votes : undefined)
      }
    })
    compactRanks()
    updateUi()
    updatePollVoters(pollEl, poll.voters)
  }

  const toggleRank = (optionId: string) => {
    const current = ranks.get(optionId) || 0
    if (current > 0) {
      ranks.set(optionId, 0)
      compactRanks()
    } else {
      ranks.set(optionId, getMaxRank() + 1)
    }
    updateUi()
  }

  const onOptionClick = (event: Event) => {
    event.preventDefault()
    event.stopPropagation()
    const target = (event.currentTarget as HTMLElement).closest(
      '.ranked-choice-poll-option'
    ) as HTMLElement | null
    const optionId = target?.dataset.pollOptionId
    if (!optionId) return
    toggleRank(optionId)
  }

  const onCastClick = async (event: Event) => {
    event.preventDefault()
    if (!castButton || castButton.disabled) return
    castButton.disabled = true

    try {
      const body = new URLSearchParams()
      body.append('post_id', String(props.postId))
      body.append('poll_name', pollName)
      if (!Array.from(ranks.values()).some(rank => rank > 0)) {
        message.warning('请先选择排序选项')
        updateUi()
        return
      }
      optionNodes.forEach((node, index) => {
        const optionId = node.dataset.pollOptionId
        if (!optionId) return
        const rank = ranks.get(optionId) || 0
        body.append(`options[${index}][digest]`, optionId)
        body.append(`options[${index}][rank]`, String(rank))
      })

      const data = await requestPollVote('PUT', body)
      applyResult(data.poll)
      message.success('投票成功')
    } catch (error) {
      const text = error instanceof Error ? error.message : '投票失败'
      message.error(text)
      updateUi()
    }
  }

  const onClearClick = async (event: Event) => {
    event.preventDefault()
    if (!clearButton || clearButton.disabled) return
    clearButton.disabled = true
    castButton && (castButton.disabled = true)
    try {
      const body = new URLSearchParams()
      body.append('post_id', String(props.postId))
      body.append('poll_name', pollName)
      const data = await requestPollVote('DELETE', body)
      applyResult(data.poll)
      message.success('已撤销投票')
    } catch (error) {
      const text = error instanceof Error ? error.message : '撤销投票失败'
      message.error(text)
      updateUi()
    }
  }

  optionNodes.forEach(node => {
    node.addEventListener('click', onOptionClick)
    const button = node.querySelector('button')
    button?.addEventListener('click', onOptionClick)
  })
  castButton?.addEventListener('click', onCastClick)
  clearButton?.addEventListener('click', onClearClick)
  const onResultsClick = (event: Event) => {
    event.preventDefault()
    applyResult(pollData)
  }
  resultsButton?.addEventListener('click', onResultsClick)
  updateUi()
  if (pollData?.results === 'always') {
    applyResult(pollData)
  }

  pollCleanupFns.push(() => {
    optionNodes.forEach(node => {
      node.removeEventListener('click', onOptionClick)
      const button = node.querySelector('button')
      button?.removeEventListener('click', onOptionClick)
    })
    castButton?.removeEventListener('click', onCastClick)
    clearButton?.removeEventListener('click', onClearClick)
    resultsButton?.removeEventListener('click', onResultsClick)
  })
}

const teardownPollEnhancements = () => {
  pollCleanupFns.forEach(fn => fn())
  pollCleanupFns = []
}

const setupPollEnhancements = () => {
  teardownPollEnhancements()
  const host = contentRef.value
  if (!host) return

  const pollRoots = Array.from(
    host.querySelectorAll<HTMLElement>('.poll-outer[data-poll-name], .poll[data-poll-name]')
  )
  const polls = pollRoots
    .map(root =>
      root.classList.contains('poll-outer')
        ? root.querySelector<HTMLElement>('.poll[data-poll-name]') || root
        : root
    )
    .filter((value, index, arr) => arr.indexOf(value) === index)

  polls.forEach(pollEl => {
    const pollName =
      pollEl.dataset.pollName || pollEl.closest<HTMLElement>('.poll-outer')?.dataset.pollName || ''
    const pollType =
      pollEl.dataset.pollType ||
      pollEl.closest<HTMLElement>('.poll-outer')?.dataset.pollType ||
      'regular'
    if (!pollName) return
    const pollData = props.polls?.find(item => item.name === pollName)

    if (pollType === 'ranked_choice') {
      setupRankedChoicePoll(pollEl, pollName, pollData)
      return
    }
    setupMultiplePoll(pollEl, pollName, pollType, pollData)
  })
}

const showFootnoteFor = (footnoteRoot: HTMLElement, trigger: HTMLAnchorElement) => {
  if (activeFootnoteRoot === footnoteRoot) return
  hideActiveFootnote()

  const href = trigger.getAttribute('href') || ''
  const id = href.startsWith('#') ? href.slice(1) : href
  const rawContent = id ? props.footnotes?.[id] : undefined
  if (!rawContent) return

  const container = document.createElement('div')
  container.className = 'post-footnote-inline'
  const parsed = parsePostContent(rawContent, props.baseUrl)
  container.innerHTML = parsed.html
  container.addEventListener('mouseenter', () => {
    // keep visible while hovering the tooltip itself
  })
  container.addEventListener('mouseleave', () => {
    hideActiveFootnote()
  })

  const host = contentRef.value
  if (!host) return

  host.appendChild(container)
  trigger.setAttribute('aria-expanded', 'true')
  activeFootnoteRoot = footnoteRoot
  activeFootnoteContainer = container
  updateFootnotePosition()
}

const handleMouseOver = (event: MouseEvent) => {
  const target = event.target as HTMLElement
  const footnoteRoot = target?.closest('sup.footnote-ref') as HTMLElement | null
  if (!footnoteRoot) return
  const trigger = footnoteRoot.querySelector('a') as HTMLAnchorElement | null
  if (!trigger) return
  showFootnoteFor(footnoteRoot, trigger)
}

const handleMouseOut = (event: MouseEvent) => {
  const target = event.target as HTMLElement
  const footnoteRoot = target?.closest('sup.footnote-ref') as HTMLElement | null
  if (!footnoteRoot) return
  if (
    event.relatedTarget instanceof Node &&
    (footnoteRoot.contains(event.relatedTarget) ||
      activeFootnoteContainer?.contains(event.relatedTarget))
  ) {
    return
  }
  hideActiveFootnote()
}

const mounted = ref(false)
const contentRef = ref<HTMLElement | null>(null)

onMounted(() => {
  mounted.value = true
  // Add click event listener to the content div
  nextTick(() => {
    const contentDiv = contentRef.value
    if (contentDiv) {
      contentDiv.addEventListener('click', handleClick)
      contentDiv.addEventListener('mouseover', handleMouseOver)
      contentDiv.addEventListener('mouseout', handleMouseOut)
      scrollContainer = contentDiv.closest('.content-area') as HTMLElement | null
      scrollContainer?.addEventListener('scroll', updateFootnotePosition, { passive: true })
      setupPollEnhancements()
    }
  })
  window.addEventListener('resize', updateFootnotePosition, { passive: true })
})

onUnmounted(() => {
  const contentDiv = contentRef.value
  if (contentDiv) {
    contentDiv.removeEventListener('click', handleClick)
    contentDiv.removeEventListener('mouseover', handleMouseOver)
    contentDiv.removeEventListener('mouseout', handleMouseOut)
    scrollContainer?.removeEventListener('scroll', updateFootnotePosition)
  }
  scrollContainer = null
  window.removeEventListener('resize', updateFootnotePosition)
  hideActiveFootnote()
  teardownPollEnhancements()
})

watch(
  () => props.segments,
  async () => {
    await nextTick()
    setupPollEnhancements()
  }
)
</script>

<template>
  <div ref="contentRef" class="post-content prose dark:prose-invert max-w-none text-sm">
    <template v-for="(segment, idx) in props.segments" :key="idx">
      <div
        v-if="segment.type === 'html'"
        class="post-content-fragment"
        v-html="processHtmlContent(segment.html)"
      />
      <div v-else-if="segment.type === 'carousel'" class="post-carousel">
        <div class="post-carousel-track">
          <div
            v-for="(img, imgIndex) in segment.images"
            :key="imgIndex"
            class="post-carousel-slide"
          >
            <img
              class="post-carousel-image"
              :src="getLightboxThumb(img)"
              :alt="img.alt || ''"
              :width="img.width"
              :height="img.height"
              :srcset="img.srcset"
              :data-base62-sha1="img.base62Sha1"
              :data-dominant-color="img.dominantColor"
              :loading="normalizeLoading(img.loading)"
              :style="img.style"
            />
          </div>
        </div>
        <div class="post-carousel-thumbs">
          <img
            v-for="(img, imgIndex) in segment.images"
            :key="`thumb-${imgIndex}`"
            class="post-carousel-thumb"
            :src="getCarouselImg(segment.images, imgIndex)"
            :alt="img.alt || ''"
            loading="lazy"
          />
        </div>
      </div>
      <div
        v-else-if="segment.type === 'image-grid'"
        class="post-image-grid"
        :style="{ '--grid-columns': getImageGridColumnsCount(segment) }"
      >
        <div
          v-for="(img, imgIndex) in getImageGridItems(segment)"
          :key="imgIndex"
          class="post-image-grid-item"
        >
          <img
            class="post-image-grid-image"
            :src="getLightboxThumb(img)"
            :alt="img.alt || ''"
            :width="img.width"
            :height="img.height"
            :srcset="img.srcset"
            :data-base62-sha1="img.base62Sha1"
            :data-dominant-color="img.dominantColor"
            :loading="normalizeLoading(img.loading)"
            :style="img.style"
          />
        </div>
      </div>
      <a-image
        v-else
        class="post-inline-image rounded"
        wrapper-class-name="post-inline-image-wrapper"
        :src="getLightboxThumb(segment.image)"
        :preview="getLightboxPreview(segment.image)"
        :alt="segment.image.alt || ''"
        :width="segment.image.width"
        :height="segment.image.height"
        :srcset="segment.image.srcset"
        :style="segment.image.style"
      />
    </template>
  </div>
</template>

<style scoped src="../css/PostContent.css"></style>
