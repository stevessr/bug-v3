// Polyfills for jsdom test environment
// matchMedia
if (typeof window.matchMedia !== 'function') {
  // @ts-ignore
  window.matchMedia = function (query: string) {
    return {
      matches: false,
      media: query,
      onchange: null,
      addListener: function () {},
      removeListener: function () {},
      addEventListener: function () {},
      removeEventListener: function () {},
      dispatchEvent: function () {
        return false
      },
    }
  }
}

// FileReader for reading File into data URL
// @ts-ignore
if (typeof global.FileReader === 'undefined') {
  // @ts-ignore
  global.FileReader = class {
    result: string | null = null
    onload: (() => void) | null = null
    onerror: (() => void) | null = null
    readAsDataURL(file: any) {
      file
        .arrayBuffer()
        .then((buf: ArrayBuffer) => {
          const u8 = new Uint8Array(buf)
          // @ts-ignore
          const b64 = Buffer.from(u8).toString('base64')
          this.result = `data:${file.type};base64,${b64}`
          this.onload && this.onload()
        })
        .catch((err: any) => {
          this.onerror && this.onerror()
        })
    }
  }
}
