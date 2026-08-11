import { defineComponent, onMounted, ref } from 'vue'
import { InputNumber, message } from 'ant-design-vue'
import { ThunderboltOutlined } from '@ant-design/icons-vue'

import { getPageFetchMaxConcurrency, setPageFetchMaxConcurrency } from '../../utils'

const STORAGE_KEY = 'discourse-browser:page-fetch-concurrency'

export default defineComponent({
  name: 'SettingsLocalSection',
  setup() {
    const concurrency = ref(getPageFetchMaxConcurrency())
    const saving = ref(false)

    onMounted(() => {
      // 进入时从本地存储恢复
      try {
        const stored = window.localStorage.getItem(STORAGE_KEY)
        const parsed = stored ? Number(stored) : NaN
        if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 8) {
          concurrency.value = Math.floor(parsed)
          setPageFetchMaxConcurrency(concurrency.value)
        }
      } catch {
        // 存储不可用时使用默认值
      }
    })

    const handleSave = () => {
      const safeValue = Math.min(8, Math.max(1, Math.floor(Number(concurrency.value) || 2)))
      concurrency.value = safeValue
      setPageFetchMaxConcurrency(safeValue)
      try {
        window.localStorage.setItem(STORAGE_KEY, String(safeValue))
      } catch {
        // 忽略存储失败，设置仍然在本次会话生效
      }
      saving.value = true
      window.setTimeout(() => {
        saving.value = false
      }, 600)
      message.success(`页面抓取并发数已调整为 ${safeValue}`)
    }

    return () => (
      <div class="user-settings-section">
        <div class="user-settings-section__title">浏览器本地</div>
        <div class="user-settings-grid">
          <div class="user-settings-label">单一论坛页面抓取并发数</div>
          <div class="user-settings-local-control">
            <InputNumber
              min={1}
              max={8}
              precision={0}
              value={concurrency.value}
              onUpdate:value={(value: number | string | null) => {
                const parsed = Number(value)
                if (Number.isFinite(parsed)) {
                  concurrency.value = Math.floor(parsed)
                }
              }}
            />
            <button type="button" class="user-settings-local-save" onClick={handleSave}>
              <ThunderboltOutlined /> {saving.value ? '已应用' : '应用'}
            </button>
          </div>
          <div class="user-settings-local-hint">
            同时发起的页面请求数（1-8）。数值越大加载越快，但会增加站点服务器压力；默认 2。
          </div>
        </div>
      </div>
    )
  }
})
