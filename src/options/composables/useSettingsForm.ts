import { ref, computed, watch, isRef, onMounted, onBeforeUnmount, type Ref } from 'vue'

import type { AppSettings } from '../../types/type'

/**
 * 配置字段定义
 */
export interface FieldConfig<K extends keyof AppSettings = keyof AppSettings> {
  key: K
  default: AppSettings[K]
}

/**
 * 表单选项
 */
export interface UseSettingsFormOptions {
  /** 保存成功的提示消息 */
  successMessage?: string
  /** 保存失败的提示消息前缀 */
  errorMessagePrefix?: string
  /** 自定义验证函数 */
  validate?: () => { valid: boolean; error?: string }
}

/**
 * 通用设置表单 Composable
 *
 * @param settings - 应用设置对象（可以是 ref 或普通对象）
 * @param fields - 表单字段配置数组
 * @param emit - Vue emit 函数
 * @param options - 可选配置
 *
 * @example
 * ```ts
 * const { localValues, hasChanges, isValid, handleSave, handleReset } = useSettingsForm(
 *   props.settings,
 *   [
 *     { key: 'geminiApiKey', default: '' },
 *     { key: 'geminiApiUrl', default: '' }
 *   ],
 *   emit,
 *   {
 *     successMessage: 'AI 配置已保存',
 *     validate: () => ({ valid: true })
 *   }
 * )
 * ```
 */
export function useSettingsForm<K extends keyof AppSettings>(
  settings: AppSettings | Ref<AppSettings>,
  fields: FieldConfig<K>[],
  emit: (event: string, ...args: any[]) => void,
  options: UseSettingsFormOptions = {}
) {
  const { successMessage = '配置已保存', errorMessagePrefix = '保存失败：', validate } = options

  // Helper function to get setting value with type safety
  function getSetting<T extends keyof AppSettings>(
    key: T,
    defaultValue: AppSettings[T]
  ): AppSettings[T] {
    try {
      if (isRef(settings)) {
        return (settings.value && settings.value[key]) ?? defaultValue
      }
      return (settings && (settings as AppSettings)[key]) ?? defaultValue
    } catch {
      return defaultValue
    }
  }

  // Initialize local values for each field
  const localValues = {} as Record<K, Ref<AppSettings[K]>>
  const originalValues = ref({} as Record<K, AppSettings[K]>)

  // Initialize values
  fields.forEach(({ key, default: defaultValue }) => {
    const value = getSetting(key, defaultValue)
    localValues[key] = ref(value) as Ref<AppSettings[K]>
    originalValues.value[key] = value
  })

  // Watch for external changes
  fields.forEach(({ key, default: defaultValue }) => {
    watch(
      () => getSetting(key, defaultValue),
      val => {
        originalValues.value[key] = val
        // Only update local value if no unsaved changes
        if (!hasChanges.value) {
          localValues[key].value = val
        }
      }
    )
  })

  // Detect if form has been modified
  const hasChanges = computed(() => {
    return fields.some(({ key }) => {
      return localValues[key].value !== originalValues.value[key]
    })
  })

  // Validation
  const isValid = computed(() => {
    if (validate) {
      return validate().valid
    }
    return true
  })

  // UI state
  const isSaving = ref(false)

  // Save handler
  const handleSave = async () => {
    if (validate) {
      const validation = validate()
      if (!validation.valid) {
        message.error(validation.error || '配置验证失败')
        return
      }
    }

    isSaving.value = true
    try {
      // Emit update events for all fields
      fields.forEach(({ key }) => {
        emit(`update:${String(key)}`, localValues[key].value)
      })

      // Update original values after successful save
      fields.forEach(({ key }) => {
        originalValues.value[key] = localValues[key].value
      })

      message.success(successMessage)
    } catch (error) {
      console.error('Failed to save settings:', error)
      message.error(errorMessagePrefix + (error as Error).message)
    } finally {
      isSaving.value = false
    }
  }

  // Reset handler
  const handleReset = () => {
    fields.forEach(({ key }) => {
      localValues[key].value = originalValues.value[key]
    })
  }

  // Keyboard shortcut handler
  const handleKeyDown = (e: KeyboardEvent) => {
    // Ctrl/Cmd + S to save
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault()
      if (hasChanges.value && isValid.value) {
        handleSave()
      }
    }
  }

  // Beforeunload handler to warn about unsaved changes
  const handleBeforeUnload = (e: BeforeUnloadEvent) => {
    if (hasChanges.value) {
      e.preventDefault()
      // Modern browsers require setting returnValue
      e.returnValue = '您有未保存的修改，确定要离开吗？'
      return '您有未保存的修改，确定要离开吗？'
    }
  }

  // Add keyboard event listener
  onMounted(() => {
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('beforeunload', handleBeforeUnload)
  })

  // Remove keyboard event listener
  onBeforeUnmount(() => {
    window.removeEventListener('keydown', handleKeyDown)
    window.removeEventListener('beforeunload', handleBeforeUnload)
  })

  return {
    /** 本地表单值 */
    localValues,
    /** 原始值（用于重置） */
    originalValues,
    /** 是否有未保存的修改 */
    hasChanges,
    /** 表单是否有效 */
    isValid,
    /** 是否正在保存 */
    isSaving,
    /** 保存处理函数 */
    handleSave,
    /** 重置处理函数 */
    handleReset
  }
}
