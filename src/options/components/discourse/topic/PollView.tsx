import { defineComponent, computed, ref, watch } from 'vue'
import { Button, Checkbox, Radio, Select, Progress, message } from 'ant-design-vue'

import type { DiscoursePoll, DiscoursePollVoter } from '../types'
import { sanitizeDiscourseHtml } from '../sanitizeHtml'
import { extractData, getAvatarUrl, pageFetch } from '../utils'
import '../css/PollView.css'

type PollOption = {
  id: string
  label: string
}

type PollMeta = {
  min?: number
  max?: number
  results?: string
  voters?: number
}

type PollVoter = {
  id?: number
  username: string
  name?: string
  avatarTemplate?: string
  rank?: number | string
}

type VoterSource = {
  found: boolean
  voters: PollVoter[]
}

const VOTERS_PAGE_SIZE = 25

const normalizePollVoter = (value: unknown): PollVoter | null => {
  if (!value || typeof value !== 'object') return null
  const entry = value as DiscoursePollVoter
  const user = entry.user && typeof entry.user === 'object' ? entry.user : entry
  const username = typeof user.username === 'string' ? user.username.trim() : ''
  if (!username) return null

  return {
    id: typeof user.id === 'number' ? user.id : undefined,
    username,
    name: typeof user.name === 'string' ? user.name : undefined,
    avatarTemplate: typeof user.avatar_template === 'string' ? user.avatar_template : undefined,
    rank: typeof entry.rank === 'number' || typeof entry.rank === 'string' ? entry.rank : undefined
  }
}

