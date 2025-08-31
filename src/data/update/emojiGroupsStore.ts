import type { EmojiGroup } from '../type/emoji/emoji'
import { createBackgroundCommService } from '../../services/communication'

import storage from './storage'
import settingsStore from './settingsStore'

// 通信服务实例
let commService: any = null

function getCommService() {
  if (!commService) {
    try {
      commService = createBackgroundCommService()
    } catch (error) {
      console.warn('[EmojiGroupsStore] Failed to create communication service:', error)
    }
  }
  return commService
}

let emojiGroups: EmojiGroup[] = []
let ungrouped: any[] = []

function initFromStorage() {
  try {
    const p = storage.loadPayload()
    if (p) {
      emojiGroups = Array.isArray(p.emojiGroups)
        ? p.emojiGroups.map((g) => ({ ...g, emojis: [...g.emojis] }))
        : []
      ungrouped = Array.isArray(p.ungrouped) ? p.ungrouped.map((e) => ({ ...e })) : []
      return
    }
  } catch (error) {
    console.warn('[EmojiGroupsStore] Failed to load from storage:', error)
  }

  // No payload in storage: try to load converted defaults from bundled JSON and persist them.
  try {
    if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
      fetch('/static/config/converted_payload.json')
        .then((res) => {
          if (!res.ok) throw new Error('fetch failed')
          return res.json()
        })
        .then((payload: any) => {
          try {
            if (!payload) return
            const gs = Array.isArray(payload.emojiGroups) ? payload.emojiGroups : []
            const ug = Array.isArray(payload.ungrouped) ? payload.ungrouped : []
            // initialize in-memory copies
            emojiGroups = gs.map((g: any) => ({
              ...g,
              emojis: Array.isArray(g.emojis) ? [...g.emojis] : [],
            }))
            ungrouped = ug.map((e: any) => ({ ...e }))
            // persist using settingsStore so storage.savePayload is used consistently
            try {
              settingsStore.setSettings(payload.Settings || {}, emojiGroups)
            } catch (_) {
              // fallback: call settingsStore.save to at least persist groups
              try {
                settingsStore.save(emojiGroups, ungrouped)
              } catch (_) {}
            }
          } catch (_) {}
        })
        .catch((_) => {})
    }
  } catch (_) {}
}

function getEmojiGroups() {
  // 🚀 关键修复：确保返回的表情组按照正确的顺序排列
  const groups = emojiGroups.map((g) => ({ ...g, emojis: [...g.emojis] }))

  // 确保常用表情组始终在第一位
  const commonGroupIndex = groups.findIndex((g) => g.UUID === 'common-emoji-group')
  if (commonGroupIndex > 0) {
    const commonGroup = groups.splice(commonGroupIndex, 1)[0]
    groups.unshift(commonGroup)
    console.log('[EmojiGroupsStore] Moved common group to first position')
  }

  return groups
}

// 获取普通表情分组（排除常用表情分组）
function getNormalGroups() {
  return emojiGroups
    .filter((g) => {
      // 排除常用表情分组（使用UUID匹配）
      if (g.UUID === 'common-emoji-group') return false

      // 排除显示名称包含常用的分组（备用方案）
      const displayName = g.displayName || ''
      if (
        displayName.includes('常用') ||
        displayName.includes('收藏') ||
        displayName.includes('最近')
      ) {
        return false
      }

      return true
    })
    .map((g) => ({ ...g, emojis: [...g.emojis] }))
}

// 获取常用表情分组
function getCommonEmojiGroup() {
  const commonGroup = emojiGroups.find((g) => g.UUID === 'common-emoji-group')
  if (commonGroup) {
    return { ...commonGroup, emojis: [...commonGroup.emojis] }
  }
  return null
}

