import { defineComponent, computed, ref, watch } from 'vue'
import { Button, Checkbox, Radio, Select, Progress, message } from 'ant-design-vue'

import type { DiscoursePoll } from '../types'
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
    requestPollVote: { type: Function as () => (method: 'PUT' | 'DELETE', body: URLSearchParams) => Promise<any>, required: true },
    pollMeta: { type: Object as () => PollMeta, required: true }
  },
  setup(props) {
    const viewMode = ref<'vote' | 'results'>(props.pollMeta.results === 'always' ? 'results' : 'vote')
    const selected = ref<string[]>([])
    const ranks = ref<Record<string, number>>({})
    const hasVoted = ref(false)
    const isSubmitting = ref(false)
    const pollState = ref<DiscoursePoll | null>(props.pollData || null)
    const voters = ref<number | undefined>(props.pollMeta.voters)

    const isRanked = computed(() => props.pollType === 'ranked_choice')
    const isMultiple = computed(() => props.pollType === 'multiple')

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

    const applyPollResult = (poll: DiscoursePoll | null) => {
      if (!poll) return
      pollState.value = poll
      voters.value = poll.voters

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
      () => props.pollData,
      next => {
        applyPollResult(next || null)
      },
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
        applyPollResult(data.poll)
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
        applyPollResult(data.poll)
        hasVoted.value = false
        message.success('已撤销投票')
      } catch (error) {
        const text = error instanceof Error ? error.message : '撤销投票失败'
        message.error(text)
      } finally {
        isSubmitting.value = false
      }
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

        return (
          <div class="poll-tsx-results">
            <div class="poll-tsx-results-title">结果</div>
            <div class="poll-tsx-rounds">
              {rounds.map((round: any) => {
                const eliminated = Array.isArray(round?.eliminated) ? round.eliminated : []
                const eliminatedText = eliminated.length
                  ? eliminated.map((item: any) => item?.html || '').filter(Boolean).join('、')
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
              const percent = totalVotes.value > 0 ? Math.round((voteCount / totalVotes.value) * 100) : 0
              const barPercent = Math.round((voteCount / maxVotes.value) * 100)

              return (
                <div key={option.id} class="poll-tsx-bar-row">
                  <div class="poll-tsx-label">{option.label}</div>
                  <div class="poll-tsx-bar">
                    <Progress percent={barPercent} showInfo={false} strokeColor="rgba(59,130,246,0.7)" />
                  </div>
                  <div class="poll-tsx-percent">{percent}%</div>
                </div>
              )
            })}
          </div>
        </div>
      )
    }

    return () => (
      <div class="poll-tsx">
        <div class="poll-tsx-title" innerHTML={props.pollTitleHtml}></div>
        {viewMode.value === 'results' ? renderResults() : renderVoteList()}
        <div class="poll-tsx-footer">
          <div class="poll-tsx-actions">
            {!hasVoted.value && (
              <Button type="primary" disabled={!canSubmit.value} loading={isSubmitting.value} onClick={submitVote}>
                提交投票
              </Button>
            )}
            {hasVoted.value && (
              <Button disabled={isSubmitting.value} onClick={revokeVote}>
                撤销
              </Button>
            )}
            <Button onClick={toggleResults}>结果</Button>
          </div>
          <div class="poll-tsx-info">
            {voters.value != null && <span>{voters.value} 投票人</span>}
          </div>
        </div>
      </div>
    )
  }
})
