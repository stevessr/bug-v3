import { ref, watch } from 'vue'
import { message } from 'ant-design-vue'

import type { ImgBedUploadChannel } from '../types'
import storage from '../../data/update/storage'

const IMG_BED_KEY = 'openrouter-imgbed-config'

type ImgBedFormat = 'default' | 'full'
type ImgUploadNameType = 'default' | 'index' | 'origin' | 'short'

interface imgbedConfig {
  useImgBed: boolean
  imgBedEndpoint: string
  imgBedAuthCode: string
  imgBedUploadChannel: ImgBedUploadChannel
  imgBedServerCompress: boolean
  imgBedAutoRetry: boolean
  imgBedUploadNameType: ImgUploadNameType
  imgBedReturnFormat: ImgBedFormat
  imgBedUploadFolder: string
}

function createImgBed() {
  // Modal control
  const showImgBedModal = ref(false)

  // Configuration state
  // Provide defaults via a factory so we can merge/restore easily
  const createDefaultConfig = (): imgbedConfig => ({
    useImgBed: false,
    imgBedEndpoint: '',
    imgBedAuthCode: '',
    imgBedUploadChannel: 'telegram',
    imgBedServerCompress: true,
    imgBedAutoRetry: true,
    imgBedUploadNameType: 'default',
    imgBedReturnFormat: 'default',
    imgBedUploadFolder: '',
  })

  const defaults = createDefaultConfig()

  const useImgBed = ref(defaults.useImgBed)
  const imgBedEndpoint = ref(defaults.imgBedEndpoint)
  const imgBedAuthCode = ref(defaults.imgBedAuthCode)
  const imgBedUploadChannel = ref(defaults.imgBedUploadChannel)
  const imgBedServerCompress = ref(defaults.imgBedServerCompress)
  const imgBedAutoRetry = ref(defaults.imgBedAutoRetry)
  const imgBedUploadNameType = ref(defaults.imgBedUploadNameType)
  const imgBedReturnFormat = ref(defaults.imgBedReturnFormat)
  const imgBedUploadFolder = ref(defaults.imgBedUploadFolder)

  // Apply a partial config onto reactive refs with type checks
  const setImgBedConfig = (cfg: Partial<imgbedConfig>) => {
    if (!cfg) return
    if (typeof cfg.useImgBed === 'boolean') useImgBed.value = cfg.useImgBed
    if (typeof cfg.imgBedEndpoint === 'string') imgBedEndpoint.value = cfg.imgBedEndpoint
    if (typeof cfg.imgBedAuthCode === 'string') imgBedAuthCode.value = cfg.imgBedAuthCode
    if (typeof cfg.imgBedUploadChannel === 'string')
      imgBedUploadChannel.value = cfg.imgBedUploadChannel
    if (typeof cfg.imgBedServerCompress === 'boolean')
      imgBedServerCompress.value = cfg.imgBedServerCompress
    if (typeof cfg.imgBedAutoRetry === 'boolean') imgBedAutoRetry.value = cfg.imgBedAutoRetry
    if (typeof cfg.imgBedUploadNameType === 'string')
      imgBedUploadNameType.value = cfg.imgBedUploadNameType
    if (typeof cfg.imgBedReturnFormat === 'string')
      imgBedReturnFormat.value = cfg.imgBedReturnFormat
    if (typeof cfg.imgBedUploadFolder === 'string')
      imgBedUploadFolder.value = cfg.imgBedUploadFolder
  }

  const resetToDefaults = () => setImgBedConfig(defaults)

  // low-level write (no UI side-effects)
  const writeImgBedConfig = () => {
    try {
      const cfg: imgbedConfig = {
        useImgBed: useImgBed.value,
        imgBedEndpoint: imgBedEndpoint.value,
        imgBedAuthCode: imgBedAuthCode.value,
        imgBedUploadChannel: imgBedUploadChannel.value,
        imgBedServerCompress: imgBedServerCompress.value,
        imgBedAutoRetry: imgBedAutoRetry.value,
        imgBedUploadNameType: imgBedUploadNameType.value,
        imgBedReturnFormat: imgBedReturnFormat.value,
        imgBedUploadFolder: imgBedUploadFolder.value,
      }
      storage.setItem(IMG_BED_KEY, cfg)
    } catch (e) {
      console.error('保存 ImgBed 配置失败', e)
      message.error('保存 ImgBed 配置失败')
    }
  }

  const loadImgBedConfig = () => {
    try {
      const cfg = storage.getItem(IMG_BED_KEY)
      if (cfg) {
        // merge with defaults by applying only valid values
        setImgBedConfig(cfg)
      }
    } catch (e) {
      console.error('加载 ImgBed 配置失败', e)
    }
  }

  const handleSaveAndCloseImgBedModal = () => {
    writeImgBedConfig()
    showImgBedModal.value = false
    message.success('ImgBed 配置已保存')
  }

  // Auto-save when any config changes
  watch(
    [
      useImgBed,
      imgBedEndpoint,
      imgBedAuthCode,
      imgBedUploadChannel,
      imgBedServerCompress,
      imgBedAutoRetry,
      imgBedUploadNameType,
      imgBedReturnFormat,
      imgBedUploadFolder,
    ],
    () => {
      // auto-save to storage
      writeImgBedConfig()
    },
  )

  return {
    showImgBedModal,
    useImgBed,
    imgBedEndpoint,
    imgBedAuthCode,
    imgBedUploadChannel,
    imgBedServerCompress,
    imgBedAutoRetry,
    imgBedUploadNameType,
    imgBedReturnFormat,
    imgBedUploadFolder,
    loadImgBedConfig,
    saveImgBedConfig: handleSaveAndCloseImgBedModal, // keep public API: save and close
    writeImgBedConfig,
    setImgBedConfig,
    resetToDefaults,
    closeImgBedModal: () => {
      showImgBedModal.value = false
    },
  }
}

// export a singleton so multiple callers share the same reactive refs
let _imgBedInstance: ReturnType<typeof createImgBed> | null = null
export function useImgBed() {
  if (!_imgBedInstance) _imgBedInstance = createImgBed()
  return _imgBedInstance
}