// 获取热门表情（基于使用计数）
function getHotEmojis(forceRefresh = false) {
  const startTime = Date.now()
  console.log('[EmojiGroupsStore] ===== Getting hot emojis =====')
  console.log('[EmojiGroupsStore] Parameters:', { forceRefresh })
  console.log('[EmojiGroupsStore] Current cache state:', {
    hasData: cachedHotEmojis.data !== null,
    dataCount: cachedHotEmojis.data?.length || 0,
    timestamp: cachedHotEmojis.timestamp,
    age: cachedHotEmojis.timestamp ? Date.now() - cachedHotEmojis.timestamp : 0,
    isExpired: cachedHotEmojis.timestamp ? Date.now() - cachedHotEmojis.timestamp > 60000 : true,
  })

  // 🚀 关键优化：增强缓存机制和强制刷新功能
  if (!forceRefresh) {
    // 检查是否有缓存且未过期（1分钟内）
    const now = Date.now()
    const cacheAge = cachedHotEmojis.timestamp ? now - cachedHotEmojis.timestamp : Infinity
    const cacheValid = cachedHotEmojis.data && cachedHotEmojis.timestamp && cacheAge < 60000

    console.log('[EmojiGroupsStore] Cache validation:', {
      hasData: !!cachedHotEmojis.data,
      hasTimestamp: !!cachedHotEmojis.timestamp,
      cacheAge,
      cacheAgeMinutes: cacheAge / 60000,
      isValid: cacheValid,
    })

    if (cacheValid && cachedHotEmojis.data) {
      console.log('[EmojiGroupsStore] ✅ Using cached hot emojis data')
      console.log(
        '[EmojiGroupsStore] Cached data preview:',
        cachedHotEmojis.data.slice(0, 5).map((e) => ({
          name: e.displayName,
          count: e.usageCount,
          group: e.groupUUID,
        })),
      )
      console.log(`[EmojiGroupsStore] Cache hit completed in ${Date.now() - startTime}ms`)
      return [...cachedHotEmojis.data]
    } else {
      console.log('[EmojiGroupsStore] ❌ Cache is invalid or expired, will recalculate')
      console.log('[EmojiGroupsStore] Cache invalidation reason:', {
        noData: !cachedHotEmojis.data,
        noTimestamp: !cachedHotEmojis.timestamp,
        expired: cacheAge >= 60000,
      })
    }
  } else {
    console.log('[EmojiGroupsStore] 🔄 Force refresh requested, completely ignoring cache')
    console.log('[EmojiGroupsStore] Previous cache will be overwritten')
  }

  console.log('[EmojiGroupsStore] 🔄 Recalculating hot emojis from scratch')
  console.log('[EmojiGroupsStore] Data sources:', {
    emojiGroupsCount: emojiGroups.length,
    ungroupedCount: ungrouped.length,
  })

  // 从所有分组收集带使用统计的表情
  const all: any[] = []
  let totalGroupEmojis = 0

  for (const g of emojiGroups) {
    if (Array.isArray(g.emojis)) {
      const groupEmojis = g.emojis.map((e: any) => ({ ...e, groupUUID: g.UUID }))
      all.push(...groupEmojis)
      totalGroupEmojis += groupEmojis.length
      console.log(
        `[EmojiGroupsStore] Group "${g.displayName}" (${g.UUID}): ${groupEmojis.length} emojis`,
      )

      // 显示该组中有使用统计的表情
      const groupWithUsage = groupEmojis.filter((e) => e.usageCount > 0)
      if (groupWithUsage.length > 0) {
        console.log(
          `  └─ ${groupWithUsage.length} emojis with usage:`,
          groupWithUsage.map((e) => `${e.displayName}(${e.usageCount})`).join(', '),
        )
      }
    } else {
      console.warn(`[EmojiGroupsStore] Group ${g.UUID} has invalid emojis array:`, g.emojis)
    }
  }

  // 添加未分组表情
  const ungroupedEmojis = ungrouped.map((e: any) => ({ ...e, groupUUID: 'ungrouped' }))
  all.push(...ungroupedEmojis)
  console.log(`[EmojiGroupsStore] Added ${ungroupedEmojis.length} ungrouped emojis`)

  const ungroupedWithUsage = ungroupedEmojis.filter((e) => e.usageCount > 0)
  if (ungroupedWithUsage.length > 0) {
    console.log(
      `  └─ ${ungroupedWithUsage.length} ungrouped with usage:`,
      ungroupedWithUsage.map((e) => `${e.displayName}(${e.usageCount})`).join(', '),
    )
  }

  console.log('[EmojiGroupsStore] Collection summary:', {
    totalEmojis: all.length,
    fromGroups: totalGroupEmojis,
    fromUngrouped: ungroupedEmojis.length,
  })

  // 过滤出有使用统计的表情
  const withUsage = all.filter((e) => typeof e.usageCount === 'number' && e.usageCount > 0)
  console.log(`[EmojiGroupsStore] ✅ Found ${withUsage.length} emojis with usage count > 0`)

  // 验证数据完整性
  const usageCounts = withUsage.map((e) => e.usageCount)
  console.log('[EmojiGroupsStore] Usage statistics:', {
    min: Math.min(...usageCounts),
    max: Math.max(...usageCounts),
    total: usageCounts.reduce((sum, count) => sum + count, 0),
    average:
      usageCounts.length > 0
        ? (usageCounts.reduce((sum, count) => sum + count, 0) / usageCounts.length).toFixed(2)
        : 0,
  })

  // 按使用次数排序
  withUsage.sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0))
  console.log('[EmojiGroupsStore] ✅ Sorted emojis by usage count')

  // 详细显示排序后的前10个表情
  if (withUsage.length > 0) {
    console.log('[EmojiGroupsStore] 🏆 Top hot emojis after sorting:')
    withUsage.slice(0, Math.min(10, withUsage.length)).forEach((e, i) => {
      console.log(
        `  ${i + 1}. "${e.displayName}" (${e.usageCount} uses, group: ${e.groupUUID}, UUID: ${e.UUID})`,
      )
    })

    if (withUsage.length > 10) {
      console.log(`  ... and ${withUsage.length - 10} more emojis`)
    }
  } else {
    console.log('[EmojiGroupsStore] ⚠️ No emojis with usage count found')
  }

  // 🚀 关键优化：更新缓存
  const maxCacheSize = 50
  const newCacheData = withUsage.slice(0, maxCacheSize)
  const newTimestamp = Date.now()

  console.log('[EmojiGroupsStore] 💾 Updating cache with new data')
  console.log('[EmojiGroupsStore] Cache update details:', {
    previousCacheSize: cachedHotEmojis.data?.length || 0,
    newCacheSize: newCacheData.length,
    maxCacheSize,
    previousTimestamp: cachedHotEmojis.timestamp,
    newTimestamp,
    timeDiff: newTimestamp - (cachedHotEmojis.timestamp || 0),
  })

  cachedHotEmojis.data = newCacheData
  cachedHotEmojis.timestamp = newTimestamp

  console.log(`[EmojiGroupsStore] ✅ Successfully cached ${cachedHotEmojis.data.length} hot emojis`)
  console.log('[EmojiGroupsStore] 📋 Final cached hot emojis preview:')
  cachedHotEmojis.data.slice(0, Math.min(10, cachedHotEmojis.data.length)).forEach((e, i) => {
    console.log(`  ${i + 1}. "${e.displayName}" (${e.usageCount} uses, group: ${e.groupUUID})`)
  })

  if (cachedHotEmojis.data.length > 10) {
    console.log(`  ... and ${cachedHotEmojis.data.length - 10} more cached emojis`)
  }

  // 性能统计
  const totalTime = Date.now() - startTime
  console.log(`[EmojiGroupsStore] ⚡ Hot emojis calculation completed in ${totalTime}ms`)
  console.log('[EmojiGroupsStore] ===== End getting hot emojis =====')

  return [...cachedHotEmojis.data]
}