const uniqueVoters = (values: PollVoter[]) => {
  const seen = new Set<string>()
  return values.filter(voter => {
    const key = voter.username.toLocaleLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

const normalizeVoterList = (value: unknown): PollVoter[] => {
  const list = Array.isArray(value)
    ? value
    : value && typeof value === 'object' && Array.isArray((value as { voters?: unknown }).voters)
      ? (value as { voters: unknown[] }).voters
      : value && typeof value === 'object' && Array.isArray((value as { users?: unknown }).users)
        ? (value as { users: unknown[] }).users
        : []
  return uniqueVoters(
    list.map(normalizePollVoter).filter((voter): voter is PollVoter => Boolean(voter))
  )
}

/** Supports both public-poll preload data and the voters endpoint response shape. */
const readVotersForOption = (value: unknown, optionId: string): VoterSource => {
  if (Array.isArray(value)) return { found: true, voters: normalizeVoterList(value) }
  if (!value || typeof value !== 'object') return { found: false, voters: [] }

  const record = value as Record<string, unknown>
  if (Object.prototype.hasOwnProperty.call(record, optionId)) {
    return { found: true, voters: normalizeVoterList(record[optionId]) }
  }
  if (Array.isArray(record.voters) || Array.isArray(record.users)) {
    return { found: true, voters: normalizeVoterList(record) }
  }

  const nestedVoters = record.voters
  if (nestedVoters && typeof nestedVoters === 'object' && !Array.isArray(nestedVoters)) {
    const nested = nestedVoters as Record<string, unknown>
    if (Object.prototype.hasOwnProperty.call(nested, optionId)) {
      return { found: true, voters: normalizeVoterList(nested[optionId]) }
    }
  }
  return { found: false, voters: [] }
}

export default defineComponent({
  name: 'PollView',
  props: {
    pollName: { type: String, required: true },
    pollType: { type: String, required: true },
    pollTitleHtml: { type: String, required: true },
    options: { type: Array as () => PollOption[], required: true },
    pollData: { type: Object as () => DiscoursePoll | undefined, default: undefined },
    baseUrl: { type: String, required: true },
    postId: { type: Number, required: true },
    requestPollVote: {
      type: Function as unknown as () => (
        method: 'PUT' | 'DELETE',
        body: URLSearchParams
      ) => Promise<any>,
      required: true
    },
    pollMeta: { type: Object as () => PollMeta, required: true }
  },
  setup(props) {
    const viewMode = ref<'vote' | 'results'>(
      props.pollMeta.results === 'always' ? 'results' : 'vote'
    )
    const selected = ref<string[]>([])
    const ranks = ref<Record<string, number>>({})
    const hasVoted = ref(false)
    const isSubmitting = ref(false)
    const pollState = ref<DiscoursePoll | null>(props.pollData || null)
    const voters = ref<number | undefined>(props.pollMeta.voters)
    const votersByOption = ref<Record<string, PollVoter[]>>({})
    const voterLoading = ref<Record<string, boolean>>({})
    const voterUnavailable = ref<Record<string, boolean>>({})
    const voterExhausted = ref<Record<string, boolean>>({})
    let pollIdentity = ''

    const isRanked = computed(() => props.pollType === 'ranked_choice')
    const isMultiple = computed(() => props.pollType === 'multiple')
    // Modern Discourse includes `public` on each poll. Older/custom hosts can
    // omit it while still authorizing the endpoint, so only an explicit false
    // suppresses the opt-in lookup; the server remains authoritative.
    const canRequestVoters = computed(() => pollState.value?.public !== false)

    const maxRankOptions = computed(() => Math.max(1, props.options.length))

    const rankOptions = computed(() => {
      const list = [{ label: '弃权', value: 0 }]
      for (let i = 1; i <= maxRankOptions.value; i += 1) {
        if (i === 1) {
          list.push({ label: `${i}（最高优先级）`, value: i })
        } else if (i === maxRankOptions.value) {
          list.push({ label: `${i}（最低优先级）`, value: i })
        } else {
          list.push({ label: String(i), value: i })
        }
      }
      return list
    })

    const mergeVotersForOption = (optionId: string, incoming: PollVoter[]) => {
      const merged = uniqueVoters([...(votersByOption.value[optionId] || []), ...incoming])
      const next = { ...votersByOption.value, [optionId]: merged }

      // A regular poll permits one choice. When a server response reflects a
      // changed vote, do not leave that voter rendered under an old option.
      if (!isRanked.value && !isMultiple.value) {
        const usernames = new Set(merged.map(voter => voter.username.toLocaleLowerCase()))
        Object.keys(next).forEach(otherOptionId => {
          if (otherOptionId === optionId) return
          next[otherOptionId] = next[otherOptionId].filter(
            voter => !usernames.has(voter.username.toLocaleLowerCase())
          )
        })
      }

      votersByOption.value = next
      return merged
    }

    const hydratePreloadedVoters = (poll: DiscoursePoll, reset = false) => {
      if (reset) votersByOption.value = {}
      const preloaded = poll.preloaded_voters
      if (!preloaded) return

      props.options.forEach(option => {
        const source = readVotersForOption(preloaded, option.id)
        if (source.found) mergeVotersForOption(option.id, source.voters)
      })
    }

    const applyPollResult = (poll: DiscoursePoll | null, forceVoterReset = false) => {
      const nextIdentity = `${props.postId}:${props.pollName}:${poll?.id ?? ''}`
      const resetVoters = forceVoterReset || nextIdentity !== pollIdentity
      if (resetVoters) {
        pollIdentity = nextIdentity
        votersByOption.value = {}
        voterLoading.value = {}
        voterUnavailable.value = {}
        voterExhausted.value = {}
      }
      if (!poll) {
        pollState.value = null
        return
      }

      pollState.value = poll
      if (typeof poll.voters === 'number') voters.value = poll.voters
      hydratePreloadedVoters(poll, resetVoters)

      if (isRanked.value) {
        const nextRanks: Record<string, number> = {}
        let voted = false
        poll.options?.forEach(option => {
          const rankArr = Array.isArray(option.rank) ? option.rank : []
          const rank = rankArr.length > 0 ? Number(rankArr[0]) : 0
          if (rank > 0) voted = true
          nextRanks[option.id] = Number.isFinite(rank) ? rank : 0
        })
        ranks.value = nextRanks
        hasVoted.value = voted
      } else {
        const nextSelected: string[] = []
        let voted = false
        poll.options?.forEach(option => {
          if (option.chosen) {
            nextSelected.push(option.id)
            voted = true
          }
        })
        selected.value = nextSelected
        hasVoted.value = voted
      }
    }

    watch(
      () => [props.postId, props.pollName] as const,
      () => applyPollResult(props.pollData || null, true),
      { immediate: true }
    )
    watch(
      () => props.pollData,
      next => applyPollResult(next || null),
      { immediate: true }
    )

    const canSubmit = computed(() => {
      if (isRanked.value) {
        return Object.values(ranks.value).some(rank => rank > 0)
      }
      if (isMultiple.value) {
        return selected.value.length > 0
      }
      return selected.value.length > 0
    })

    const totalVotes = computed(() => {
      return pollState.value?.options?.reduce((acc, option) => acc + (option.votes || 0), 0) || 0
    })

    const maxVotes = computed(() => {
      return Math.max(1, ...(pollState.value?.options?.map(option => option.votes || 0) || [1]))
    })

    const toggleResults = () => {
      viewMode.value = viewMode.value === 'results' ? 'vote' : 'results'
    }

    const submitVote = async () => {
      if (!canSubmit.value || isSubmitting.value) return
      isSubmitting.value = true
      try {
        const body = new URLSearchParams()
        body.append('post_id', String(props.postId))
        body.append('poll_name', props.pollName)

        if (isRanked.value) {
          const entries = props.options.map((option, index) => {
            const rank = ranks.value[option.id] || 0
            return { option, index, rank }
          })
          if (!entries.some(item => item.rank > 0)) {
            message.warning('请先选择排序选项')
            return
          }
          entries.forEach(item => {
            body.append(`options[${item.index}][digest]`, item.option.id)
            body.append(`options[${item.index}][rank]`, String(item.rank))
          })
        } else if (isMultiple.value) {
          selected.value.forEach(optionId => body.append('options[]', optionId))
        } else if (selected.value[0]) {
          body.append('options[]', selected.value[0])
        }

        const data = await props.requestPollVote('PUT', body)
        applyPollResult(data.poll, true)
        hasVoted.value = true
        message.success('投票成功')
      } catch (error) {
        const text = error instanceof Error ? error.message : '投票失败'
        message.error(text)
      } finally {
        isSubmitting.value = false
      }
    }

    const revokeVote = async () => {
      if (isSubmitting.value) return
      isSubmitting.value = true
      try {
        const body = new URLSearchParams()
        body.append('post_id', String(props.postId))
        body.append('poll_name', props.pollName)
        const data = await props.requestPollVote('DELETE', body)
        applyPollResult(data.poll, true)
        hasVoted.value = false
        message.success('已撤销投票')
      } catch (error) {
        const text = error instanceof Error ? error.message : '撤销投票失败'
        message.error(text)
      } finally {
        isSubmitting.value = false
      }
    }

    const loadVoters = async (option: PollOption, voteCount: number) => {
      const optionId = option.id
      if (
        !canRequestVoters.value ||
        voterLoading.value[optionId] ||
        voterUnavailable.value[optionId] ||
        voterExhausted.value[optionId]
      ) {
        return
      }

      voterLoading.value = { ...voterLoading.value, [optionId]: true }
      try {
        const existing = votersByOption.value[optionId] || []
        const params = new URLSearchParams({
          post_id: String(props.postId),
          poll_name: props.pollName,
          option_id: optionId,
          page: String(Math.floor(existing.length / VOTERS_PAGE_SIZE) + 1),
          limit: String(VOTERS_PAGE_SIZE)
        })
        const result = await pageFetch<any>(
          `${props.baseUrl}/polls/voters.json?${params.toString()}`
        )
        if (!result.ok) throw new Error('poll voters unavailable')
        const data = extractData(result)
        const source = readVotersForOption(data?.voters, optionId)
        if (!source.found) throw new Error('poll voters unavailable')

        const merged = mergeVotersForOption(optionId, source.voters)
        if (source.voters.length < VOTERS_PAGE_SIZE || merged.length >= voteCount) {
          voterExhausted.value = { ...voterExhausted.value, [optionId]: true }
        }
      } catch {
        // Public voter information is optional and sites can disable this
        // endpoint. Hide the affordance instead of surfacing a misleading
        // error for a permission-gated response.
        voterUnavailable.value = { ...voterUnavailable.value, [optionId]: true }
      } finally {
        voterLoading.value = { ...voterLoading.value, [optionId]: false }
      }
    }

    const renderVoterDetails = (option: PollOption, voteCount: number) => {
      const people = votersByOption.value[option.id] || []
      const publicOrReturned = canRequestVoters.value || people.length > 0
      if (
        !publicOrReturned ||
        (voteCount <= 0 && people.length === 0) ||
        (people.length === 0 &&
          (voterUnavailable.value[option.id] || voterExhausted.value[option.id]))
      ) {
        return null
      }

      const isLoading = voterLoading.value[option.id] === true
      const canLoad =
        canRequestVoters.value &&
        !voterUnavailable.value[option.id] &&
        !voterExhausted.value[option.id] &&
        people.length < voteCount
      const showMore = people.length > 0
      const actionLabel = showMore ? '显示更多投票人' : '显示投票人'

      return (
        <div class="poll-tsx-voters" aria-label={`${option.label} 的投票人`}>
          {people.length > 0 && (
            <div class="poll-tsx-voter-list" role="list">
              {people.map(voter => {
                const profileUrl = `${props.baseUrl.replace(/\/+$/, '')}/u/${encodeURIComponent(
                  voter.username
                )}`
                const avatarUrl = voter.avatarTemplate
                  ? getAvatarUrl(voter.avatarTemplate, props.baseUrl, 40)
                  : ''
                const displayName = voter.name
                  ? `${voter.name} (@${voter.username})`
                  : `@${voter.username}`
                return (
                  <a
                    key={voter.username}
                    class="poll-tsx-voter"
                    href={profileUrl}
                    data-user-card={voter.username}
                    title={displayName}
                    aria-label={`投票人 ${displayName}`}
                    role="listitem"
                  >
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="" />
                    ) : (
                      <span class="poll-tsx-voter-fallback" aria-hidden="true">
                        {voter.username.slice(0, 1).toLocaleUpperCase()}
                      </span>
                    )}
                    {isRanked.value && voter.rank !== undefined && (
                      <span class="poll-tsx-voter-rank" aria-label={`排序 ${voter.rank}`}>
                        {voter.rank === 'Abstain' ? '弃' : voter.rank}
                      </span>
                    )}
                  </a>
                )
              })}
            </div>
          )}
          {canLoad && (
            <Button
              type="text"
              size="small"
              class="poll-tsx-voters-toggle"
              loading={isLoading}
              aria-label={`${actionLabel}：${option.label}`}
              onClick={() => void loadVoters(option, voteCount)}
            >
              {actionLabel}
            </Button>
          )}
        </div>
      )
    }

    const renderVoteList = () => {
      if (isRanked.value) {
        return (
          <div class="poll-tsx-list">
            {props.options.map(option => (
              <div key={option.id} class="poll-tsx-row">
                <Select
                  size="small"
                  class="poll-tsx-rank"
                  options={rankOptions.value}
                  value={ranks.value[option.id] || 0}
                  onUpdate:value={value => {
                    const next = Number(value || 0)
                    const nextRanks = { ...ranks.value }
                    Object.keys(nextRanks).forEach(key => {
                      if (key !== option.id && nextRanks[key] === next && next > 0) {
                        nextRanks[key] = 0
                      }
                    })
                    nextRanks[option.id] = next
                    ranks.value = nextRanks
                  }}
                />
                <span class="poll-tsx-label">{option.label}</span>
              </div>
            ))}
          </div>
        )
      }

      if (isMultiple.value) {
        return (
          <div class="poll-tsx-list">
            {props.options.map(option => (
              <Checkbox
                key={option.id}
                checked={selected.value.includes(option.id)}
                onChange={event => {
                  const checked = (event.target as HTMLInputElement).checked
                  if (checked) {
                    selected.value = Array.from(new Set([...selected.value, option.id]))
                  } else {
                    selected.value = selected.value.filter(item => item !== option.id)
                  }
                }}
              >
                {option.label}
              </Checkbox>
            ))}
          </div>
        )
      }

      return (
        <Radio.Group
          value={selected.value[0]}
          onUpdate:value={value => {
            selected.value = value ? [String(value)] : []
          }}
        >
          <div class="poll-tsx-list">
            {props.options.map(option => (
              <Radio key={option.id} value={option.id}>
                {option.label}
              </Radio>
            ))}
          </div>
        </Radio.Group>
      )
    }

    const renderResults = () => {
      if (isRanked.value && pollState.value?.ranked_choice_outcome) {
        const outcome = pollState.value.ranked_choice_outcome as Record<string, any>
        const rounds = Array.isArray(outcome.round_activity) ? outcome.round_activity : []
        const rankedVoterDetails = props.options
          .map(option => {
            const voteCount =
              pollState.value?.options?.find(item => item.id === option.id)?.votes || 0
            return {
              option,
              details: renderVoterDetails(option, voteCount)
            }
          })
          .filter(item => Boolean(item.details))

        return (
          <div class="poll-tsx-results">
            <div class="poll-tsx-results-title">结果</div>
            <div class="poll-tsx-rounds">
              {rounds.map((round: any) => {
                const eliminated = Array.isArray(round?.eliminated) ? round.eliminated : []
                const eliminatedText = eliminated.length
                  ? eliminated
                      .map((item: any) => item?.html || '')
                      .filter(Boolean)
                      .join('、')
                  : '—'
                return (
                  <div class="poll-tsx-round" key={round?.round ?? Math.random()}>
                    <div class="poll-tsx-round-label">回合 {round?.round ?? ''}</div>
                    <div class="poll-tsx-round-desc">淘汰：{eliminatedText}</div>
                  </div>
                )
              })}
            </div>
            <div class="poll-tsx-summary">
              {outcome.winning_candidate?.html
                ? `结果：${outcome.winning_candidate.html}`
                : outcome.tied_candidates?.length
                  ? `结果：${outcome.tied_candidates
                      .map((item: any) => item?.html || '')
                      .filter(Boolean)
                      .join('、')}`
                  : '结果：暂无'}
            </div>
            {rankedVoterDetails.length > 0 && (
              <div class="poll-tsx-ranked-voters">
                {rankedVoterDetails.map(({ option, details }) => (
                  <div key={option.id} class="poll-tsx-ranked-voter-option">
                    <span class="poll-tsx-label">{option.label}</span>
                    {details}
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      }

      return (
        <div class="poll-tsx-results">
          <div class="poll-tsx-results-title">结果</div>
          <div class="poll-tsx-bars">
            {props.options.map(option => {
              const pollOption = pollState.value?.options?.find(item => item.id === option.id)
              const voteCount = pollOption?.votes || 0
              const percent =
                totalVotes.value > 0 ? Math.round((voteCount / totalVotes.value) * 100) : 0
              const barPercent = Math.round((voteCount / maxVotes.value) * 100)

              return (
                <div key={option.id} class="poll-tsx-result-option">
                  <div class="poll-tsx-bar-row">
                    <div class="poll-tsx-label">{option.label}</div>
                    <div class="poll-tsx-bar">
                      <Progress
                        percent={barPercent}
                        showInfo={false}
                        strokeColor="rgba(59,130,246,0.7)"
                      />
                    </div>
                    <div class="poll-tsx-percent">{percent}%</div>
                  </div>
                  {renderVoterDetails(option, voteCount)}
                </div>
              )
            })}
          </div>
        </div>
      )
    }

    return () => (
      <div class="poll-tsx">
        <div class="poll-tsx-title" innerHTML={sanitizeDiscourseHtml(props.pollTitleHtml)}></div>
        {viewMode.value === 'results' ? renderResults() : renderVoteList()}
        <div class="poll-tsx-footer">
          <div class="poll-tsx-actions">
            {!hasVoted.value && (
              <Button
                type="primary"
                disabled={!canSubmit.value}
                loading={isSubmitting.value}
                onClick={submitVote}
              >
                提交投票
              </Button>
            )}
            {hasVoted.value && (
              <Button disabled={isSubmitting.value} onClick={revokeVote}>
                撤销
              </Button>
            )}
            <Button onClick={toggleResults}>
              {viewMode.value === 'results' ? '投票' : '结果'}
            </Button>
          </div>
          <div class="poll-tsx-info">
            {voters.value != null && <span>{voters.value} 投票人</span>}
          </div>
        </div>
      </div>
    )
  }
})
