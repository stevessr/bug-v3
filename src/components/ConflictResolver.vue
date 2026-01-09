<script setup lang="ts">
import { ref, computed } from 'vue'

import type { ConflictInfo, EntityType } from '@/types/sync'
import { conflictResolver } from '@/services/conflict-resolver'
import { extractTimestamp, extractChanges } from '@/utils/typeGuards'

const { t } = useI18n()

interface Props {
  conflicts: ConflictInfo[]
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'resolved', conflict: ConflictInfo, resolution: 'local' | 'remote' | 'merged'): void
  (e: 'cancel'): void
  (e: 'continue'): void
}>()

const resolvedConflicts = ref<Set<string>>(new Set())

const allResolved = computed(() => {
  return props.conflicts.every(c => resolvedConflicts.value.has(c.id))
})

function getEntityTypeLabel(type: EntityType): string {
  const labels: Record<EntityType, string> = {
    emoji: 'Emoji',
    group: t('entityTypeGroup'),
    settings: t('entityTypeSettings'),
    favorites: t('entityTypeFavorites')
  }
  return labels[type] || type
}

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

function formatValue(value: any): string {
  if (value === null || value === undefined) {
    return 'null'
  }
  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2)
  }
  return String(value)
}

async function resolveConflict(conflict: ConflictInfo, resolution: 'local' | 'remote' | 'merged') {
  try {
    await conflictResolver.manualResolve(conflict.id, resolution)
    resolvedConflicts.value.add(conflict.id)
    emit('resolved', conflict, resolution)

    console.log(`Resolved conflict ${conflict.id} with ${resolution}`)
  } catch (error) {
    console.error('Failed to resolve conflict:', error)
    alert(t('resolveConflictFailed'))
  }
}

async function tryAutoMerge(conflict: ConflictInfo) {
  try {
    // 尝试智能合并
    const results = await conflictResolver.autoResolve([conflict], 'auto')

    if (results.length > 0 && results[0].resolved) {
      resolvedConflicts.value.add(conflict.id)
      emit('resolved', conflict, 'merged')
      console.log(`Auto-merged conflict ${conflict.id}`)
    } else {
      alert(t('autoMergeFailed'))
    }
  } catch (error) {
    console.error('Failed to auto-merge:', error)
    alert(t('autoMergeFailed'))
  }
}

async function autoResolveAll() {
  try {
    const unresolvedConflicts = props.conflicts.filter(c => !resolvedConflicts.value.has(c.id))

    const results = await conflictResolver.autoResolve(unresolvedConflicts, 'newest-wins')
    for (const result of results) {
      resolvedConflicts.value.add(result.id)
      const resolution = result.resolution === 'manual' ? 'merged' : result.resolution || 'merged'
      emit('resolved', result, resolution)
    }

    console.log(`Auto-resolved ${results.length} conflicts`)
  } catch (error) {
    console.error('Failed to auto-resolve all:', error)
    alert(t('batchResolveFailed'))
  }
}
</script>

<template>
  <div v-if="conflicts.length > 0" class="conflict-resolver">
    <div class="conflict-header">
      <h3>{{ t('syncConflict') }}</h3>
      <p>{{ t('syncConflictDescription', conflicts.length.toString()) }}</p>
    </div>

    <div class="conflict-list">
      <div v-for="conflict in conflicts" :key="conflict.id" class="conflict-item">
        <div class="conflict-info">
          <div class="conflict-title">
            <span class="entity-type">{{ getEntityTypeLabel(conflict.entityType) }}</span>
            <span class="entity-id">{{ conflict.entityId }}</span>
          </div>
          <div class="conflict-timestamp">
            {{ formatTimestamp(conflict.timestamp) }}
          </div>
        </div>

        <div class="conflict-comparison">
          <!-- 本地版本 -->
          <div class="version-panel local">
            <div class="version-header">
              <h4>{{ t('localVersion') }}</h4>
              <span class="timestamp">
                {{ formatTimestamp(extractTimestamp(conflict.localChange)) }}
              </span>
            </div>
            <div class="version-content">
              <template v-if="extractChanges(conflict.localChange)">
                <div
                  v-for="change in extractChanges(conflict.localChange)"
                  :key="change.field"
                  class="change-item"
                >
                  <div class="field-name">{{ change.field }}</div>
                  <div class="field-value">
                    <span class="value-label">{{ t('oldValue') }}</span>
                    <code>{{ formatValue(change.oldValue) }}</code>
                  </div>
                  <div class="field-value new">
                    <span class="value-label">{{ t('newValue') }}</span>
                    <code>{{ formatValue(change.newValue) }}</code>
                  </div>
                </div>
              </template>
              <div v-else class="no-changes">{{ t('noChangeDetails') }}</div>
            </div>
          </div>

          <!-- 远程版本 -->
          <div class="version-panel remote">
            <div class="version-header">
              <h4>{{ t('remoteVersion') }}</h4>
              <span class="timestamp">
                {{ formatTimestamp(extractTimestamp(conflict.remoteChange)) }}
              </span>
            </div>
            <div class="version-content">
              <template v-if="extractChanges(conflict.remoteChange)">
                <div
                  v-for="change in extractChanges(conflict.remoteChange)"
                  :key="change.field"
                  class="change-item"
                >
                  <div class="field-name">{{ change.field }}</div>
                  <div class="field-value">
                    <span class="value-label">{{ t('oldValue') }}：</span>
                    <code>{{ formatValue(change.oldValue) }}</code>
                  </div>
                  <div class="field-value new">
                    <span class="value-label">{{ t('newValue') }}：</span>
                    <code>{{ formatValue(change.newValue) }}</code>
                  </div>
                </div>
              </template>
              <div v-else class="no-changes">{{ t('noChangeDetails') }}</div>
            </div>
          </div>
        </div>

        <div class="conflict-actions">
          <button class="action-btn local-btn" @click="resolveConflict(conflict, 'local')">
            {{ t('useLocalVersion') }}
          </button>
          <button class="action-btn remote-btn" @click="resolveConflict(conflict, 'remote')">
            {{ t('useRemoteVersion') }}
          </button>
          <button class="action-btn merge-btn" @click="tryAutoMerge(conflict)">
            {{ t('tryAutoMerge') }}
          </button>
        </div>
      </div>
    </div>

    <div class="conflict-footer">
      <button class="footer-btn cancel" @click="$emit('cancel')">{{ t('cancelSync') }}</button>
      <button class="footer-btn auto-resolve" @click="autoResolveAll">
        {{ t('autoResolveAll') }}
      </button>
      <button class="footer-btn continue" :disabled="!allResolved" @click="$emit('continue')">
        {{ t('continueSync') }}
      </button>
    </div>
  </div>
</template>

<style scoped src="./ConflictResolver.css" />