// 🚀 关键优化：添加缓存变量
const cachedHotEmojis = {
  data: null as any[] | null,
  timestamp: 0,
}

function getUngrouped() {
  return ungrouped.map((e) => ({ ...e }))
}

function setEmojiGroups(gs: EmojiGroup[]) {
  emojiGroups = gs.map((g) => ({ ...g, emojis: [...g.emojis] }))
  // persist together with settings (sync)
  settingsStore.save(emojiGroups, ungrouped)
}

function addUngrouped(emoji: any) {
  console.log('[EmojiGroupsStore] Adding ungrouped emoji:', emoji.displayName || emoji.UUID)

  ungrouped.push(emoji)

  try {
    settingsStore.save(emojiGroups, ungrouped)

    // 🚀 新增：发送未分组表情变更的实时同步消息
    try {
      const comm = getCommService()
      if (comm) {
        comm.sendUngroupedEmojisChangedSync([...ungrouped])
        console.log('[EmojiGroupsStore] Sent ungrouped emojis changed sync message')
      }
    } catch (syncError) {
      console.warn('[EmojiGroupsStore] Failed to send ungrouped sync message:', syncError)
    }

    // 保存到专用存储键
    try {
      storage.saveUngroupedEmojis(ungrouped)
      console.log('[EmojiGroupsStore] Saved ungrouped emojis to dedicated storage key')
    } catch (storageError) {
      console.warn('[EmojiGroupsStore] Failed to save to dedicated ungrouped key:', storageError)
    }
  } catch (error) {
    console.error('[EmojiGroupsStore] Failed to save ungrouped emojis:', error)
  }
}

function removeUngroupedByUUID(uuid: string) {
  console.log('[EmojiGroupsStore] Removing ungrouped emoji by UUID:', uuid)

  const idx = ungrouped.findIndex((e) => e.UUID === (uuid as any))
  if (idx >= 0) {
    const removedEmoji = ungrouped[idx]
    ungrouped.splice(idx, 1)

    try {
      settingsStore.save(emojiGroups, ungrouped)

      // 🚀 新增：发送未分组表情变更的实时同步消息
      try {
        const comm = getCommService()
        if (comm) {
          comm.sendUngroupedEmojisChangedSync([...ungrouped])
          console.log('[EmojiGroupsStore] Sent ungrouped emojis changed sync message after removal')
        }
      } catch (syncError) {
        console.warn('[EmojiGroupsStore] Failed to send ungrouped sync message:', syncError)
      }

      // 保存到专用存储键
      try {
        storage.saveUngroupedEmojis(ungrouped)
        console.log('[EmojiGroupsStore] Saved updated ungrouped emojis to dedicated storage key')
      } catch (storageError) {
        console.warn('[EmojiGroupsStore] Failed to save to dedicated ungrouped key:', storageError)
      }

      console.log(
        '[EmojiGroupsStore] Successfully removed ungrouped emoji:',
        removedEmoji.displayName || uuid,
      )
      return true
    } catch (error) {
      console.error('[EmojiGroupsStore] Failed to save after removing ungrouped emoji:', error)
      return false
    }
  }

  console.warn('[EmojiGroupsStore] Ungrouped emoji not found with UUID:', uuid)
  return false
}

