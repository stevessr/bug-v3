<script setup lang="ts">
import { ref, computed } from 'vue'

import { importBilibiliToStore } from '../utils/importUtils'

type BiliEmote = { text?: string; url?: string; meta?: Record<string, unknown> }
type BiliPackage = { id?: string | number; text?: string; label?: string; emote?: BiliEmote[] }

const fileInput = ref<HTMLInputElement | null>(null)
const isImporting = ref(false)
const importStatus = ref('')
const importResults = ref<{ success: boolean; message: string; details?: string } | null>(null)

// Search / dynamic index UI
const query = ref('')
// default to the emitted asset path
const indexUrl = ref('/bilibili_emoji_index.json')
const packages = ref<BiliPackage[]>([])
const selected = ref<Record<string, boolean>>({})
// packages that are currently displayed after clicking '搜索'
const displayPackages = ref<BiliPackage[]>([])

const filteredPackages = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return packages.value
  return packages.value.filter(p => {
    const name = String(p.text || p.label || p.id || '').toLowerCase()
    if (name.includes(q)) return true
    if (Array.isArray(p.emote)) {
      for (const e of p.emote) {
        const alias = String((e?.meta?.alias as string) || e?.text || '').toLowerCase()
        if (alias.includes(q)) return true
      }
    }
    return false
  })
})

const toggleSelect = (pkgId: string) => {
  selected.value[pkgId] = !selected.value[pkgId]
}

const selectedPackages = (): BiliPackage[] => {
  const ids = Object.keys(selected.value).filter(k => selected.value[k])
  return packages.value.filter(p => ids.includes(String(p.id)))
}

const applySearch = () => {
  // snapshot filtered result to displayPackages; user must click 搜索 to update
  displayPackages.value = filteredPackages.value
}

// --- ID-based fetch by calling Bilibili API ---
const fetchIdStart = ref<string>('')
// 默认连续空响应阈值。脚本示例使用 5000，这里默认 50，用户可修改。
const consecutiveNullsToStop = ref<string>('50')
const isFetchingById = ref(false)
const fetchStatus = ref('')
const fetchProgress = ref<{ id: number; msg: string }[]>([])
const importToStoreOnFetch = ref(false)

async function fetchIdOnce(idNum: number) {
  const url = `https://api.bilibili.com/x/emote/package?ids=${idNum}&business=reply`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`请求失败: ${res.status}`)
  try {
    return await res.json()
  } catch (err) {
    throw new Error('JSON 解析失败')
  }
}

async function fetchByIdLoop() {
  const start = Number(fetchIdStart.value)
  const stopThreshold = Number(consecutiveNullsToStop.value) || 50
  if (!Number.isFinite(start) || start <= 0) {
    fetchStatus.value = '请输入合法的起始 ID（正整数）'
    return
  }

  isFetchingById.value = true
  fetchStatus.value = `开始从 ID ${start} 连续拉取，直到连续 ${stopThreshold} 次空响应为止`
  fetchProgress.value = []

  let consecutiveNulls = 0
  let idCursor = start

  try {
    while (consecutiveNulls < stopThreshold && isFetchingById.value) {
      try {
        const json = await fetchIdOnce(idCursor)
        if (json && json.data && json.data.packages) {
          // 将返回的包追加到 packages 中，方便用户查看/选择
          const pkgs = Array.isArray(json.data.packages) ? json.data.packages : []
          if (pkgs.length > 0) {
            for (const p of pkgs) packages.value.push(p as BiliPackage)
            fetchProgress.value.push({ id: idCursor, msg: `获得 ${pkgs.length} 个包` })
            consecutiveNulls = 0
            // 如果用户选择自动导入到 store，则直接导入当前包集合
            if (importToStoreOnFetch.value) {
              try {
                // 调用现有导入方法，传入 data.packages 结构
                // importBilibiliToStore 接受 { data: { packages: [...] } }
                await importBilibiliToStore({ data: { packages: pkgs } })
                fetchProgress.value.push({ id: idCursor, msg: '已导入到 Store' })
              } catch (impErr) {
                fetchProgress.value.push({
                  id: idCursor,
                  msg: `导入失败: ${impErr instanceof Error ? impErr.message : String(impErr)}`
                })
              }
            }
          } else {
            for (const p of pkgs) packages.value.push(p as BiliPackage)
            fetchProgress.value.push({ id: idCursor, msg: 'packages 为空' })
          }
        } else {
          consecutiveNulls++
          fetchProgress.value.push({ id: idCursor, msg: '无有效 packages（空响应）' })
        }
      } catch (err) {
        consecutiveNulls++
        fetchProgress.value.push({
          id: idCursor,
          msg: `请求/解析失败: ${err instanceof Error ? err.message : String(err)}`
        })
        // 小幅退避
        await new Promise(r => setTimeout(r, 300))
      }
      idCursor++
      // 小间隔，避免短时间内触发速率限制
      await new Promise(r => setTimeout(r, 100))
    }

    fetchStatus.value = `停止：已连续 ${consecutiveNulls} 个空响应，最后检查 ID ${idCursor - 1}`
  } finally {
    isFetchingById.value = false
  }
}

