/** Upload transport only: never try another tab after an ambiguous/accepted request. */
export async function uploadNativeViaTab(origin: string, options: Record<string, unknown>) {
  const api = globalThis.chrome
  if (!api?.tabs?.query || !api.tabs.sendMessage) {
    throw new Error('后台原生上传需要浏览器扩展的标签页权限')
  }
  const tabs = (await api.tabs.query({ url: origin + '/*' }))
    .filter(tab => {
      try {
        return tab.id !== undefined && new URL(tab.url || '').origin === origin
      } catch {
        return false
      }
    })
    .sort((a, b) => Number(b.active) - Number(a.active))
  if (!tabs.length) throw new Error('请先打开并登录 ' + origin + '，然后打开帖子编辑器')
  for (const tab of tabs) {
    if (tab.id === undefined) continue
    // Only explicit "unavailable before acceptance" permits trying another tab.
    const response = await api.tabs.sendMessage(tab.id, {
      type: 'PAGE_UPLOAD',
      options: { ...options, nativeUpload: true }
    })
    if (response?.data?.nativeUnavailable) continue
    if (!response?.success) throw new Error(response?.error || '论坛原生上传失败')
    return response
  }
  throw new Error('论坛原生上传器尚未就绪，请在 ' + origin + ' 打开帖子编辑器后重试')
}