function recordUsageByUUID(uuid: string) {
  console.log('[EmojiGroupsStore] Recording usage for UUID:', uuid)

  // try to find in groups first
  const found = findEmojiByUUID(uuid)
  if (found && found.emoji) {
    const e: any = found.emoji
    const now = Date.now()
    const oldUsageCount = e.usageCount || 0

    console.log(
      '[EmojiGroupsStore] Found emoji in group:',
      found.group.UUID,
      'emoji:',
      e.displayName,
      'current usage:',
      oldUsageCount,
    )

    // if no previous lastUsed, treat as new
    if (!e.lastUsed) {
      e.usageCount = 1
      e.lastUsed = now
    } else {
      const days = Math.floor((now - (e.lastUsed || 0)) / (24 * 60 * 60 * 1000))
      if (days >= 1 && typeof e.usageCount === 'number') {
        // decay by 80% per day
        e.usageCount = Math.floor(e.usageCount * Math.pow(0.8, days))
      }
      e.usageCount = (e.usageCount || 0) + 1
      e.lastUsed = now
    }

    console.log('[EmojiGroupsStore] Updated usage count from', oldUsageCount, 'to', e.usageCount)

    // 🚀 关键修复：清除热门表情缓存，强制重新计算
    console.log('[EmojiGroupsStore] Clearing hot emoji cache after usage update for grouped emoji')
    cachedHotEmojis.data = null
    cachedHotEmojis.timestamp = 0
    console.log('[EmojiGroupsStore] Hot emoji cache cleared successfully')

    // 保存到存储
    try {
      settingsStore.save(emojiGroups, ungrouped)
      console.log('[EmojiGroupsStore] Successfully saved emoji groups to storage')

      // 🚀 关键修复：增强常用表情组的存储同步
      if (found.group.UUID === 'common-emoji-group') {
        console.log('[EmojiGroupsStore] ===== Common Emoji Group Storage Sync =====')
        console.log('[EmojiGroupsStore] Detected common emoji group update')
        console.log('[EmojiGroupsStore] Common group details:', {
          UUID: found.group.UUID,
          displayName: found.group.displayName,
          emojiCount: found.group.emojis?.length || 0,
          updatedEmoji: {
            UUID: e.UUID,
            displayName: e.displayName,
            oldUsageCount: oldUsageCount,
            newUsageCount: e.usageCount,
            lastUsed: e.lastUsed,
          },
        })

        // 验证数据完整性
        const dataIntegrityCheck = {
          hasUUID: !!found.group.UUID,
          hasDisplayName: !!found.group.displayName,
          hasEmojis: Array.isArray(found.group.emojis),
          emojiCount: found.group.emojis?.length || 0,
          allEmojisHaveUUID: found.group.emojis?.every((emoji) => !!emoji.UUID) || false,
          allEmojisHaveUsageCount:
            found.group.emojis?.every((emoji) => typeof emoji.usageCount === 'number') || false,
        }

        console.log('[EmojiGroupsStore] Data integrity check:', dataIntegrityCheck)

        if (!dataIntegrityCheck.hasUUID || !dataIntegrityCheck.hasEmojis) {
          console.error(
            '[EmojiGroupsStore] Data integrity check failed, skipping dedicated storage save',
          )
        } else {
          try {
            console.log('[EmojiGroupsStore] Calling storage.saveCommonEmojiGroup...')
            const saveStartTime = Date.now()

            storage.saveCommonEmojiGroup(found.group)

            const saveDuration = Date.now() - saveStartTime
            console.log(
              '[EmojiGroupsStore] ✅ Successfully saved common emoji group to dedicated storage key',
            )
            console.log('[EmojiGroupsStore] Save operation took:', saveDuration, 'ms')

            // 验证保存结果
            try {
              const savedGroup = storage.getCommonEmojiGroup()
              if (savedGroup) {
                const savedEmoji = savedGroup.emojis.find((se: any) => se.UUID === e.UUID)
                console.log('[EmojiGroupsStore] Save verification:', {
                  groupExists: !!savedGroup,
                  emojiFound: !!savedEmoji,
                  savedUsageCount: savedEmoji?.usageCount,
                  expectedUsageCount: e.usageCount,
                  consistent: savedEmoji?.usageCount === e.usageCount,
                })

                if (savedEmoji?.usageCount !== e.usageCount) {
                  console.error(
                    '[EmojiGroupsStore] ❌ Save verification failed: usage count mismatch',
                  )
                }
              } else {
                console.error(
                  '[EmojiGroupsStore] ❌ Save verification failed: group not found after save',
                )
              }
            } catch (verificationError) {
              console.error('[EmojiGroupsStore] Save verification failed:', verificationError)
            }
          } catch (error) {
            console.error(
              '[EmojiGroupsStore] ❌ Failed to save common emoji group to dedicated key:',
              error,
            )
            console.error('[EmojiGroupsStore] Error details:', {
              message: error instanceof Error ? error.message : String(error),
              stack: error instanceof Error ? error.stack : undefined,
              groupUUID: found.group.UUID,
              emojiUUID: e.UUID,
            })
            // Don't fail the entire operation, but log the error
          }
        }
        console.log('[EmojiGroupsStore] ===== Common Emoji Group Storage Sync Complete =====')
      } else {
        console.log('[EmojiGroupsStore] Updated emoji is not in common group')
        console.log('[EmojiGroupsStore] Group details:', {
          UUID: found.group.UUID,
          displayName: found.group.displayName,
          isCommonGroup: found.group.UUID === 'common-emoji-group',
        })
      }

      return true
    } catch (error) {
      console.error('[EmojiGroupsStore] Failed to save emoji groups to storage:', error)
      return false
    }
  }

  // fallback: try ungrouped
  const ue = ungrouped.find((x) => x.UUID === (uuid as any))
  if (ue) {
    const now = Date.now()
    const oldUsageCount = ue.usageCount || 0

    console.log(
      '[EmojiGroupsStore] Found emoji in ungrouped:',
      ue.displayName,
      'current usage:',
      oldUsageCount,
    )

    if (!ue.lastUsed) {
      ue.usageCount = 1
      ue.lastUsed = now
    } else {
      const days = Math.floor((now - (ue.lastUsed || 0)) / (24 * 60 * 60 * 1000))
      if (days >= 1 && typeof ue.usageCount === 'number') {
        ue.usageCount = Math.floor(ue.usageCount * Math.pow(0.8, days))
      }
      ue.usageCount = (ue.usageCount || 0) + 1
      ue.lastUsed = now
    }

    console.log(
      '[EmojiGroupsStore] Updated ungrouped usage count from',
      oldUsageCount,
      'to',
      ue.usageCount,
    )

    // 🚀 关键修复：清除热门表情缓存，强制重新计算
    console.log(
      '[EmojiGroupsStore] Clearing hot emoji cache after usage update for ungrouped emoji',
    )
    cachedHotEmojis.data = null
    cachedHotEmojis.timestamp = 0
    console.log('[EmojiGroupsStore] Hot emoji cache cleared successfully')

    try {
      console.log('[EmojiGroupsStore] ===== Ungrouped Emoji Storage Sync =====')
      console.log('[EmojiGroupsStore] Saving ungrouped emojis to storage')
      console.log('[EmojiGroupsStore] Ungrouped emoji details:', {
        totalUngrouped: ungrouped.length,
        updatedEmoji: {
          UUID: ue.UUID,
          displayName: ue.displayName,
          oldUsageCount: oldUsageCount,
          newUsageCount: ue.usageCount,
          lastUsed: ue.lastUsed,
        },
      })

      const saveStartTime = Date.now()
      settingsStore.save(emojiGroups, ungrouped)
      const saveDuration = Date.now() - saveStartTime

      console.log('[EmojiGroupsStore] ✅ Successfully saved ungrouped emojis to storage')
      console.log('[EmojiGroupsStore] Save operation took:', saveDuration, 'ms')

      // 🚀 关键修复：额外保存到专用的未分组存储键
      try {
        console.log('[EmojiGroupsStore] Saving to dedicated ungrouped storage key')
        storage.saveUngroupedEmojis(ungrouped)
        console.log('[EmojiGroupsStore] ✅ Successfully saved to dedicated ungrouped storage key')
      } catch (ungroupedSaveError) {
        console.error(
          '[EmojiGroupsStore] Failed to save to dedicated ungrouped key:',
          ungroupedSaveError,
        )
        // Don't fail the entire operation
      }

      console.log('[EmojiGroupsStore] ===== Ungrouped Emoji Storage Sync Complete =====')
      return true
    } catch (error) {
      console.error('[EmojiGroupsStore] ❌ Failed to save ungrouped emojis to storage:', error)
      console.error('[EmojiGroupsStore] Error details:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        emojiUUID: ue.UUID,
        ungroupedCount: ungrouped.length,
      })
      return false
    }
  }

  console.warn('[EmojiGroupsStore] Emoji not found with UUID:', uuid)
  return false
}