const stopFetchingById = () => {
  isFetchingById.value = false
  fetchStatus.value = '用户已停止拉取'
}

// 单次拉取（由 UI 调用）
const fetchSingleId = async () => {
  const start = Number(fetchIdStart.value)
  if (!Number.isFinite(start) || start <= 0) {
    fetchStatus.value = '请输入合法的 ID（正整数）'
    return
  }
  fetchStatus.value = `正在获取 ID ${start}...`
  try {
    const json = await fetchIdOnce(start)
    if (
      json &&
      json.data &&
      json.data.packages &&
      Array.isArray(json.data.packages) &&
      json.data.packages.length > 0
    ) {
      const pkgs = json.data.packages
      for (const p of pkgs) packages.value.push(p as BiliPackage)
      fetchStatus.value = `ID ${start} 获取到 ${pkgs.length} 个包`
      if (importToStoreOnFetch.value) {
        await importBilibiliToStore({ data: { packages: pkgs } })
        fetchStatus.value += '，已导入到 Store'
      }
    } else {
      fetchStatus.value = `ID ${start} 无有效 packages`
    }
  } catch (err) {
    fetchStatus.value = `ID ${start} 请求失败: ${err instanceof Error ? err.message : String(err)}`
  }
}
function normalizeBilibiliIndex(json: unknown): BiliPackage[] | null {
  if (!json) return null

  // Case 1: { packages: [...] }
  if (typeof json === 'object' && json !== null) {
    const obj = json as Record<string, unknown>
    const pk = obj['packages']
    if (Array.isArray(pk)) return pk as BiliPackage[]
  }

  // Case 2: array of packages, or array of maps
  if (Array.isArray(json)) {
    const out: BiliPackage[] = []
    for (const item of json) {
      if (!item) continue

      // looks like package
      if (typeof item === 'object' && Object.prototype.hasOwnProperty.call(item, 'emote')) {
        out.push(item as BiliPackage)
        continue
      }

      // item could be a map like { id: { name: url } }
      if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
        for (const [k, v] of Object.entries(item as Record<string, unknown>)) {
          if (v && typeof v === 'object') {
            const emotes: BiliEmote[] = []
            for (const [name, url] of Object.entries(v as Record<string, unknown>)) {
              emotes.push({ text: name, url: String(url) })
            }
            out.push({ id: k, text: k, emote: emotes })
          }
        }
        continue
      }
    }
    if (out.length > 0) return out
  }

  // Case 3: object mapping id -> { name: url }
  if (typeof json === 'object' && json !== null && !Array.isArray(json)) {
    const out: BiliPackage[] = []
    for (const [k, v] of Object.entries(json as Record<string, unknown>)) {
      if (v && typeof v === 'object') {
        const emotes: BiliEmote[] = []
        for (const [name, url] of Object.entries(v as Record<string, unknown>)) {
          emotes.push({ text: name, url: String(url) })
        }
        out.push({ id: k, text: k, emote: emotes })
      }
    }
    if (out.length > 0) return out
  }

  return null
}

