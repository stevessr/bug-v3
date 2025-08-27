import { ref } from 'vue'
import { message } from 'ant-design-vue'
import { useImgBed } from './useImgBed'

// Helper function to convert a file to a data URL
const fileToDataUrl = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export function useFileUpload() {
  // Get the stateful ImgBed config
  const imgBedConfig = useImgBed()

  // Image Preview / Upload state
  const showImagePreview = ref(false)
  const previewImageUrl = ref('')
  const imageUrlInput = ref('')
  const fileList = ref<Array<any>>([])
  const pendingImages = ref<any[]>([]) // Kept for legacy test compatibility

  const previewImage = (url: string) => {
    previewImageUrl.value = url
    showImagePreview.value = true
  }

  const downloadImage = () => {
    const a = document.createElement('a')
    a.href = previewImageUrl.value
    a.download = `openrouter-image-${Date.now()}.png`
    a.click()
  }

  const addImageUrl = () => {
    const raw = imageUrlInput.value.trim()
    if (!raw) return
    const url =
      raw.startsWith('data:') || raw.startsWith('http') ? raw : `data:image/png;base64,${raw}`
    const item = { uid: `${Date.now()}`, name: 'pasted.png', status: 'done', url }
    
    const exists = fileList.value.find((f) => f.url === url || f.preview === url)
    if (!exists) {
      fileList.value.push(item)
    }
    
    const pendingExists = pendingImages.value.find((p) => p.image_url?.url === url)
    if (!pendingExists) {
      pendingImages.value.push({ type: 'image_url', image_url: { url } })
    }
    imageUrlInput.value = ''
  }

  const remoteUpload = async (file: File) => {
    if (!imgBedConfig.imgBedEndpoint.value) throw new Error('ImgBed endpoint 未配置')
    const params = new URLSearchParams()
    if (imgBedConfig.imgBedAuthCode.value) params.set('authCode', imgBedConfig.imgBedAuthCode.value)
    params.set('serverCompress', String(imgBedConfig.imgBedServerCompress.value))
    params.set('uploadChannel', imgBedConfig.imgBedUploadChannel.value)
    params.set('autoRetry', String(imgBedConfig.imgBedAutoRetry.value))
    params.set('uploadNameType', imgBedConfig.imgBedUploadNameType.value)
    params.set('returnFormat', imgBedConfig.imgBedReturnFormat.value)
    if (imgBedConfig.imgBedUploadFolder.value) params.set('uploadFolder', imgBedConfig.imgBedUploadFolder.value)

    const uploadUrl =
      imgBedConfig.imgBedEndpoint.value + (imgBedConfig.imgBedEndpoint.value.includes('?') ? '&' : '?') + params.toString()

    const fd = new FormData()
    fd.append('file', file)

    const resp = await fetch(uploadUrl, { method: 'POST', body: fd })
    if (!resp.ok) throw new Error(`上传失败: ${resp.status}`)
    const data = await resp.json()
    const src = Array.isArray(data) && data[0] && data[0].src ? data[0].src : null
    if (!src) throw new Error('返回格式不正确')
    try {
      return new URL(src, imgBedConfig.imgBedEndpoint.value).href
    } catch (e) {
      return imgBedConfig.imgBedEndpoint.value.replace(/\/upload\/?$/, '') + src
    }
  }

  const uploadBefore = async (file: File) => {
    const findExistingIndex = () => fileList.value.findIndex((f) => f.originFileObj === file || (f.name === file.name && f.size === file.size))

    if (imgBedConfig.useImgBed.value) {
      if (!imgBedConfig.imgBedEndpoint.value) {
        message.error('ImgBed endpoint 未配置，请先配置 ImgBed 设置')
        return false
      }
      const existingIdx = findExistingIndex()
      if (existingIdx === -1) {
        fileList.value.push({ uid: `${Date.now()}-${file.name}`, name: file.name, status: 'uploading', originFileObj: file })
      } else {
        fileList.value[existingIdx].status = 'uploading'
      }

      try {
        const url = await remoteUpload(file)
        const idxToUpdate = findExistingIndex()
        if (idxToUpdate !== -1) {
          fileList.value[idxToUpdate].status = 'done'
          fileList.value[idxToUpdate].url = url
        }
        if (!pendingImages.value.find((p) => p.image_url?.url === url)) {
          pendingImages.value.push({ type: 'image_url', image_url: { url } })
        }
        message.success(`图片已上传到 ImgBed: ${file.name}`)
      } catch (err) {
        const idxToUpdate = findExistingIndex()
        if (idxToUpdate !== -1) {
          fileList.value[idxToUpdate].status = 'error'
          fileList.value[idxToUpdate].response = String(err instanceof Error ? err.message : err)
        }
        message.error(`ImgBed 上传失败: ${err instanceof Error ? err.message : String(err)}`)
        return false
      }
      return false
    }

    // Local dataURL branch
    const dataUrl = await fileToDataUrl(file)
    const existingIdx = findExistingIndex()
    if (existingIdx === -1) {
      fileList.value.push({ uid: `${Date.now()}-${file.name}`, name: file.name, status: 'done', url: dataUrl, originFileObj: file })
    } else {
      fileList.value[existingIdx].status = 'done'
      fileList.value[existingIdx].url = dataUrl
      fileList.value[existingIdx].originFileObj = file
    }
    if (!pendingImages.value.find((p) => p.image_url?.url === dataUrl)) {
      pendingImages.value.push({ type: 'image_url', image_url: { url: dataUrl } })
    }
    return false
  }

  const handleUploadChange = (info: any) => {
    const remoteList: any[] = info.fileList || []
    fileList.value = remoteList
      .filter((f) => f.url || f.thumbUrl || f.preview)
      .map((f) => ({
        uid: f.uid,
        name: f.name,
        status: f.status,
        url: f.url || f.thumbUrl || f.preview,
        originFileObj: f.originFileObj || f.raw || null,
      }))
    pendingImages.value = fileList.value.map((entry) => ({
      type: 'image_url',
      image_url: { url: entry.url }
    }))
  }

  const handleUploadPreview = async (file: any) => {
    if (!file.url && !file.preview && file.originFileObj) {
      file.preview = await fileToDataUrl(file.originFileObj)
    }
    previewImage(file.url || file.preview)
  }

  const handleRemove = (file: any) => {
    const idx = fileList.value.findIndex((f) => f.uid === file.uid)
    if (idx !== -1) fileList.value.splice(idx, 1)
    const url = file.url || file.preview
    const pidx = pendingImages.value.findIndex((p) => p.image_url?.url === url)
    if (pidx !== -1) pendingImages.value.splice(pidx, 1)
  }

  return {
    showImagePreview,
    previewImageUrl,
    imageUrlInput,
    fileList,
    pendingImages,
    previewImage,
    downloadImage,
    addImageUrl,
    uploadBefore,
    handleUploadChange,
    handleUploadPreview,
    handleRemove,
  }
}