function findGroupByUUID(uuid: string) {
  return emojiGroups.find((g) => g.UUID === (uuid as any)) || null
}

function findEmojiByUUID(uuid: string) {
  for (const g of emojiGroups) {
    const e = g.emojis.find((it) => it.UUID === (uuid as any))
    if (e) return { group: g, emoji: e }
  }
  return null
}

function addGroup(group: EmojiGroup) {
  emojiGroups.push({ ...group, emojis: [...group.emojis] })
  settingsStore.save(emojiGroups, ungrouped)
}

function removeGroup(uuid: string) {
  const idx = emojiGroups.findIndex((g) => g.UUID === (uuid as any))
  if (idx >= 0) {
    emojiGroups.splice(idx, 1)
    settingsStore.save(emojiGroups, ungrouped)
    return true
  }
  return false
}

function addEmojiToGroup(groupUUID: string, emoji: any, position?: number) {
  const g = emojiGroups.find((x) => x.UUID === (groupUUID as any))
  if (!g) return false
  if (typeof position === 'number' && position >= 0 && position <= g.emojis.length) {
    g.emojis.splice(position, 0, emoji)
  } else {
    g.emojis.push(emoji)
  }
  settingsStore.save(emojiGroups, ungrouped)
  return true
}

function removeEmojiFromGroup(groupUUID: string, emojiUUID: string) {
  const g = emojiGroups.find((x) => x.UUID === (groupUUID as any))
  if (!g) return false
  const idx = g.emojis.findIndex((e) => e.UUID === (emojiUUID as any))
  if (idx >= 0) {
    g.emojis.splice(idx, 1)
    settingsStore.save(emojiGroups, ungrouped)
    return true
  }
  return false
}