function safeParseJson(text: string): unknown {
  if (!text) return null
  let t = text.trim()
  // strip BOM
  t = t.replace(/^\uFEFF/, '')
  // remove JS-style block comments
  t = t.replace(/\/\*[\s\S]*?\*\//g, '')
  // remove line comments (//) but avoid http://
  t = t.replace(/(^|[^: "])(\/\/).*$/gm, '$1')
  // remove trailing commas before ] or }
  t = t.replace(/,\s*(]|})/g, '$1')

  // try direct parse
  try {
    return JSON.parse(t)
  } catch (e) {
    // try to extract first JSON object or array
    const firstObj = t.indexOf('{')
    const lastObj = t.lastIndexOf('}')
    const firstArr = t.indexOf('[')
    const lastArr = t.lastIndexOf(']')
    if (firstObj !== -1 && lastObj !== -1 && lastObj > firstObj) {
      const sub = t.slice(firstObj, lastObj + 1)
      try {
        return JSON.parse(sub)
      } catch (err) {
        // fallthrough
      }
    }
    if (firstArr !== -1 && lastArr !== -1 && lastArr > firstArr) {
      const sub = t.slice(firstArr, lastArr + 1)
      try {
        return JSON.parse(sub)
      } catch (err) {
        // fallthrough
      }
    }
  }
  throw new Error('无法解析 JSON')
}

const loadIndexFromUrl = async (url?: string) => {
  const u = (url || indexUrl.value || '').trim()
  if (!u) {
    importResults.value = { success: false, message: '请输入索引 URL 后再加载' }
    return
  }
  isImporting.value = true
  importStatus.value = '正在加载索引...'
  importResults.value = null
  try {
    const res = await fetch(u)
    if (!res.ok) throw new Error(`请求失败: ${res.status}`)
    let json: unknown
    const txt = await res.text()
    try {
      json = JSON.parse(txt)
    } catch (parseErr) {
      json = safeParseJson(txt)
    }
    const normalized = normalizeBilibiliIndex(json)
    if (!normalized || !Array.isArray(normalized)) {
      throw new Error('无效的索引格式')
    }
    packages.value = normalized
    importResults.value = { success: true, message: `加载到 ${packages.value.length} 个包` }
  } catch (e) {
    importResults.value = {
      success: false,
      message: '加载索引失败',
      details: e instanceof Error ? e.message : String(e)
    }
  } finally {
    isImporting.value = false
  }
}

const openFile = () => fileInput.value?.click()

const handleFile = async (e: Event) => {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return
  isImporting.value = true
  importStatus.value = '正在读取文件...'
  importResults.value = null
  try {
    const text = await file.text()
    let data: unknown
    try {
      data = JSON.parse(text)
    } catch (parseErr) {
      data = safeParseJson(text)
    }
    // If this is a full bilibili API response (has data.packages), import directly
    const asObj = data as Record<string, unknown>
    if (asObj.data && typeof asObj.data === 'object') {
      const inner = asObj.data as Record<string, unknown>
      if (Array.isArray(inner.packages)) {
        importStatus.value = '正在导入 bilibili 数据...'
        await importBilibiliToStore(data)
        importResults.value = {
          success: true,
          message: '导入成功'
        }
        return
      }
    }

    // Otherwise try to normalize to packages and load into UI for selection
    const normalized = normalizeBilibiliIndex(data)
    if (!normalized || !Array.isArray(normalized)) throw new Error('无效的索引格式')
    packages.value = normalized
    importResults.value = { success: true, message: `加载到 ${packages.value.length} 个包` }
  } catch (err) {
    importResults.value = {
      success: false,
      message: '导入失败',
      details: err instanceof Error ? err.message : String(err)
    }
  } finally {
    isImporting.value = false
  }
}

const importSelectedFromIndex = async () => {
  const pkgs = selectedPackages()
  if (!pkgs || pkgs.length === 0) {
    importResults.value = { success: false, message: '请先选择要导入的包' }
    return
  }
  importStatus.value = '正在导入选中包...'
  importResults.value = null
  isImporting.value = true
  try {
    await importBilibiliToStore({ data: { packages: pkgs } })
    importResults.value = {
      success: true,
      message: `已导入 ${pkgs.length} 个包`
    }
  } catch (e) {
    importResults.value = {
      success: false,
      message: '导入失败',
      details: e instanceof Error ? e.message : String(e)
    }
  } finally {
    isImporting.value = false
  }
}
</script>

<template>
  <div class="space-y-8">
    <div class="bg-white shadow rounded-lg border dark:border-gray-700 dark:bg-gray-800">
      <div class="px-6 py-4 border-b border-gray-200">
        <h3 class="text-lg font-medium text-gray-900 dark:text-white">Bilibili 表情导入</h3>
        <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
          上传 bilibili 风格的 JSON 响应（包含 data.packages），导入为表情分组
        </p>
      </div>
      <div class="p-6 space-y-4">
        <div class="space-y-4">
          <div class="flex items-center space-x-3">
            <AButton type="primary" @click="openFile">选择 Bilibili JSON 文件</AButton>
            <input ref="fileInput" type="file" accept=".json" class="hidden" @change="handleFile" />
            <span v-if="isImporting" class="text-sm text-blue-600">{{ importStatus }}</span>
          </div>

          <div class="flex items-center space-x-3">
              <AInput v-model:value="indexUrl" placeholder="请输入索引 JSON 的 URL" class="dark:bg-black dark:text-white" />
            <AButton @click="() => loadIndexFromUrl()">加载索引</AButton>
          </div>

          <div class="flex items-center space-x-3">
            <AInput v-model:value="query" placeholder="按包名或别名搜索" />
            <AButton type="primary" @click="applySearch">搜索</AButton>
            <AButton type="default" @click="query = ''">清空</AButton>
            <AButton type="primary" @click="importSelectedFromIndex">导入选中包</AButton>
          </div>

          <!-- ID 拉取区 -->
          <div class="mt-4 p-3 border rounded bg-gray-50 dark:bg-gray-700">
            <div class="flex items-center space-x-3">
              <AInput v-model:value="fetchIdStart" placeholder="起始 ID(例如 10600)" class="dark:bg-black dark:text-white" />
                <AInput
                  v-model:value="consecutiveNullsToStop"
                  placeholder="连续空响应阈值(默认 50)"
                  class="dark:bg-black dark:text-white"
                />
              <label class="flex items-center space-x-2">
                <input type="checkbox" v-model="importToStoreOnFetch" />
                <span class="text-sm">自动导入到 Store</span>
              </label>
            </div>
            <div class="mt-3 flex items-center space-x-3">
              <AButton type="primary" @click="fetchSingleId">单次获取</AButton>
              <AButton type="primary" @click="fetchByIdLoop" :disabled="isFetchingById">
                开始连续拉取
              </AButton>
              <AButton type="default" @click="stopFetchingById" :disabled="!isFetchingById">
                停止
              </AButton>
            </div>
            <div class="mt-3 text-sm text-gray-700">
              <div>{{ fetchStatus }}</div>
              <div
                v-if="fetchProgress && fetchProgress.length"
                class="mt-2 max-h-40 overflow-auto text-xs"
              >
                <div v-for="p in fetchProgress" :key="p.id">ID {{ p.id }} — {{ p.msg }}</div>
              </div>
            </div>
          </div>

          <div class="mt-3">
            <div v-if="packages.length === 0" class="text-sm text-gray-500">尚未加载任何索引包</div>
            <div v-else>
              <div v-if="displayPackages.length === 0" class="text-sm text-gray-500">
                请输入关键词并点击“搜索”以显示结果
              </div>
              <div v-else class="grid gap-2">
                <ACard v-for="pkg in displayPackages" :key="pkg.id" class="p-2">
                  <div class="flex items-center justify-between">
                    <div class="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        :checked="selected[String(pkg.id)]"
                        @change="() => toggleSelect(String(pkg.id))"
                        class="dark:bg-black dark:text-white"
                        />
                      <div>
                        <div class="font-medium">{{ pkg.text || pkg.label || pkg.id }}</div>
                        <div class="text-xs text-gray-500">
                          {{ (pkg.emote && pkg.emote.length) || 0 }} 个表情
                        </div>
                      </div>
                    </div>
                    <div>
                      <img
                        v-if="pkg.emote && pkg.emote[0] && pkg.emote[0].url"
                        :src="pkg.emote[0].url"
                        class="h-8 w-8 object-contain"
                      />
                    </div>
                  </div>
                </ACard>
              </div>
            </div>
          </div>
        </div>

        <div
          v-if="importResults"
          class="p-3 rounded"
          :class="importResults.success ? 'bg-green-50' : 'bg-red-50'"
        >
          <p
            class="text-sm font-medium"
            :class="importResults.success ? 'text-green-700' : 'text-red-700'"
          >
            {{ importResults.message }}
          </p>
          <p v-if="importResults.details" class="text-sm mt-1">{{ importResults.details }}</p>
        </div>
      </div>
    </div>
  </div>
</template>
