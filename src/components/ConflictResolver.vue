<script setup lang="ts">
import { ref, computed } from 'vue'

import type { ConflictInfo, EntityType, DeltaRecord } from '@/types/sync'
import { conflictResolver } from '@/services/conflict-resolver'
import { useI18n } from '@/utils/i18n'

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

/**
 * Type guard to check if a value is a DeltaRecord
 */
function isDeltaRecord(value: unknown): value is DeltaRecord {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'timestamp' in value &&
    'version' in value &&
    'operation' in value &&
    'changes' in value &&
    Array.isArray((value as DeltaRecord).changes)
  )
}

/**
 * Extract timestamp from a DeltaRecord or data object
 */
function extractTimestamp(value: DeltaRecord | Record<string, unknown>): number {
  if (isDeltaRecord(value)) {
    return value.timestamp
  }
  const timestamp = (value as { timestamp?: number }).timestamp
  return typeof timestamp === 'number' ? timestamp : Date.now()
}

/**
 * Extract changes from a DeltaRecord or return undefined
 */
function extractChanges(value: DeltaRecord | Record<string, unknown>) {
  if (isDeltaRecord(value)) {
    return value.changes
  }
  return undefined
}

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
                    <span class="value-label">旧值：</span>
                    <code>{{ formatValue(change.oldValue) }}</code>
                  </div>
                  <div class="field-value new">
                    <span class="value-label">新值：</span>
                    <code>{{ formatValue(change.newValue) }}</code>
                  </div>
                </div>
              </template>
              <div v-else class="no-changes">无可用的变更详情</div>
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

<style scoped>
.conflict-resolver {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  z-index: 9999;
  display: flex;
  flex-direction: column;
  padding: 20px;
  overflow-y: auto;
}

.conflict-header {
  background: #fff;
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.conflict-header h3 {
  margin: 0 0 10px 0;
  font-size: 24px;
  color: #ff6b6b;
}

.conflict-header p {
  margin: 0;
  color: #666;
}

.conflict-list {
  flex: 1;
  overflow-y: auto;
}

.conflict-item {
  background: #fff;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.conflict-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 15px;
  border-bottom: 2px solid #f0f0f0;
}

.conflict-title {
  display: flex;
  gap: 10px;
  align-items: center;
}

.entity-type {
  background: #4caf50;
  color: white;
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 500;
}

.entity-id {
  font-family: monospace;
  color: #666;
}

.conflict-timestamp {
  color: #999;
  font-size: 14px;
}

.conflict-comparison {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin-bottom: 20px;
}

.version-panel {
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  overflow: hidden;
}

.version-panel.local {
  border-color: #2196f3;
}

.version-panel.remote {
  border-color: #ff9800;
}

.version-header {
  background: #f5f5f5;
  padding: 12px 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.version-header h4 {
  margin: 0;
  font-size: 16px;
}

.timestamp {
  font-size: 12px;
  color: #999;
}

.version-content {
  padding: 16px;
}

.change-item {
  margin-bottom: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid #f0f0f0;
}

.change-item:last-child {
  margin-bottom: 0;
  padding-bottom: 0;
  border-bottom: none;
}

.field-name {
  font-weight: 600;
  color: #333;
  margin-bottom: 8px;
}

.field-value {
  margin-bottom: 4px;
  display: flex;
  gap: 8px;
  align-items: flex-start;
}

.field-value.new code {
  background: #e8f5e9;
  border-left: 3px solid #4caf50;
}

.value-label {
  flex-shrink: 0;
  color: #666;
  font-size: 12px;
  padding-top: 4px;
}

.field-value code {
  flex: 1;
  background: #f5f5f5;
  padding: 8px;
  border-radius: 4px;
  font-size: 13px;
  white-space: pre-wrap;
  word-break: break-all;
}

.conflict-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}

.action-btn {
  flex: 1;
  padding: 12px 24px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.local-btn {
  background: #2196f3;
  color: white;
}

.local-btn:hover {
  background: #1976d2;
}

.remote-btn {
  background: #ff9800;
  color: white;
}

.remote-btn:hover {
  background: #f57c00;
}

.merge-btn {
  background: #4caf50;
  color: white;
}

.merge-btn:hover {
  background: #388e3c;
}

.conflict-footer {
  background: #fff;
  padding: 20px;
  border-radius: 8px;
  margin-top: 20px;
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.footer-btn {
  padding: 12px 32px;
  border: none;
  border-radius: 6px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.footer-btn.cancel {
  background: #f5f5f5;
  color: #666;
}

.footer-btn.cancel:hover {
  background: #e0e0e0;
}

.footer-btn.auto-resolve {
  background: #9c27b0;
  color: white;
}

.footer-btn.auto-resolve:hover {
  background: #7b1fa2;
}

.footer-btn.continue {
  background: #4caf50;
  color: white;
}

.footer-btn.continue:hover:not(:disabled) {
  background: #388e3c;
}

.footer-btn.continue:disabled {
  background: #ccc;
  cursor: not-allowed;
}
</style>