function moveEmojiBetweenGroups(
  fromGroupUUID: string,
  toGroupUUID: string,
  emojiUUID: string,
  toIndex?: number,
) {
  const from = emojiGroups.find((x) => x.UUID === (fromGroupUUID as any))
  const to = emojiGroups.find((x) => x.UUID === (toGroupUUID as any))
  if (!from || !to) return false
  const idx = from.emojis.findIndex((e) => e.UUID === (emojiUUID as any))
  if (idx < 0) return false
  const [e] = from.emojis.splice(idx, 1)
  if (typeof toIndex === 'number' && toIndex >= 0 && toIndex <= to.emojis.length) {
    to.emojis.splice(toIndex, 0, e)
  } else {
    to.emojis.push(e)
  }
  settingsStore.save(emojiGroups, ungrouped)
  return true
}

function reorderEmojiInGroup(groupUUID: string, fromIndex: number, toIndex: number) {
  const g = emojiGroups.find((x) => x.UUID === (groupUUID as any))
  if (!g) return false
  if (fromIndex < 0 || fromIndex >= g.emojis.length) return false
  const [e] = g.emojis.splice(fromIndex, 1)
  g.emojis.splice(Math.min(Math.max(0, toIndex), g.emojis.length), 0, e)
  settingsStore.save(emojiGroups, ungrouped)
  return true
}

function reorderGroups(fromIndex: number, toIndex: number) {
  if (fromIndex < 0 || fromIndex >= emojiGroups.length) return false
  const [g] = emojiGroups.splice(fromIndex, 1)
  emojiGroups.splice(Math.min(Math.max(0, toIndex), emojiGroups.length), 0, g)
  settingsStore.save(emojiGroups, ungrouped)
  return true
}

function resetAllUsageCounts() {
  for (const g of emojiGroups) {
    if (Array.isArray(g.emojis)) {
      for (const e of g.emojis) {
        e.usageCount = 0
        e.lastUsed = undefined
      }
    }
  }
  for (const e of ungrouped) {
    e.usageCount = 0
    e.lastUsed = undefined
  }
  settingsStore.save(emojiGroups, ungrouped)
}

function resetUsageCountByUUID(uuid: string) {
  const found = findEmojiByUUID(uuid)
  if (found && found.emoji) {
    const e: any = found.emoji
    e.usageCount = 0
    e.lastUsed = undefined
    settingsStore.save(emojiGroups, ungrouped)
    return true
  }
  // fallback: try ungrouped
  const ue = ungrouped.find((x) => x.UUID === (uuid as any))
  if (ue) {
    ue.usageCount = 0
    ue.lastUsed = undefined
    settingsStore.save(emojiGroups, ungrouped)
    return true
  }
  return false
}

// 🚀 新增：批量更新未分组表情
function setUngroupedEmojis(newUngrouped: any[]) {
  console.log('[EmojiGroupsStore] Setting ungrouped emojis, count:', newUngrouped.length)

  ungrouped = newUngrouped.map((e) => ({ ...e }))

  try {
    settingsStore.save(emojiGroups, ungrouped)

    // 🚀 发送未分组表情变更的实时同步消息
    try {
      const comm = getCommService()
      if (comm) {
        comm.sendUngroupedEmojisChangedSync([...ungrouped])
        console.log(
          '[EmojiGroupsStore] Sent ungrouped emojis changed sync message after batch update',
        )
      }
    } catch (syncError) {
      console.warn('[EmojiGroupsStore] Failed to send ungrouped sync message:', syncError)
    }

    // 保存到专用存储键
    try {
      storage.saveUngroupedEmojis(ungrouped)
      console.log(
        '[EmojiGroupsStore] Saved batch updated ungrouped emojis to dedicated storage key',
      )
    } catch (storageError) {
      console.warn('[EmojiGroupsStore] Failed to save to dedicated ungrouped key:', storageError)
    }

    return true
  } catch (error) {
    console.error('[EmojiGroupsStore] Failed to save batch updated ungrouped emojis:', error)
    return false
  }
}

// 🚀 新增：移动表情从分组到未分组
function moveEmojiToUngrouped(groupUUID: string, emojiUUID: string) {
  console.log('[EmojiGroupsStore] Moving emoji from group to ungrouped:', groupUUID, emojiUUID)

  const group = emojiGroups.find((g) => g.UUID === (groupUUID as any))
  if (!group) {
    console.warn('[EmojiGroupsStore] Group not found:', groupUUID)
    return false
  }

  const emojiIndex = group.emojis.findIndex((e) => e.UUID === (emojiUUID as any))
  if (emojiIndex < 0) {
    console.warn('[EmojiGroupsStore] Emoji not found in group:', emojiUUID)
    return false
  }

  // 移除表情从分组
  const [emoji] = group.emojis.splice(emojiIndex, 1)

  // 添加到未分组
  ungrouped.push(emoji)

  try {
    settingsStore.save(emojiGroups, ungrouped)

    // 🚀 发送未分组表情变更的实时同步消息
    try {
      const comm = getCommService()
      if (comm) {
        comm.sendUngroupedEmojisChangedSync([...ungrouped])
        console.log('[EmojiGroupsStore] Sent ungrouped emojis changed sync message after move')
      }
    } catch (syncError) {
      console.warn('[EmojiGroupsStore] Failed to send ungrouped sync message:', syncError)
    }

    // 保存到专用存储键
    try {
      storage.saveUngroupedEmojis(ungrouped)
      console.log('[EmojiGroupsStore] Saved ungrouped emojis after move to dedicated storage key')
    } catch (storageError) {
      console.warn('[EmojiGroupsStore] Failed to save to dedicated ungrouped key:', storageError)
    }

    console.log(
      '[EmojiGroupsStore] Successfully moved emoji to ungrouped:',
      emoji.displayName || emojiUUID,
    )
    return true
  } catch (error) {
    console.error('[EmojiGroupsStore] Failed to save after moving emoji to ungrouped:', error)
    return false
  }
}

