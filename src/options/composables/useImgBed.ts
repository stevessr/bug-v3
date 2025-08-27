import { ref, watch } from 'vue'
import { message } from 'ant-design-vue'

const IMG_BED_KEY = 'openrouter-imgbed-config'

export function useImgBed() {
  // Modal control
  const showImgBedModal = ref(false)

  // Configuration state
  const useImgBed = ref(false)
  const imgBedEndpoint = ref('')
  const imgBedAuthCode = ref('')
  const imgBedUploadChannel = ref('telegram')
  const imgBedServerCompress = ref(true)
  const imgBedAutoRetry = ref(true)
  const imgBedUploadNameType = ref('default')
  const imgBedReturnFormat = ref('default')
  const imgBedUploadFolder = ref('')

  const saveImgBedConfig = () => {
    try {
      const cfg = {
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
      localStorage.setItem(IMG_BED_KEY, JSON.stringify(cfg))
    } catch (e) {
      console.error('保存 ImgBed 配置失败', e)
      message.error('保存 ImgBed 配置失败')
    }
  }

  const loadImgBedConfig = () => {
    try {
      const raw = localStorage.getItem(IMG_BED_KEY)
      if (!raw) return
      const cfg = JSON.parse(raw)
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
    } catch (e) {
      console.error('加载 ImgBed 配置失败', e)
    }
  }

  const handleSaveAndCloseImgBedModal = () => {
    saveImgBedConfig()
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
      saveImgBedConfig()
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
    saveImgBedConfig: handleSaveAndCloseImgBedModal, // Rename for clarity in component
    closeImgBedModal: () => {
      showImgBedModal.value = false
    },
  }
}
