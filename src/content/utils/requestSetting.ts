// Helper to request a single setting from the background (by key).
// Returns the value for the key, or null if unavailable.
export function requestSettingFromBackground(key: string): Promise<any> {
  return new Promise(resolve => {
    try {
      const chromeAPI = (window as any).chrome
      if (chromeAPI && chromeAPI.runtime && chromeAPI.runtime.sendMessage) {
        chromeAPI.runtime.sendMessage({ type: 'GET_EMOJI_SETTING', key }, (resp: any) => {
          if (
            resp &&
            resp.success &&
            resp.data &&
            Object.prototype.hasOwnProperty.call(resp.data, 'value')
          ) {
            resolve(resp.data.value)
          } else {
            resolve(null)
          }
        })
      } else {
        resolve(null)
      }
    } catch (e) {
      void e
      resolve(null)
    }
  })
}