// 🚀 新增：移动表情从未分组到分组
function moveEmojiFromUngrouped(emojiUUID: string, targetGroupUUID: string, position?: number) {
  console.log(
    '[EmojiGroupsStore] Moving emoji from ungrouped to group:',
    emojiUUID,
    targetGroupUUID,
  )

  const emojiIndex = ungrouped.findIndex((e) => e.UUID === (emojiUUID as any))
  if (emojiIndex < 0) {
    console.warn('[EmojiGroupsStore] Emoji not found in ungrouped:', emojiUUID)
    return false
  }

  const targetGroup = emojiGroups.find((g) => g.UUID === (targetGroupUUID as any))
  if (!targetGroup) {
    console.warn('[EmojiGroupsStore] Target group not found:', targetGroupUUID)
    return false
  }

  // 移除表情从未分组
  const [emoji] = ungrouped.splice(emojiIndex, 1)

  // 添加到目标分组
  if (typeof position === 'number' && position >= 0 && position <= targetGroup.emojis.length) {
    targetGroup.emojis.splice(position, 0, emoji)
  } else {
    targetGroup.emojis.push(emoji)
  }

  try {
    settingsStore.save(emojiGroups, ungrouped)

    // 🚀 发送未分组表情变更的实时同步消息
    try {
      const comm = getCommService()
      if (comm) {
        comm.sendUngroupedEmojisChangedSync([...ungrouped])
        console.log(
          '[EmojiGroupsStore] Sent ungrouped emojis changed sync message after move from ungrouped',
        )
      }
    } catch (syncError) {
      console.warn('[EmojiGroupsStore] Failed to send ungrouped sync message:', syncError)
    }

    // 保存到专用存储键
    try {
      storage.saveUngroupedEmojis(ungrouped)
      console.log(
        '[EmojiGroupsStore] Saved ungrouped emojis after move from ungrouped to dedicated storage key',
      )
    } catch (storageError) {
      console.warn('[EmojiGroupsStore] Failed to save to dedicated ungrouped key:', storageError)
    }

    console.log(
      '[EmojiGroupsStore] Successfully moved emoji from ungrouped to group:',
      emoji.displayName || emojiUUID,
    )
    return true
  } catch (error) {
    console.error('[EmojiGroupsStore] Failed to save after moving emoji from ungrouped:', error)
    return false
  }
}

// 🚀 新增：更新分组图标
function updateGroupIcon(groupUUID: string, newIcon: string) {
  console.log('[EmojiGroupsStore] Updating group icon:', groupUUID, newIcon)

  const group = emojiGroups.find((g) => g.UUID === (groupUUID as any))
  if (!group) {
    console.warn('[EmojiGroupsStore] Group not found for icon update:', groupUUID)
    return false
  }

  const oldIcon = group.icon
  group.icon = newIcon

  try {
    settingsStore.save(emojiGroups, ungrouped)

    // 🚀 发送分组图标更新的实时同步消息
    try {
      const comm = getCommService()
      if (comm) {
        comm.sendGroupIconUpdated(groupUUID, newIcon)
        console.log('[EmojiGroupsStore] Sent group icon updated sync message')
      }
    } catch (syncError) {
      console.warn('[EmojiGroupsStore] Failed to send group icon sync message:', syncError)
    }

    // 如果是常用表情组，保存到专用存储键
    if (groupUUID === 'common-emoji-group') {
      try {
        storage.saveCommonEmojiGroup(group)
        console.log(
          '[EmojiGroupsStore] Saved common emoji group with updated icon to dedicated storage key',
        )
      } catch (storageError) {
        console.warn(
          '[EmojiGroupsStore] Failed to save common group with updated icon:',
          storageError,
        )
      }
    }

    console.log('[EmojiGroupsStore] Successfully updated group icon from', oldIcon, 'to', newIcon)
    return true
  } catch (error) {
    console.error('[EmojiGroupsStore] Failed to save after updating group icon:', error)
    return false
  }
}

// 🚀 新增：批量更新分组图标
function updateMultipleGroupIcons(iconUpdates: Array<{ groupUUID: string; icon: string }>) {
  console.log('[EmojiGroupsStore] Updating multiple group icons, count:', iconUpdates.length)

  const updatedGroups: Array<{ groupUUID: string; oldIcon: string; newIcon: string }> = []

  for (const update of iconUpdates) {
    const group = emojiGroups.find((g) => g.UUID === (update.groupUUID as any))
    if (group) {
      const oldIcon = typeof group.icon === 'string' ? group.icon : group.icon.toString()
      group.icon = update.icon
      updatedGroups.push({
        groupUUID: update.groupUUID,
        oldIcon,
        newIcon: update.icon,
      })
    } else {
      console.warn('[EmojiGroupsStore] Group not found for batch icon update:', update.groupUUID)
    }
  }

  if (updatedGroups.length === 0) {
    console.warn('[EmojiGroupsStore] No groups were updated in batch icon update')
    return false
  }

  try {
    settingsStore.save(emojiGroups, ungrouped)

    // 🚀 发送每个分组图标更新的实时同步消息
    try {
      const comm = getCommService()
      if (comm) {
        for (const update of updatedGroups) {
          comm.sendGroupIconUpdated(update.groupUUID, update.newIcon)
        }
        console.log('[EmojiGroupsStore] Sent batch group icon updated sync messages')
      }
    } catch (syncError) {
      console.warn('[EmojiGroupsStore] Failed to send batch group icon sync messages:', syncError)
    }

    // 保存常用表情组到专用存储键（如果有更新）
    const commonGroupUpdate = updatedGroups.find((u) => u.groupUUID === 'common-emoji-group')
    if (commonGroupUpdate) {
      try {
        const commonGroup = emojiGroups.find((g) => g.UUID === 'common-emoji-group')
        if (commonGroup) {
          storage.saveCommonEmojiGroup(commonGroup)
          console.log(
            '[EmojiGroupsStore] Saved common emoji group with updated icon to dedicated storage key',
          )
        }
      } catch (storageError) {
        console.warn(
          '[EmojiGroupsStore] Failed to save common group with updated icon:',
          storageError,
        )
      }
    }

    console.log('[EmojiGroupsStore] Successfully updated', updatedGroups.length, 'group icons')
    return true
  } catch (error) {
    console.error('[EmojiGroupsStore] Failed to save after batch updating group icons:', error)
    return false
  }
}

// 🚀 新增：图标缓存管理
const iconCache = new Map<string, { url: string; timestamp: number; blob?: Blob }>()
const ICON_CACHE_DURATION = 5 * 60 * 1000 // 5分钟缓存

function cacheGroupIcon(groupUUID: string, iconUrl: string, blob?: Blob) {
  iconCache.set(groupUUID, {
    url: iconUrl,
    timestamp: Date.now(),
    blob,
  })
  console.log('[EmojiGroupsStore] Cached icon for group:', groupUUID)
}

function getCachedGroupIcon(groupUUID: string): { url: string; blob?: Blob } | null {
  const cached = iconCache.get(groupUUID)
  if (!cached) {
    return null
  }

  // 检查缓存是否过期
  if (Date.now() - cached.timestamp > ICON_CACHE_DURATION) {
    iconCache.delete(groupUUID)
    console.log('[EmojiGroupsStore] Icon cache expired for group:', groupUUID)
    return null
  }

  console.log('[EmojiGroupsStore] Using cached icon for group:', groupUUID)
  return { url: cached.url, blob: cached.blob }
}

function clearIconCache(groupUUID?: string) {
  if (groupUUID) {
    iconCache.delete(groupUUID)
    console.log('[EmojiGroupsStore] Cleared icon cache for group:', groupUUID)
  } else {
    iconCache.clear()
    console.log('[EmojiGroupsStore] Cleared all icon cache')
  }
}

// 🚀 新增：预加载分组图标
async function preloadGroupIcons(groupUUIDs: string[]) {
  console.log('[EmojiGroupsStore] Preloading icons for groups:', groupUUIDs)

  const preloadPromises = groupUUIDs.map(async (groupUUID) => {
    const group = emojiGroups.find((g) => g.UUID === groupUUID)
    if (!group || !group.icon) {
      return
    }

    // 检查是否已缓存
    if (getCachedGroupIcon(groupUUID)) {
      return
    }

    try {
      // 如果图标是URL，尝试预加载
      const iconStr = typeof group.icon === 'string' ? group.icon : group.icon.toString()
      if (iconStr.startsWith('http') || iconStr.startsWith('data:')) {
        const response = await fetch(iconStr)
        if (response.ok) {
          const blob = await response.blob()
          cacheGroupIcon(groupUUID, iconStr, blob)
        }
      } else {
        // 如果是emoji字符，直接缓存
        cacheGroupIcon(groupUUID, iconStr)
      }
    } catch (error) {
      console.warn('[EmojiGroupsStore] Failed to preload icon for group:', groupUUID, error)
    }
  })

  await Promise.all(preloadPromises)
  console.log('[EmojiGroupsStore] Completed preloading icons')
}

initFromStorage()

export default {
  resetAllUsageCounts,
  getEmojiGroups,
  getNormalGroups,
  getCommonEmojiGroup,
  getHotEmojis,
  getUngrouped,
  setEmojiGroups,
  setUngroupedEmojis,
  findGroupByUUID,
  findEmojiByUUID,
  addGroup,
  removeGroup,
  addEmojiToGroup,
  removeEmojiFromGroup,
  moveEmojiBetweenGroups,
  moveEmojiToUngrouped,
  moveEmojiFromUngrouped,
  reorderEmojiInGroup,
  reorderGroups,
  addUngrouped,
  removeUngroupedByUUID,
  recordUsageByUUID,
  resetUsageCountByUUID,
  updateGroupIcon,
  updateMultipleGroupIcons,
  cacheGroupIcon,
  getCachedGroupIcon,
  clearIconCache,
  preloadGroupIcons,
}
